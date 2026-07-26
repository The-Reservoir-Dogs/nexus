export const dynamic = "force-dynamic";
import { promises as fs } from "node:fs";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ok, fail } from "@/lib/types";
import path from "node:path";
import { localWavPath, persistNarration } from "@/lib/storage";
import { agentJsonHeaders } from "@/lib/agent";

const GEMINI_MODELS_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const TTS_SAMPLE_RATE = 24000;

function wavFromPcm(pcm: Buffer, sampleRate = TTS_SAMPLE_RATE): Buffer {
  const dataSize = pcm.length;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  pcm.copy(buf, 44);
  return buf;
}

function fallbackWav(seconds = 2): Buffer {
  const samples = TTS_SAMPLE_RATE * seconds;
  const pcm = Buffer.alloc(samples * 2);
  // Quiet warm tone placeholder for local/dev when all TTS backends are unavailable.
  for (let i = 0; i < samples; i++) {
    const amp = Math.sin((i / TTS_SAMPLE_RATE) * Math.PI * 2 * 220) * 900;
    pcm.writeInt16LE(Math.round(amp), i * 2);
  }
  return wavFromPcm(pcm);
}

type GeminiTtsResult = { bytes: Buffer; durationMs: number };

async function renderGeminiNarration(input: { title: string; content: string }): Promise<GeminiTtsResult | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  const model = process.env.TTS_MODEL ?? "gemini-2.5-flash-preview-tts";
  const limit = Number(process.env.NARRATION_CHAR_LIMIT ?? 3200);
  const story = input.content.replace(/^TITLE:\s.*$/im, "").trim().slice(0, limit);
  if (!story) throw new Error("episode has no content to narrate");

  const prompt =
    "Read this as a cinematic Pocket FM style audio drama narration. " +
    "Use natural emotion, suspenseful pauses, careful pacing, and a curious storyteller voice. " +
    "Slow down at tense moments, soften for grief, sharpen for danger, and respect commas, em dashes, ellipses, and paragraph breaks. " +
    "Do not add commentary. Narrate only the story.\n\n" +
    `Title: ${input.title}\n\n${story}`;

  const res = await fetch(`${GEMINI_MODELS_URL}/${model}:generateContent?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: process.env.TTS_VOICE ?? "Charon" } },
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`Gemini TTS failed: ${res.status} ${await res.text().catch(() => "")}`);
  const json = await res.json();
  const part = json?.candidates?.[0]?.content?.parts?.find((p: any) => p?.inlineData?.data);
  const b64 = part?.inlineData?.data;
  if (!b64) throw new Error("Gemini TTS returned no audio data");
  const pcm = Buffer.from(b64, "base64");
  const bytes = wavFromPcm(pcm);
  return { bytes, durationMs: Math.round((pcm.length / 2 / TTS_SAMPLE_RATE) * 1000) };
}

// Generate multi-voice narration for an episode.
//
// TTS (python + Gemini) runs in the AGENT service (the web container is Node-only in
// prod). We POST the episode id to the agent's /narrate, receive the rendered .wav
// bytes, then persist it to durable storage (UC Volume in prod, local public/ in dev)
// and record audio_url on the episode. The web backend owns the DB write.

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const id = params.id;

  // Only the series author or the branch co-author can render narration.
  const me = await getCurrentUser();
  const owner = await query<{ authorId: string; coAuthorId: string | null }>(
    `SELECT s.author_id::text AS "authorId", e.co_author_id::text AS "coAuthorId"
       FROM episodes e JOIN series s ON s.id = e.series_id WHERE e.id = $1`,
    [id]
  );
  if (!owner.length) return fail("NOT_FOUND", "Episode not found", 404);
  if (owner[0].authorId !== me.id && owner[0].coAuthorId !== me.id) {
    return fail("FORBIDDEN", "Only the author or co-author can generate narration", 403);
  }

  const episodeRows = await query<{ title: string; content: string }>(
    `SELECT title, content FROM episodes WHERE id = $1 LIMIT 1`,
    [id]
  );
  const episode = episodeRows[0];
  if (!episode) return fail("NOT_FOUND", "Episode not found", 404);

  const agentUrl = process.env.AGENT_URL;
  const allowDevFallback = process.env.NODE_ENV !== "production" || process.env.DEMO_TTS_FALLBACK === "1";

  // 1) Prefer the Python agent (multi-voice pipeline). If unavailable, render directly
  // from this web route with GEMINI_API_KEY. This fixes deployments where AGENT_URL is
  // absent/broken but Gemini outbound works (Render/Vercel/local).
  let durationMs: number | null = null;
  let bytes: Buffer | null = null;
  let lastError = "";

  if (agentUrl) {
    try {
      const res = await fetch(`${agentUrl}/narrate`, {
        method: "POST",
        headers: agentJsonHeaders(),
        body: JSON.stringify({ episodeId: id }),
      });
      if (res.ok) {
        durationMs = Number(res.headers.get("X-Duration-Ms") ?? 0) || null;
        bytes = Buffer.from(await res.arrayBuffer());
      } else {
        let detail = `${res.status}`;
        try {
          const j = await res.json();
          detail = j?.detail ?? j?.error?.message ?? detail;
        } catch {
          detail = await res.text().catch(() => detail);
        }
        lastError = `Agent narration failed: ${detail}`;
      }
    } catch (e: any) {
      lastError = `Agent unreachable: ${e?.message ?? e}`;
    }
  } else {
    lastError = "AGENT_URL not configured";
  }

  if (!bytes?.length) {
    try {
      const rendered = await renderGeminiNarration(episode);
      if (rendered) {
        bytes = rendered.bytes;
        durationMs = rendered.durationMs;
      } else {
        lastError = `${lastError}; GEMINI_API_KEY not configured`;
      }
    } catch (e: any) {
      lastError = `${lastError}; ${e?.message ?? e}`;
    }
  }

  if (!bytes?.length && allowDevFallback) {
    bytes = fallbackWav();
    durationMs = 2000;
  }

  if (!bytes?.length) {
    return fail("SERVER_ERROR", `Narration failed: ${lastError || "no audio produced"}`, 500);
  }

  // 2) Persist: write locally first, then upload to the Volume (prod) or serve locally (dev).
  let audioUrl: string;
  try {
    const wav = localWavPath(id);
    await fs.mkdir(path.dirname(wav), { recursive: true }); // /tmp in Volume mode (serverless-safe)
    await fs.writeFile(wav, bytes);
    audioUrl = await persistNarration(id, wav);
  } catch (e: any) {
    return fail("SERVER_ERROR", `Narration store failed: ${e?.message ?? e}`, 500);
  }

  // 3) Record it on the episode (web owns writes).
  try {
    await query(
      `UPDATE episodes SET audio_url = $2, audio_duration_ms = COALESCE($3, audio_duration_ms), updated_at = now() WHERE id = $1`,
      [id, audioUrl, durationMs]
    );
  } catch {
    /* serving the file is enough even if the persist fails */
  }

  return ok({ audioUrl, durationMs: durationMs ?? 0 });
}

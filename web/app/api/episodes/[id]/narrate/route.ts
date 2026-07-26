export const dynamic = "force-dynamic";
import { promises as fs } from "node:fs";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ok, fail } from "@/lib/types";
import path from "node:path";
import { localWavPath, persistNarration } from "@/lib/storage";

function fallbackWav(seconds = 2): Buffer {
  const sampleRate = 24000;
  const samples = sampleRate * seconds;
  const dataSize = samples * 2;
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
  // Quiet warm tone placeholder for local/dev when agent TTS is unavailable.
  for (let i = 0; i < samples; i++) {
    const amp = Math.sin((i / sampleRate) * Math.PI * 2 * 220) * 900;
    buf.writeInt16LE(Math.round(amp), 44 + i * 2);
  }
  return buf;
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

  const agentUrl = process.env.AGENT_URL;
  const allowDevFallback = process.env.NODE_ENV !== "production";

  // 1) Ask the agent to render the wav. In local/dev, fall back to a small playable
  // WAV so the UI/storage/player loop remains demoable even when AGENT_URL/TTS is absent.
  let durationMs: number | null = null;
  let bytes: Buffer | null = null;
  if (!agentUrl && allowDevFallback) {
    bytes = fallbackWav();
    durationMs = 2000;
  } else if (!agentUrl) {
    return fail("SERVER_ERROR", "AGENT_URL not configured", 500);
  } else {
    let res: Response;
    try {
      res = await fetch(`${agentUrl}/narrate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episodeId: id }),
      });
    } catch (e: any) {
      if (!allowDevFallback) return fail("SERVER_ERROR", `Agent unreachable: ${e?.message ?? e}`, 502);
      bytes = fallbackWav();
      durationMs = 2000;
      res = null as any;
    }
    if (res) {
      if (!res.ok) {
        let detail = `${res.status}`;
        try {
          const j = await res.json();
          detail = j?.detail ?? j?.error?.message ?? detail;
        } catch {
          /* non-JSON */
        }
        if (!allowDevFallback) return fail("SERVER_ERROR", `Narration failed: ${detail}`, 500);
        bytes = fallbackWav();
        durationMs = 2000;
      } else {
        durationMs = Number(res.headers.get("X-Duration-Ms") ?? 0) || null;
        bytes = Buffer.from(await res.arrayBuffer());
      }
    }
  }
  if (!bytes?.length) return fail("SERVER_ERROR", "Narration returned no audio", 500);

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

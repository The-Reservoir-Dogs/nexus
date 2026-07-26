// Durable storage for rendered narration audio.
//
// Databricks Apps run on an ephemeral container filesystem: anything written to
// web/public is lost on redeploy/restart and isn't shared across replicas. So for
// production we persist the .wav to a Unity Catalog Volume (S3/ADLS/GCS-backed) via
// the Databricks Files API, and stream it back through /api/episodes/[id]/audio.
//
// Config (env):
//   NARRATION_VOLUME = /Volumes/<catalog>/<schema>/<volume>   (enables UC Volume mode)
//   DATABRICKS_HOST, DATABRICKS_TOKEN                          (app SP token or PAT)
//
// If NARRATION_VOLUME is unset (local dev), we fall back to web/public/narration and
// serve the file statically at /narration/ep<id>.wav.

import { promises as fs, createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import os from "node:os";

// Local-mode (dev) static dir, served at /narration/ep<id>.wav.
export const LOCAL_DIR = path.join(process.cwd(), "public", "narration");

// Where the renderer stages the wav before (maybe) uploading. In Volume mode the
// copy is transient, so use a writable temp dir — serverless hosts (Vercel) have a
// READ-ONLY app filesystem and only /tmp is writable. Local dev stages in public/.
export function stagingDir(): string {
  return volumeRoot() ? path.join(os.tmpdir(), "nexus-narration") : LOCAL_DIR;
}

export function volumeRoot(): string | null {
  const v = process.env.NARRATION_VOLUME?.trim();
  return v ? v.replace(/\/+$/, "") : null;
}

/** Where the renderer should write the wav locally before we (maybe) upload it. */
export function localWavPath(id: string): string {
  return path.join(stagingDir(), `ep${id}.wav`);
}

function filesApiUrl(volumePath: string): string {
  const host = process.env.DATABRICKS_HOST?.replace(/\/+$/, "");
  if (!host) throw new Error("DATABRICKS_HOST not set for Files API");
  // path segments must be encoded but slashes kept
  const encoded = volumePath.split("/").map(encodeURIComponent).join("/");
  return `${host}/api/2.0/fs/files${encoded.startsWith("/") ? "" : "/"}${encoded}`;
}

function authHeader(): string {
  const token = process.env.DATABRICKS_TOKEN;
  if (!token) throw new Error("DATABRICKS_TOKEN not set for Files API");
  return `Bearer ${token}`;
}

/**
 * Persist a locally-rendered wav to durable storage.
 * @returns the audio_url to store on the episode (an app route in volume mode, or a
 *          static /narration path in local mode).
 */
export async function persistNarration(id: string, localPath: string): Promise<string> {
  const root = volumeRoot();
  if (!root) {
    // Local mode: the file already sits in web/public/narration — serve it directly.
    return `/narration/ep${id}.wav`;
  }
  const volPath = `${root}/ep${id}.wav`;
  const body = await fs.readFile(localPath);
  const res = await fetch(`${filesApiUrl(volPath)}?overwrite=true`, {
    method: "PUT",
    headers: { Authorization: authHeader(), "Content-Type": "application/octet-stream" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Volume upload failed: ${res.status} ${await res.text().catch(() => "")}`);
  }
  // Clean up the local copy so the container disk doesn't fill up.
  await fs.rm(localPath, { force: true }).catch(() => {});
  // Served through our streaming route (Volumes aren't public URLs).
  return `/api/episodes/${id}/audio`;
}

export type AudioSource =
  | { kind: "local"; size: number; stream: (start?: number, end?: number) => NodeJS.ReadableStream }
  | { kind: "remote"; upstream: (range: string | null) => Promise<Response> };

/** Open the stored narration for streaming back to the browser (supports Range). */
export function openNarration(id: string): AudioSource | null {
  const root = volumeRoot();
  if (!root) {
    const p = localWavPath(id);
    if (!existsSync(p)) return null;
    const size = statSync(p).size;
    return {
      kind: "local",
      size,
      stream: (start = 0, end = size - 1) => createReadStream(p, { start, end }),
    };
  }
  const volPath = `${root}/ep${id}.wav`;
  return {
    kind: "remote",
    upstream: (range) =>
      fetch(filesApiUrl(volPath), {
        headers: {
          Authorization: authHeader(),
          ...(range ? { Range: range } : {}),
        },
      }),
  };
}

export const dynamic = "force-dynamic";
import { Readable } from "node:stream";
import { openNarration } from "@/lib/storage";

// Stream stored narration back to the browser. In UC Volume mode the .wav lives in
// object storage (not a public URL), so we proxy it here with HTTP Range support so
// the <audio> element can seek.

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const src = openNarration(params.id);
  if (!src) return new Response("Not found", { status: 404 });

  const range = req.headers.get("range");

  // Local file: serve with Range ourselves.
  if (src.kind === "local") {
    const size = src.size;
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      const start = m && m[1] ? parseInt(m[1], 10) : 0;
      const end = m && m[2] ? parseInt(m[2], 10) : size - 1;
      if (start >= size || end >= size || start > end) {
        return new Response("Range Not Satisfiable", {
          status: 416,
          headers: { "Content-Range": `bytes */${size}` },
        });
      }
      const nodeStream = src.stream(start, end);
      return new Response(Readable.toWeb(nodeStream as Readable) as ReadableStream, {
        status: 206,
        headers: {
          "Content-Type": "audio/wav",
          "Content-Length": String(end - start + 1),
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "private, max-age=3600",
        },
      });
    }
    const nodeStream = src.stream();
    return new Response(Readable.toWeb(nodeStream as Readable) as ReadableStream, {
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": String(size),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  // Remote (UC Volume): forward the Range to the Files API and pass the body through.
  const upstream = await src.upstream(range);
  if (!upstream.ok || !upstream.body) {
    return new Response("Not found", { status: upstream.status === 404 ? 404 : 502 });
  }
  const headers = new Headers();
  headers.set("Content-Type", "audio/wav");
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, max-age=3600");
  for (const h of ["content-length", "content-range"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}

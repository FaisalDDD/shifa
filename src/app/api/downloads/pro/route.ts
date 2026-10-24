import "server-only";
import { open } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { errorResponse } from "@/lib/api";
import { getProRelease, proReleaseDirectory } from "@/services/pharmacy-portal/pro-release";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public installer distribution; never accepts a filename/path from the caller. */
export async function GET() {
  const release = await getProRelease();
  if (!release) return errorResponse(503, "release_unavailable", "The Windows installer is not available on this server. Please contact support.");
  try {
    const file = await open(path.join(proReleaseDirectory(), release.filename), "r");
    const stream = file.createReadStream({ autoClose: true });
    return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${release.filename}"`,
        "Content-Length": String(release.sizeBytes),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return errorResponse(503, "release_unavailable", "The Windows installer is temporarily unavailable. Please try again or contact support.");
  }
}

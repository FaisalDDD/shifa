import "server-only";
import { lstat, readdir, realpath } from "node:fs/promises";
import path from "node:path";

export interface ProRelease {
  filename: string;
  version: string;
  sizeBytes: number;
  downloadUrl: string;
}

// No request parameter or environment variable can choose a filesystem path.
export function proReleaseDirectory() {
  return path.resolve(process.cwd(), "pro", "release");
}

export async function getProRelease(): Promise<ProRelease | null> {
  // Hosted release (GitHub Releases / CDN) — the source of truth on Vercel,
  // where the local pro/release directory is not deployed.
  const hostedUrl = process.env.SHIFA_PRO_DOWNLOAD_URL;
  if (hostedUrl) {
    const filename = hostedUrl.split("/").pop() ?? "Shifa Pro Setup.exe";
    const version = (hostedUrl.match(/(\d+\.\d+\.\d+)/) ?? [])[1] ?? "latest";
    return { filename, version, sizeBytes: 0, downloadUrl: hostedUrl };
  }

  try {
    const directory = proReleaseDirectory();
    const canonicalDirectory = await realpath(directory);
    const candidates = (await readdir(directory)).flatMap((filename) => {
      const match = /^Shifa Pro Setup (\d+\.\d+\.\d+)\.exe$/.exec(filename);
      return match ? [{ filename, version: match[1] }] : [];
    }).sort((a, b) => b.version.localeCompare(a.version, "en", { numeric: true }));
    for (const candidate of candidates) {
      const filePath = path.join(directory, candidate.filename);
      const info = await lstat(filePath);
      if (!info.isFile() || info.isSymbolicLink() || info.size === 0) continue;
      if (path.dirname(await realpath(filePath)) !== canonicalDirectory) continue;
      return { ...candidate, sizeBytes: info.size, downloadUrl: "/api/downloads/pro" };
    }
    return null;
  } catch {
    // Missing or unreadable release storage is genuinely unavailable, not a fake link.
    return null;
  }
}

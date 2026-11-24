/**
 * post-x-promote-make-your-own-bounty-01 — entry program.
 *
 * Job: copy POST.json (repo root) into the output directory.
 *
 * Implementation choice — deliberation:
 *  1. copyFileSync: one stdlib call, byte-exact, synchronous and
 *     deterministic. No partial-write window worth worrying about
 *     for a tiny JSON file.
 *  2. read + JSON.parse + write: lets us validate the payload, but
 *     if we re-stringify we risk reformatting the bytes; writing the
 *     original text back avoids that, at the cost of more moving parts.
 *  3. Stream copy (createReadStream/pipe): built for large files.
 *     Here it adds async plumbing and failure modes for zero gain.
 *
 * Decision: approach (1), plus a cheap validation pass borrowed from
 * (2). POST.json IS validated before copying — it is parsed and its
 * `url` field is checked — because a malformed payload would fail
 * the bounty check anyway, and failing loudly here is kinder than
 * silently copying garbage. Validation never mutates the file: the
 * copy itself stays byte-for-byte via copyFileSync.
 *
 * Constraints honoured: Node 22 standard library only, no network,
 * no external packages, same input always yields the same output.
 */

import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Resolve POST.json relative to this file, not the caller's cwd,
// so the program works no matter where it is invoked from.
const here = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(here, "POST.json");

// Destination: MAKEFUN_OUTPUT_DIR when set, /output otherwise.
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
const destPath = join(outputDir, "POST.json");

// Validate before copying: parse the JSON and require an https url.
// Returns the validated url so callers never re-read the raw value.
function readValidatedUrl(path: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new Error(`POST.json at ${path} is not valid JSON`);
  }
  const url = (parsed as { url?: unknown } | null)?.url;
  if (typeof parsed !== "object" || parsed === null || typeof url !== "string" || !url.startsWith("https://")) {
    throw new Error(
      `POST.json at ${path} must be an object like {"url": "https://..."} — got an invalid \`url\` field`,
    );
  }
  return url;
}

function main(): void {
  readValidatedUrl(sourcePath);

  // Create the output directory (recursively) and copy byte-for-byte.
  mkdirSync(outputDir, { recursive: true });
  copyFileSync(sourcePath, destPath);

  console.log(`Copied ${sourcePath} -> ${destPath}`);
}

main();

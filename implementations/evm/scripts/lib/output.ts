import fs from "node:fs";
import path from "node:path";

export function ensureDirectory(directory: string) {
  const resolved = path.resolve(directory);
  fs.mkdirSync(resolved, { recursive: true });
  return resolved;
}

export function timestampSlug(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

export function writeJson(outputPath: string, payload: unknown) {
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
}

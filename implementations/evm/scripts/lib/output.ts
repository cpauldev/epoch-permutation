import fs from "node:fs";
import path from "node:path";

export function ensureDirectory(directory: string) {
  const resolved = path.resolve(directory);
  fs.mkdirSync(resolved, { recursive: true });
  return resolved;
}

export function ensureOutputPath(outputPath: string) {
  const resolved = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  return resolved;
}

export function timestampSlug(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

export function buildTimestampedOutputPath(
  prefix: string,
  extension = ".json",
) {
  return path.join("results", `${prefix}-${timestampSlug()}${extension}`);
}

export function writeJson(outputPath: string, payload: unknown) {
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
}

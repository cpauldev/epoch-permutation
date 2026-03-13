const fs = require("node:fs");
const path = require("node:path");

function ensureOutputPath(outputPath) {
  const resolved = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  return resolved;
}

function timestampSlug(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function buildTimestampedOutputPath(prefix, options = {}) {
  const {
    directory = "results",
    extension = ".json",
    date = new Date(),
  } = options;

  return path.join(directory, `${prefix}-${timestampSlug(date)}${extension}`);
}

function writeJson(outputPath, payload) {
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
}

module.exports = {
  buildTimestampedOutputPath,
  ensureOutputPath,
  writeJson,
};

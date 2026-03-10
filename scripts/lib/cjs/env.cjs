const path = require("node:path");

function getEnvPath(env) {
  if (typeof env.PATH === "string") {
    return env.PATH;
  }

  if (typeof env.Path === "string") {
    return env.Path;
  }

  return "";
}

function setEnvPath(env, value) {
  env.PATH = value;
  env.Path = value;
}

function mergePathEntries(entries, platform = process.platform) {
  const seen = new Set();
  const merged = [];

  for (const entry of entries.flatMap((value) =>
    String(value).split(path.delimiter),
  )) {
    const trimmed = entry.trim();
    if (!trimmed) {
      continue;
    }

    const normalized = platform === "win32" ? trimmed.toLowerCase() : trimmed;
    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    merged.push(trimmed);
  }

  return merged;
}

module.exports = {
  getEnvPath,
  mergePathEntries,
  setEnvPath,
};

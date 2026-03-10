function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index++) {
    const part = argv[index];
    if (!part.startsWith("--")) {
      continue;
    }

    const separatorIndex = part.indexOf("=");
    if (separatorIndex !== -1) {
      args[part.slice(2, separatorIndex)] = part.slice(separatorIndex + 1);
      continue;
    }

    const key = part.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      index += 1;
      continue;
    }

    args[key] = "true";
  }

  return args;
}

function getConfigValue(args, keys, envKey, env = process.env) {
  for (const key of keys) {
    if (args[key] !== undefined) {
      return args[key];
    }
  }

  return env[envKey];
}

function toNumber(value, fallback) {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric value: ${value}`);
  }

  return parsed;
}

function toBoolean(value, fallback) {
  if (value === undefined) {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function toBigInt(value, fallback) {
  if (value === undefined) {
    return BigInt(fallback);
  }
  if (typeof value === "bigint") {
    return value;
  }
  if (typeof value === "number") {
    return BigInt(value);
  }
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Invalid bigint value: ${value}`);
  }

  return BigInt(value);
}

module.exports = {
  getConfigValue,
  parseArgs,
  toBigInt,
  toBoolean,
  toNumber,
};

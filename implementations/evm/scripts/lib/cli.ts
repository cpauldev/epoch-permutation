export type CliArgs = Record<string, string>;

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};

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

export function getConfigValue(
  args: CliArgs,
  keys: string[],
  envKey: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  for (const key of keys) {
    if (args[key] !== undefined) {
      return args[key];
    }
  }

  return env[envKey];
}

export function toNumber(value: string | undefined, fallback: number) {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric argument: ${value}`);
  }

  return parsed;
}

export function toBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no"].includes(normalized)) {
    return false;
  }

  return fallback;
}

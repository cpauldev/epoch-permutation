import type { AlgorithmId } from "./benchmarkTypes.js";

export function parseBoolean(value: string | undefined, fallback: boolean) {
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

export function parseNumber(value: string | undefined, fallback: number) {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric value: ${value}`);
  }

  return parsed;
}

export function parseAlgorithmList(value: string | undefined): AlgorithmId[] {
  const all: AlgorithmId[] = [
    "sequential-counter",
    "single-stage-feistel",
    "sparse-fisher-yates",
    "epoch-permutation",
  ];

  if (!value) {
    return all;
  }

  const parsed = value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean) as AlgorithmId[];

  for (const algorithm of parsed) {
    if (!all.includes(algorithm)) {
      throw new Error(`Unknown algorithm id: ${algorithm}`);
    }
  }

  return parsed;
}

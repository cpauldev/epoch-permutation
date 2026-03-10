export const DEFAULT_MAX_RANGE = 25000;
export const DEFAULT_MIN_EPOCH_SIZE = 250;
export const DEFAULT_MAX_EPOCH_SIZE = 750;
export const DEFAULT_EPOCH_ROUNDS = 1;
export const DEFAULT_GLOBAL_ROUNDS = 3;
export const DEFAULT_SEED = 1n;
export const DEFAULT_SIMULATION_SEED = DEFAULT_SEED;
export const DEFAULT_SEED_MODE = "deterministic";
export const EPOCH_SIZE_LABEL = "EPOCH_SIZE";
export const EPOCH_ROTATION_LABEL = "EPOCH_ROTATION";
export const FEISTEL_ROUND_LABEL = "FEISTEL_ROUND";
export const GLOBAL_SCRAMBLE_LABEL = "GLOBAL_SCRAMBLE";
export const RUNTIME_DEPLOYMENT_LABEL = "RUNTIME_DEPLOYMENT";
export const RUNTIME_ROTATION_LABEL = "RUNTIME_ROTATION";

export function normalizeEpochPermutationConfig({
  maxRange = DEFAULT_MAX_RANGE,
  minEpochSize = DEFAULT_MIN_EPOCH_SIZE,
  maxEpochSize = DEFAULT_MAX_EPOCH_SIZE,
  epochRounds = DEFAULT_EPOCH_ROUNDS,
  globalRounds = DEFAULT_GLOBAL_ROUNDS,
  seed = DEFAULT_SEED,
  seedMode = DEFAULT_SEED_MODE,
  runtimeContext = {},
} = {}) {
  const normalizedSeedMode = String(seedMode || DEFAULT_SEED_MODE)
    .trim()
    .toLowerCase();

  const config = {
    maxRange: maxRange || DEFAULT_MAX_RANGE,
    minEpochSize: minEpochSize || DEFAULT_MIN_EPOCH_SIZE,
    maxEpochSize: maxEpochSize || DEFAULT_MAX_EPOCH_SIZE,
    epochRounds: epochRounds || DEFAULT_EPOCH_ROUNDS,
    globalRounds: globalRounds || DEFAULT_GLOBAL_ROUNDS,
    seed: BigInt(seed),
    seedMode: normalizedSeedMode,
    runtimeContext,
  };

  if (config.maxRange <= 0) {
    throw new Error("Max range must be positive");
  }
  if (config.minEpochSize <= 0) {
    throw new Error("Min epoch size must be positive");
  }
  if (config.maxEpochSize < config.minEpochSize) {
    throw new Error("Max epoch size must be >= min");
  }
  if (!["deterministic", "runtime"].includes(config.seedMode)) {
    throw new Error(`Unsupported seed mode: ${config.seedMode}`);
  }
  if (
    config.runtimeContext === null ||
    Array.isArray(config.runtimeContext) ||
    typeof config.runtimeContext !== "object"
  ) {
    throw new Error("Runtime context must be an object");
  }

  return config;
}

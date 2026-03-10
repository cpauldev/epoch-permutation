const {
  getConfigValue,
  toBoolean,
  toNumber,
} = require("../../../../scripts/lib/cjs/args.cjs");

function buildStressConfig(rawArgs) {
  const seedModeValue = getConfigValue(
    rawArgs,
    ["seedMode", "seed-mode"],
    "EPOCH_PERMUTATION_SEED_MODE",
  );

  return {
    runs: toNumber(
      getConfigValue(rawArgs, ["runs"], "EPOCH_PERMUTATION_JS_RUNS"),
      100,
    ),
    maxRange: toNumber(
      getConfigValue(
        rawArgs,
        ["maxRange", "max-range"],
        "EPOCH_PERMUTATION_MAX_RANGE",
      ),
      25000,
    ),
    minEpochSize: toNumber(
      getConfigValue(
        rawArgs,
        ["minEpochSize", "min-epoch-size"],
        "EPOCH_PERMUTATION_MIN_EPOCH_SIZE",
      ),
      250,
    ),
    maxEpochSize: toNumber(
      getConfigValue(
        rawArgs,
        ["maxEpochSize", "max-epoch-size"],
        "EPOCH_PERMUTATION_MAX_EPOCH_SIZE",
      ),
      750,
    ),
    epochRounds: toNumber(
      getConfigValue(
        rawArgs,
        ["epochRounds", "epoch-rounds"],
        "EPOCH_PERMUTATION_EPOCH_ROUNDS",
      ),
      1,
    ),
    globalRounds: toNumber(
      getConfigValue(
        rawArgs,
        ["globalRounds", "global-rounds"],
        "EPOCH_PERMUTATION_GLOBAL_ROUNDS",
      ),
      3,
    ),
    seedMode: seedModeValue
      ? String(seedModeValue).trim().toLowerCase()
      : "deterministic",
    seedBase: toNumber(
      getConfigValue(
        rawArgs,
        ["seedBase", "seed-base"],
        "EPOCH_PERMUTATION_SEED_BASE",
      ),
      Date.now(),
    ),
    progressEvery: Math.max(
      1,
      toNumber(
        getConfigValue(
          rawArgs,
          ["progressEvery", "progress-every"],
          "EPOCH_PERMUTATION_PROGRESS_EVERY",
        ),
        100,
      ),
    ),
    stopOnFailure: toBoolean(
      getConfigValue(
        rawArgs,
        ["stopOnFailure", "stop-on-failure"],
        "EPOCH_PERMUTATION_STOP_ON_FAILURE",
      ),
      true,
    ),
  };
}

function runSingleStressTest(EpochPermutation, config, runNumber) {
  const model = new EpochPermutation({
    maxRange: config.maxRange,
    minEpochSize: config.minEpochSize,
    maxEpochSize: config.maxEpochSize,
    epochRounds: config.epochRounds,
    globalRounds: config.globalRounds,
    seedMode: config.seedMode,
    seed: BigInt(config.seedBase) + BigInt(runNumber),
  });
  const seen = new Set();

  for (
    let sequenceIndex = 0;
    sequenceIndex < config.maxRange;
    sequenceIndex++
  ) {
    const value = model.getNext();
    if (seen.has(value)) {
      return {
        success: false,
        runNumber,
        failure: {
          sequenceIndex,
          duplicateValue: value,
        },
        config: {
          epochSize: model.EPOCH_SIZE,
          globalSeed: model.GLOBAL_SEED.toString(),
          seedMode: model.SEED_MODE,
          runSeed: (BigInt(config.seedBase) + BigInt(runNumber)).toString(),
        },
      };
    }

    seen.add(value);
  }

  return {
    success: true,
    runNumber,
    config: {
      epochSize: model.EPOCH_SIZE,
      globalSeed: model.GLOBAL_SEED.toString(),
      seedMode: model.SEED_MODE,
      runSeed: (BigInt(config.seedBase) + BigInt(runNumber)).toString(),
    },
  };
}

module.exports = {
  buildStressConfig,
  runSingleStressTest,
};

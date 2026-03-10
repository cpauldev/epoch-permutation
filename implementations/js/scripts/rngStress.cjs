const { parseArgs } = require("../../../scripts/lib/cjs/args.cjs");
const {
  buildTimestampedOutputPath,
  ensureOutputPath,
  writeJson,
} = require("../../../scripts/lib/cjs/fs.cjs");
const {
  logFields,
  printSection,
  toErrorMessage,
} = require("../../../scripts/lib/cjs/logging.cjs");
const { loadEpochPermutationModule } = require("./lib/moduleLoader.cjs");
const { buildStressConfig, runSingleStressTest } = require("./lib/stress.cjs");

async function main() {
  const { EpochPermutation } = await loadEpochPermutationModule();
  const rawArgs = parseArgs(process.argv.slice(2));
  const config = buildStressConfig(rawArgs);
  const outputPath = ensureOutputPath(
    rawArgs.output || buildTimestampedOutputPath("rng-stress"),
  );

  const startedAt = new Date();
  const results = [];
  let failure = null;

  printSection("stress");
  logFields([
    ["runs", config.runs],
    ["range", config.maxRange],
    ["epochs", `${config.minEpochSize}-${config.maxEpochSize}`],
    ["rounds", `epoch=${config.epochRounds}, global=${config.globalRounds}`],
    ["mode", config.seedMode],
    ["output", outputPath],
  ]);

  for (let runNumber = 1; runNumber <= config.runs; runNumber++) {
    const result = runSingleStressTest(EpochPermutation, config, runNumber);
    results.push(result);

    if (runNumber % config.progressEvery === 0 || runNumber === config.runs) {
      logFields([["completed", `${runNumber}/${config.runs}`]]);
    }

    if (!result.success) {
      failure = result;
      printSection("failure");
      logFields([
        ["run", runNumber],
        ["duplicate", result.failure.duplicateValue],
        ["sequence", result.failure.sequenceIndex],
      ]);
      if (config.stopOnFailure) {
        break;
      }
    }
  }

  const completedAt = new Date();
  const passed = results.filter((result) => result.success).length;
  const failed = results.length - passed;
  const summary = {
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: completedAt.getTime() - startedAt.getTime(),
    parameters: config,
    totals: {
      attemptedRuns: results.length,
      passedRuns: passed,
      failedRuns: failed,
    },
    firstFailure: failure,
    sampleRuns: results.slice(0, Math.min(results.length, 10)),
  };

  writeJson(outputPath, summary);

  printSection("summary");
  logFields([
    ["passed", passed],
    ["failed", failed],
    ["elapsed", `${summary.durationMs}ms`],
    ["summary", outputPath],
  ]);

  if (failure) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(toErrorMessage(error));
  process.exitCode = 1;
});

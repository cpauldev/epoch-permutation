const fs = require("node:fs");
const path = require("node:path");
const { parseArgs, toBigInt, toNumber } = require("../lib/cjs/args.cjs");
const { ensureOutputPath, writeJson } = require("../lib/cjs/fs.cjs");
const {
  logFields,
  printSection,
  toErrorMessage,
} = require("../lib/cjs/logging.cjs");
const {
  loadEpochPermutationConfigModule,
  loadEpochPermutationModule,
} = require("../../implementations/js/scripts/lib/moduleLoader.cjs");
const {
  buildEpochRows,
  buildMetadata,
  buildPoints,
} = require("../../implementations/js/scripts/lib/scatter/data.cjs");
const {
  renderScatterDetailsSvg,
} = require("../../implementations/js/scripts/lib/scatter/details.cjs");
const {
  buildScatterContext,
  renderScatterOverviewSvg,
} = require("../../implementations/js/scripts/lib/scatter/overview.cjs");

async function main() {
  const [{ EpochPermutation }, configModule] = await Promise.all([
    loadEpochPermutationModule(),
    loadEpochPermutationConfigModule(),
  ]);
  const rawArgs = parseArgs(process.argv.slice(2));
  const fixedSeed = toBigInt(rawArgs.seed, configModule.DEFAULT_SEED);
  const maxRange = toNumber(
    rawArgs["max-range"],
    configModule.DEFAULT_MAX_RANGE,
  );
  const model = new EpochPermutation({
    maxRange,
    minEpochSize: toNumber(
      rawArgs["min-epoch-size"],
      configModule.DEFAULT_MIN_EPOCH_SIZE,
    ),
    maxEpochSize: toNumber(
      rawArgs["max-epoch-size"],
      configModule.DEFAULT_MAX_EPOCH_SIZE,
    ),
    epochRounds: toNumber(
      rawArgs["epoch-rounds"],
      configModule.DEFAULT_EPOCH_ROUNDS,
    ),
    globalRounds: toNumber(
      rawArgs["global-rounds"],
      configModule.DEFAULT_GLOBAL_ROUNDS,
    ),
    seed: fixedSeed,
  });

  const epochRows = buildEpochRows(model, maxRange);
  const points = buildPoints(model, maxRange);
  const metadata = buildMetadata(model, epochRows, maxRange, fixedSeed, points);
  const context = buildScatterContext(maxRange);

  const overviewPath = ensureOutputPath(
    rawArgs.output || path.join("assets", "permutation-scatter.svg"),
  );
  const detailsPath = ensureOutputPath(
    rawArgs.details || path.join("assets", "permutation-scatter-details.svg"),
  );
  const jsonPath = ensureOutputPath(
    rawArgs.json || path.join("assets", "permutation-scatter-epochs.json"),
  );

  fs.writeFileSync(
    overviewPath,
    renderScatterOverviewSvg({ context, points, epochRows }),
  );
  fs.writeFileSync(
    detailsPath,
    renderScatterDetailsSvg({ metadata, epochRows }),
  );
  writeJson(jsonPath, {
    generatedAt: new Date().toISOString(),
    metadata,
    epochs: epochRows,
  });

  printSection("artifacts");
  logFields([
    ["overviewSvg", overviewPath],
    ["detailsSvg", detailsPath],
    ["epochMetadata", jsonPath],
  ]);
}

main().catch((error) => {
  console.error(toErrorMessage(error));
  process.exitCode = 1;
});

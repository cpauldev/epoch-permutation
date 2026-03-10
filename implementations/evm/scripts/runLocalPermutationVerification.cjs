const path = require("node:path");
const { parseArgs } = require("../../../scripts/lib/cjs/args.cjs");
const {
  exitOnCommandFailure,
  runCommand,
} = require("../../../scripts/lib/cjs/process.cjs");

const rawArgs = parseArgs(process.argv.slice(2));
const env = { ...process.env };

const mappings = {
  range: ["range", "max-range"],
  batchSize: ["batchSize", "batch-size"],
  epochMin: ["epochMin", "epoch-min"],
  epochMax: ["epochMax", "epoch-max"],
  epochRounds: ["epochRounds", "epoch-rounds"],
  globalRounds: ["globalRounds", "global-rounds"],
  outputDir: ["outputDir", "output-dir"],
};

const envKeys = {
  range: "PERM_LOCAL_RANGE",
  batchSize: "PERM_LOCAL_BATCH_SIZE",
  epochMin: "PERM_LOCAL_EPOCH_MIN",
  epochMax: "PERM_LOCAL_EPOCH_MAX",
  epochRounds: "PERM_LOCAL_EPOCH_ROUNDS",
  globalRounds: "PERM_LOCAL_GLOBAL_ROUNDS",
  outputDir: "PERM_LOCAL_OUTPUT_DIR",
};

for (const [mappingKey, keys] of Object.entries(mappings)) {
  const key = keys.find((entry) => rawArgs[entry] !== undefined);
  if (key) {
    env[envKeys[mappingKey]] = rawArgs[key];
  }
}

const skipCompile =
  rawArgs["skip-compile"] === "true" || rawArgs.skipCompile === "true";
const hardhat = path.join(
  process.cwd(),
  "node_modules",
  ".bin",
  process.platform === "win32" ? "hardhat.cmd" : "hardhat",
);
const workflowScript =
  "implementations/evm/scripts/localPermutationVerification.ts";

if (!skipCompile) {
  exitOnCommandFailure(runCommand(hardhat, ["compile"], { env }));
}

exitOnCommandFailure(
  runCommand(hardhat, ["run", "--no-compile", workflowScript], { env }),
);

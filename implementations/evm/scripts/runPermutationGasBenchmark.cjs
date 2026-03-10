const path = require("node:path");
const { parseArgs } = require("../../../scripts/lib/cjs/args.cjs");
const {
  exitOnCommandFailure,
  runCommand,
} = require("../../../scripts/lib/cjs/process.cjs");

const rawArgs = parseArgs(process.argv.slice(2));
const env = { ...process.env };

const mappings = {
  range: "PERM_BENCH_RANGE",
  runs: "PERM_BENCH_RUNS",
  bins: "PERM_BENCH_BINS",
  algorithms: "PERM_BENCH_ALGORITHMS",
  epochMin: "PERM_BENCH_EPOCH_MIN",
  epochMax: "PERM_BENCH_EPOCH_MAX",
  epochRounds: "PERM_BENCH_EPOCH_ROUNDS",
  globalRounds: "PERM_BENCH_GLOBAL_ROUNDS",
  outputDir: "PERM_BENCH_OUTPUT_DIR",
  verifyUniqueness: "PERM_BENCH_VERIFY_UNIQUENESS",
  baseTimestamp: "PERM_BENCH_BASE_TIMESTAMP",
};

for (const [argKey, envKey] of Object.entries(mappings)) {
  if (rawArgs[argKey] !== undefined) {
    env[envKey] = rawArgs[argKey];
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
const benchmarkScript =
  "implementations/evm/scripts/benchmarkPermutationGas.ts";

if (!skipCompile) {
  exitOnCommandFailure(runCommand(hardhat, ["compile"], { env }));
}

exitOnCommandFailure(
  runCommand(hardhat, ["run", "--no-compile", benchmarkScript], { env }),
);

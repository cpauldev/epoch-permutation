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
  "epoch-min": "PERM_BENCH_EPOCH_MIN",
  "epoch-max": "PERM_BENCH_EPOCH_MAX",
  "epoch-rounds": "PERM_BENCH_EPOCH_ROUNDS",
  "global-rounds": "PERM_BENCH_GLOBAL_ROUNDS",
  "output-dir": "PERM_BENCH_OUTPUT_DIR",
  "verify-uniqueness": "PERM_BENCH_VERIFY_UNIQUENESS",
  "base-timestamp": "PERM_BENCH_BASE_TIMESTAMP",
};

for (const [argKey, envKey] of Object.entries(mappings)) {
  if (rawArgs[argKey] !== undefined) {
    env[envKey] = rawArgs[argKey];
  }
}

const skipCompile = rawArgs["skip-compile"] === "true";
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

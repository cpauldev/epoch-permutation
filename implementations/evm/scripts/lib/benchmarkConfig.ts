import { ensureDirectory } from "./output.js";
import {
  parseAlgorithmList,
  parseBoolean,
  parseNumber,
} from "./benchmarkParsing.js";
import type { BenchmarkConfig } from "./benchmarkTypes.js";

const DEFAULT_OUTPUT_DIR = "results/benchmarks";

export function loadBenchmarkConfig(
  env: NodeJS.ProcessEnv = process.env,
): BenchmarkConfig {
  return {
    range: parseNumber(env.PERM_BENCH_RANGE, 25000),
    runs: parseNumber(env.PERM_BENCH_RUNS, 5),
    bins: parseNumber(env.PERM_BENCH_BINS, 100),
    epochMinSize: parseNumber(env.PERM_BENCH_EPOCH_MIN, 250),
    epochMaxSize: parseNumber(env.PERM_BENCH_EPOCH_MAX, 750),
    epochRounds: parseNumber(env.PERM_BENCH_EPOCH_ROUNDS, 1),
    globalRounds: parseNumber(env.PERM_BENCH_GLOBAL_ROUNDS, 3),
    algorithms: parseAlgorithmList(env.PERM_BENCH_ALGORITHMS),
    outputDir: ensureDirectory(env.PERM_BENCH_OUTPUT_DIR || DEFAULT_OUTPUT_DIR),
    verifyUniqueness: parseBoolean(env.PERM_BENCH_VERIFY_UNIQUENESS, true),
    baseTimestamp: parseNumber(
      env.PERM_BENCH_BASE_TIMESTAMP,
      Math.floor(Date.now() / 1000) + 10_000,
    ),
  };
}

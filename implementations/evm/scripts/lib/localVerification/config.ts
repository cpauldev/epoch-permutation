import { parseNumber } from "../benchmarkParsing.js";
import { ensureDirectory } from "../output.js";
import type {
  LocalVerificationConfig,
  LocalVerificationRuntime,
} from "./types.js";

const DEFAULT_OUTPUT_DIR = "results/local-verification";

export function loadLocalVerificationConfig(
  env: NodeJS.ProcessEnv = process.env,
): LocalVerificationConfig {
  const range = Math.max(1, parseNumber(env.PERM_LOCAL_RANGE, 25_000));
  const epochMinSize = Math.min(
    Math.max(1, parseNumber(env.PERM_LOCAL_EPOCH_MIN, 250)),
    range,
  );
  const epochMaxSize = Math.min(
    Math.max(parseNumber(env.PERM_LOCAL_EPOCH_MAX, 750), epochMinSize),
    range,
  );

  return {
    range,
    batchSize: Math.max(1, parseNumber(env.PERM_LOCAL_BATCH_SIZE, 150)),
    epochMinSize,
    epochMaxSize,
    epochRounds: parseNumber(env.PERM_LOCAL_EPOCH_ROUNDS, 1),
    globalRounds: parseNumber(env.PERM_LOCAL_GLOBAL_ROUNDS, 3),
    outputDir: ensureDirectory(env.PERM_LOCAL_OUTPUT_DIR || DEFAULT_OUTPUT_DIR),
  };
}

export function resolveLocalVerificationRuntime(
  networkName: string,
  chainId: number,
): LocalVerificationRuntime {
  const knownNames: Record<number, string> = {
    1337: "Hardhat Local Network",
    31337: "Hardhat Local Network",
  };

  return {
    name: knownNames[chainId] || networkName,
    chainId,
  };
}

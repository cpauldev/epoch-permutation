import type { HardhatEthersHelpers } from "@nomicfoundation/hardhat-ethers/types";
import type {
  AlgorithmId,
  AlgorithmSpec,
  BenchmarkConfig,
} from "./benchmarkTypes.js";

const COLOR_MAP: Record<AlgorithmId, string> = {
  "sequential-counter": "#1f77b4",
  "single-stage-feistel": "#ff7f0e",
  "sparse-fisher-yates": "#2ca02c",
  "epoch-permutation": "#d62728",
};

export function buildAlgorithmSpecs(
  ethers: HardhatEthersHelpers,
  config: BenchmarkConfig,
): AlgorithmSpec[] {
  const effectiveEpochMin = Math.min(config.epochMinSize, config.range);
  const effectiveEpochMax = Math.min(
    Math.max(config.epochMaxSize, effectiveEpochMin),
    config.range,
  );

  const all: Record<AlgorithmId, AlgorithmSpec> = {
    "sequential-counter": {
      id: "sequential-counter",
      label: "Sequential Counter",
      color: COLOR_MAP["sequential-counter"],
      description:
        "Control baseline with no shuffling and one monotonic counter update per call.",
      deploy: async () => {
        const factory = await ethers.getContractFactory(
          "SequentialCounterPermutation",
        );
        return factory.deploy(config.range);
      },
    },
    "single-stage-feistel": {
      id: "single-stage-feistel",
      label: "Single-Stage Feistel",
      color: COLOR_MAP["single-stage-feistel"],
      description:
        "One Feistel permutation over the full range with a fixed deployment-time seed.",
      deploy: async () => {
        const factory = await ethers.getContractFactory(
          "SingleStageFeistelPermutation",
        );
        return factory.deploy(config.range, config.globalRounds);
      },
    },
    "sparse-fisher-yates": {
      id: "sparse-fisher-yates",
      label: "Sparse Fisher-Yates",
      color: COLOR_MAP["sparse-fisher-yates"],
      description:
        "Sparse swap-map draw over the remaining range; common storage-light Fisher-Yates variant.",
      deploy: async () => {
        const factory = await ethers.getContractFactory(
          "SparseFisherYatesPermutation",
        );
        return factory.deploy(config.range);
      },
    },
    "epoch-permutation": {
      id: "epoch-permutation",
      label: "Epoch Permutation",
      color: COLOR_MAP["epoch-permutation"],
      description:
        "Dual-stage Feistel structure with epoch-local seed rotation and global redistribution, benchmarked without extra auxiliary events.",
      deploy: async () => {
        const factory = await ethers.getContractFactory(
          "EpochPermutationBenchmark",
        );
        return factory.deploy(
          config.range,
          effectiveEpochMin,
          effectiveEpochMax,
          config.epochRounds,
          config.globalRounds,
        );
      },
    },
  };

  return config.algorithms.map((id) => all[id]);
}

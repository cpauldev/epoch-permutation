import type { PermutationBenchmarkBase } from "../../typechain-types/index.js";

export type AlgorithmId =
  | "sequential-counter"
  | "single-stage-feistel"
  | "sparse-fisher-yates"
  | "epoch-permutation";

export type RawObservation = {
  algorithmId: AlgorithmId;
  algorithmLabel: string;
  run: number;
  sequenceIndex: number;
  progressPercent: number;
  gasUsed: number;
  permutedValue: number;
};

export type RunSummary = {
  run: number;
  deploymentGas: number;
  totalExecutionGas: number;
  averageGas: number;
  medianGas: number;
  minGas: number;
  maxGas: number;
  firstDecileAverageGas: number;
  lastDecileAverageGas: number;
  lateToEarlyRatio: number;
};

export type SequenceSummary = {
  sequenceIndex: number;
  progressPercent: number;
  sampleCount: number;
  averageGas: number;
  medianGas: number;
  minGas: number;
  maxGas: number;
};

export type BinSummary = {
  binIndex: number;
  progressStartPercent: number;
  progressEndPercent: number;
  progressMidPercent: number;
  sampleCount: number;
  averageGas: number;
  medianGas: number;
  minGas: number;
  maxGas: number;
};

export type AlgorithmSummary = {
  id: AlgorithmId;
  label: string;
  color: string;
  description: string;
  deploymentGasAverage: number;
  deploymentGasMedian: number;
  totalExecutionGasAverage: number;
  totalExecutionGasMedian: number;
  averageGasPerCall: number;
  medianGasPerCall: number;
  minGasObserved: number;
  maxGasObserved: number;
  firstDecileAverageGas: number;
  lastDecileAverageGas: number;
  lateToEarlyRatio: number;
  firstDecileMedianGas: number;
  lastDecileMedianGas: number;
  lateToEarlyMedianRatio: number;
  peakAverageGasBinPercent: number;
  peakAverageGasBinValue: number;
  peakMedianGasBinPercent: number;
  peakMedianGasBinValue: number;
  runs: RunSummary[];
  sequenceSummaries: SequenceSummary[];
  bins: BinSummary[];
};

export type AlgorithmBenchmarkResult = {
  summary: AlgorithmSummary;
  observations: RawObservation[];
};

export type BenchmarkConfig = {
  range: number;
  runs: number;
  bins: number;
  epochMinSize: number;
  epochMaxSize: number;
  epochRounds: number;
  globalRounds: number;
  algorithms: AlgorithmId[];
  outputDir: string;
  verifyUniqueness: boolean;
  baseTimestamp: number;
};

export type AlgorithmSpec = {
  id: AlgorithmId;
  label: string;
  color: string;
  description: string;
  deploy: () => Promise<PermutationBenchmarkBase>;
};

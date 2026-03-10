import type { BaseContract } from "ethers";
import type { PermutationBatchHarness } from "../../../typechain-types/harnesses/PermutationBatchHarness.sol/PermutationBatchHarness.js";

export type LocalVerificationAlgorithmId =
  | "epoch-permutation"
  | "sparse-fisher-yates";

export type LocalVerificationConfig = {
  range: number;
  batchSize: number;
  epochMinSize: number;
  epochMaxSize: number;
  epochRounds: number;
  globalRounds: number;
  outputDir: string;
};

export type LocalVerificationRuntime = {
  name: string;
  chainId: number;
};

export type DeploymentRecord = {
  id: LocalVerificationAlgorithmId;
  label: string;
  color: string;
  description: string;
  contractName: string;
  generatorAddress: string;
  harnessAddress: string;
  generatorConstructorArgs: unknown[];
  harnessConstructorArgs: unknown[];
  generatorDeploymentTxHash: string | null;
  harnessDeploymentTxHash: string | null;
  generatorDeploymentGas: number;
  harnessDeploymentGas: number;
};

export type BatchObservation = {
  algorithmId: LocalVerificationAlgorithmId;
  algorithmLabel: string;
  batchNumber: number;
  stepsRequested: number;
  stepsExecuted: number;
  processedCount: number;
  progressPercent: number;
  gasUsed: number;
  gasPerValue: number;
  effectiveGasPriceWei: string;
  txFeeWei: string;
  txHash: string;
  duplicateCount: number;
};

export type RunStatus = {
  processedCount: number;
  duplicateCount: number;
  remainingCount: number;
  complete: boolean;
  hasDuplicates: boolean;
  firstDuplicateRecorded: boolean;
  firstDuplicateValue: number;
  firstDuplicateSequenceIndex: number;
};

export type AlgorithmSummary = {
  id: LocalVerificationAlgorithmId;
  label: string;
  color: string;
  description: string;
  deploymentGas: number;
  harnessDeploymentGas: number;
  totalDeploymentGas: number;
  batchCount: number;
  totalExecutionGas: number;
  averageGasPerBatch: number;
  medianGasPerBatch: number;
  averageGasPerValue: number;
  medianGasPerValue: number;
  firstDecileGasPerValue: number;
  lastDecileGasPerValue: number;
  lateToEarlyGasPerValueRatio: number;
  totalFeeWei: string;
  totalFeeEth: string;
  finalDuplicateCount: number;
  complete: boolean;
};

export type LocalVerificationResult = {
  generatedAt: string;
  runtime: LocalVerificationRuntime;
  config: LocalVerificationConfig;
  deployments: DeploymentRecord[];
  observations: BatchObservation[];
  statuses: Record<LocalVerificationAlgorithmId, RunStatus>;
  algorithms: AlgorithmSummary[];
};

export type DeploymentHandle = {
  spec: {
    id: LocalVerificationAlgorithmId;
    label: string;
    color: string;
    description: string;
    contractName: string;
    constructorArgs: unknown[];
    deploy: () => Promise<BaseContract>;
  };
  targetContract: BaseContract;
  harnessContract: PermutationBatchHarness;
  deployment: DeploymentRecord;
};

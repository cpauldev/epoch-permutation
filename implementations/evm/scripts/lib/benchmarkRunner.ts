import type { HardhatEthersHelpers } from "@nomicfoundation/hardhat-ethers/types";
import { getEventArgs } from "./events.js";
import {
  average,
  meanOfRuns,
  median,
  medianOfRuns,
  summarizeBins,
  summarizeRun,
  summarizeSequenceSummaries,
} from "./benchmarkStats.js";
import { logFields, printSection } from "./logging.js";
import type {
  AlgorithmBenchmarkResult,
  AlgorithmSpec,
  AlgorithmSummary,
  BenchmarkConfig,
  RawObservation,
} from "./benchmarkTypes.js";

export async function prepareRunEnvironment(
  ethers: HardhatEthersHelpers,
  config: BenchmarkConfig,
  run: number,
) {
  const latestBlock = await ethers.provider.getBlock("latest");
  const minimumTimestamp = latestBlock ? Number(latestBlock.timestamp) + 1 : 0;
  const runTimestamp = Math.max(
    config.baseTimestamp + run * 100_000,
    minimumTimestamp,
  );
  await ethers.provider.send("evm_setNextBlockTimestamp", [runTimestamp]);
  await ethers.provider.send("evm_mine", []);
}

function summarizeAlgorithm(
  config: BenchmarkConfig,
  spec: AlgorithmSpec,
  runSummaries: ReturnType<typeof summarizeRun>[],
  observations: RawObservation[],
): AlgorithmSummary {
  const sequenceSummaries = summarizeSequenceSummaries(
    config.range,
    observations,
  );
  const bins = summarizeBins(config.range, config.bins, sequenceSummaries);
  const peakAverageBin = bins.reduce(
    (best, current) => (current.averageGas > best.averageGas ? current : best),
    bins[0],
  );
  const peakMedianBin = bins.reduce(
    (best, current) => (current.medianGas > best.medianGas ? current : best),
    bins[0],
  );
  const decileSize = Math.max(1, Math.floor(sequenceSummaries.length / 10));
  const firstSequenceDecile = sequenceSummaries.slice(0, decileSize);
  const lastSequenceDecile = sequenceSummaries.slice(
    sequenceSummaries.length - decileSize,
  );
  const firstDecileAverageGas = average(
    firstSequenceDecile.map((summary) => summary.averageGas),
  );
  const lastDecileAverageGas = average(
    lastSequenceDecile.map((summary) => summary.averageGas),
  );
  const firstDecileMedianGas = median(
    firstSequenceDecile.map((summary) => summary.medianGas),
  );
  const lastDecileMedianGas = median(
    lastSequenceDecile.map((summary) => summary.medianGas),
  );

  return {
    id: spec.id,
    label: spec.label,
    color: spec.color,
    description: spec.description,
    deploymentGasAverage: meanOfRuns(runSummaries, (run) => run.deploymentGas),
    deploymentGasMedian: medianOfRuns(runSummaries, (run) => run.deploymentGas),
    totalExecutionGasAverage: meanOfRuns(
      runSummaries,
      (run) => run.totalExecutionGas,
    ),
    totalExecutionGasMedian: medianOfRuns(
      runSummaries,
      (run) => run.totalExecutionGas,
    ),
    averageGasPerCall: average(
      observations.map((observation) => observation.gasUsed),
    ),
    medianGasPerCall: median(
      observations.map((observation) => observation.gasUsed),
    ),
    minGasObserved: Math.min(...runSummaries.map((run) => run.minGas)),
    maxGasObserved: Math.max(...runSummaries.map((run) => run.maxGas)),
    firstDecileAverageGas,
    lastDecileAverageGas,
    lateToEarlyRatio:
      firstDecileAverageGas === 0
        ? 0
        : lastDecileAverageGas / firstDecileAverageGas,
    firstDecileMedianGas,
    lastDecileMedianGas,
    lateToEarlyMedianRatio:
      firstDecileMedianGas === 0
        ? 0
        : lastDecileMedianGas / firstDecileMedianGas,
    peakAverageGasBinPercent: peakAverageBin.progressMidPercent,
    peakAverageGasBinValue: peakAverageBin.averageGas,
    peakMedianGasBinPercent: peakMedianBin.progressMidPercent,
    peakMedianGasBinValue: peakMedianBin.medianGas,
    runs: runSummaries,
    sequenceSummaries,
    bins,
  };
}

export async function benchmarkAlgorithm(
  ethers: HardhatEthersHelpers,
  spec: AlgorithmSpec,
  config: BenchmarkConfig,
): Promise<AlgorithmBenchmarkResult> {
  const runSummaries = [];
  const observations: RawObservation[] = [];

  printSection(spec.label);

  for (let run = 1; run <= config.runs; run++) {
    logFields([["run", `${run}/${config.runs}`]]);

    await prepareRunEnvironment(ethers, config, run);

    const contract = await spec.deploy();
    const deploymentTx = contract.deploymentTransaction();
    const deploymentReceipt = deploymentTx ? await deploymentTx.wait() : null;
    await contract.waitForDeployment();

    const deploymentGas = deploymentReceipt
      ? Number(deploymentReceipt.gasUsed)
      : 0;
    const gasSeries: number[] = [];
    const seen = config.verifyUniqueness ? new Set<number>() : null;

    for (let sequenceIndex = 0; sequenceIndex < config.range; sequenceIndex++) {
      const tx = await contract.getNextPermutedValue();
      const receipt = await tx.wait();
      const gasUsed = Number(receipt.gasUsed);
      const args = getEventArgs(receipt, contract, "PermutationExecuted");
      const emittedSequenceIndex = Number(args[0]);
      const permutedValue = Number(args[1]);

      if (emittedSequenceIndex !== sequenceIndex) {
        throw new Error(
          `${spec.label}: sequence mismatch at ${sequenceIndex}, got ${emittedSequenceIndex}`,
        );
      }

      if (config.verifyUniqueness && seen !== null) {
        if (permutedValue < 1 || permutedValue > config.range) {
          throw new Error(
            `${spec.label}: output ${permutedValue} out of range`,
          );
        }
        if (seen.has(permutedValue)) {
          throw new Error(
            `${spec.label}: duplicate output ${permutedValue} at ${sequenceIndex}`,
          );
        }

        seen.add(permutedValue);
      }

      gasSeries.push(gasUsed);
      observations.push({
        algorithmId: spec.id,
        algorithmLabel: spec.label,
        run,
        sequenceIndex,
        progressPercent: ((sequenceIndex + 1) / config.range) * 100,
        gasUsed,
        permutedValue,
      });
    }

    runSummaries.push(summarizeRun(run, deploymentGas, gasSeries));
  }

  return {
    observations,
    summary: summarizeAlgorithm(config, spec, runSummaries, observations),
  };
}

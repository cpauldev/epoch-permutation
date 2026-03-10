import type {
  BinSummary,
  RunSummary,
  SequenceSummary,
} from "./benchmarkTypes.js";

export function average(numbers: number[]) {
  if (numbers.length === 0) {
    return 0;
  }

  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

export function median(numbers: number[]) {
  if (numbers.length === 0) {
    return 0;
  }

  const sorted = [...numbers].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

export function meanOfRuns(
  runs: RunSummary[],
  selector: (run: RunSummary) => number,
) {
  return average(runs.map(selector));
}

export function medianOfRuns(
  runs: RunSummary[],
  selector: (run: RunSummary) => number,
) {
  return median(runs.map(selector));
}

export function createBins(range: number, binCount: number) {
  return Array.from({ length: binCount }, (_, index) => {
    const start = Math.floor((index * range) / binCount);
    const end = Math.floor(((index + 1) * range) / binCount);
    return { start, end };
  });
}

export function summarizeRun(
  run: number,
  deploymentGas: number,
  gasSeries: number[],
): RunSummary {
  const decileSize = Math.max(1, Math.floor(gasSeries.length / 10));
  const firstDecileAverageGas = average(gasSeries.slice(0, decileSize));
  const lastDecileAverageGas = average(
    gasSeries.slice(gasSeries.length - decileSize),
  );

  return {
    run,
    deploymentGas,
    totalExecutionGas: gasSeries.reduce((sum, value) => sum + value, 0),
    averageGas: average(gasSeries),
    medianGas: median(gasSeries),
    minGas: Math.min(...gasSeries),
    maxGas: Math.max(...gasSeries),
    firstDecileAverageGas,
    lastDecileAverageGas,
    lateToEarlyRatio:
      firstDecileAverageGas === 0
        ? 0
        : lastDecileAverageGas / firstDecileAverageGas,
  };
}

export function summarizeSequenceSummaries(
  range: number,
  observations: { sequenceIndex: number; gasUsed: number }[],
): SequenceSummary[] {
  const buckets = Array.from({ length: range }, () => [] as number[]);

  for (const observation of observations) {
    buckets[observation.sequenceIndex].push(observation.gasUsed);
  }

  return buckets.map((values, sequenceIndex) => ({
    sequenceIndex,
    progressPercent: ((sequenceIndex + 1) / range) * 100,
    sampleCount: values.length,
    averageGas: average(values),
    medianGas: median(values),
    minGas: values.length > 0 ? Math.min(...values) : 0,
    maxGas: values.length > 0 ? Math.max(...values) : 0,
  }));
}

export function summarizeBins(
  range: number,
  binCount: number,
  sequenceSummaries: SequenceSummary[],
): BinSummary[] {
  return createBins(range, binCount).map((bin, binIndex) => {
    const members = sequenceSummaries.filter(
      (summary) =>
        summary.sequenceIndex >= bin.start && summary.sequenceIndex < bin.end,
    );

    const progressStartPercent = (bin.start / range) * 100;
    const progressEndPercent = (bin.end / range) * 100;
    const progressMidPercent = (progressStartPercent + progressEndPercent) / 2;

    return {
      binIndex,
      progressStartPercent,
      progressEndPercent,
      progressMidPercent,
      sampleCount: members.length,
      averageGas:
        members.length > 0
          ? average(members.map((member) => member.averageGas))
          : 0,
      medianGas:
        members.length > 0
          ? median(members.map((member) => member.medianGas))
          : 0,
      minGas:
        members.length > 0
          ? Math.min(...members.map((member) => member.minGas))
          : 0,
      maxGas:
        members.length > 0
          ? Math.max(...members.map((member) => member.maxGas))
          : 0,
    };
  });
}

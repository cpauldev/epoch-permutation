import fs from "node:fs";
import path from "node:path";
import { formatEther } from "ethers";
import { average, median } from "../benchmarkStats.js";
import { timestampSlug, writeJson } from "../output.js";
import type {
  AlgorithmSummary,
  BatchObservation,
  DeploymentRecord,
  LocalVerificationConfig,
  LocalVerificationResult,
  LocalVerificationRuntime,
  RunStatus,
} from "./types.js";

function summarizeAlgorithm(
  deployment: DeploymentRecord,
  observations: BatchObservation[],
  status: RunStatus,
): AlgorithmSummary {
  const batchGas = observations.map((observation) => observation.gasUsed);
  const gasPerValueSeries = observations.map(
    (observation) => observation.gasPerValue,
  );
  const decileSize = Math.max(1, Math.floor(gasPerValueSeries.length / 10));
  const firstDecileGasPerValue = average(
    gasPerValueSeries.slice(0, decileSize),
  );
  const lastDecileGasPerValue = average(
    gasPerValueSeries.slice(gasPerValueSeries.length - decileSize),
  );
  const totalFeeWei = observations.reduce(
    (sum, observation) => sum + BigInt(observation.txFeeWei),
    0n,
  );

  return {
    id: deployment.id,
    label: deployment.label,
    color: deployment.color,
    description: deployment.description,
    deploymentGas: deployment.generatorDeploymentGas,
    harnessDeploymentGas: deployment.harnessDeploymentGas,
    totalDeploymentGas:
      deployment.generatorDeploymentGas + deployment.harnessDeploymentGas,
    batchCount: observations.length,
    totalExecutionGas: batchGas.reduce((sum, value) => sum + value, 0),
    averageGasPerBatch: average(batchGas),
    medianGasPerBatch: median(batchGas),
    averageGasPerValue: average(gasPerValueSeries),
    medianGasPerValue: median(gasPerValueSeries),
    firstDecileGasPerValue,
    lastDecileGasPerValue,
    lateToEarlyGasPerValueRatio:
      firstDecileGasPerValue === 0
        ? 0
        : lastDecileGasPerValue / firstDecileGasPerValue,
    totalFeeWei: totalFeeWei.toString(),
    totalFeeEth: formatEther(totalFeeWei),
    finalDuplicateCount: status.duplicateCount,
    complete: status.complete,
  };
}

function makeChart(
  title: string,
  subtitle: string,
  algorithms: AlgorithmSummary[],
  groupedObservations: Map<string, BatchObservation[]>,
) {
  const width = 1380;
  const height = 860;
  const margin = { top: 90, right: 280, bottom: 126, left: 110 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const maxGasPerValue = Math.max(
    1,
    ...Array.from(groupedObservations.values()).flatMap((observations) =>
      observations.map((observation) => observation.gasPerValue),
    ),
  );
  const xScale = (percent: number) => margin.left + (percent / 100) * plotWidth;
  const yScale = (gasPerValue: number) =>
    margin.top + plotHeight - (gasPerValue / maxGasPerValue) * plotHeight;

  const grid = [];
  for (let tick = 0; tick <= 5; tick++) {
    const percent = tick * 20;
    const x = xScale(percent);
    grid.push(`
      <line x1="${x}" y1="${margin.top}" x2="${x}" y2="${margin.top + plotHeight}" stroke="#f1f5f9" stroke-width="1" />
      <text x="${x}" y="${margin.top + plotHeight + 28}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#475569">${percent}%</text>
    `);
  }

  for (let tick = 0; tick <= 6; tick++) {
    const value = (maxGasPerValue / 6) * tick;
    const y = yScale(value);
    grid.push(`
      <line x1="${margin.left}" y1="${y}" x2="${margin.left + plotWidth}" y2="${y}" stroke="#e5e7eb" stroke-width="1" />
      <text x="${margin.left - 14}" y="${y + 5}" text-anchor="end" font-family="Arial, sans-serif" font-size="14" fill="#475569">${value.toFixed(0)}</text>
    `);
  }

  const paths = algorithms
    .map((algorithm) => {
      const observations = groupedObservations.get(algorithm.id) || [];
      const pathData = observations
        .map((observation, index) => {
          const x = xScale(observation.progressPercent);
          const y = yScale(observation.gasPerValue);
          return `${index === 0 ? "M" : "L"} ${x} ${y}`;
        })
        .join(" ");

      return `<path d="${pathData}" fill="none" stroke="${algorithm.color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />`;
    })
    .join("\n");

  const legend = algorithms
    .map((algorithm, index) => {
      const y = margin.top + 24 + index * 74;
      return `
        <line x1="${width - 248}" y1="${y}" x2="${width - 205}" y2="${y}" stroke="${algorithm.color}" stroke-width="4" stroke-linecap="round" />
        <text x="${width - 195}" y="${y + 5}" font-family="Arial, sans-serif" font-size="16" fill="#0f172a">${algorithm.label}</text>
        <text x="${width - 195}" y="${y + 26}" font-family="Arial, sans-serif" font-size="13" fill="#475569">median ${algorithm.medianGasPerValue.toFixed(1)} gas/value</text>
        <text x="${width - 195}" y="${y + 46}" font-family="Arial, sans-serif" font-size="13" fill="#475569">mean ${algorithm.averageGasPerValue.toFixed(1)} gas/value</text>
      `;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#ffffff" />
  <text x="${margin.left}" y="42" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#0f172a">${title}</text>
  <text x="${margin.left}" y="68" font-family="Arial, sans-serif" font-size="16" fill="#475569">${subtitle}</text>
  <text x="${margin.left + plotWidth / 2}" y="${height - 56}" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#0f172a">Run progress</text>
  <text transform="translate(26 ${margin.top + plotHeight / 2}) rotate(-90)" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#0f172a">Batch gas per generated value</text>
  <rect x="${margin.left}" y="${margin.top}" width="${plotWidth}" height="${plotHeight}" fill="#fcfcfd" stroke="#cbd5e1" stroke-width="1.5" />
  ${grid.join("\n")}
  ${paths}
  <text x="${width - 248}" y="${margin.top - 28}" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#0f172a">Algorithms</text>
  ${legend}
  <text x="${margin.left}" y="${height - 22}" font-family="Arial, sans-serif" font-size="13" fill="#64748b">Each point is one local batch transaction routed through the duplicate-checking harness. Values represent end-to-end verification cost for batched generation and duplicate tracking.</text>
</svg>`;
}

function toCsv(observations: BatchObservation[]) {
  const header = [
    "algorithmId",
    "algorithmLabel",
    "batchNumber",
    "stepsRequested",
    "stepsExecuted",
    "processedCount",
    "progressPercent",
    "gasUsed",
    "gasPerValue",
    "effectiveGasPriceWei",
    "txFeeWei",
    "txHash",
    "duplicateCount",
  ];

  const lines = observations.map((observation) =>
    [
      observation.algorithmId,
      `"${observation.algorithmLabel}"`,
      observation.batchNumber,
      observation.stepsRequested,
      observation.stepsExecuted,
      observation.processedCount,
      observation.progressPercent.toFixed(4),
      observation.gasUsed,
      observation.gasPerValue.toFixed(4),
      observation.effectiveGasPriceWei,
      observation.txFeeWei,
      observation.txHash,
      observation.duplicateCount,
    ].join(","),
  );

  return [header.join(","), ...lines].join("\n");
}

function makeReport(
  runtime: LocalVerificationRuntime,
  config: LocalVerificationConfig,
  deployments: DeploymentRecord[],
  algorithms: AlgorithmSummary[],
  chartFileName: string,
  jsonFileName: string,
  csvFileName: string,
) {
  const tableRows = algorithms
    .map((algorithm) => {
      const deployment = deployments.find((entry) => entry.id === algorithm.id);
      if (!deployment) {
        throw new Error(`No deployment found for algorithm ${algorithm.id}`);
      }
      return `| ${algorithm.label} | ${algorithm.complete ? "yes" : "no"} | ${algorithm.finalDuplicateCount} | ${algorithm.medianGasPerValue.toFixed(1)} | ${algorithm.averageGasPerValue.toFixed(1)} | ${algorithm.totalExecutionGas.toFixed(0)} | ${deployment.generatorAddress} | ${deployment.harnessAddress} |`;
    })
    .join("\n");

  const deploymentRows = deployments
    .map((deployment) => {
      return `| ${deployment.label} | ${deployment.generatorDeploymentTxHash || "not available"} | ${deployment.harnessDeploymentTxHash || "not available"} | ${deployment.generatorDeploymentGas} | ${deployment.harnessDeploymentGas} |`;
    })
    .join("\n");

  return `# Local Harness Verification

## Runtime

- Runtime: ${runtime.name}
- Chain ID: ${runtime.chainId}
- Range: ${config.range}
- Batch size: ${config.batchSize}
- Epoch / global rounds: ${config.epochRounds} / ${config.globalRounds}
- Epoch size range: ${config.epochMinSize}-${config.epochMaxSize}

## Summary

| Algorithm | Complete | Duplicates | Median gas/value | Mean gas/value | Total execution gas | Generator | Harness |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- |
${tableRows}

## Deployments

| Algorithm | Generator deployment tx | Harness deployment tx | Generator deploy gas | Harness deploy gas |
| --- | --- | --- | ---: | ---: |
${deploymentRows}

## Interpretation

- Every generation call was routed through the local duplicate-checking harness, so the gas curve reflects end-to-end verification cost for batched generation and duplicate tracking.
- A complete run with \`Duplicates = 0\` means the harness did not observe repeated outputs across the configured range.
- The harness is also the stable caller, which is required for \`EpochPermutation\` because it mixes \`msg.sender\` into epoch seed rotation.

## Artifacts

- Chart: \`${chartFileName}\`
- Structured results: \`${jsonFileName}\`
- Raw batch observations: \`${csvFileName}\`
`;
}

export function writeLocalVerificationArtifacts(
  runtime: LocalVerificationRuntime,
  config: LocalVerificationConfig,
  deployments: DeploymentRecord[],
  observations: BatchObservation[],
  statuses: LocalVerificationResult["statuses"],
) {
  const generatedAt = new Date().toISOString();
  const groupedObservations = new Map(
    deployments.map((deployment) => [
      deployment.id,
      observations
        .filter((observation) => observation.algorithmId === deployment.id)
        .sort((left, right) => left.batchNumber - right.batchNumber),
    ]),
  );

  const algorithms = deployments.map((deployment) =>
    summarizeAlgorithm(
      deployment,
      groupedObservations.get(deployment.id) || [],
      statuses[deployment.id],
    ),
  );
  const structured: LocalVerificationResult = {
    generatedAt,
    runtime,
    config,
    deployments,
    observations,
    statuses,
    algorithms,
  };

  const stamp = timestampSlug();
  const baseName = `local-permutation-verification-${stamp}`;
  const jsonFileName = `${baseName}.json`;
  const csvFileName = `${baseName}.csv`;
  const chartFileName = `${baseName}.svg`;
  const reportFileName = `${baseName}.md`;
  const chart = makeChart(
    `${runtime.name} harness verification gas curve`,
    `Range ${config.range}, batch size ${config.batchSize}, duplicate-checking harness enabled`,
    algorithms,
    groupedObservations,
  );
  const csv = toCsv(observations);
  const report = makeReport(
    runtime,
    config,
    deployments,
    algorithms,
    chartFileName,
    jsonFileName,
    csvFileName,
  );

  writeJson(path.join(config.outputDir, jsonFileName), structured);
  fs.writeFileSync(path.join(config.outputDir, csvFileName), csv);
  fs.writeFileSync(path.join(config.outputDir, chartFileName), chart);
  fs.writeFileSync(path.join(config.outputDir, reportFileName), report);

  writeJson(
    path.join(config.outputDir, "local-permutation-verification-latest.json"),
    structured,
  );
  fs.writeFileSync(
    path.join(config.outputDir, "local-permutation-verification-latest.csv"),
    csv,
  );
  fs.writeFileSync(
    path.join(config.outputDir, "local-permutation-verification-latest.svg"),
    chart,
  );
  fs.writeFileSync(
    path.join(config.outputDir, "local-permutation-verification-latest.md"),
    report,
  );

  return {
    algorithms,
    chartPath: path.join(config.outputDir, chartFileName),
    csvPath: path.join(config.outputDir, csvFileName),
    jsonPath: path.join(config.outputDir, jsonFileName),
    reportPath: path.join(config.outputDir, reportFileName),
    structured,
  };
}

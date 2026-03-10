import fs from "node:fs";
import path from "node:path";
import { timestampSlug, writeJson } from "./output.js";
import type {
  AlgorithmSummary,
  BenchmarkConfig,
  RawObservation,
} from "./benchmarkTypes.js";

function makeSvgChart(
  title: string,
  subtitle: string,
  algorithms: AlgorithmSummary[],
  config: BenchmarkConfig,
) {
  const width = 1400;
  const height = 860;
  const margin = { top: 100, right: 280, bottom: 80, left: 100 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const maxGas = Math.max(
    ...algorithms.flatMap((algorithm) =>
      algorithm.bins.map((bin) => bin.maxGas),
    ),
  );
  const safeMaxGas = maxGas === 0 ? 1 : maxGas;
  const yTicks = 6;
  const xTicks = 5;

  const xScale = (percent: number) => margin.left + (percent / 100) * plotWidth;
  const yScale = (gas: number) =>
    margin.top + plotHeight - (gas / safeMaxGas) * plotHeight;

  const gridLines = [];
  for (let index = 0; index <= yTicks; index++) {
    const value = (safeMaxGas / yTicks) * index;
    const y = yScale(value);
    gridLines.push(`
      <line x1="${margin.left}" y1="${y}" x2="${margin.left + plotWidth}" y2="${y}" stroke="#e5e7eb" stroke-width="1" />
      <text x="${margin.left - 12}" y="${y + 5}" text-anchor="end" font-family="Arial, sans-serif" font-size="14" fill="#475569">${Math.round(value).toLocaleString()}</text>
    `);
  }

  for (let index = 0; index <= xTicks; index++) {
    const percent = (100 / xTicks) * index;
    const x = xScale(percent);
    gridLines.push(`
      <line x1="${x}" y1="${margin.top}" x2="${x}" y2="${margin.top + plotHeight}" stroke="#f1f5f9" stroke-width="1" />
      <text x="${x}" y="${margin.top + plotHeight + 28}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#475569">${percent.toFixed(0)}%</text>
    `);
  }

  const paths = algorithms
    .map((algorithm) => {
      const medianPathData = algorithm.bins
        .map((bin, index) => {
          const x = xScale(bin.progressMidPercent);
          const y = yScale(bin.medianGas);
          return `${index === 0 ? "M" : "L"} ${x} ${y}`;
        })
        .join(" ");

      const averagePathData = algorithm.bins
        .map((bin, index) => {
          const x = xScale(bin.progressMidPercent);
          const y = yScale(bin.averageGas);
          return `${index === 0 ? "M" : "L"} ${x} ${y}`;
        })
        .join(" ");

      return `
        <path d="${averagePathData}" fill="none" stroke="${algorithm.color}" stroke-width="2" stroke-dasharray="8 6" stroke-linejoin="round" stroke-linecap="round" opacity="0.65" />
        <path d="${medianPathData}" fill="none" stroke="${algorithm.color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />
      `;
    })
    .join("\n");

  const legend = algorithms
    .map((algorithm, index) => {
      const y = margin.top + 24 + index * 74;
      return `
        <line x1="${width - 250}" y1="${y}" x2="${width - 205}" y2="${y}" stroke="${algorithm.color}" stroke-width="4" stroke-linecap="round" />
        <text x="${width - 195}" y="${y + 5}" font-family="Arial, sans-serif" font-size="16" fill="#0f172a">${algorithm.label}</text>
        <text x="${width - 195}" y="${y + 26}" font-family="Arial, sans-serif" font-size="13" fill="#475569">median ${algorithm.medianGasPerCall.toFixed(0)} gas/call</text>
        <text x="${width - 195}" y="${y + 46}" font-family="Arial, sans-serif" font-size="13" fill="#475569">mean ${algorithm.averageGasPerCall.toFixed(0)} gas/call</text>
      `;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#ffffff" />
  <text x="${margin.left}" y="44" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#0f172a">${title}</text>
  <text x="${margin.left}" y="72" font-family="Arial, sans-serif" font-size="16" fill="#475569">${subtitle}</text>
  <text x="${margin.left + plotWidth / 2}" y="${height - 20}" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#0f172a">Run progress</text>
  <text transform="translate(24 ${margin.top + plotHeight / 2}) rotate(-90)" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#0f172a">Gas used per call</text>
  <rect x="${margin.left}" y="${margin.top}" width="${plotWidth}" height="${plotHeight}" fill="#fcfcfd" stroke="#cbd5e1" stroke-width="1.5" />
  ${gridLines.join("\n")}
  ${paths}
  <text x="${width - 250}" y="${margin.top - 28}" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#0f172a">Algorithms</text>
  <text x="${width - 250}" y="${margin.top - 6}" font-family="Arial, sans-serif" font-size="12" fill="#64748b">Solid = median, dashed = mean</text>
  ${legend}
  <text x="${margin.left}" y="${height - 50}" font-family="Arial, sans-serif" font-size="13" fill="#64748b">Binned averages from ${config.bins} progress buckets. Exact raw traces are available in the accompanying CSV and JSON outputs.</text>
</svg>`;
}

function toCsv(rows: RawObservation[]) {
  const header = [
    "algorithmId",
    "algorithmLabel",
    "run",
    "sequenceIndex",
    "progressPercent",
    "gasUsed",
    "permutedValue",
  ];

  const lines = rows.map((row) =>
    [
      row.algorithmId,
      `"${row.algorithmLabel}"`,
      row.run,
      row.sequenceIndex,
      row.progressPercent.toFixed(4),
      row.gasUsed,
      row.permutedValue,
    ].join(","),
  );

  return [header.join(","), ...lines].join("\n");
}

function makeReport(
  config: BenchmarkConfig,
  algorithms: AlgorithmSummary[],
  chartFileName: string,
  jsonFileName: string,
  csvFileName: string,
) {
  const sorted = [...algorithms].sort(
    (left, right) =>
      left.medianGasPerCall - right.medianGasPerCall ||
      left.averageGasPerCall - right.averageGasPerCall,
  );

  const tableRows = sorted
    .map(
      (algorithm) =>
        `| ${algorithm.label} | ${algorithm.medianGasPerCall.toFixed(0)} | ${algorithm.averageGasPerCall.toFixed(0)} | ${algorithm.totalExecutionGasMedian.toFixed(0)} | ${algorithm.totalExecutionGasAverage.toFixed(0)} | ${algorithm.peakMedianGasBinPercent.toFixed(1)}% | ${algorithm.peakAverageGasBinPercent.toFixed(1)}% | ${algorithm.lateToEarlyMedianRatio.toFixed(2)}x | ${algorithm.lateToEarlyRatio.toFixed(2)}x |`,
    )
    .join("\n");

  const algorithmNotes = sorted
    .map((algorithm) => `- **${algorithm.label}**: ${algorithm.description}`)
    .join("\n");

  return `# Permutation Gas Benchmark Report

## Configuration

| Field | Value |
| --- | --- |
| Range | ${config.range} |
| Runs per algorithm | ${config.runs} |
| Progress bins | ${config.bins} |
| Epoch size range | ${config.epochMinSize}-${config.epochMaxSize} |
| Epoch / global rounds | ${config.epochRounds} / ${config.globalRounds} |
| Uniqueness verification | ${config.verifyUniqueness ? "enabled" : "disabled"} |

## Algorithms

${algorithmNotes}

## Summary

| Algorithm | Median gas/call | Mean gas/call | Median run total | Mean run total | Peak median bin | Peak mean bin | Median late / early | Mean late / early |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${tableRows}

## Interpretation

- All compared generators use the same benchmark surface: one generation call and one emitted output event per transaction.
- The chart shows both metrics: solid lines for median gas and dashed lines for mean gas.
- Median is the primary comparison metric in the summary table. Mean is included as secondary context.
- Sequence positions are aligned across runs before binning, so each progress bin reflects the same portion of the generation run in every run.
- The late / early ratios compare the last 10% of the run to the first 10%, reported for both median and mean.
- A ratio near \`1.00x\` indicates a relatively flat curve. Larger or smaller values indicate non-flat behavior across the run.
- Curves are not required to be monotonic. Storage transition effects can make early, middle, and late phases behave differently.
- The sequential counter is included as a control baseline, not as a shuffled algorithm.

## Artifacts

- Chart: \`${chartFileName}\`
- Structured results: \`${jsonFileName}\`
- Raw observations: \`${csvFileName}\`

## Rerun

\`\`\`bash
npm run benchmark:gas
\`\`\`

To change the benchmark configuration:

\`\`\`bash
npm run benchmark:gas -- --range ${config.range} --runs ${config.runs} --bins ${config.bins}
\`\`\`
`;
}

export function writeBenchmarkArtifacts(
  config: BenchmarkConfig,
  algorithms: AlgorithmSummary[],
  observations: RawObservation[],
) {
  const generatedAt = new Date().toISOString();
  const stamp = timestampSlug();
  const baseName = `gas-benchmark-${stamp}`;
  const jsonFileName = `${baseName}.json`;
  const csvFileName = `${baseName}.csv`;
  const chartFileName = `${baseName}.svg`;
  const reportFileName = `${baseName}.md`;

  const chart = makeSvgChart(
    "Permutation Gas Curves Across the Generation Run",
    `Range ${config.range}, ${config.runs} run(s) per algorithm, ${config.bins} progress bins`,
    algorithms,
    config,
  );
  const csv = toCsv(observations);
  const report = makeReport(
    config,
    algorithms,
    chartFileName,
    jsonFileName,
    csvFileName,
  );
  const structured = {
    generatedAt,
    config,
    algorithms,
  };

  writeJson(path.join(config.outputDir, jsonFileName), structured);
  fs.writeFileSync(path.join(config.outputDir, chartFileName), chart);
  fs.writeFileSync(path.join(config.outputDir, reportFileName), report);
  fs.writeFileSync(path.join(config.outputDir, csvFileName), csv);

  writeJson(
    path.join(config.outputDir, "gas-benchmark-latest.json"),
    structured,
  );
  fs.writeFileSync(
    path.join(config.outputDir, "gas-benchmark-latest.csv"),
    csv,
  );
  fs.writeFileSync(
    path.join(config.outputDir, "gas-benchmark-latest.svg"),
    chart,
  );
  fs.writeFileSync(
    path.join(config.outputDir, "gas-benchmark-latest.md"),
    report,
  );

  return {
    chartPath: path.join(config.outputDir, chartFileName),
    csvPath: path.join(config.outputDir, csvFileName),
    jsonPath: path.join(config.outputDir, jsonFileName),
    reportPath: path.join(config.outputDir, reportFileName),
  };
}

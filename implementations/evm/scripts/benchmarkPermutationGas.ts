import { network } from "hardhat";
import { loadBenchmarkConfig } from "./lib/benchmarkConfig.js";
import { writeBenchmarkArtifacts } from "./lib/benchmarkArtifacts.js";
import { benchmarkAlgorithm } from "./lib/benchmarkRunner.js";
import { logFields, printSection, toErrorMessage } from "./lib/logging.js";
import { buildAlgorithmSpecs } from "./lib/benchmarkSpecs.js";

const { ethers } = await network.connect();

async function main() {
  const config = loadBenchmarkConfig();
  const specs = buildAlgorithmSpecs(ethers, config);
  const algorithms = [];
  const observations = [];

  printSection("benchmark");
  logFields([
    ["range", config.range],
    ["runs", config.runs],
    ["algorithms", specs.map((spec) => spec.label).join(", ")],
    ["output", config.outputDir],
  ]);

  for (const spec of specs) {
    const result = await benchmarkAlgorithm(ethers, spec, config);
    algorithms.push(result.summary);
    observations.push(...result.observations);
  }

  const written = writeBenchmarkArtifacts(config, algorithms, observations);

  printSection("artifacts");
  logFields([
    ["chart", written.chartPath],
    ["json", written.jsonPath],
    ["csv", written.csvPath],
    ["report", written.reportPath],
  ]);
}

main().catch((error) => {
  console.error(toErrorMessage(error));
  process.exitCode = 1;
});

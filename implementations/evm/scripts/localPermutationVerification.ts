import { network } from "hardhat";
import { writeLocalVerificationArtifacts } from "./lib/localVerification/artifacts.js";
import {
  loadLocalVerificationConfig,
  resolveLocalVerificationRuntime,
} from "./lib/localVerification/config.js";
import {
  buildLocalVerificationSpecs,
  deployHarnessedAlgorithm,
} from "./lib/localVerification/deploy.js";
import {
  calibrateSharedBatchSize,
  executeHarnessRun,
} from "./lib/localVerification/execute.js";
import { logFields, printSection, toErrorMessage } from "./lib/logging.js";
import type { LocalVerificationAlgorithmId } from "./lib/localVerification/types.js";

const { ethers } = await network.connect();

async function main() {
  const providerNetwork = await ethers.provider.getNetwork();
  const config = loadLocalVerificationConfig(process.env);
  const runtime = resolveLocalVerificationRuntime(
    process.env.HARDHAT_NETWORK || "hardhat",
    Number(providerNetwork.chainId),
  );

  printSection("runtime");
  logFields([
    ["runtime", `${runtime.name} (${runtime.chainId})`],
    ["range", config.range],
    ["batch", config.batchSize],
    ["output", config.outputDir],
  ]);

  const specs = buildLocalVerificationSpecs(ethers, config);
  const deployments = [];

  printSection("deploy");
  for (const spec of specs) {
    logFields([["algorithm", spec.label]]);
    deployments.push(await deployHarnessedAlgorithm(ethers, spec));
  }

  const fixedBatchSize = await calibrateSharedBatchSize(
    deployments,
    config.batchSize,
    config.range,
  );
  const effectiveConfig = {
    ...config,
    batchSize: fixedBatchSize,
  };

  if (fixedBatchSize !== config.batchSize) {
    printSection("batch");
    logFields([
      ["requested", config.batchSize],
      ["using", fixedBatchSize],
    ]);
  }

  const observations = [];
  const statuses = {} as Record<
    LocalVerificationAlgorithmId,
    Awaited<ReturnType<typeof executeHarnessRun>>["status"]
  >;

  printSection("run");
  for (const deployment of deployments) {
    logFields([["algorithm", deployment.spec.label]]);
    const result = await executeHarnessRun(
      deployment,
      effectiveConfig.range,
      effectiveConfig.batchSize,
    );
    observations.push(...result.observations);
    statuses[deployment.spec.id] = result.status;
  }

  const written = writeLocalVerificationArtifacts(
    runtime,
    effectiveConfig,
    deployments.map((deployment) => deployment.deployment),
    observations,
    statuses,
  );

  printSection("deployments");
  for (const deployment of deployments) {
    logFields([
      [`${deployment.spec.id}.gen`, deployment.deployment.generatorAddress],
      [`${deployment.spec.id}.harness`, deployment.deployment.harnessAddress],
    ]);
  }

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

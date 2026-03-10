import type { HardhatEthersHelpers } from "@nomicfoundation/hardhat-ethers/types";
import type {
  DeploymentHandle,
  DeploymentRecord,
  LocalVerificationConfig,
} from "./types.js";

export function buildLocalVerificationSpecs(
  ethers: HardhatEthersHelpers,
  config: LocalVerificationConfig,
) {
  return [
    {
      id: "epoch-permutation" as const,
      label: "Epoch Permutation",
      color: "#d62728",
      description:
        "Dual-stage Feistel permutation with epoch-local seed rotation and a stable caller harness.",
      contractName: "EpochPermutation",
      constructorArgs: [
        config.range,
        config.epochMinSize,
        config.epochMaxSize,
        config.epochRounds,
        config.globalRounds,
      ],
      deploy: async () => {
        const Factory = await ethers.getContractFactory("EpochPermutation");
        return Factory.deploy(
          config.range,
          config.epochMinSize,
          config.epochMaxSize,
          config.epochRounds,
          config.globalRounds,
        );
      },
    },
    {
      id: "sparse-fisher-yates" as const,
      label: "Sparse Fisher-Yates",
      color: "#2ca02c",
      description:
        "Sparse swap-map draw over the remaining range, executed through the same stable caller harness.",
      contractName: "SparseFisherYatesPermutation",
      constructorArgs: [config.range],
      deploy: async () => {
        const Factory = await ethers.getContractFactory(
          "SparseFisherYatesPermutation",
        );
        return Factory.deploy(config.range);
      },
    },
  ];
}

export async function deployHarnessedAlgorithm(
  ethers: HardhatEthersHelpers,
  spec: ReturnType<typeof buildLocalVerificationSpecs>[number],
): Promise<DeploymentHandle> {
  const targetContract = await spec.deploy();
  const targetDeployment = targetContract.deploymentTransaction();
  const targetReceipt = targetDeployment ? await targetDeployment.wait() : null;
  await targetContract.waitForDeployment();

  const targetAddress = await targetContract.getAddress();
  const Harness = await ethers.getContractFactory("PermutationBatchHarness");
  const harnessContract = await Harness.deploy(targetAddress, true);
  const harnessDeployment = harnessContract.deploymentTransaction();
  const harnessReceipt = harnessDeployment
    ? await harnessDeployment.wait()
    : null;
  await harnessContract.waitForDeployment();

  const harnessAddress = await harnessContract.getAddress();
  const deployment: DeploymentRecord = {
    id: spec.id,
    label: spec.label,
    color: spec.color,
    description: spec.description,
    contractName: spec.contractName,
    generatorAddress: targetAddress,
    harnessAddress,
    generatorConstructorArgs: spec.constructorArgs,
    harnessConstructorArgs: [targetAddress, true],
    generatorDeploymentTxHash: targetReceipt?.hash ?? null,
    harnessDeploymentTxHash: harnessReceipt?.hash ?? null,
    generatorDeploymentGas: targetReceipt ? Number(targetReceipt.gasUsed) : 0,
    harnessDeploymentGas: harnessReceipt ? Number(harnessReceipt.gasUsed) : 0,
  };

  return {
    spec,
    targetContract,
    harnessContract,
    deployment,
  };
}

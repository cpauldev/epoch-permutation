import { expect } from "chai";
import { network } from "hardhat";
import type { PermutationBenchmarkBase } from "../typechain-types/benchmarks/PermutationBenchmarkBase.js";
import { getEventArgs } from "../scripts/lib/events.js";

const { ethers } = await network.connect();

describe("Permutation Benchmark Algorithms", function () {
  const RANGE = 257;

  async function assertUniqueFullRun(contract: PermutationBenchmarkBase) {
    const seen = new Set<number>();

    for (let i = 0; i < RANGE; i++) {
      const tx = await contract.getNextPermutedValue();
      const receipt = await tx.wait();
      const args = getEventArgs(receipt, contract, "PermutationExecuted");
      const sequenceIndex = Number(args[0]);
      const value = Number(args[1]);

      expect(sequenceIndex).to.equal(i);
      expect(value).to.be.gte(1);
      expect(value).to.be.lte(RANGE);
      expect(seen.has(value)).to.equal(false);

      seen.add(value);
    }

    expect(seen.size).to.equal(RANGE);
    await expect(contract.getNextPermutedValue()).to.revert(ethers);
  }

  it("SequentialCounterPermutation exhausts the range without duplicates", async function () {
    const Factory = await ethers.getContractFactory(
      "SequentialCounterPermutation",
    );
    const contract = await Factory.deploy(RANGE);
    await contract.waitForDeployment();

    await assertUniqueFullRun(contract);
  });

  it("SingleStageFeistelPermutation exhausts the range without duplicates", async function () {
    const Factory = await ethers.getContractFactory(
      "SingleStageFeistelPermutation",
    );
    const contract = await Factory.deploy(RANGE, 0);
    await contract.waitForDeployment();

    await assertUniqueFullRun(contract);
  });

  it("SparseFisherYatesPermutation exhausts the range without duplicates", async function () {
    const Factory = await ethers.getContractFactory(
      "SparseFisherYatesPermutation",
    );
    const contract = await Factory.deploy(RANGE);
    await contract.waitForDeployment();

    await assertUniqueFullRun(contract);
  });

  it("EpochPermutationBenchmark exhausts the range without duplicates under small-range settings", async function () {
    const Factory = await ethers.getContractFactory(
      "EpochPermutationBenchmark",
    );
    const contract = await Factory.deploy(RANGE, 8, 16, 1, 3);
    await contract.waitForDeployment();

    await assertUniqueFullRun(contract);
  });
});

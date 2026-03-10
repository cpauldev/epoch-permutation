import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("PermutationBatchHarness", function () {
  it("produces a complete duplicate-free harness run for EpochPermutation", async function () {
    const range = 64;
    const EpochPermutation =
      await ethers.getContractFactory("EpochPermutation");
    const target = await EpochPermutation.deploy(range, 8, 16, 1, 3);
    await target.waitForDeployment();

    const Harness = await ethers.getContractFactory("PermutationBatchHarness");
    const harness = await Harness.deploy(await target.getAddress(), true);
    await harness.waitForDeployment();

    await harness.runBatch(17);
    await harness.runBatch(17);
    await harness.runBatch(100);

    expect(await harness.processedCount()).to.equal(range);
    expect(await harness.duplicateCount()).to.equal(0);
    expect(await harness.isComplete()).to.equal(true);
    expect(await harness.hasDuplicates()).to.equal(false);
    expect(await target.permutationCounter()).to.equal(range);

    for (let value = 1; value <= range; value++) {
      expect(await harness.seen(value)).to.equal(true);
    }
  });

  it("records duplicates when the target repeats a value", async function () {
    const Mock = await ethers.getContractFactory("RepeatingPermutationMock");
    const target = await Mock.deploy(4);
    await target.waitForDeployment();

    const Harness = await ethers.getContractFactory("PermutationBatchHarness");
    const harness = await Harness.deploy(await target.getAddress(), true);
    await harness.waitForDeployment();

    await harness.runBatch(4);

    expect(await harness.processedCount()).to.equal(4);
    expect(await harness.duplicateCount()).to.equal(1);
    expect(await harness.hasDuplicates()).to.equal(true);
    expect(await harness.firstDuplicateRecorded()).to.equal(true);
    expect(await harness.firstDuplicateValue()).to.equal(1);
    expect(await harness.firstDuplicateSequenceIndex()).to.equal(1);
    expect(await harness.seen(1)).to.equal(true);
  });

  it("supports gas-only mode without bitmap tracking", async function () {
    const range = 32;
    const FisherYates = await ethers.getContractFactory(
      "SparseFisherYatesPermutation",
    );
    const target = await FisherYates.deploy(range);
    await target.waitForDeployment();

    const Harness = await ethers.getContractFactory("PermutationBatchHarness");
    const harness = await Harness.deploy(await target.getAddress(), false);
    await harness.waitForDeployment();

    await harness.runBatch(range);

    expect(await harness.isComplete()).to.equal(true);
    expect(await harness.duplicateCount()).to.equal(0);
    expect(await harness.seen(1)).to.equal(false);
    expect(await harness.bitmapWord(0)).to.equal(0);
  });

  it("rejects targets that have already started", async function () {
    const range = 8;
    const FisherYates = await ethers.getContractFactory(
      "SparseFisherYatesPermutation",
    );
    const target = await FisherYates.deploy(range);
    await target.waitForDeployment();

    const tx = await target.getNextPermutedValue();
    await tx.wait();

    const Harness = await ethers.getContractFactory("PermutationBatchHarness");
    await expect(Harness.deploy(await target.getAddress(), true)).to.be.revert(
      ethers,
    );
  });
});

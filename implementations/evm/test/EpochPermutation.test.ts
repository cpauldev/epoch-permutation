import { expect } from "chai";
import { network } from "hardhat";
import type { EpochPermutation } from "../typechain-types/index.js";
import { getEventArgs } from "../scripts/lib/events.js";

const { ethers } = await network.connect();

describe("EpochPermutation", function () {
  let permutation: EpochPermutation;
  const MAX_RANGE = 1000; // Use smaller range for faster tests

  beforeEach(async function () {
    const EpochPermutation =
      await ethers.getContractFactory("EpochPermutation");
    // Use default parameters: maxRange=1000, rest use defaults
    permutation = await EpochPermutation.deploy(MAX_RANGE, 0, 0, 0, 0);
    await permutation.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct max range", async function () {
      expect(await permutation.MAX_RANGE()).to.equal(MAX_RANGE);
    });

    it("Should set default epoch sizes", async function () {
      const minEpoch = await permutation.MIN_EPOCH_SIZE();
      const maxEpoch = await permutation.MAX_EPOCH_SIZE();
      expect(minEpoch).to.equal(250); // DEFAULT_MIN_EPOCH_SIZE
      expect(maxEpoch).to.equal(750); // DEFAULT_MAX_EPOCH_SIZE
    });

    it("Should set default rounds", async function () {
      const epochRounds = await permutation.EPOCH_ROUNDS();
      const globalRounds = await permutation.GLOBAL_ROUNDS();
      expect(epochRounds).to.equal(1); // DEFAULT_EPOCH_ROUNDS
      expect(globalRounds).to.equal(3); // DEFAULT_GLOBAL_ROUNDS
    });

    it("Should randomly select epoch size within range", async function () {
      const epochSize = await permutation.EPOCH_SIZE();
      const minEpoch = await permutation.MIN_EPOCH_SIZE();
      const maxEpoch = await permutation.MAX_EPOCH_SIZE();
      expect(epochSize).to.be.gte(minEpoch);
      expect(epochSize).to.be.lte(maxEpoch);
    });
  });

  describe("Bijectivity", function () {
    it("Should produce unique outputs for all inputs (no collisions)", async function () {
      const outputs = new Set<number>();
      const limit = 100; // Test first 100 values

      for (let i = 0; i < limit; i++) {
        const value = await permutation.viewPermutation(i);
        const numValue = Number(value);

        expect(outputs.has(numValue)).to.be.false; // No collision
        outputs.add(numValue);
      }

      expect(outputs.size).to.equal(limit);
    });

    it("Should produce outputs within valid range [1, MAX_RANGE]", async function () {
      for (let i = 0; i < 50; i++) {
        const value = await permutation.viewPermutation(i);
        expect(value).to.be.gte(1);
        expect(value).to.be.lte(MAX_RANGE);
      }
    });
  });

  describe("Sequential Generation", function () {
    it("Should increment permutation counter", async function () {
      expect(await permutation.permutationCounter()).to.equal(0);

      await permutation.getNextPermutedValue();
      expect(await permutation.permutationCounter()).to.equal(1);

      await permutation.getNextPermutedValue();
      expect(await permutation.permutationCounter()).to.equal(2);
    });

    it("Should emit PermutationExecuted event", async function () {
      const tx = await permutation.getNextPermutedValue();
      const receipt = await tx.wait();
      if (!receipt) throw new Error("Transaction not mined");
      const args = getEventArgs(receipt, permutation, "PermutationExecuted");

      expect(args[0]).to.equal(0);
      expect(args[1]).to.be.gte(1);
      expect(args[1]).to.be.lte(MAX_RANGE);
    });

    it("Should produce unique outputs across the full configured range", async function () {
      const outputs = new Set<number>();

      for (let i = 0; i < MAX_RANGE; i++) {
        const tx = await permutation.getNextPermutedValue();
        const receipt = await tx.wait();
        if (!receipt) throw new Error("Transaction not mined");
        const args = getEventArgs(receipt, permutation, "PermutationExecuted");
        const sequenceIndex = Number(args[0]);
        const permutedValue = Number(args[1]);

        expect(sequenceIndex).to.equal(i);
        expect(permutedValue).to.be.gte(1);
        expect(permutedValue).to.be.lte(MAX_RANGE);
        expect(outputs.has(permutedValue)).to.be.false;

        outputs.add(permutedValue);
      }

      expect(outputs.size).to.equal(MAX_RANGE);
    });

    it("Should revert when range exhausted", async function () {
      // Fast-forward to near the end
      for (let i = 0; i < MAX_RANGE; i++) {
        await permutation.getNextPermutedValue();
      }

      await expect(
        permutation.getNextPermutedValue(),
      ).to.be.revertedWithCustomError(permutation, "RangeExhausted");
    });
  });

  describe("Epoch Rotation", function () {
    it("Should emit EpochSeedRotated on the first value and again at the next epoch boundary", async function () {
      const epochSize = Number(await permutation.EPOCH_SIZE());

      const firstTx = await permutation.getNextPermutedValue();
      const firstReceipt = await firstTx.wait();
      if (!firstReceipt) throw new Error("Transaction not mined");
      const firstArgs = getEventArgs(
        firstReceipt,
        permutation,
        "EpochSeedRotated",
      );
      expect(firstArgs[0]).to.equal(0);

      for (let i = 1; i < epochSize; i++) {
        await permutation.getNextPermutedValue();
      }

      const nextEpochTx = await permutation.getNextPermutedValue();
      const nextEpochReceipt = await nextEpochTx.wait();
      if (!nextEpochReceipt) throw new Error("Transaction not mined");
      const nextEpochArgs = getEventArgs(
        nextEpochReceipt,
        permutation,
        "EpochSeedRotated",
      );
      expect(nextEpochArgs[0]).to.equal(1);
    });
  });

  describe("View Function", function () {
    it("Should return same value for same input (deterministic)", async function () {
      const value1 = await permutation.viewPermutation(42);
      const value2 = await permutation.viewPermutation(42);
      expect(value1).to.equal(value2);
    });

    it("Should revert for out-of-range input", async function () {
      await expect(
        permutation.viewPermutation(MAX_RANGE),
      ).to.be.revertedWithCustomError(permutation, "InputOutOfRange");
    });
  });

  describe("Custom Parameters", function () {
    it("Should accept custom parameters", async function () {
      const EpochPermutation =
        await ethers.getContractFactory("EpochPermutation");
      const custom = await EpochPermutation.deploy(
        5000, // maxRange
        100, // minEpochSize
        300, // maxEpochSize
        2, // epochRounds
        4, // globalRounds
      );

      expect(await custom.MAX_RANGE()).to.equal(5000);
      expect(await custom.MIN_EPOCH_SIZE()).to.equal(100);
      expect(await custom.MAX_EPOCH_SIZE()).to.equal(300);
      expect(await custom.EPOCH_ROUNDS()).to.equal(2);
      expect(await custom.GLOBAL_ROUNDS()).to.equal(4);
    });
  });
});

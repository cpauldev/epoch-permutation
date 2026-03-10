/**
 * Native JavaScript implementation of the Epoch Permutation algorithm.
 * By default it uses deterministic seed-derived hashing for epoch rotation
 * and Feistel round mixing. A runtime mode can also mirror the EVM seed
 * lifecycle with JS-native deployment and rotation context.
 */

import { randomUUID } from "node:crypto";
import {
  EPOCH_ROTATION_LABEL,
  EPOCH_SIZE_LABEL,
  FEISTEL_ROUND_LABEL,
  GLOBAL_SCRAMBLE_LABEL,
  RUNTIME_DEPLOYMENT_LABEL,
  RUNTIME_ROTATION_LABEL,
  normalizeEpochPermutationConfig,
} from "./config.js";
import { hashBigInt } from "./hash.js";

function runtimeNowMs() {
  return BigInt(Date.now());
}

function runtimeMonotonicNow() {
  if (
    typeof process !== "undefined" &&
    typeof process.hrtime?.bigint === "function"
  ) {
    return process.hrtime.bigint();
  }

  return runtimeNowMs();
}

function runtimeProcessId() {
  if (typeof process !== "undefined" && Number.isFinite(process.pid)) {
    return BigInt(process.pid);
  }

  return 0n;
}

function runtimeParentProcessId() {
  if (typeof process !== "undefined" && Number.isFinite(process.ppid)) {
    return BigInt(process.ppid);
  }

  return 0n;
}

export class EpochPermutation {
  constructor(options = {}) {
    const config = normalizeEpochPermutationConfig(options);

    this.MAX_RANGE = config.maxRange;
    this.MIN_EPOCH_SIZE = config.minEpochSize;
    this.MAX_EPOCH_SIZE = config.maxEpochSize;
    this.EPOCH_ROUNDS = config.epochRounds;
    this.GLOBAL_ROUNDS = config.globalRounds;
    this.SEED = config.seed;
    this.SEED_MODE = config.seedMode;
    this.RUNTIME_CONTEXT =
      this.SEED_MODE === "runtime"
        ? this._buildRuntimeContext(config.runtimeContext)
        : null;

    const epochSizeSpan = BigInt(this.MAX_EPOCH_SIZE - this.MIN_EPOCH_SIZE + 1);
    const epochSizeOffset = this._deriveEpochSizeOffset(epochSizeSpan);
    this.EPOCH_SIZE = Number(epochSizeOffset) + this.MIN_EPOCH_SIZE;

    this.GLOBAL_SEED = this._deriveGlobalSeed();

    this.currentEpochSeed = 0n;
    this.permutationCounter = 0;
  }

  /**
   * Get the next permuted value in sequence
   */
  getNext() {
    if (this.permutationCounter >= this.MAX_RANGE) {
      throw new Error(
        `Range exhausted (${this.permutationCounter}/${this.MAX_RANGE})`,
      );
    }

    const value = this._getPermutedValue(this.permutationCounter);
    this.permutationCounter++;
    return value;
  }

  /**
   * View permutation at specific index (read-only).
   * Runtime mode mirrors the EVM contract and is only exact for the current epoch.
   */
  view(sequenceIndex) {
    if (sequenceIndex >= this.MAX_RANGE) {
      throw new Error(
        `Input ${sequenceIndex} out of range (max: ${this.MAX_RANGE})`,
      );
    }
    return this._simulatePermutation(sequenceIndex);
  }

  /**
   * Get permutations up to a limit for inspection or analysis.
   */
  getAllPermutations(limit = this.MAX_RANGE) {
    const results = [];
    for (let i = 0; i < Math.min(limit, this.MAX_RANGE); i++) {
      results.push({
        input: i,
        output: this.view(i),
        epoch: Math.floor(i / this.EPOCH_SIZE),
      });
    }
    return results;
  }

  /**
   * Internal: Get permuted value with state mutation
   */
  _getPermutedValue(sequenceIndex) {
    const epochIndex = Math.floor(sequenceIndex / this.EPOCH_SIZE);
    const positionInEpoch = sequenceIndex % this.EPOCH_SIZE;

    // Rotate epoch seed if needed
    if (positionInEpoch === 0) {
      this._rotateEpochSeed(epochIndex);
    }

    // Calculate actual epoch size (may be smaller for last partial epoch)
    const firstSequenceIndexOfCurrentEpoch = epochIndex * this.EPOCH_SIZE;
    const remainingSupplyFromStartOfCurrentEpoch =
      this.MAX_RANGE - firstSequenceIndexOfCurrentEpoch;
    const epochBlockSizeActual =
      remainingSupplyFromStartOfCurrentEpoch < this.EPOCH_SIZE
        ? remainingSupplyFromStartOfCurrentEpoch
        : this.EPOCH_SIZE;

    // Stage 1: Epoch permutation
    const epochPermuted = this._feistelPermute(
      positionInEpoch,
      this.currentEpochSeed,
      epochBlockSizeActual,
      this.EPOCH_ROUNDS,
    );

    // Reconstruct global index
    const globalIndex = firstSequenceIndexOfCurrentEpoch + epochPermuted;

    // Stage 2: Global permutation
    const finalValue = this._feistelPermute(
      globalIndex,
      this.GLOBAL_SEED,
      this.MAX_RANGE,
      this.GLOBAL_ROUNDS,
    );

    return finalValue + 1; // 1-indexed
  }

  /**
   * Internal: Simulate permutation without state mutation
   */
  _simulatePermutation(sequenceIndex) {
    const epochIndex = Math.floor(sequenceIndex / this.EPOCH_SIZE);
    const positionInEpoch = sequenceIndex % this.EPOCH_SIZE;

    // Simulate epoch seed
    const simulatedSeed = this._computeEpochSeed(epochIndex);

    // Calculate actual epoch size (may be smaller for last partial epoch)
    const firstSequenceIndexOfCurrentEpoch = epochIndex * this.EPOCH_SIZE;
    const remainingSupplyFromStartOfCurrentEpoch =
      this.MAX_RANGE - firstSequenceIndexOfCurrentEpoch;
    const epochBlockSizeActual =
      remainingSupplyFromStartOfCurrentEpoch < this.EPOCH_SIZE
        ? remainingSupplyFromStartOfCurrentEpoch
        : this.EPOCH_SIZE;

    // Stage 1: Epoch permutation
    const epochPermuted = this._feistelPermute(
      positionInEpoch,
      simulatedSeed,
      epochBlockSizeActual,
      this.EPOCH_ROUNDS,
    );

    // Reconstruct global index
    const globalIndex = firstSequenceIndexOfCurrentEpoch + epochPermuted;

    // Stage 2: Global permutation
    const finalValue = this._feistelPermute(
      globalIndex,
      this.GLOBAL_SEED,
      this.MAX_RANGE,
      this.GLOBAL_ROUNDS,
    );

    return finalValue + 1; // 1-indexed
  }

  /**
   * Rotate the epoch seed using deterministic JS-native hashing.
   */
  _rotateEpochSeed(epochNumber) {
    this.currentEpochSeed = this._deriveEpochSeed(
      epochNumber,
      this.currentEpochSeed,
    );
  }

  /**
   * Compute what the epoch seed would be at a given epoch.
   * Runtime mode mirrors the EVM contract and only knows the current epoch seed.
   */
  _computeEpochSeed(epochNumber) {
    if (this.SEED_MODE === "runtime") {
      return this.currentEpochSeed;
    }

    let seed = 0n;

    for (let i = 0; i <= epochNumber; i++) {
      seed = this._deriveEpochSeed(i, seed);
    }

    return seed;
  }

  _deriveEpochSeed(epochNumber, previousSeed) {
    const derivedSeed =
      this.SEED_MODE === "runtime"
        ? hashBigInt(
            RUNTIME_ROTATION_LABEL,
            this._runtimeRotationEntropy(epochNumber, previousSeed),
            EPOCH_ROTATION_LABEL,
            epochNumber,
            previousSeed,
            this.EPOCH_SIZE,
            this.MAX_RANGE,
            this.EPOCH_ROUNDS,
          )
        : hashBigInt(
            this.SEED,
            EPOCH_ROTATION_LABEL,
            epochNumber,
            previousSeed,
            this.EPOCH_SIZE,
            this.MAX_RANGE,
            this.EPOCH_ROUNDS,
          );

    return derivedSeed === 0n ? 1n : derivedSeed;
  }

  _buildRuntimeContext(runtimeContext = {}) {
    return {
      caller: runtimeContext.caller ?? "js-runtime",
      deploymentTimestamp: this._toBigIntOrDefault(
        runtimeContext.deploymentTimestamp,
        runtimeNowMs(),
      ),
      deploymentMonotonic: this._toBigIntOrDefault(
        runtimeContext.deploymentMonotonic,
        runtimeMonotonicNow(),
      ),
      processId: this._toBigIntOrDefault(
        runtimeContext.processId,
        runtimeProcessId(),
      ),
      parentProcessId: this._toBigIntOrDefault(
        runtimeContext.parentProcessId,
        runtimeParentProcessId(),
      ),
      instanceId: runtimeContext.instanceId ?? randomUUID(),
    };
  }

  _deriveEpochSizeOffset(epochSizeSpan) {
    return this.SEED_MODE === "runtime"
      ? hashBigInt(
          RUNTIME_DEPLOYMENT_LABEL,
          this._deploymentEntropy(),
          EPOCH_SIZE_LABEL,
          this.MAX_RANGE,
          this.MIN_EPOCH_SIZE,
          this.MAX_EPOCH_SIZE,
        ) % epochSizeSpan
      : hashBigInt(
          this.SEED,
          EPOCH_SIZE_LABEL,
          this.MAX_RANGE,
          this.MIN_EPOCH_SIZE,
          this.MAX_EPOCH_SIZE,
        ) % epochSizeSpan;
  }

  _deriveGlobalSeed() {
    return this.SEED_MODE === "runtime"
      ? hashBigInt(
          RUNTIME_DEPLOYMENT_LABEL,
          this._deploymentEntropy(),
          GLOBAL_SCRAMBLE_LABEL,
          this.MAX_RANGE,
          this.EPOCH_SIZE,
          this.GLOBAL_ROUNDS,
        )
      : hashBigInt(
          this.SEED,
          GLOBAL_SCRAMBLE_LABEL,
          this.MAX_RANGE,
          this.EPOCH_SIZE,
          this.GLOBAL_ROUNDS,
        );
  }

  _deploymentEntropy() {
    return hashBigInt(
      RUNTIME_DEPLOYMENT_LABEL,
      this.SEED,
      this.RUNTIME_CONTEXT.instanceId,
      this.RUNTIME_CONTEXT.caller,
      this.RUNTIME_CONTEXT.deploymentTimestamp,
      this.RUNTIME_CONTEXT.deploymentMonotonic,
      this.RUNTIME_CONTEXT.processId,
      this.RUNTIME_CONTEXT.parentProcessId,
      this.MAX_RANGE,
      this.MIN_EPOCH_SIZE,
      this.MAX_EPOCH_SIZE,
      this.EPOCH_ROUNDS,
      this.GLOBAL_ROUNDS,
    );
  }

  _runtimeRotationEntropy(epochNumber, previousSeed) {
    return hashBigInt(
      RUNTIME_ROTATION_LABEL,
      this.RUNTIME_CONTEXT.instanceId,
      this.RUNTIME_CONTEXT.caller,
      epochNumber,
      previousSeed,
      runtimeNowMs(),
      runtimeMonotonicNow(),
      this.permutationCounter,
    );
  }

  _toBigIntOrDefault(value, fallback) {
    return value === undefined ? fallback : BigInt(value);
  }

  /**
   * Feistel permutation with cycle walking
   */
  _feistelPermute(value, seed, range, rounds) {
    // Edge cases
    if (range === 0) return 0;
    if (range === 1) return 0;

    // Grid decomposition
    const { a, b } = this._findGrid(range);
    let x = value;

    // Execute Feistel rounds
    for (let i = 0; i < rounds; i++) {
      // Decode current position
      const l = Math.floor(x / b); // column
      const r = x % b; // row

      // Generate round-specific hash
      const h = hashBigInt(FEISTEL_ROUND_LABEL, r, seed, i, range, a, b);

      // Feistel transformation
      const l_new = r;
      const r_new = Number((BigInt(l) + h) % BigInt(a));

      // Encode new position
      x = l_new * a + r_new;
    }

    // Cycle walking - recursively permute if out of range
    if (x >= range) {
      x = this._feistelPermute(x, seed, range, rounds);
    }

    return x;
  }

  /**
   * Find optimal grid decomposition (a × b) for range
   */
  _findGrid(n) {
    if (n <= 1) {
      return { a: 1, b: 1 };
    }

    // a = ceiling(sqrt(range - 1)) + 1
    const a = Math.floor(Math.sqrt(n - 1)) + 1;
    // b = ceiling(range / a)
    const b = Math.ceil(n / a);
    return { a, b };
  }
}

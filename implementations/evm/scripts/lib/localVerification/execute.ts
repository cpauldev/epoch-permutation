import { getEventArgs } from "../events.js";
import { toErrorMessage } from "../logging.js";
import type { PermutationBatchHarness } from "../../../typechain-types/harnesses/PermutationBatchHarness.sol/PermutationBatchHarness.js";
import type { BatchObservation, DeploymentHandle, RunStatus } from "./types.js";

const LOCAL_GAS_CAP_PATTERNS = [
  /gas limit .* greater than the cap/i,
  /exceeds block gas limit/i,
  /intrinsic gas too high/i,
];
const HARDHAT_LOCAL_TX_GAS_CAP = 16_777_216n;
const GAS_LIMIT_BUFFER_NUMERATOR = 12n;
const GAS_LIMIT_BUFFER_DENOMINATOR = 10n;
const GAS_LIMIT_HEADROOM = 250_000n;
const DEFAULT_BATCH_GAS_TARGET =
  ((HARDHAT_LOCAL_TX_GAS_CAP - GAS_LIMIT_HEADROOM) * 3n) / 4n;

export async function calibrateSharedBatchSize(
  handles: DeploymentHandle[],
  requestedBatchSize: number,
  range: number,
) {
  let low = 1;
  let high = Math.max(1, Math.min(requestedBatchSize, range));
  let best = 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const safe = await isSharedBatchSizeSafe(handles, mid);

    if (safe) {
      best = mid;
      low = mid + 1;
      continue;
    }

    high = mid - 1;
  }

  return best;
}

export async function executeHarnessRun(
  handle: DeploymentHandle,
  range: number,
  batchSize: number,
): Promise<{ observations: BatchObservation[]; status: RunStatus }> {
  const observations: BatchObservation[] = [];
  let activeBatchSize = batchSize;

  while (true) {
    const processedCount = Number(
      await handle.harnessContract.processedCount(),
    );
    if (processedCount >= range) {
      break;
    }

    const maxStepsRequested = Math.min(activeBatchSize, range - processedCount);
    const { stepsRequested, estimate } = await resolveBatchEstimate(
      handle,
      maxStepsRequested,
    );
    activeBatchSize = stepsRequested;

    const tx = await handle.harnessContract.runBatch(stepsRequested, {
      gasLimit: bufferedGasLimit(estimate),
    });
    const receipt = await tx.wait();
    const args = getEventArgs(
      receipt,
      handle.harnessContract,
      "BatchProcessed",
    );
    const emittedBatchNumber = Number(args[0]);
    const emittedProcessedCount = Number(args[1]);
    const emittedStepsRequested = Number(args[2]);
    const emittedStepsExecuted = Number(args[3]);
    const emittedDuplicateCount = Number(args[4]);
    const gasUsed = Number(receipt.gasUsed);
    const effectiveGasPrice = receipt.gasPrice ?? 0n;
    const txFeeWei = effectiveGasPrice * receipt.gasUsed;

    observations.push({
      algorithmId: handle.spec.id,
      algorithmLabel: handle.spec.label,
      batchNumber: emittedBatchNumber,
      stepsRequested: emittedStepsRequested,
      stepsExecuted: emittedStepsExecuted,
      processedCount: emittedProcessedCount,
      progressPercent: (emittedProcessedCount / range) * 100,
      gasUsed,
      gasPerValue:
        emittedStepsExecuted === 0 ? 0 : gasUsed / emittedStepsExecuted,
      effectiveGasPriceWei: effectiveGasPrice.toString(),
      txFeeWei: txFeeWei.toString(),
      txHash: receipt.hash,
      duplicateCount: emittedDuplicateCount,
    });
  }

  return {
    observations,
    status: await readHarnessStatus(handle.harnessContract),
  };
}

async function isSharedBatchSizeSafe(
  handles: DeploymentHandle[],
  stepsRequested: number,
) {
  for (const handle of handles) {
    const estimate = await estimateBatchGas(handle, stepsRequested);
    if (estimate === null || estimate > DEFAULT_BATCH_GAS_TARGET) {
      return false;
    }
  }

  return true;
}

async function estimateBatchGas(
  handle: DeploymentHandle,
  stepsRequested: number,
) {
  try {
    return await handle.harnessContract.runBatch.estimateGas(stepsRequested);
  } catch (error) {
    if (isLocalGasCapError(error)) {
      return null;
    }

    throw error;
  }
}

async function requireBatchEstimate(
  handle: DeploymentHandle,
  stepsRequested: number,
) {
  const estimate = await estimateBatchGas(handle, stepsRequested);
  if (estimate === null) {
    throw new Error(
      `Unable to estimate gas for ${handle.spec.label} batch size ${stepsRequested}`,
    );
  }

  return estimate;
}

async function resolveBatchEstimate(
  handle: DeploymentHandle,
  maxStepsRequested: number,
) {
  const directEstimate = await estimateBatchGas(handle, maxStepsRequested);
  if (directEstimate !== null) {
    return {
      stepsRequested: maxStepsRequested,
      estimate: directEstimate,
    };
  }

  let low = 1;
  let high = Math.max(1, maxStepsRequested - 1);
  let bestSteps = 0;
  let bestEstimate: bigint | null = null;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const estimate = await estimateBatchGas(handle, mid);

    if (estimate !== null) {
      bestSteps = mid;
      bestEstimate = estimate;
      low = mid + 1;
      continue;
    }

    high = mid - 1;
  }

  if (bestEstimate === null || bestSteps < 1) {
    await requireBatchEstimate(handle, maxStepsRequested);
    throw new Error(`No valid batch size found below ${maxStepsRequested}`);
  }

  return {
    stepsRequested: bestSteps,
    estimate: bestEstimate,
  };
}

function bufferedGasLimit(estimate: bigint) {
  const buffered =
    (estimate * GAS_LIMIT_BUFFER_NUMERATOR) / GAS_LIMIT_BUFFER_DENOMINATOR;
  const capped = HARDHAT_LOCAL_TX_GAS_CAP - 1n;
  return buffered < capped ? buffered : capped;
}

function isLocalGasCapError(error: unknown) {
  return collectErrorMessages(error).some((message) =>
    LOCAL_GAS_CAP_PATTERNS.some((pattern) => pattern.test(message)),
  );
}

function collectErrorMessages(error: unknown) {
  const messages = new Set<string>();
  const visited = new Set<unknown>();

  function visit(value: unknown) {
    if (value === undefined || value === null || visited.has(value)) {
      return;
    }

    if (typeof value === "string") {
      if (value.trim() !== "") {
        messages.add(value);
      }
      return;
    }

    if (typeof value !== "object") {
      return;
    }

    visited.add(value);

    if (value instanceof Error) {
      messages.add(value.message);
      visit((value as Error & { cause?: unknown }).cause);
    }

    const record = value as Record<string, unknown>;
    for (const key of ["message", "shortMessage", "details", "reason"]) {
      const field = record[key];
      if (typeof field === "string" && field.trim() !== "") {
        messages.add(field);
      }
    }

    for (const key of ["error", "cause", "info", "data"]) {
      visit(record[key]);
    }
  }

  visit(error);

  if (messages.size === 0 && error !== undefined && error !== null) {
    messages.add(toErrorMessage(error));
  }

  return [...messages];
}

async function readHarnessStatus(
  harnessContract: PermutationBatchHarness,
): Promise<RunStatus> {
  const [
    processedCount,
    duplicateCount,
    remainingCount,
    firstDuplicateRecorded,
    firstDuplicateValue,
    firstDuplicateSequenceIndex,
  ] = await Promise.all([
    harnessContract.processedCount(),
    harnessContract.duplicateCount(),
    harnessContract.remainingCount(),
    harnessContract.firstDuplicateRecorded(),
    harnessContract.firstDuplicateValue(),
    harnessContract.firstDuplicateSequenceIndex(),
  ]);

  return {
    processedCount: Number(processedCount),
    duplicateCount: Number(duplicateCount),
    remainingCount: Number(remainingCount),
    complete: Number(remainingCount) === 0,
    hasDuplicates: Number(duplicateCount) > 0,
    firstDuplicateRecorded: Boolean(firstDuplicateRecorded),
    firstDuplicateValue: Number(firstDuplicateValue),
    firstDuplicateSequenceIndex: Number(firstDuplicateSequenceIndex),
  };
}

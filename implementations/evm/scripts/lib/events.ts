import type { BaseContract, ContractTransactionReceipt } from "ethers";

export function requireReceipt(
  receipt: ContractTransactionReceipt | null,
): ContractTransactionReceipt {
  if (receipt === null) {
    throw new Error("Transaction receipt was not available");
  }

  return receipt;
}

export function getEventArgs(
  receipt: ContractTransactionReceipt,
  contract: BaseContract,
  eventName: string,
) {
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed?.name === eventName) {
        return parsed.args;
      }
    } catch {
      // Ignore unrelated logs from other contracts/interfaces.
    }
  }

  throw new Error(`Event ${eventName} not found in receipt`);
}

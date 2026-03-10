import type { BaseContract, ContractTransactionReceipt } from "ethers";

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

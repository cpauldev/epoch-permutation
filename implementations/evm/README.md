# EVM Implementation

## Scope

This directory contains the Solidity implementation, benchmark variants,
Hardhat tests, and the local runners used by the root `evm:*` commands.

## Layout

| Path                                              | Verified purpose                                                                          |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `contracts/EpochPermutation.sol`                  | Primary EVM implementation.                                                               |
| `contracts/benchmarks/`                           | Benchmark contracts, including `EpochPermutationBenchmark` and the comparator algorithms. |
| `contracts/harnesses/PermutationBatchHarness.sol` | Stable-caller and duplicate-tracking harness used by local verification.                  |
| `contracts/mocks/`                                | Test-only mock contracts.                                                                 |
| `test/`                                           | Hardhat unit tests for the implementation, the harness, and the benchmark variants.       |
| `scripts/`                                        | Entrypoints and helpers for local verification and gas benchmarking.                      |

## Requirements

| Requirement     | Notes                                                                      |
| --------------- | -------------------------------------------------------------------------- |
| Node.js and npm | Required for the root `npm run evm:*` commands.                            |
| `npm install`   | Installs the Hardhat and TypeScript toolchain used by this implementation. |

## Commands

Run these commands from the repository root.

| Command                     | Verified behavior                                                                                                                                     |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run evm:compile`       | Runs `hardhat compile`.                                                                                                                               |
| `npm run evm:typecheck`     | Runs `hardhat compile` and then `tsc --noEmit`.                                                                                                       |
| `npm run evm:test`          | Runs `evm:typecheck`, `evm:test:unit`, and `evm:test:local`.                                                                                          |
| `npm run evm:test:unit`     | Runs `hardhat test`.                                                                                                                                  |
| `npm run evm:test:local`    | Compiles by default and then runs `implementations/evm/scripts/localPermutationVerification.ts`. Pass `--skip-compile true` to skip the compile step. |
| `npm run evm:benchmark:gas` | Runs `implementations/evm/scripts/runPermutationGasBenchmark.cjs` with the package preset `--range 5000 --bins 50 --runs 1`.                          |

## Generated Outputs

| Producer                    | Output                                                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `hardhat compile`           | Writes cache data to `cache/evm/`, contract artifacts to `artifacts/evm/`, and TypeChain output to `implementations/evm/typechain-types/`. |
| `npm run evm:test:local`    | Writes timestamped `.svg`, `.json`, `.csv`, and `.md` artifacts plus `*-latest.*` copies under `results/local-verification/`.              |
| `npm run evm:benchmark:gas` | Writes timestamped `.svg`, `.json`, `.csv`, and `.md` artifacts plus `*-latest.*` copies under `results/benchmarks/`.                      |

## Implementation Notes

| Topic                  | Verified detail                                                                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Local verification set | Compares exactly `EpochPermutation` and `SparseFisherYatesPermutation`, each deployed behind `PermutationBatchHarness`.                                                        |
| Harness behavior       | `PermutationBatchHarness` keeps the caller address fixed across all batches and can track duplicates on-chain with a bitmap.                                                   |
| Batch sizing           | The local verification runner auto-calibrates batch size downward when gas estimates exceed the local Hardhat transaction gas cap.                                             |
| Benchmark set          | Compares `SequentialCounterPermutation`, `SingleStageFeistelPermutation`, `SparseFisherYatesPermutation`, and `EpochPermutationBenchmark`.                                     |
| Benchmark contract     | `EpochPermutationBenchmark` is a benchmark-specific contract that keeps the stateful generation flow but exposes a reduced benchmark surface compared with `EpochPermutation`. |

# EVM Implementation

This directory contains the Solidity contracts, benchmark contracts, Hardhat tests, and local runners for the EVM implementation.

## Requirements

- Node.js and npm
- `npm install`

## Layout

- `contracts/`: Solidity source
- `contracts/benchmarks/`: benchmark-only comparator contracts
- `test/`: Hardhat test files
- `scripts/`: local harness verification and gas benchmark runners

## Commands

- `npm run evm:compile`
- `npm run evm:typecheck`
- `npm run evm:test`: typecheck + Hardhat unit tests + local harness verification
- `npm run evm:test:unit`: Hardhat unit tests only
- `npm run evm:test:local`: local harness verification only
- `npm run evm:benchmark:gas`

## Notes

- Run the commands in this guide from the repository root.
- Hardhat paths are configured from the repository root in `hardhat.config.ts`.
- `hardhat compile` writes TypeChain output to `implementations/evm/typechain-types`.
- `npm run evm:test` is the default EVM test entrypoint. It runs `evm:typecheck`, the Hardhat unit tests, and the local harness verification flow.
- `npm run evm:benchmark:gas` runs the default gas benchmark preset. Pass flags such as `--range`, `--runs`, or `--bins` after `--` when you want a heavier run.
- `EpochPermutationBenchmark` keeps the same stateful generation flow with a compact benchmark event surface.
- `PermutationBatchHarness` is the stable local caller for realistic end-to-end runs. It keeps the caller address fixed across batches, which matters because epoch rotation mixes in `msg.sender`, and it tracks duplicates on-chain with a bitmap.
- The harness exposes read methods such as `hasDuplicates()`, `seen(value)`, and `getStatus()` for local verification runs.
- `npm run evm:test:local` is the full-range EVM harness verification path. It deploys both permutation contracts and both harnesses on the local Hardhat network, then writes gas and duplicate-tracking artifacts under `results/local-verification/`.

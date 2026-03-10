# Epoch Permutation

## Epoch-Based Feistel Permutation for Deterministic Sequence Generation on Blockchain Networks

<p align="center">
  <a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-blue?style=for-the-badge" height="28" style="vertical-align: middle;" /></a>
</p>

<p align="center">
  <img src="assets/ethereum.svg" height="56" alt="Ethereum" style="vertical-align: middle;" />
  <img src="assets/solidity.svg" height="56" alt="Solidity" style="vertical-align: middle;" />
  <img src="assets/hardhat.svg" height="56" alt="Hardhat" style="vertical-align: middle;" />
  <img src="assets/javascript.svg" height="56" alt="JavaScript" style="vertical-align: middle;" />
  <img src="assets/rust.svg" height="56" alt="Rust" style="vertical-align: middle;" />
  <img src="assets/solana.svg" height="56" alt="Solana" style="vertical-align: middle;" />
  <img src="assets/cosmwasm.svg" height="56" alt="CosmWasm" style="vertical-align: middle;" />
  <img src="assets/aptos.svg" height="56" alt="Aptos" style="vertical-align: middle;" />
  <img src="assets/starknet.svg" height="56" alt="Starknet" style="vertical-align: middle;" />
  <img src="assets/sui.svg" height="56" alt="Sui" style="vertical-align: middle;" />
</p>

`EpochPermutation` is a deterministic permutation generator for bounded, non-repeating sequences. It avoids storing a pre-shuffled array and uses epoch-based seed rotation to limit advance computation of future mappings.

Epoch seeds are revealed only when their epoch becomes active, preventing advance computation of future mappings. This limits the ability for observers to target specific upcoming outputs through transaction reordering or front-running (MEV) strategies, while preserving deterministic behavior within the active epoch.

The resulting sequence is bounded, non-repeating, compact, and reproducible. In the repository’s EVM benchmarks, it is also less gas-intensive than the benchmarked sparse Fisher–Yates variant.

_The repo includes JavaScript and Solidity reference implementations, a shared Rust core with Solana and CosmWasm adapters, and native ports for Aptos Move, Starknet (Cairo), and Sui Move._

![Example permutation scatter plot](assets/permutation-scatter.svg)

<details>
<summary>Reference run metadata and epoch seeds</summary>

![Reference run metadata and epoch seeds](assets/permutation-scatter-details.svg)

</details>

<details>
<summary>Local harness verification gas curve</summary>

![Local harness verification gas curve](assets/local-permutation-verification.svg)

</details>

_This repository does not include a public testnet deployment. Public faucet access to testnet ETH was not reliable enough for a repeatable deployment workflow, so EVM validation was performed on the local Hardhat network._

## Table of Contents

- [Requirements](#requirements)
- [Setup](#setup)
- [Quick start](#quick-start)
- [How It Works](#how-it-works)
- [Implementation Guides](#implementation-guides)
- [Commands](#commands)
- [License](#license)

## Requirements

- Node.js and npm
- `npm install`
- Additional toolchains are only needed if you are working on a specific runtime guide below

## Setup

```powershell
npm install
```

That is enough for the root JavaScript and local EVM workflows. If you want Rust, Aptos, Starknet, or Sui commands, use the implementation guide for that target.

## Quick start

Run the full EVM test flow.

```powershell
npm run evm:test
```

This is the default EVM entrypoint. It runs `evm:typecheck`, `evm:test:unit`, and `evm:test:local` together.

Run the JavaScript reference tests.

```powershell
npm run js:test
```

## How It Works

Each instance fixes an `EPOCH_SIZE` and a `GLOBAL_SEED`, then applies an epoch-local Feistel permutation followed by a full-range Feistel permutation. In deterministic JS mode, `view()` can reconstruct any index from the configured seed; in JS runtime mode and in the EVM contract, read-only lookup is only exact for the current epoch.

<p align="center">
  <img src="assets/how-it-works-diagram.svg" alt="Epoch Permutation flow diagram" width="980" />
</p>

## Implementation Guides

| Target                   | Guide                                                                      |
| ------------------------ | -------------------------------------------------------------------------- |
| Repo-wide matrix         | [`implementations/README.md`](implementations/README.md)                   |
| EVM / Solidity           | [`implementations/evm/README.md`](implementations/evm/README.md)           |
| JavaScript               | [`implementations/js/README.md`](implementations/js/README.md)             |
| Rust / Solana / CosmWasm | [`implementations/rust/README.md`](implementations/rust/README.md)         |
| Aptos Move               | [`implementations/aptos/README.md`](implementations/aptos/README.md)       |
| Starknet / Cairo         | [`implementations/starknet/README.md`](implementations/starknet/README.md) |
| Sui Move                 | [`implementations/sui/README.md`](implementations/sui/README.md)           |

## Commands

### Repo-wide

| Goal                                         | Command               |
| -------------------------------------------- | --------------------- |
| Remove generated outputs and caches          | `npm run repo:clean`  |
| Run the full cross-runtime verification pass | `npm run repo:verify` |

### EVM

| Goal                                                                                    | Command                     |
| --------------------------------------------------------------------------------------- | --------------------------- |
| Compile contracts                                                                       | `npm run evm:compile`       |
| Typecheck Hardhat + TypeScript integration                                              | `npm run evm:typecheck`     |
| Run the full EVM test flow: typecheck, unit tests, and local harness verification       | `npm run evm:test`          |
| Run the contract assertions in `implementations/evm/test`                               | `npm run evm:test:unit`     |
| Run the end-to-end harness flow and write artifacts under `results/local-verification/` | `npm run evm:test:local`    |
| Run the EVM gas benchmark preset                                                        | `npm run evm:benchmark:gas` |

### JavaScript

| Goal                                           | Command             |
| ---------------------------------------------- | ------------------- |
| Run the JS stress runner with default settings | `npm run js:stress` |
| Run the JS test preset                         | `npm run js:test`   |

### Rust / Solana / CosmWasm

| Goal                       | Command                       |
| -------------------------- | ----------------------------- |
| Test the Rust workspace    | `npm run rust:test`           |
| Check the Rust workspace   | `npm run rust:check`          |
| Build the Solana adapter   | `npm run rust:build:solana`   |
| Build the CosmWasm adapter | `npm run rust:build:cosmwasm` |

### Aptos

| Goal                      | Command                 |
| ------------------------- | ----------------------- |
| Compile the Aptos package | `npm run aptos:compile` |
| Test the Aptos package    | `npm run aptos:test`    |

### Starknet

| Goal                       | Command                  |
| -------------------------- | ------------------------ |
| Build the Starknet package | `npm run starknet:build` |
| Test the Starknet package  | `npm run starknet:test`  |

### Sui

| Goal                  | Command             |
| --------------------- | ------------------- |
| Build the Sui package | `npm run sui:build` |
| Test the Sui package  | `npm run sui:test`  |

## License

MIT. See [`LICENSE`](LICENSE).

# Rust Implementation

## Scope

This directory is a Rust workspace containing the shared core crate plus the
Solana and CosmWasm adapters.

## Layout

| Path                   | Verified purpose                                         |
| ---------------------- | -------------------------------------------------------- |
| `Cargo.toml`           | Workspace manifest for `core`, `solana`, and `cosmwasm`. |
| `core/src/lib.rs`      | Shared algorithm crate.                                  |
| `solana/src/lib.rs`    | Solana adapter around the shared core.                   |
| `cosmwasm/src/lib.rs`  | CosmWasm contract wrapper around the shared core.        |
| `scripts/runCargo.cjs` | Cargo wrapper used by the root `rust:*` commands.        |

## Requirements

| Requirement                     | Notes                                                     |
| ------------------------------- | --------------------------------------------------------- |
| Node.js and npm                 | Required for the root `npm run rust:*` commands.          |
| `npm install`                   | Installs the wrapper and repo-level tooling dependencies. |
| Rust and `cargo`                | Required to build and test the Rust workspace.            |
| `wasm32-unknown-unknown` target | Required for `npm run rust:build:cosmwasm`.               |

## Commands

Run these commands from the repository root.

| Command                       | Verified behavior                                                                         |
| ----------------------------- | ----------------------------------------------------------------------------------------- |
| `npm run rust:test`           | Runs `cargo test --manifest-path implementations/rust/Cargo.toml --workspace`.            |
| `npm run rust:check`          | Runs `cargo check --manifest-path implementations/rust/Cargo.toml --workspace`.           |
| `npm run rust:build:solana`   | Builds package `epoch-permutation-solana`.                                                |
| `npm run rust:build:cosmwasm` | Builds package `epoch-permutation-cosmwasm` for `wasm32-unknown-unknown` in release mode. |

## Tooling

The root npm commands do not invoke Cargo directly; they go through
`implementations/rust/scripts/runCargo.cjs`. On Windows, the wrapper
initializes the Visual Studio C++ build environment before invoking Cargo.

## Implementation Notes

| Topic            | Verified detail                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Source layout    | All handwritten Rust sources live in `src/lib.rs` files; tests are inline `#[cfg(test)]` modules rather than separate `tests/` directories. |
| Core features    | `core` exposes optional `serde` and `borsh` features.                                                                                       |
| Solana adapter   | Enables the core `borsh` feature.                                                                                                           |
| CosmWasm adapter | Enables the core `serde` feature.                                                                                                           |
| Lockfile         | `Cargo.lock` at this directory root is the shared workspace lockfile.                                                                       |

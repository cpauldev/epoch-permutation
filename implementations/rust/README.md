# Rust Implementation

This directory contains the Rust workspace for the shared core plus the Solana and CosmWasm adapters.

## Requirements

- Node.js and npm
- `npm install`
- Rust and `cargo`
- The `wasm32-unknown-unknown` Rust target for `npm run rust:build:cosmwasm`

## Layout

- `Cargo.toml`: workspace manifest
- `core/`: shared algorithm crate
- `solana/`: Solana adapter crate
- `cosmwasm/`: CosmWasm adapter crate
- `scripts/`: Cargo wrapper used by the root npm commands

## Commands

- `npm run rust:test`
- `npm run rust:check`
- `npm run rust:build:solana`
- `npm run rust:build:cosmwasm`

## Notes

- Run the commands in this guide from the repository root.
- Tests stay inline in each crate under `#[cfg(test)]`.
- The workspace keeps a single lockfile at this directory root.
- On Windows, the wrapper initializes the Visual Studio C++ build environment before invoking Cargo.

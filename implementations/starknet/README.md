# Starknet Implementation

This directory contains the Cairo/Starknet port of Epoch Permutation.

## Requirements

- Node.js and npm
- `npm install`
- `scarb`
- `snforge`

## Layout

- `Scarb.toml`: package manifest
- `Scarb.lock`: resolved toolchain dependencies
- `src/lib.cairo`: implementation and inline tests

## Commands

- `npm run starknet:build`
- `npm run starknet:test`

## Notes

- Run the commands in this guide from the repository root.
- Use `snforge test` for the local test path.
- The contract derives its entropy inputs from Starknet runtime values such as block number, block timestamp, caller address, contract address, and chain id.
- Scarb and Starknet Foundry write build and cache output under their standard working directories.

# Sui Implementation

This directory contains the Sui Move port of Epoch Permutation.

## Requirements

- Node.js and npm
- `npm install`
- `sui` CLI

## Layout

- `Move.toml`: package manifest
- `Move.lock`: resolved framework dependencies
- `sources/epoch_permutation.move`: implementation and inline tests

## Commands

- `npm run sui:build`
- `npm run sui:test`

## Notes

- Run the commands in this guide from the repository root.
- The package uses the Sui object and transaction-context model to drive the bounded permutation flow.
- Sui build output is written under `build/`.
- On first use, the Sui CLI may initialize a local client config under the user's home directory.

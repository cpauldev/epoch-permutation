# Aptos Implementation

This directory contains the Aptos Move port of Epoch Permutation.

## Requirements

- Node.js and npm
- `npm install`
- The root npm commands use the npm-installed `@aptos-labs/aptos-cli` binary when it is present and otherwise fall back to a system `aptos` binary

## Layout

- `Move.toml`: package manifest
- `sources/epoch_permutation.move`: implementation and inline tests

## Commands

- `npm run aptos:compile`
- `npm run aptos:test`

## Notes

- Run the commands in this guide from the repository root.
- The root npm commands invoke the Aptos CLI through `implementations/tooling/runExternal.cjs`.
- Aptos CLI build output is written under `build/`.
- The package uses Move-native state and chain context to drive the bounded permutation flow.

const fs = require("node:fs");

const GENERATED_PATHS = [
  "artifacts",
  "cache",
  "results",
  "implementations/aptos/build",
  "implementations/evm/typechain-types",
  "implementations/rust/target",
  "implementations/starknet/.snfoundry_cache",
  "implementations/starknet/snfoundry_trace",
  "implementations/starknet/target",
  "implementations/sui/build",
  "gas-report.txt",
];

for (const generatedPath of GENERATED_PATHS) {
  fs.rmSync(generatedPath, { recursive: true, force: true });
}

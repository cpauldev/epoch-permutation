const { spawnSync } = require("node:child_process");
const { buildCargoEnv, resolveCargoPath } = require("./lib/cargoRuntime.cjs");

function main() {
  const cargoPath = resolveCargoPath();
  const cargoArgs = process.argv.slice(2);

  if (cargoArgs.length === 0) {
    console.error(
      "Usage: node implementations/rust/scripts/runCargo.cjs <cargo args...>",
    );
    process.exit(1);
  }

  const result = spawnSync(cargoPath, cargoArgs, {
    cwd: process.cwd(),
    env: buildCargoEnv(),
    stdio: "inherit",
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}

main();

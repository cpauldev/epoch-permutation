const {
  parseExternalArgs,
  resolveBinary,
  spawnExternal,
} = require("./lib/externalTooling.cjs");

function main() {
  const { tool, cwd, passthrough } = parseExternalArgs(process.argv.slice(2));
  const binary = resolveBinary(tool);

  if (!binary) {
    console.error(
      `Unable to locate ${tool}. Install it and re-run the command.`,
    );
    process.exit(1);
  }

  const result = spawnExternal(binary, passthrough, cwd);
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}

main();

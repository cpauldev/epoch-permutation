const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  getEnvPath,
  mergePathEntries,
  setEnvPath,
} = require("../../../scripts/lib/cjs/env.cjs");

function homePath(...parts) {
  return path.join(os.homedir(), ...parts);
}

function localPath(...parts) {
  return path.join(process.cwd(), ...parts);
}

function candidateBinaries(tool) {
  const windows = process.platform === "win32";
  const localBin = "node_modules/.bin";
  const exeExt = windows ? ".exe" : "";

  switch (tool) {
    case "scarb":
      return [homePath(".local", "bin", `scarb${exeExt}`), "scarb"];
    case "sui":
      return [homePath(".sui", "bin", `sui${exeExt}`), "sui"];
    case "aptos":
      return windows
        ? [
            localPath(
              "node_modules",
              "@aptos-labs",
              "aptos-cli",
              "dist",
              "utils",
              "aptos-cli.exe",
            ),
            localPath(localBin, "aptos.cmd"),
            localPath(localBin, "aptos.exe"),
            "aptos",
          ]
        : [
            localPath(localBin, "aptos"),
            homePath(".local", "bin", "aptos"),
            "aptos",
          ];
    case "snforge":
      return [homePath(".cargo", "bin", `snforge${exeExt}`), "snforge"];
    default:
      return [tool];
  }
}

function resolveFromPath(binary) {
  const command = process.platform === "win32" ? "where.exe" : "which";
  const result = spawnSync(command, [binary], {
    encoding: "utf8",
    shell: false,
  });

  if (result.status !== 0) {
    return null;
  }

  const [firstMatch] = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return firstMatch || null;
}

function resolveBinary(tool) {
  for (const candidate of candidateBinaries(tool)) {
    if (path.isAbsolute(candidate)) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
      continue;
    }

    const resolved = resolveFromPath(candidate);
    if (resolved) {
      return resolved;
    }
  }

  return null;
}

function parseExternalArgs(argv) {
  if (argv.length === 0) {
    throw new Error(
      "Usage: node implementations/tooling/runExternal.cjs <tool> [--cwd path] [-- args...]",
    );
  }

  const tool = argv[0];
  let cwd = process.cwd();
  const passthrough = [];

  for (let index = 1; index < argv.length; index++) {
    const part = argv[index];
    if (part === "--cwd") {
      cwd = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (part === "--") {
      passthrough.push(...argv.slice(index + 1));
      break;
    }

    passthrough.push(part);
  }

  return { tool, cwd, passthrough };
}

function quoteForCmd(argument) {
  if (argument.length === 0) {
    return '""';
  }
  if (!/[ \t"&()<>^|]/.test(argument)) {
    return argument;
  }

  return `"${argument.replace(/"/g, '""')}"`;
}

function spawnExternal(binary, args, cwd) {
  const isCmdScript =
    process.platform === "win32" &&
    [".cmd", ".bat"].includes(path.extname(binary).toLowerCase());
  const env = { ...process.env };

  if (path.isAbsolute(binary)) {
    const mergedEntries = mergePathEntries([
      path.dirname(binary),
      getEnvPath(env),
    ]);
    setEnvPath(env, mergedEntries.join(path.delimiter));
  }

  if (isCmdScript) {
    const commandLine = [quoteForCmd(binary), ...args.map(quoteForCmd)].join(
      " ",
    );
    return spawnSync(
      process.env.ComSpec || "cmd.exe",
      ["/d", "/s", "/c", commandLine],
      {
        cwd,
        env,
        stdio: "inherit",
        shell: false,
      },
    );
  }

  return spawnSync(binary, args, {
    cwd,
    env,
    stdio: "inherit",
    shell: false,
  });
}

module.exports = {
  parseExternalArgs,
  resolveBinary,
  spawnExternal,
};

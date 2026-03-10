const { spawnSync } = require("node:child_process");
const path = require("node:path");

function quoteForCmd(argument) {
  if (argument.length === 0) {
    return '""';
  }
  if (!/[ \t"&()<>^|]/.test(argument)) {
    return argument;
  }

  return `"${argument.replace(/"/g, '""')}"`;
}

function runCommand(command, args, options = {}) {
  const isCmdScript =
    process.platform === "win32" &&
    [".cmd", ".bat"].includes(path.extname(command).toLowerCase());

  if (isCmdScript) {
    const commandLine = [quoteForCmd(command), ...args.map(quoteForCmd)].join(
      " ",
    );
    return spawnSync(
      process.env.ComSpec || "cmd.exe",
      ["/d", "/s", "/c", commandLine],
      {
        shell: false,
        stdio: "inherit",
        ...options,
      },
    );
  }

  return spawnSync(command, args, {
    shell: false,
    stdio: "inherit",
    ...options,
  });
}

function exitOnCommandFailure(result) {
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

module.exports = {
  exitOnCommandFailure,
  runCommand,
};

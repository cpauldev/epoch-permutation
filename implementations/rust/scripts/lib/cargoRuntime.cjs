const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  getEnvPath,
  mergePathEntries,
  setEnvPath,
} = require("../../../../scripts/lib/cjs/env.cjs");

function resolveCargoPath() {
  const home = os.homedir();
  const candidates =
    process.platform === "win32"
      ? [path.join(home, ".cargo", "bin", "cargo.exe"), "cargo"]
      : [path.join(home, ".cargo", "bin", "cargo"), "cargo"];

  for (const candidate of candidates) {
    if (candidate === "cargo" || fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error("cargo was not found. Install Rust with rustup first.");
}

function resolveWindowsVcvars() {
  const explicitVsWhere = path.join(
    process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)",
    "Microsoft Visual Studio",
    "Installer",
    "vswhere.exe",
  );
  const candidateInstallations = [];

  if (fs.existsSync(explicitVsWhere)) {
    const result = spawnSync(
      explicitVsWhere,
      [
        "-products",
        "*",
        "-requires",
        "Microsoft.VisualStudio.Component.VC.Tools.x86.x64",
        "-property",
        "installationPath",
      ],
      { encoding: "utf8" },
    );

    if (result.status === 0) {
      const lines = result.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      candidateInstallations.push(...lines);
    }
  }

  candidateInstallations.push(
    "C:\\Program Files (x86)\\Microsoft Visual Studio\\2022\\BuildTools",
    "C:\\Program Files\\Microsoft Visual Studio\\2022\\BuildTools",
  );

  for (const installation of candidateInstallations) {
    const vcvars = path.join(
      installation,
      "VC",
      "Auxiliary",
      "Build",
      "vcvars64.bat",
    );
    if (fs.existsSync(vcvars)) {
      return vcvars;
    }
  }

  throw new Error(
    "Visual Studio C++ build tools were not found. Install Visual Studio Build Tools with the C++ workload.",
  );
}

function loadWindowsBuildEnv() {
  const vcvars = resolveWindowsVcvars();
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "epoch-permutation-vcvars-"),
  );
  const bootstrapPath = path.join(tempDir, "bootstrap.cmd");
  fs.writeFileSync(
    bootstrapPath,
    `@echo off\r\ncall "${vcvars}" >nul\r\nset\r\n`,
    "utf8",
  );

  const result = spawnSync("cmd.exe", ["/d", "/c", bootstrapPath], {
    encoding: "utf8",
  });
  fs.rmSync(tempDir, { recursive: true, force: true });

  if (result.status !== 0) {
    throw new Error(
      result.stderr ||
        result.stdout ||
        "Failed to initialize the Visual Studio build environment.",
    );
  }

  const env = { ...process.env };
  for (const line of result.stdout.split(/\r?\n/)) {
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex);
    const value = line.slice(separatorIndex + 1);
    env[key] = value;
  }

  const mergedEntries = mergePathEntries([
    path.join(os.homedir(), ".cargo", "bin"),
    getEnvPath(process.env),
    getEnvPath(env),
  ]);
  setEnvPath(env, mergedEntries.join(path.delimiter));
  return env;
}

function buildCargoEnv() {
  if (process.platform !== "win32") {
    return process.env;
  }

  return loadWindowsBuildEnv();
}

module.exports = {
  buildCargoEnv,
  resolveCargoPath,
};

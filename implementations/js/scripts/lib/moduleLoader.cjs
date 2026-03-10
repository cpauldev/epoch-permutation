const path = require("node:path");
const { pathToFileURL } = require("node:url");

function localModuleUrl(...parts) {
  return pathToFileURL(path.resolve(__dirname, "..", "..", "src", ...parts))
    .href;
}

async function loadEpochPermutationModule() {
  return import(localModuleUrl("EpochPermutation.js"));
}

async function loadEpochPermutationConfigModule() {
  return import(localModuleUrl("config.js"));
}

module.exports = {
  loadEpochPermutationConfigModule,
  loadEpochPermutationModule,
};

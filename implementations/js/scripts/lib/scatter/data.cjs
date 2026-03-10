const { toHex } = require("./shared.cjs");

function buildEpochRows(model, maxRange) {
  const epochCount = Math.ceil(maxRange / model.EPOCH_SIZE);
  const rows = [];

  for (let epochIndex = 0; epochIndex < epochCount; epochIndex++) {
    const startIndex = epochIndex * model.EPOCH_SIZE;
    const endIndex = Math.min(maxRange - 1, startIndex + model.EPOCH_SIZE - 1);
    rows.push({
      epoch: epochIndex + 1,
      epochIndex,
      startIndex,
      endIndex,
      seed: toHex(model._computeEpochSeed(epochIndex), 64),
    });
  }

  return rows;
}

function buildPoints(model, maxRange) {
  const points = [];
  for (let sequenceIndex = 0; sequenceIndex < maxRange; sequenceIndex++) {
    points.push({
      sequenceIndex,
      generatedValue: model.getNext(),
      epoch: Math.floor(sequenceIndex / model.EPOCH_SIZE) + 1,
    });
  }

  return points;
}

function countDetectedDuplicates(points) {
  const seen = new Set();
  let duplicates = 0;

  for (const point of points) {
    if (seen.has(point.generatedValue)) {
      duplicates += 1;
      continue;
    }

    seen.add(point.generatedValue);
  }

  return duplicates;
}

function buildMetadata(model, epochRows, maxRange, fixedSeed, points) {
  return {
    maxRange,
    epochSize: model.EPOCH_SIZE,
    epochCount: epochRows.length,
    duplicateCount: countDetectedDuplicates(points),
    fixedSeed: toHex(fixedSeed),
    globalSeed: toHex(model.GLOBAL_SEED, 64),
  };
}

module.exports = {
  buildEpochRows,
  buildMetadata,
  buildPoints,
};

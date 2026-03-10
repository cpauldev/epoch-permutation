const { COLORS } = require("./constants.cjs");
const { escapeXml, formatNumber } = require("./shared.cjs");

function buildScatterContext(maxRange) {
  const width = 1600;
  const height = 940;
  const marginLeft = 110;
  const marginRight = 60;
  const marginTop = 176;
  const marginBottom = 108;
  const plotWidth = width - marginLeft - marginRight;
  const plotHeight = height - marginTop - marginBottom;
  const plotLeft = marginLeft;
  const plotTop = marginTop;
  const plotBottom = plotTop + plotHeight;

  return {
    width,
    height,
    plotLeft,
    plotTop,
    plotWidth,
    plotHeight,
    plotBottom,
    marginBottom,
    maxRange,
  };
}

function xFor(sequenceIndex, context) {
  if (context.maxRange <= 1) {
    return context.plotLeft;
  }

  return (
    context.plotLeft +
    (sequenceIndex / (context.maxRange - 1)) * context.plotWidth
  );
}

function yFor(generatedValue, context) {
  if (context.maxRange <= 1) {
    return context.plotBottom;
  }

  return (
    context.plotBottom -
    ((generatedValue - 1) / (context.maxRange - 1)) * context.plotHeight
  );
}

function buildTicks(maxValue, count) {
  const ticks = [];
  for (let step = 0; step <= count; step++) {
    const ratio = step / count;
    const value = step === count ? maxValue : Math.round(maxValue * ratio);
    ticks.push({ ratio, value });
  }
  return ticks;
}

function buildIndexTicks(maxIndex, count) {
  if (maxIndex <= count) {
    return Array.from({ length: maxIndex + 1 }, (_, value) => ({
      ratio: maxIndex === 0 ? 0 : value / maxIndex,
      value,
    }));
  }

  const ticks = [];
  for (let step = 0; step < count; step++) {
    const value = Math.round((step * (maxIndex + 1)) / count);
    ticks.push({
      ratio: maxIndex === 0 ? 0 : value / maxIndex,
      value,
    });
  }
  ticks.push({ ratio: 1, value: maxIndex });
  return ticks;
}

function buildEpochBands(epochRows, context) {
  return epochRows
    .map((row) => {
      const x = xFor(row.startIndex, context);
      const nextStart = row.endIndex + 1;
      const bandRight =
        nextStart >= context.maxRange
          ? context.plotLeft + context.plotWidth
          : xFor(nextStart, context);
      const color = row.epoch % 2 === 1 ? COLORS.bandA : COLORS.bandB;
      return `<rect x="${x.toFixed(2)}" y="${context.plotTop}" width="${(
        bandRight - x
      ).toFixed(2)}" height="${context.plotHeight}" fill="${color}" />`;
    })
    .join("");
}

function epochCenter(row, context) {
  return xFor((row.startIndex + row.endIndex) / 2, context);
}

function estimateEpochLabelWidth(row) {
  return String(row.epoch).length * 8 + 18;
}

function buildTopTickLabels(epochRows, context) {
  const minSpacing = 56;
  const maxLabels = Math.min(
    epochRows.length,
    Math.max(2, Math.floor(context.plotWidth / minSpacing)),
  );

  if (epochRows.length <= maxLabels) {
    return epochRows;
  }

  const lastIndex = epochRows.length - 1;

  function buildCandidates(count) {
    const indices = [];

    for (let slot = 0; slot < count; slot++) {
      indices.push(Math.round((slot * lastIndex) / (count - 1)));
    }

    const uniqueIndices = indices.filter(
      (index, position) => position === 0 || index !== indices[position - 1],
    );
    return uniqueIndices.map((index) => ({
      row: epochRows[index],
      center: epochCenter(epochRows[index], context),
      width: estimateEpochLabelWidth(epochRows[index]),
    }));
  }

  function fits(candidates) {
    for (let index = 1; index < candidates.length; index++) {
      const previous = candidates[index - 1];
      const current = candidates[index];
      const requiredGap = Math.max(
        minSpacing,
        (previous.width + current.width) / 2 + 8,
      );

      if (current.center - previous.center < requiredGap) {
        return false;
      }
    }

    return true;
  }

  for (let count = maxLabels; count >= 2; count--) {
    const candidates = buildCandidates(count);
    if (candidates.length !== count) {
      continue;
    }

    if (fits(candidates)) {
      return candidates.map((entry) => entry.row);
    }
  }

  return [epochRows[0], epochRows[lastIndex]];
}

function buildGridAndAxes(context, topTickLabels) {
  const xTicks = buildIndexTicks(context.maxRange - 1, 5);
  const yTicks = buildTicks(context.maxRange, 5);
  const grid = [];
  const labels = [];

  xTicks.forEach((tick) => {
    const x = context.plotLeft + tick.ratio * context.plotWidth;
    grid.push(
      `<line x1="${x.toFixed(2)}" y1="${context.plotTop}" x2="${x.toFixed(
        2,
      )}" y2="${context.plotBottom}" stroke="${COLORS.grid}" stroke-width="1" />`,
    );
    labels.push(
      `<text x="${x.toFixed(2)}" y="${context.plotBottom + 34}" text-anchor="middle" font-size="14" fill="${COLORS.muted}">${escapeXml(
        formatNumber(tick.value),
      )}</text>`,
    );
  });

  yTicks.forEach((tick) => {
    const y = context.plotBottom - tick.ratio * context.plotHeight;
    grid.push(
      `<line x1="${context.plotLeft}" y1="${y.toFixed(
        2,
      )}" x2="${context.plotLeft + context.plotWidth}" y2="${y.toFixed(
        2,
      )}" stroke="${COLORS.grid}" stroke-width="1" />`,
    );
    labels.push(
      `<text x="${context.plotLeft - 18}" y="${(y + 5).toFixed(
        2,
      )}" text-anchor="end" font-size="14" fill="${COLORS.muted}">${escapeXml(
        formatNumber(tick.value),
      )}</text>`,
    );
  });

  const topLabels = topTickLabels
    .map((row) => {
      const center = epochCenter(row, context);
      return `<g><line x1="${center.toFixed(2)}" y1="${context.plotTop - 16}" x2="${center.toFixed(
        2,
      )}" y2="${context.plotTop}" stroke="${COLORS.border}" stroke-width="1" /><text x="${center.toFixed(
        2,
      )}" y="${context.plotTop - 23}" text-anchor="middle" font-size="14" fill="${COLORS.muted}">${row.epoch}</text></g>`;
    })
    .join("");

  const axes = [
    `<rect x="${context.plotLeft}" y="${context.plotTop}" width="${context.plotWidth}" height="${context.plotHeight}" fill="none" stroke="${COLORS.border}" stroke-width="1.5" />`,
    `<text x="${(context.plotLeft + context.plotWidth / 2).toFixed(
      2,
    )}" y="${context.plotTop - 54}" text-anchor="middle" font-size="16" fill="${COLORS.text}">Epoch index</text>`,
    `<text x="${(context.plotLeft + context.plotWidth / 2).toFixed(
      2,
    )}" y="${context.height - 34}" text-anchor="middle" font-size="16" fill="${COLORS.text}">Sequence index (0-based)</text>`,
    `<text x="34" y="${(context.plotTop + context.plotHeight / 2).toFixed(
      2,
    )}" text-anchor="middle" font-size="16" fill="${COLORS.text}" transform="rotate(-90 34 ${
      context.plotTop + context.plotHeight / 2
    })">Generated value (1-based)</text>`,
  ].join("");

  return `${grid.join("")}${axes}${labels.join("")}${topLabels}`;
}

function buildPointLayer(points, context) {
  return points
    .map((point) => {
      const color = point.epoch % 2 === 1 ? COLORS.dotA : COLORS.dotB;
      return `<circle cx="${xFor(point.sequenceIndex, context).toFixed(
        2,
      )}" cy="${yFor(point.generatedValue, context).toFixed(
        2,
      )}" r="1.05" fill="${color}" fill-opacity="0.7" />`;
    })
    .join("");
}

function renderScatterOverviewSvg({ context, points, epochRows }) {
  const topTickLabels = buildTopTickLabels(epochRows, context);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${context.width} ${context.height}" width="${context.width}" height="${context.height}" role="img" aria-labelledby="overview-title overview-subtitle" font-family="Arial, sans-serif">
  <title id="overview-title">Example permutation output sequence</title>
  <desc id="overview-subtitle">Full-range scatter of generated value versus sequence index for one fixed-seed JavaScript reference run. Alternating bands denote epoch boundaries.</desc>
  <rect width="${context.width}" height="${context.height}" fill="${COLORS.background}" />
  <rect x="${context.plotLeft}" y="${context.plotTop}" width="${context.plotWidth}" height="${context.plotHeight}" fill="${COLORS.plotBackground}" />
  <text x="${context.plotLeft}" y="46" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="${COLORS.text}">Example Permutation Output Sequence</text>
  <text x="${context.plotLeft}" y="72" font-family="Arial, sans-serif" font-size="16" fill="${COLORS.muted}">Generated value versus sequence index for one full deterministic run. Alternating bands denote epoch boundaries.</text>
  ${buildEpochBands(epochRows, context)}
  ${buildGridAndAxes(context, topTickLabels)}
  ${buildPointLayer(points, context)}
</svg>`;
}

module.exports = {
  buildScatterContext,
  renderScatterOverviewSvg,
};

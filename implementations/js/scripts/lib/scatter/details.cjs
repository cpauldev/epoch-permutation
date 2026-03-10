const { COLORS, SEED_FONT } = require("./constants.cjs");
const {
  buildClipPath,
  escapeXml,
  formatNumber,
  renderTableShell,
} = require("./shared.cjs");

function renderSummaryTable({ left, top, width, metadata, defs }) {
  const headerHeight = 34;
  const rowHeight = 46;
  const totalHeight = headerHeight + rowHeight;
  const columns = [
    {
      label: "Generated values",
      value: formatNumber(metadata.maxRange),
      width: 140,
      align: "end",
      fontSize: 15,
    },
    {
      label: "Epoch size",
      value: formatNumber(metadata.epochSize),
      width: 140,
      align: "end",
      fontSize: 15,
    },
    {
      label: "Epoch count",
      value: formatNumber(metadata.epochCount),
      width: 140,
      align: "end",
      fontSize: 15,
    },
    {
      label: "Detected duplicates",
      value: formatNumber(metadata.duplicateCount),
      width: 188,
      align: "end",
      fontSize: 15,
    },
    {
      label: "Fixed seed",
      value: metadata.fixedSeed,
      width: 220,
      clipId: "summary-fixed-seed",
      fontFamily: SEED_FONT,
      fontSize: 14,
    },
    {
      label: "Global seed",
      value: metadata.globalSeed,
      width: 780,
      clipId: "summary-global-seed",
      fontFamily: SEED_FONT,
      fontSize: 14,
    },
  ];

  let currentX = left;
  const labelY = top + 22;
  const valueY = top + headerHeight + 29;
  const verticalRuleXs = [];
  const labels = [];
  const values = [];

  columns.forEach((column, index) => {
    const columnLeft = currentX;
    const columnRight = columnLeft + column.width;
    const textLeft = columnLeft + 14;
    const textRight = columnRight - 14;
    const valueX = column.align === "end" ? textRight : textLeft;
    const valueAnchor = column.align === "end" ? "end" : "start";

    if (column.clipId) {
      defs.push(
        buildClipPath(
          column.clipId,
          textLeft,
          top + headerHeight + 10,
          column.width - 28,
          24,
        ),
      );
    }

    labels.push(
      `<text x="${textLeft}" y="${labelY}" font-size="14" font-weight="700" fill="${COLORS.text}">${escapeXml(column.label)}</text>`,
    );
    values.push(
      `<text x="${valueX}" y="${valueY}" text-anchor="${valueAnchor}" font-size="${column.fontSize}" fill="${COLORS.text}"${
        column.clipId ? ` clip-path="url(#${column.clipId})"` : ""
      }${column.fontFamily ? ` font-family="${column.fontFamily}"` : ""}>${escapeXml(column.value)}</text>`,
    );

    currentX = columnRight;
    if (index < columns.length - 1) {
      verticalRuleXs.push(currentX);
    }
  });

  return {
    height: totalHeight,
    content: `<g>
      ${renderTableShell({
        left,
        top,
        width,
        height: totalHeight,
        headerHeight,
        verticalRuleXs,
        colors: COLORS,
      })}
      ${labels.join("")}
      ${values.join("")}
    </g>`,
  };
}

function renderScatterDetailsSvg({ metadata, epochRows }) {
  const width = 1720;
  const left = 56;
  const contentWidth = width - left * 2;
  const summaryTop = 110;
  const summaryGap = 28;
  const rowHeight = 34;
  const headerHeight = 40;
  const bottomPadding = 42;
  const column = {
    epoch: 180,
    start: 180,
    end: 180,
    seed: contentWidth - 180 - 180 - 180,
  };

  column.startX = left;
  column.epochRight = column.startX + column.epoch;
  column.startRight = column.epochRight + column.start;
  column.endRight = column.startRight + column.end;
  column.startValueX = column.startRight;
  column.endValueX = column.endRight;
  column.seedValueX = left + contentWidth - 14;
  column.seedClipX = column.endRight + 14;
  column.seedClipWidth = column.seedValueX - column.seedClipX;

  const defs = [];
  const summary = renderSummaryTable({
    left,
    top: summaryTop,
    width: contentWidth,
    metadata,
    defs,
  });
  const tableTop = summaryTop + summary.height + summaryGap;
  const tableHeight = headerHeight + epochRows.length * rowHeight;
  const height = tableTop + tableHeight + bottomPadding;

  const tableRows = epochRows
    .map((row, index) => {
      const y = tableTop + headerHeight + index * rowHeight;
      const rowLeft = left + 1;
      const rowWidth = contentWidth - 2;
      const clipId = `seed-row-${row.epoch}`;
      defs.push(
        buildClipPath(
          clipId,
          column.seedClipX,
          y + 7,
          column.seedClipWidth,
          22,
        ),
      );

      return `<g>
        <rect x="${rowLeft}" y="${y}" width="${rowWidth}" height="${rowHeight}" fill="${
          index % 2 === 0 ? COLORS.background : COLORS.rowAlt
        }" />
        ${
          index < epochRows.length - 1
            ? `<line x1="${rowLeft}" y1="${y + rowHeight}" x2="${
                rowLeft + rowWidth
              }" y2="${y + rowHeight}" stroke="${COLORS.grid}" stroke-width="1" />`
            : ""
        }
        <text x="${column.startX + 16}" y="${y + 22}" font-size="15" fill="${COLORS.text}">Epoch ${row.epoch}</text>
        <text x="${column.startValueX - 16}" y="${y + 22}" text-anchor="end" font-size="15" fill="${COLORS.text}">${escapeXml(
          formatNumber(row.startIndex),
        )}</text>
        <text x="${column.endValueX - 16}" y="${y + 22}" text-anchor="end" font-size="15" fill="${COLORS.text}">${escapeXml(
          formatNumber(row.endIndex),
        )}</text>
        <text x="${column.seedValueX}" y="${y + 22}" text-anchor="end" font-size="14" fill="${COLORS.text}" font-family="${SEED_FONT}" clip-path="url(#${clipId})">${escapeXml(
          row.seed,
        )}</text>
      </g>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="details-title details-subtitle" font-family="Arial, sans-serif">
  <title id="details-title">Reference run metadata and epoch seeds</title>
  <desc id="details-subtitle">Run parameters and per-epoch seed schedule for the example sequence shown in the overview chart.</desc>
  <defs>${defs.join("")}</defs>
  <rect width="${width}" height="${height}" fill="${COLORS.background}" />
  <text x="${left}" y="46" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="${COLORS.text}">Reference Run Metadata and Epoch Seeds</text>
  <text x="${left}" y="72" font-family="Arial, sans-serif" font-size="16" fill="${COLORS.muted}">Run parameters and per-epoch seed schedule for the example sequence shown in the overview chart.</text>
  ${summary.content}
  ${renderTableShell({
    left,
    top: tableTop,
    width: contentWidth,
    height: tableHeight,
    headerHeight,
    verticalRuleXs: [column.epochRight, column.startRight, column.endRight],
    colors: COLORS,
  })}
  <text x="${column.startX + 16}" y="${tableTop + 25}" font-size="15" font-weight="700" fill="${COLORS.text}">Epoch</text>
  <text x="${column.startValueX - 16}" y="${tableTop + 25}" text-anchor="end" font-size="15" font-weight="700" fill="${COLORS.text}">Start index</text>
  <text x="${column.endValueX - 16}" y="${tableTop + 25}" text-anchor="end" font-size="15" font-weight="700" fill="${COLORS.text}">End index</text>
  <text x="${column.seedValueX}" y="${tableTop + 25}" text-anchor="end" font-size="15" font-weight="700" fill="${COLORS.text}">Seed</text>
  ${tableRows}
  <text x="${left}" y="${height - 16}" font-size="14" fill="${COLORS.muted}">Start and end indices are zero-based sequence indices.</text>
</svg>`;
}

module.exports = {
  renderScatterDetailsSvg,
};

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toHex(value, digits) {
  const hex = value.toString(16);
  return `0x${digits ? hex.padStart(digits, "0") : hex}`;
}

function buildClipPath(id, x, y, width, height) {
  return `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="0" ry="0" /></clipPath>`;
}

function renderTableShell({
  left,
  top,
  width,
  height,
  headerHeight,
  verticalRuleXs = [],
  colors,
}) {
  return `<g>
    <rect x="${left}" y="${top}" width="${width}" height="${height}" fill="${colors.background}" stroke="${colors.border}" stroke-width="1" />
    <rect x="${left}" y="${top}" width="${width}" height="${headerHeight}" fill="${colors.header}" />
    <line x1="${left}" y1="${top + headerHeight}" x2="${left + width}" y2="${top + headerHeight}" stroke="${colors.border}" stroke-width="1" />
    ${verticalRuleXs
      .map(
        (x) =>
          `<line x1="${x}" y1="${top}" x2="${x}" y2="${top + height}" stroke="${colors.border}" stroke-width="1" />`,
      )
      .join("")}
  </g>`;
}

module.exports = {
  buildClipPath,
  escapeXml,
  formatNumber,
  renderTableShell,
  toHex,
};

const fs = require("node:fs");
const path = require("node:path");

const OUT_DIR = path.join(process.cwd(), "assets");

const PALETTE = {
  background: "#ffffff",
  text: "#0f172a",
  muted: "#475569",
  baseFill: "#f8fafc",
  baseStroke: "#cbd5e1",
  decisionFill: "#e0f2fe",
  decisionStroke: "#0284c7",
  branchStateFill: "#ede9fe",
  branchStateStroke: "#7c3aed",
  branchAnswerFill: "#fee2e2",
  branchAnswerStroke: "#dc2626",
  feistelFill: "#fef3c7",
  feistelStroke: "#d97706",
  feistelCoreFill: "#fde68a",
  feistelCoreStroke: "#b45309",
  outputFill: "#dcfce7",
  outputStroke: "#16a34a",
  edge: "#64748b",
  panelStroke: "#e2e8f0",
  panelFill: "#ffffff",
  panelAltFill: "#f8fafc",
};

const THIN_ARROW = { width: 2.25 };

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function lineText(x, y, lines, options = {}) {
  const {
    size = 18,
    weight = 600,
    fill = PALETTE.text,
    anchor = "middle",
    lineHeight = Math.round(size * 1.28),
  } = options;
  const items = Array.isArray(lines) ? lines : [lines];
  const spans = items
    .map(
      (line, index) =>
        `<tspan x="${x}" dy="${index === 0 ? -((items.length - 1) * lineHeight) / 2 : lineHeight}">${escapeXml(line)}</tspan>`,
    )
    .join("");

  return `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="middle" font-size="${size}" font-weight="${weight}" fill="${fill}">${spans}</text>`;
}

function roundedRect({
  x,
  y,
  w,
  h,
  rx = 18,
  fill,
  stroke,
  strokeWidth = 2.5,
  lines,
}) {
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" filter="url(#shadow)" />
    ${lineText(x + w / 2, y + h / 2, lines)}
  `;
}

function pill({ x, y, w, h, fill, stroke, lines, strokeWidth = 2.5 }) {
  return roundedRect({
    x,
    y,
    w,
    h,
    rx: h / 2,
    fill,
    stroke,
    strokeWidth,
    lines,
  });
}

function diamond({ cx, cy, w, h, fill, stroke, strokeWidth = 2.5, lines }) {
  const points = [
    [cx, cy - h / 2],
    [cx + w / 2, cy],
    [cx, cy + h / 2],
    [cx - w / 2, cy],
  ]
    .map(([x, y]) => `${x},${y}`)
    .join(" ");

  return `
    <polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" filter="url(#shadow)" />
    ${lineText(cx, cy, lines)}
  `;
}

function arrow(points, options = {}) {
  const { color = PALETTE.edge, width = 2.75, radius = 18 } = options;
  let d = `M ${points[0][0]} ${points[0][1]}`;

  if (points.length === 2) {
    d += ` L ${points[1][0]} ${points[1][1]}`;
  } else {
    for (let index = 1; index < points.length - 1; index += 1) {
      const [prevX, prevY] = points[index - 1];
      const [currX, currY] = points[index];
      const [nextX, nextY] = points[index + 1];
      const incomingLength = Math.hypot(currX - prevX, currY - prevY);
      const outgoingLength = Math.hypot(nextX - currX, nextY - currY);
      const cornerRadius = Math.min(
        radius,
        incomingLength / 2,
        outgoingLength / 2,
      );

      if (cornerRadius <= 0) {
        d += ` L ${currX} ${currY}`;
        continue;
      }

      const incomingUnitX = (currX - prevX) / incomingLength;
      const incomingUnitY = (currY - prevY) / incomingLength;
      const outgoingUnitX = (nextX - currX) / outgoingLength;
      const outgoingUnitY = (nextY - currY) / outgoingLength;

      const beforeCornerX = currX - incomingUnitX * cornerRadius;
      const beforeCornerY = currY - incomingUnitY * cornerRadius;
      const afterCornerX = currX + outgoingUnitX * cornerRadius;
      const afterCornerY = currY + outgoingUnitY * cornerRadius;

      d += ` L ${beforeCornerX} ${beforeCornerY}`;
      d += ` Q ${currX} ${currY} ${afterCornerX} ${afterCornerY}`;
    }

    const [endX, endY] = points[points.length - 1];
    d += ` L ${endX} ${endY}`;
  }

  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#arrowhead)" />`;
}

function noteText(x, y, text, options = {}) {
  const {
    size = 16,
    weight = 600,
    fill = PALETTE.muted,
    anchor = "start",
  } = options;
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeXml(text)}</text>`;
}

function baseNode(spec) {
  return roundedRect({
    ...spec,
    fill: PALETTE.baseFill,
    stroke: PALETTE.baseStroke,
  });
}

function decisionNode(spec) {
  return diamond({
    ...spec,
    fill: PALETTE.decisionFill,
    stroke: PALETTE.decisionStroke,
  });
}

function stateNode(spec) {
  return pill({
    ...spec,
    fill: PALETTE.branchStateFill,
    stroke: PALETTE.branchStateStroke,
  });
}

function answerNode(spec) {
  return pill({
    ...spec,
    fill: PALETTE.branchAnswerFill,
    stroke: PALETTE.branchAnswerStroke,
  });
}

function feistelNode(spec) {
  return roundedRect({
    ...spec,
    fill: PALETTE.feistelFill,
    stroke: PALETTE.feistelStroke,
    strokeWidth: 3,
  });
}

function feistelCoreNode(spec) {
  return roundedRect({
    ...spec,
    fill: PALETTE.feistelCoreFill,
    stroke: PALETTE.feistelCoreStroke,
    strokeWidth: 3,
  });
}

function outputNode(spec) {
  return roundedRect({
    ...spec,
    fill: PALETTE.outputFill,
    stroke: PALETTE.outputStroke,
    strokeWidth: 3,
  });
}

function legendItem(x, y, label, fill, stroke) {
  return `
    <rect x="${x}" y="${y}" width="22" height="22" rx="7" fill="${fill}" stroke="${stroke}" stroke-width="2" />
    <text x="${x + 34}" y="${y + 16}" font-size="16" font-weight="600" fill="${PALETTE.muted}">${escapeXml(label)}</text>
  `;
}

function renderLegend(items) {
  return items
    .map((item) =>
      legendItem(item.x, item.y, item.label, item.fill, item.stroke),
    )
    .join("");
}

function panel({ x, y, w, h, fill, title, subtitle }) {
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="30" fill="${fill}" stroke="${PALETTE.panelStroke}" stroke-width="2.5" />
    ${noteText(x + 40, y + 52, title, { size: 28, weight: 700, fill: PALETTE.text })}
    ${noteText(x + 40, y + 86, subtitle, { size: 18, weight: 400, fill: PALETTE.muted })}
  `;
}

function baseSvg(width, height, title, subtitle, body) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc" style="font-family: Arial, Helvetica, sans-serif;">
  <title>${escapeXml(title)}</title>
  <desc>${escapeXml(subtitle)}</desc>
  <defs>
    <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 8 4 L 0 8 z" fill="${PALETTE.edge}" />
    </marker>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#0f172a" flood-opacity="0.07" />
    </filter>
  </defs>
  <rect width="${width}" height="${height}" fill="${PALETTE.background}" />
  <text x="${width / 2}" y="58" text-anchor="middle" font-size="34" font-weight="700" fill="${PALETTE.text}">${escapeXml(title)}</text>
  <text x="${width / 2}" y="92" text-anchor="middle" font-size="18" fill="${PALETTE.muted}">${escapeXml(subtitle)}</text>
  ${body}
</svg>`;
}

function renderCombinedDiagram() {
  const width = 1220;
  const height = 3220;

  const legend = renderLegend([
    {
      x: 96,
      y: 126,
      label: "Decision",
      fill: PALETTE.decisionFill,
      stroke: PALETTE.decisionStroke,
    },
    {
      x: 288,
      y: 126,
      label: "Path label",
      fill: PALETTE.branchStateFill,
      stroke: PALETTE.branchStateStroke,
    },
    {
      x: 508,
      y: 126,
      label: "Yes / No",
      fill: PALETTE.branchAnswerFill,
      stroke: PALETTE.branchAnswerStroke,
    },
    {
      x: 700,
      y: 126,
      label: "Feistel stage",
      fill: PALETTE.feistelFill,
      stroke: PALETTE.feistelStroke,
    },
    {
      x: 928,
      y: 126,
      label: "Returned output",
      fill: PALETTE.outputFill,
      stroke: PALETTE.outputStroke,
    },
  ]);

  const sequencePanel = panel({
    x: 60,
    y: 186,
    w: 1100,
    h: 1820,
    fill: PALETTE.panelFill,
    title: "Sequence generation flow",
    subtitle:
      "Stateful generation and read-only lookup share the same two-stage mapping.",
  });

  const sequenceNodes = [
    baseNode({ x: 460, y: 320, w: 300, h: 76, lines: ["Read sequence index"] }),
    baseNode({
      x: 400,
      y: 438,
      w: 420,
      h: 92,
      lines: ["Compute epoch index", "and in-epoch position"],
    }),
    decisionNode({
      cx: 610,
      cy: 640,
      w: 280,
      h: 122,
      lines: ["Stateful or", "read-only?"],
    }),
    stateNode({ x: 300, y: 778, w: 180, h: 52, lines: ["Stateful"] }),
    stateNode({ x: 845, y: 778, w: 190, h: 52, lines: ["Read-only"] }),
    decisionNode({
      cx: 390,
      cy: 962,
      w: 220,
      h: 112,
      lines: ["Start of a", "new epoch?"],
    }),
    answerNode({ x: 214, y: 1010, w: 72, h: 38, lines: ["Yes"] }),
    answerNode({ x: 498, y: 1010, w: 64, h: 38, lines: ["No"] }),
    baseNode({
      x: 130,
      y: 1100,
      w: 240,
      h: 80,
      lines: ["Rotate the current", "epoch seed"],
    }),
    baseNode({
      x: 410,
      y: 1100,
      w: 240,
      h: 80,
      lines: ["Reuse the current", "epoch seed"],
    }),
    baseNode({
      x: 790,
      y: 1100,
      w: 300,
      h: 80,
      lines: ["Resolve the seed for", "the read-only path"],
    }),
    baseNode({
      x: 460,
      y: 1272,
      w: 300,
      h: 80,
      lines: ["Compute actual", "epoch size"],
    }),
    feistelNode({
      x: 430,
      y: 1424,
      w: 360,
      h: 104,
      lines: ["Epoch-local", "Feistel permutation"],
    }),
    baseNode({
      x: 490,
      y: 1600,
      w: 240,
      h: 80,
      lines: ["Add the epoch", "offset"],
    }),
    feistelNode({
      x: 430,
      y: 1748,
      w: 360,
      h: 104,
      lines: ["Full-range", "Feistel permutation"],
    }),
    outputNode({ x: 510, y: 1904, w: 200, h: 72, lines: ["Return value + 1"] }),
  ].join("");

  const sequenceArrows = [
    [
      [610, 396],
      [610, 438],
    ],
    [
      [610, 530],
      [610, 579],
    ],
    [
      [470, 640],
      [390, 640],
      [390, 778],
    ],
    [
      [750, 640],
      [940, 640],
      [940, 778],
    ],
    [
      [390, 830],
      [390, 906],
    ],
    [
      [280, 962],
      [250, 962],
      [250, 1010],
    ],
    [
      [500, 962],
      [530, 962],
      [530, 1010],
    ],
    [
      [250, 1048],
      [250, 1100],
    ],
    [
      [530, 1048],
      [530, 1100],
    ],
    [
      [940, 830],
      [940, 1100],
    ],
    [
      [250, 1180],
      [250, 1228],
      [610, 1228],
      [610, 1272],
    ],
    [
      [530, 1180],
      [530, 1228],
      [610, 1228],
      [610, 1272],
    ],
    [
      [940, 1180],
      [940, 1228],
      [610, 1228],
      [610, 1272],
    ],
    [
      [610, 1352],
      [610, 1424],
    ],
    [
      [610, 1528],
      [610, 1600],
    ],
    [
      [610, 1680],
      [610, 1748],
    ],
    [
      [610, 1852],
      [610, 1904],
    ],
  ]
    .map((points) => arrow(points, THIN_ARROW))
    .join("");

  const feistelPanel = panel({
    x: 60,
    y: 2050,
    w: 1100,
    h: 1160,
    fill: PALETTE.panelAltFill,
    title: "Shared Feistel primitive",
    subtitle: "Both highlighted stages above call this same subroutine.",
  });

  const feistelNodes = [
    baseNode({ x: 460, y: 2178, w: 300, h: 76, lines: ["Start with value x"] }),
    baseNode({
      x: 390,
      y: 2300,
      w: 440,
      h: 96,
      lines: ["Choose a near-square grid", "a × b that covers the range"],
    }),
    baseNode({
      x: 470,
      y: 2448,
      w: 280,
      h: 76,
      lines: ["Decode x into", "l and r"],
    }),
    feistelCoreNode({
      x: 330,
      y: 2588,
      w: 560,
      h: 108,
      lines: [
        "For each round, hash the current",
        "right side with the seed and round index,",
        "then swap and mix",
      ],
    }),
    baseNode({
      x: 420,
      y: 2758,
      w: 380,
      h: 76,
      lines: ["Re-encode the result into x"],
    }),
    decisionNode({
      cx: 610,
      cy: 2958,
      w: 240,
      h: 118,
      lines: ["Is x inside", "the range?"],
    }),
    answerNode({ x: 360, y: 2940, w: 64, h: 38, lines: ["No"] }),
    answerNode({ x: 796, y: 2940, w: 72, h: 38, lines: ["Yes"] }),
    outputNode({ x: 732, y: 3088, w: 200, h: 72, lines: ["Return x"] }),
  ].join("");

  const feistelArrows = [
    [
      [610, 2254],
      [610, 2300],
    ],
    [
      [610, 2396],
      [610, 2448],
    ],
    [
      [610, 2524],
      [610, 2588],
    ],
    [
      [610, 2696],
      [610, 2758],
    ],
    [
      [610, 2834],
      [610, 2899],
    ],
    [
      [490, 2958],
      [424, 2958],
    ],
    [
      [730, 2958],
      [796, 2958],
    ],
    [
      [832, 2978],
      [832, 3088],
    ],
    [
      [360, 2958],
      [220, 2958],
      [220, 2216],
      [460, 2216],
    ],
  ]
    .map((points) => arrow(points, THIN_ARROW))
    .join("");

  const body = `
    ${legend}
    ${sequencePanel}
    ${sequenceNodes}
    ${sequenceArrows}
    ${feistelPanel}
    ${feistelNodes}
    ${feistelArrows}
    ${noteText(112, 2990, "Cycle-walk if needed")}
  `;

  return baseSvg(
    width,
    height,
    "Epoch Permutation flow",
    "Top: sequence generation flow. Bottom: the shared Feistel primitive used in both highlighted stages.",
    body,
  );
}

function writeSvg(filename, contents) {
  fs.writeFileSync(path.join(OUT_DIR, filename), contents);
}

writeSvg("how-it-works-diagram.svg", renderCombinedDiagram());

import { createHash } from "node:crypto";

function normalizeHashPart(value) {
  if (typeof value === "bigint") {
    return `bigint:${value.toString(16)}`;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`Cannot hash non-finite number: ${value}`);
    }
    return `number:${value}`;
  }

  if (typeof value === "string") {
    return `string:${value}`;
  }

  if (typeof value === "boolean") {
    return `boolean:${value ? "1" : "0"}`;
  }

  if (value === null) {
    return "null";
  }

  if (value === undefined) {
    return "undefined";
  }

  if (Array.isArray(value)) {
    return `array:[${value.map((entry) => normalizeHashPart(entry)).join(",")}]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value).sort(([left], [right]) =>
      left.localeCompare(right),
    );
    return `object:{${entries
      .map(([key, entry]) => `${key}=${normalizeHashPart(entry)}`)
      .join(",")}}`;
  }

  throw new Error(`Unsupported hash input type: ${typeof value}`);
}

export function hashBigInt(...parts) {
  const hash = createHash("sha256");

  for (const part of parts) {
    hash.update(normalizeHashPart(part));
    hash.update("\x1f");
  }

  return BigInt(`0x${hash.digest("hex")}`);
}

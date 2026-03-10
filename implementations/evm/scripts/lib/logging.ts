function formatSectionTitle(title: string) {
  return String(title).trim().toLowerCase();
}

export function printSection(title: string) {
  console.log(`\n--- ${formatSectionTitle(title)} ---`);
}

export function logFields(fields: Array<[string, unknown]>) {
  const visibleFields = fields.filter(
    ([, value]) => value !== undefined && value !== null && value !== "",
  );

  if (visibleFields.length === 0) {
    return;
  }

  const width = Math.max(
    7,
    ...visibleFields.map(([label]) => String(label).length),
  );

  for (const [label, value] of visibleFields) {
    console.log(`${String(label).padEnd(width)}  ${String(value)}`);
  }
}

export function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

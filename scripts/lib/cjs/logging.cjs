function formatSectionTitle(title) {
  return String(title).trim().toLowerCase();
}

function toErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function printSection(title) {
  console.log(`\n--- ${formatSectionTitle(title)} ---`);
}

function logFields(fields) {
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

module.exports = {
  printSection,
  logFields,
  toErrorMessage,
};

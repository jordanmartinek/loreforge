// Pure helper for computing a human-readable shallow diff between two
// entity snapshots (FR4.2). Kept dependency-free and side-effect-free, like
// timelineMath.ts, so it's trivially unit-testable without mounting React.

export interface DiffLine {
  field: string;
  before: string;
  after: string;
}

const HIDDEN_FIELDS = new Set(["created_at", "updated_at", "id"]);

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "(empty)";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "(empty)";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return value.trim() === "" ? "(empty)" : value;
  return String(value);
}

/** Computes a shallow, top-level-field diff between two JSON snapshots.
 * Only fields present in `after` (or `before`, for deletions) are
 * considered; timestamps and id are excluded since they change on every
 * write and aren't meaningful to a worldbuilder reviewing "what changed". */
export function computeDiffSummary(
  beforeJson: string | null,
  afterJson: string | null,
): DiffLine[] {
  const before = beforeJson ? (JSON.parse(beforeJson) as Record<string, unknown>) : {};
  const after = afterJson ? (JSON.parse(afterJson) as Record<string, unknown>) : {};

  const allFields = new Set([...Object.keys(before), ...Object.keys(after)]);
  const lines: DiffLine[] = [];

  for (const field of allFields) {
    if (HIDDEN_FIELDS.has(field)) continue;
    const beforeValue = before[field];
    const afterValue = after[field];
    if (JSON.stringify(beforeValue) === JSON.stringify(afterValue)) continue;
    lines.push({
      field,
      before: formatValue(beforeValue),
      after: formatValue(afterValue),
    });
  }

  return lines.sort((a, b) => a.field.localeCompare(b.field));
}

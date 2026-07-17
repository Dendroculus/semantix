export function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isNullableFiniteNumber(
  value: unknown,
): value is number | null {
  return value === null || isFiniteNumber(value);
}

export function isNullableString(
  value: unknown,
): value is string | null {
  return value === null || typeof value === "string";
}

export function isNonNegativeInteger(
  value: unknown,
): value is number {
  return (
    isFiniteNumber(value) &&
    Number.isInteger(value) &&
    value >= 0
  );
}

export function isIsoDate(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

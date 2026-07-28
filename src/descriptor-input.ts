export function normalizeIntegerInput(
  value: string,
  minimum = 0,
  maximum = Number.POSITIVE_INFINITY,
): number {
  const parsed = Number(value);
  const integer = Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
  return Math.max(minimum, Math.min(maximum, integer));
}

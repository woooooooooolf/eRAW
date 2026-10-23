/** Shared defaults, independent live windows. Each field has its own storage key.
 * The legacy object remains a read-only fallback; no read/modify/write race is needed.
 */
export function readPreferenceFields<T extends object>(
  storage: Pick<Storage, "getItem">,
  key: string,
  defaults: T,
): Record<string, unknown> {
  let legacy: Record<string, unknown> = {};
  try {
    const value: unknown = JSON.parse(storage.getItem(key) ?? "null");
    if (value && typeof value === "object" && !Array.isArray(value)) {
      legacy = value as Record<string, unknown>;
    }
  } catch { /* Invalid legacy preferences use the caller's defaults. */ }
  for (const field of Object.keys(defaults)) {
    try {
      const saved = storage.getItem(`${key}.${field}`);
      if (saved !== null) legacy[field] = JSON.parse(saved) as unknown;
    } catch { /* One invalid field must not discard other preferences. */ }
  }
  return legacy;
}

export function savePreferenceChanges<T extends object>(
  storage: Pick<Storage, "setItem">,
  key: string,
  previous: T,
  current: T,
): void {
  for (const field of Object.keys(current) as Array<keyof T & string>) {
    const value = JSON.stringify(current[field]);
    if (value !== JSON.stringify(previous[field])) storage.setItem(`${key}.${field}`, value);
  }
}

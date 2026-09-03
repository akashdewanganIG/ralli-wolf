type ColumnPreference = {
  visibleColumns: string[];
};

const isColumnPreference = (value: unknown): value is ColumnPreference => {
  if (!value || typeof value !== "object") return false;

  const { visibleColumns } = value as { visibleColumns?: unknown };

  return (
    Array.isArray(visibleColumns) &&
    visibleColumns.every(
      (column): column is string => typeof column === "string"
    )
  );
};

const STORAGE_PREFIX = "crm_column_prefs:";

const isBrowser = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const getStorageKey = (key: string) => `${STORAGE_PREFIX}${key}`;

export const getColumnPreferences = (key: string): ColumnPreference | null => {
  if (!isBrowser()) return null;

  try {
    const raw = window.localStorage.getItem(getStorageKey(key));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (isColumnPreference(parsed)) {
      return parsed as ColumnPreference;
    }
    return null;
  } catch {
    return null;
  }
};

export const setColumnPreferences = (
  key: string,
  preferences: ColumnPreference
) => {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(
      getStorageKey(key),
      JSON.stringify(preferences)
    );
  } catch {
    return;
  }
};

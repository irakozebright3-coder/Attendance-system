// Global contact information: instant, and never blank.
//
// The founder's contact details live in one database row and are shown to every
// visitor. This module keeps a copy of the last REAL values on the device so:
//   1. the page shows saved contact details immediately, before the network answers;
//   2. a slow or failed request keeps showing the last real values instead of the
//      empty built-in defaults;
//   3. the founder's own save shows up at once, with no refresh.
// The database stays the source of truth: fresh data always replaces the copy.

const KEY = "attendanceflow-platform-settings-v1";

// Fields that make up the public contact / connection information.
export const CONTACT_FIELDS = [
  "contact_email", "contact_phone", "contact_address",
  "owner_name", "owner_title", "owner_email", "owner_phone", "support_hours"
];

function storage() {
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; }
}

/** The last real settings seen on this device, or null. */
export function readCachedSettings() {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && parsed.values ? parsed.values : null;
  } catch {
    return null;
  }
}

/** Remember real settings from the database (never the built-in defaults). */
export function writeCachedSettings(values) {
  const store = storage();
  if (!store || !values || typeof values !== "object") return;
  try {
    store.setItem(KEY, JSON.stringify({ savedAt: Date.now(), values }));
  } catch {
    // Storage full or blocked: the app still works, it just loads from the network.
  }
}

/**
 * Combine sources, most trustworthy last: built-in defaults < device copy < fresh
 * database row. A blank value from a stale copy never hides a real saved value
 * from the database, and a failed fetch (fresh = null) keeps the device copy.
 */
export function mergeSettings(defaults, cached, fresh) {
  return { ...defaults, ...(cached || {}), ...(fresh || {}) };
}

/**
 * Load settings fast and safely.
 * `fetchFresh` is the network call. Returns { settings, source } where source is
 * "database", "device" or "defaults" so callers can tell what they are showing.
 * `onCached` fires immediately with the device copy so the page can paint first.
 */
export async function loadSettingsFast({ defaults, fetchFresh, onCached, timeoutMs = 6000 }) {
  const cached = readCachedSettings();
  if (cached && typeof onCached === "function") onCached(mergeSettings(defaults, cached, null));

  let fresh = null;
  try {
    fresh = await Promise.race([
      fetchFresh(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs))
    ]);
  } catch {
    fresh = null;
  }

  if (fresh && typeof fresh === "object") {
    writeCachedSettings(fresh);
    return { settings: mergeSettings(defaults, null, fresh), source: "database" };
  }
  if (cached) return { settings: mergeSettings(defaults, cached, null), source: "device" };
  return { settings: mergeSettings(defaults, null, null), source: "defaults" };
}

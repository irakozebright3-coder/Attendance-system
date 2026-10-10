// Shared helpers: escaping, dates, formatting, CSV, friendly errors.

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[m]));
}

export function today(timeZone) {
  const d = new Date();
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).formatToParts(d);
      const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
      if (map.year && map.month && map.day) return map.year + "-" + map.month + "-" + map.day;
    } catch {
      // fall back to browser-local time for an invalid/unavailable timezone
    }
  }
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

export function dateLabel(d, settings) {
  const date = new Date(d + "T00:00:00");
  const format = typeof settings === "string" ? settings : settings?.date_format;
  if (format === "YYYY-MM-DD") {
    return d;
  }
  if (format === "DD/MM/YYYY") {
    return String(date.getDate()).padStart(2, "0") + "/" +
      String(date.getMonth() + 1).padStart(2, "0") + "/" + date.getFullYear();
  }
  if (format === "MM/DD/YYYY") {
    return String(date.getMonth() + 1).padStart(2, "0") + "/" +
      String(date.getDate()).padStart(2, "0") + "/" + date.getFullYear();
  }
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export function isValidDate(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s + "T00:00:00").getTime());
}

export function timeLabel(iso) {
  if (!iso) return "";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" })
    .format(new Date(iso));
}

export function pct(n, d) {
  return d > 0 ? Math.round((n / d) * 100) + "%" : "0%";
}

export function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function shortId(id) {
  return typeof id === "string" ? id.slice(0, 8) : "";
}

// Translate raw Supabase/Postgres errors into messages a human can act on.
export function friendlyError(err) {
  if (!err) return "Something went wrong.";
  const msg = String(err.message || err);
  if (/people_team_identifier_unique/.test(msg)) return "That identifier is already used by someone in your team.";
  if (/attendance_dates_team_id_date_key/.test(msg)) return "That date is already in the register.";
  if (/attendance_team_id_person_id_date_key/.test(msg)) return "This attendance cell was already updated. Refreshing…";
  if (/Invalid login credentials/i.test(msg)) return "Wrong email or password.";
  if (/Email not confirmed/i.test(msg)) return "Please confirm your email address first, then sign in.";
  if (/User already registered/i.test(msg)) return "An account with this email already exists. Try signing in.";
  if (/violates row-level security/i.test(msg)) return "Your role does not allow this action.";
  if (/Attendance person does not belong/.test(msg)) return "This person does not belong to your team.";
  if (/Team ownership cannot be changed/.test(msg)) return "Team ownership cannot be changed.";
  if (/Invite code not recognized/i.test(msg)) return "That invite code is not valid.";
  if (/Invite code is required/i.test(msg)) return "Enter the invite code from your team admin.";
  if (/Could not find the function public\.create_team|function public\.create_team.*schema cache/i.test(msg)) return "The AttendanceFlow database setup is incomplete. Run the current supabase/FINAL_SETUP.sql once in Supabase, then retry.";
  if (/save_team_settings/i.test(msg) && /function|schema cache|could not find/i.test(msg)) return "Team settings cannot be saved because the save_team_settings database function is missing. Run supabase/REPAIR_TEAM_SETTINGS.sql once in Supabase.";
  if (/ensure_team_settings/i.test(msg) && /function|schema cache|could not find/i.test(msg)) return "Team settings cannot be initialized because ensure_team_settings is missing. Run supabase/CORE_SETUP.sql or repair the missing function.";
  if (/Could not find the function public\./i.test(msg)) return "An AttendanceFlow database function is missing. Check the exact RPC name shown in the browser console and apply its targeted SQL repair; do not rerun large setup scripts blindly.";
  if (/Could not find the relation .*team_settings|relation .*team_settings does not exist/i.test(msg)) return "Team settings are not initialized yet. Run the current supabase/FINAL_SETUP.sql.";
  if (/A photo is required by this team/i.test(msg)) return "This team requires a photo for every person.";
  if (/An identifier is required by this team/i.test(msg)) return "This team requires an ID / employee number.";
  if (/Team administrator access required/i.test(msg)) return "Only a team owner or admin can change team settings.";
  if (/Platform administrator access required/i.test(msg)) return "This area is restricted to the AttendanceFlow platform administrator.";
  if (/JWT|token.*expired|session.*expired/i.test(msg)) return "Your session expired. Please sign in again.";
  if (/Failed to fetch|NetworkError|fetch failed/i.test(msg)) return "Network problem. Check your connection and try again.";
  if (/Signup requires a valid password/i.test(msg)) return "Password must be at least 8 characters.";
  if (/Password should be at least/i.test(msg)) return "Password must be at least 8 characters.";
  if (/at least 8 characters/i.test(msg)) return "Password must be at least 8 characters.";
  return msg;
}

// ---------- CSV export ----------

function csvCell(v) {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function toCsv(rows) {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

export function downloadCsv(filename, rows) {
  const blob = new Blob(["\uFEFF" + toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  const objectUrl = URL.createObjectURL(blob);
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
}

// Validate an image file chosen for upload.
export function validatePhoto(file) {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!file || typeof file === "string") return null;
  if (file.type && !allowed.includes(file.type)) {
    return "Photos must be JPG, PNG or WebP.";
  }
  if (file.size && file.size > 5 * 1024 * 1024) {
    return "Photos must be smaller than 5 MB.";
  }
  return null;
}

export function photoExt(type) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

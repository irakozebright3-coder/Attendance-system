// Saved reports: a snapshot of the attendance report for a chosen period.
// Saving never touches attendance data. A saved report stays downloadable
// until a team owner or admin deletes it.
import { esc, dateLabel, today } from "../lib/util.js";

const modalHost = () => document.getElementById("modal");

function closeSavedModal() {
  const m = modalHost();
  if (!m) return;
  m.classList.add("hidden");
  document.body.classList.remove("attendance-modal-open");
  m.innerHTML = "";
}

function openSavedModal(html) {
  const m = modalHost();
  m.innerHTML = '<div class="modal-card glass rounded-3xl">' + html + "</div>";
  m.classList.remove("hidden");
  document.body.classList.add("attendance-modal-open");
  m.onclick = (e) => { if (e.target === m) closeSavedModal(); };
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  const rounded = Math.round(Number(value) * 10) / 10;
  return (Number.isInteger(rounded) ? rounded : rounded.toFixed(1)) + "%";
}

function organizationName(ctx) {
  return String(ctx?.S?.team?.name || "").trim();
}

function slug(text) {
  return String(text || "").replaceAll(/[^a-zA-Z0-9]+/g, "-").replaceAll(/^-+|-+$/g, "").slice(0, 40);
}

// ---------- building a snapshot from the live register ----------

export function periodRange(mode, values) {
  const pad = (n) => String(n).padStart(2, "0");
  if (mode === "day") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(values.day || "")) throw new Error("Choose a valid day.");
    return { start: values.day, end: values.day, label: values.day };
  }
  if (mode === "month") {
    if (!/^\d{4}-\d{2}$/.test(values.month || "")) throw new Error("Choose a month.");
    const [y, m] = values.month.split("-").map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { start: values.month + "-01", end: values.month + "-" + pad(last), label: values.month };
  }
  if (mode === "year") {
    if (!/^\d{4}$/.test(values.year || "")) throw new Error("Enter a four-digit year.");
    return { start: values.year + "-01-01", end: values.year + "-12-31", label: values.year };
  }
  if (mode === "range") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(values.start || "") || !/^\d{4}-\d{2}-\d{2}$/.test(values.end || "")) {
      throw new Error("Choose both the start and end dates.");
    }
    if (values.start > values.end) throw new Error("The start date must be on or before the end date.");
    return { start: values.start, end: values.end, label: values.start + " to " + values.end };
  }
  throw new Error("Choose a period.");
}

export function buildReportSummary(ctx, range) {
  const { S } = ctx;
  const dates = S.dates.map((d) => d.date).filter((d) => d >= range.start && d <= range.end).sort();
  const active = S.people.filter((p) => p.active);

  const people = [];
  const unmarked = [];
  for (const person of active) {
    const entries = [];
    for (const date of dates) {
      const status = S.marks.get(person.id + "|" + date);
      if (status === "present" || status === "absent") entries.push([date, status]);
    }
    if (!entries.length) {
      unmarked.push(person.name || "Unknown person");
      continue;
    }
    const present = entries.filter(([, status]) => status === "present").length;
    people.push({
      name: person.name || "Unknown person",
      dates: entries.map(([date]) => date),
      present,
      absent: entries.length - present,
      percent: Math.round((present / entries.length) * 1000) / 10
    });
  }
  const collator = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
  people.sort((a, b) => collator(a.name, b.name));
  unmarked.sort(collator);

  const present = people.reduce((n, p) => n + p.present, 0);
  const absent = people.reduce((n, p) => n + p.absent, 0);
  const total = present + absent;
  return {
    dates,
    people,
    unmarked,
    totals: { present, absent, total, percent: total ? Math.round((present / total) * 1000) / 10 : null }
  };
}

// ---------- download formats ----------

function download(filename, contents, mime) {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const csvCell = (value) => {
  let text = String(value ?? "");
  if (/^[\t\r ]*[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
};

function reportRows(saved) {
  const summary = saved.summary || {};
  const rows = (summary.people || []).map((p) => [
    p.name, (p.dates || []).join("; "), p.present ? "✓" : "—", p.absent ? "✗" : "—", formatPercent(p.percent)
  ]);
  for (const name of summary.unmarked || []) rows.push([name, "No attendance recorded", "—", "—", "Unmarked"]);
  const t = summary.totals || {};
  rows.push(["TOTAL", (t.total || 0) + " records · " + (t.present || 0) + " present, " + (t.absent || 0) + " absent", "✓", "✗", formatPercent(t.percent)]);
  return rows;
}

const HEAD = ["Person", "Attendance dates", "Present", "Absent", "%"];

function fileBase(saved) {
  const org = slug(saved.organization);
  return (org ? org + "-" : "") + "report-" + slug(saved.period_label) + "-saved-" + String(saved.saved_at || "").slice(0, 10);
}

export function downloadSavedReport(ctx, saved, format) {
  const base = fileBase(saved);
  if (format === "csv") {
    const csv = [HEAD, ...reportRows(saved)].map((row) => row.map(csvCell).join(",")).join("\r\n");
    download(base + ".csv", "\uFEFF" + csv, "text/csv;charset=utf-8");
  } else if (format === "json") {
    download(base + ".json", JSON.stringify({
      organization: saved.organization,
      period: saved.period_label,
      saved_at: saved.saved_at,
      report: saved.summary
    }, null, 2), "application/json;charset=utf-8");
  } else if (format === "pdf") {
    printSavedReport(ctx, saved);
  }
}

function printSavedReport(ctx, saved) {
  const win = window.open("", "_blank");
  if (!win) {
    ctx.toast("The PDF preview was blocked. Allow pop-ups for AttendanceFlow and try again.", "error");
    return;
  }
  const title = saved.organization || "Attendance Report";
  const summary = saved.summary || {};
  const t = summary.totals || {};
  const body = (summary.people || []).map((p) =>
    "<tr><td><strong>" + esc(p.name) + "</strong></td><td class=\"dates\">" +
      (p.dates || []).map((d) => esc(dateLabel(d, ctx.S.teamSettings))).join("  ·  ") + "</td>" +
      "<td class=\"num\">" + (p.present ? "✓" : "—") + "</td><td class=\"num\">" + (p.absent ? "✗" : "—") + "</td>" +
      "<td class=\"num\"><strong>" + formatPercent(p.percent) + "</strong></td></tr>"
  ).join("") + (summary.unmarked || []).map((name) =>
    "<tr><td><strong>" + esc(name) + "</strong> <span class=\"tag\">Unmarked</span></td>" +
      "<td class=\"dates\">No attendance recorded in this period</td><td class=\"num\">—</td><td class=\"num\">—</td><td class=\"num\">—</td></tr>"
  ).join("") +
    "<tr class=\"totals\"><td><strong>TOTAL</strong></td><td class=\"dates\">" + (summary.people || []).length +
    " people · " + (t.total || 0) + " records · " + (t.present || 0) + " present, " + (t.absent || 0) + " absent" +
    ((summary.unmarked || []).length ? " · " + summary.unmarked.length + " unmarked" : "") + "</td>" +
    "<td class=\"num\">✓</td><td class=\"num\">✗</td><td class=\"num\">" + formatPercent(t.percent) + "</td></tr>";

  win.document.open();
  win.document.write("<!doctype html><html><head><meta charset=\"utf-8\"><title>" + esc(title + " " + saved.period_label) + "</title><style>" +
    "@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{font:12px/1.45 Arial,sans-serif;color:#172033;margin:0}" +
    "h1{font-size:22px;margin:0 0 6px}p{margin:0 0 14px;color:#4b5563}table{width:100%;border-collapse:collapse}" +
    "th,td{border:1px solid #d1d5db;padding:7px;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#eef2f7}" +
    "td.num{text-align:center;white-space:nowrap;width:70px}td.dates{font-size:11px;line-height:1.7}tr{break-inside:avoid}thead{display:table-header-group}" +
    "tr.totals td{background:#f3f4f6;font-weight:700;border-top:2px solid #9ca3af}.tag{font-size:9px;text-transform:uppercase;color:#6b7280;border:1px solid #d1d5db;border-radius:999px;padding:1px 5px}" +
    "@media screen{body{padding:24px;max-width:1400px;margin:auto}}</style></head><body><h1>" + esc(title) + "</h1><p>Period: " +
    esc(saved.period_label) + " · Saved " + esc(new Date(saved.saved_at).toLocaleDateString()) + "</p><table><thead><tr>" +
    HEAD.map((h) => "<th>" + esc(h) + "</th>").join("") + "</tr></thead><tbody>" + body + "</tbody></table></body></html>");
  win.document.close();
  setTimeout(() => { try { win.focus(); win.print(); } catch { /* user can print manually */ } }, 150);
}

// ---------- Save report dialog (attendance workspace) ----------

export function saveReportModal(ctx) {
  const { S } = ctx;
  const dates = S.dates.map((d) => d.date).sort();
  const first = dates[0] || today(S.teamSettings?.timezone);
  const last = dates[dates.length - 1] || first;

  openSavedModal(
    '<div class="p-6" role="dialog" aria-modal="true" aria-labelledby="saveReportTitle">' +
      '<div class="flex justify-between items-start"><div><h2 id="saveReportTitle" class="text-xl font-black">Save report</h2>' +
      '<p class="text-xs text-slate-500 mt-1">Saves a snapshot of the report with today’s date. It stays downloadable until an admin deletes it. Attendance data is not changed.</p></div>' +
      '<button id="closeSaveReport" class="text-2xl" aria-label="Close">×</button></div>' +
      '<label class="dialog-label mt-4">Period<select id="saveReportMode" class="dialog-input">' +
        '<option value="month">A month</option><option value="year">A year</option><option value="range">A date range</option><option value="day">One day</option>' +
      "</select></label>" +
      '<div id="saveReportInputs" class="mt-3"></div>' +
      '<div id="saveReportPreview" class="mt-4 text-sm text-slate-400" aria-live="polite"></div>' +
      '<div class="flex gap-2 mt-5"><button id="confirmSaveReport" class="liquid rounded-xl bg-violet-600 px-4 py-3 font-bold text-sm">Save report</button>' +
      '<button id="cancelSaveReport" class="liquid rounded-xl bg-white/5 px-4 py-3 font-bold text-sm">Cancel</button></div>' +
    "</div>"
  );

  const $ = (id) => document.getElementById(id);
  const readPeriod = () => {
    const mode = $("saveReportMode").value;
    return periodRange(mode, {
      day: $("srDay")?.value, month: $("srMonth")?.value, year: $("srYear")?.value,
      start: $("srStart")?.value, end: $("srEnd")?.value
    });
  };
  const preview = () => {
    try {
      const summary = buildReportSummary(ctx, readPeriod());
      $("saveReportPreview").textContent = summary.people.length + " " + (summary.people.length === 1 ? "person" : "people") +
        " · " + summary.dates.length + " " + (summary.dates.length === 1 ? "date" : "dates") + " · " + formatPercent(summary.totals.percent) +
        (summary.unmarked.length ? " · " + summary.unmarked.length + " unmarked" : "");
      $("confirmSaveReport").disabled = summary.totals.total === 0;
      $("confirmSaveReport").title = summary.totals.total === 0 ? "No attendance is recorded in this period." : "";
    } catch (err) {
      $("saveReportPreview").textContent = err.message;
      $("confirmSaveReport").disabled = true;
    }
  };
  const inputs = () => {
    const mode = $("saveReportMode").value;
    $("saveReportInputs").innerHTML =
      mode === "day" ? '<label class="dialog-label">Day<input id="srDay" type="date" value="' + esc(last) + '" class="dialog-input"></label>'
      : mode === "month" ? '<label class="dialog-label">Month<input id="srMonth" type="month" value="' + esc(last.slice(0, 7)) + '" class="dialog-input"></label>'
      : mode === "year" ? '<label class="dialog-label">Year<input id="srYear" type="number" min="2000" max="2100" value="' + esc(last.slice(0, 4)) + '" class="dialog-input"></label>'
      : '<div class="grid grid-cols-2 gap-3"><label class="dialog-label">From<input id="srStart" type="date" value="' + esc(first) + '" class="dialog-input"></label>' +
        '<label class="dialog-label">To<input id="srEnd" type="date" value="' + esc(last) + '" class="dialog-input"></label></div>';
    $("saveReportInputs").querySelectorAll("input").forEach((input) => { input.oninput = preview; input.onchange = preview; });
    preview();
  };

  $("saveReportMode").onchange = inputs;
  $("closeSaveReport").onclick = closeSavedModal;
  $("cancelSaveReport").onclick = closeSavedModal;
  $("confirmSaveReport").onclick = async () => {
    let range;
    try { range = readPeriod(); } catch (err) { ctx.toast(err.message, "error"); return; }
    const summary = buildReportSummary(ctx, range);
    if (!summary.totals.total) { ctx.toast("No attendance is recorded in this period.", "error"); return; }
    const button = $("confirmSaveReport");
    button.disabled = true;
    button.textContent = "Saving…";
    try {
      const saved = await ctx.handlers.saveReport({
        organization: organizationName(ctx),
        periodLabel: range.label,
        periodStart: range.start,
        periodEnd: range.end,
        summary
      });
      if (saved) {
        closeSavedModal();
        ctx.toast("Report saved. Find it under Saved reports.", "success");
      } else {
        button.disabled = false;
        button.textContent = "Save report";
      }
    } catch (err) {
      button.disabled = false;
      button.textContent = "Save report";
      ctx.toast(err.message || "Could not save the report.", "error");
    }
  };
  inputs();
}

// ---------- Saved reports list (replaces the old Reports popup) ----------

export async function savedReportsModal(ctx) {
  const manager = ctx.canManage();
  openSavedModal(
    '<div class="p-6" role="dialog" aria-modal="true" aria-labelledby="savedReportsTitle">' +
      '<div class="flex justify-between items-start"><div><h2 id="savedReportsTitle" class="text-xl font-black">Saved reports</h2>' +
      '<p class="text-xs text-slate-500 mt-1">Download a saved report any time' + (manager ? " until you delete it." : ". Owners and admins can delete them.") + "</p></div>" +
      '<button id="closeSavedReports" class="text-2xl" aria-label="Close">×</button></div>' +
      '<div id="savedReportsBody" class="mt-4 text-sm saved-reports-list">Loading…</div>' +
    "</div>"
  );
  document.getElementById("closeSavedReports").onclick = closeSavedModal;
  await refreshList(ctx);
}

async function refreshList(ctx) {
  const host = document.getElementById("savedReportsBody");
  if (!host) return;
  const manager = ctx.canManage();
  let reports;
  try {
    reports = await ctx.handlers.loadSavedReports();
  } catch (err) {
    host.innerHTML = '<p class="text-red-300">' + esc(err.message || "Could not load saved reports.") + "</p>";
    return;
  }
  if (!reports.length) {
    host.innerHTML = '<div class="saved-reports-empty"><p><strong>No saved reports yet.</strong></p><p>Use “Save report” in the attendance register to save one.</p></div>';
    return;
  }

  host.innerHTML = reports.map((r) => {
    const t = r.summary?.totals || {};
    return '<article class="saved-report-card" data-report-id="' + esc(r.id) + '">' +
      '<div class="saved-report-info"><strong>' + esc(r.organization || "Attendance Report") + "</strong>" +
      '<span class="saved-report-meta">Period ' + esc(r.period_label) + " · saved " + esc(new Date(r.saved_at).toLocaleDateString()) +
      " · " + esc((r.summary?.people || []).length) + " people · " + esc(formatPercent(t.percent)) + "</span></div>" +
      '<div class="saved-report-actions">' +
        '<button type="button" data-dl="pdf" class="saved-report-btn">PDF</button>' +
        '<button type="button" data-dl="csv" class="saved-report-btn">CSV</button>' +
        '<button type="button" data-dl="json" class="saved-report-btn">JSON</button>' +
        (manager ? '<button type="button" data-del class="saved-report-btn saved-report-delete" aria-label="Delete saved report ' + esc(r.period_label) + '">Delete</button>' : "") +
      "</div></article>";
  }).join("");

  host.querySelectorAll(".saved-report-card").forEach((card) => {
    const report = reports.find((r) => r.id === card.dataset.reportId);
    card.querySelectorAll("[data-dl]").forEach((button) => {
      button.onclick = () => downloadSavedReport(ctx, report, button.dataset.dl);
    });
    const del = card.querySelector("[data-del]");
    if (del) del.onclick = async () => {
      const ok = await ctx.handlers.confirm({
        title: "Delete this saved report?",
        message: "The saved report for " + report.period_label + " will be permanently deleted. Attendance data is not affected.",
        confirmLabel: "Delete report", danger: true
      });
      // The confirmation shares the modal host, so the list is gone either
      // way; reopen it so the user lands back on their saved reports.
      if (!ok) { await savedReportsModal(ctx); return; }
      try {
        await ctx.handlers.deleteSavedReport(report.id);
        await savedReportsModal(ctx);
        ctx.toast("Saved report deleted.", "success");
      } catch (err) {
        await savedReportsModal(ctx);
        ctx.toast(err.message || "Could not delete the report.", "error");
      }
    };
  });
}

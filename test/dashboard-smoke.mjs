// Dashboard smoke test: boots the real app bundle against the test double and
// drives the register, modals, filters, and reports with assertions.
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";

const results = [];
const check = (name, ok, note = "") => {
  results.push([name, ok, note]);
  console.log((ok ? "PASS: " : "FAIL: ") + name + (ok ? "" : " — " + note));
};

const indexHtml = readFileSync("index.html", "utf8");

const iso = (offsetDays) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};
const TODAY = iso(0);
const TOMORROW = iso(1);
const bundle = readFileSync("/tmp/app.db.test.js", "utf8");

const dom = new JSDOM(indexHtml, {
  url: "https://attendanceflow.test/",
  runScripts: "outside-only",
  pretendToBeVisual: true,
  beforeParse(window) {
    window.matchMedia = (q) => ({
      matches: /reduce/.test(q), media: q,
      addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}
    });
    window.HTMLCanvasElement.prototype.getContext = () => null;
    window.URL.createObjectURL = () => "blob:test";
    window.URL.revokeObjectURL = () => {};
    window.HTMLElement.prototype.scrollIntoView = () => {};
    window.navigator.clipboard = { writeText: () => Promise.resolve() };
    window.__errors = [];
    window.addEventListener("error", (e) => window.__errors.push(String(e.message)));
  }
});
const { window } = dom;
const { document } = window;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const $ = (id) => document.getElementById(id);

try {
  window.eval(bundle);
  await sleep(400);

  check("no runtime errors on boot", window.__errors.length === 0, window.__errors.join("; "));
  check("dashboard rendered", !!document.querySelector(".app-shell"));
  check("team name shown in header", $("teamLabel").textContent === "Test Team");
  check("role badge shows ADMIN", $("roleLabel").textContent === "ADMIN");
  check("backend status realtime", ($("backendStatus").textContent || "").includes("realtime"), $("backendStatus")?.textContent);
  check("stats: 2 active people", $("peopleCount").textContent === "2", $("peopleCount")?.textContent);
  check("empty state: dates exist but register renders", document.querySelectorAll("[data-person-cell]").length >= 2);
  check("inactive person hidden by default", ![...document.querySelectorAll("[data-person-edit]")].some((b) => b.textContent === "Carol"));

  // --- toggle cycle empty → present → absent → empty
  const cell = document.querySelector("[data-person-cell='p1']");
  check("cell starts empty", cell.classList.contains("empty"));
  cell.click();
  await sleep(120);
  const c1 = document.querySelector("[data-person-cell='p1']");
  check("click 1 → present", c1.classList.contains("present"), c1.className);
  c1.click();
  await sleep(120);
  const c2 = document.querySelector("[data-person-cell='p1']");
  check("click 2 → absent", c2.classList.contains("absent"), c2.className);
  c2.click();
  await sleep(120);
  const c3 = document.querySelector("[data-person-cell='p1']");
  check("click 3 → empty again", c3.classList.contains("empty"), c3.className);
  check("stats update after marks (present today 0 after clear)", $("presentCount").textContent === "0", $("presentCount")?.textContent);

  // mark present again for stats check
  c3.click();
  await sleep(120);
  check("present count = 1", $("presentCount").textContent === "1");
  check("rate = 100%", $("rate").textContent === "100%");

  // --- add date modal (admin)
  $("newDate").click();
  check("date modal opens", !$("modal").classList.contains("hidden"));
  $("dateValue").value = TOMORROW;
  $("saveDate").click();
  await sleep(200);
  check("date added to header", !!document.querySelector(`[data-date-remove="${TOMORROW}"]`));
  // duplicate date → friendly error
  $("newDate").click();
  $("dateValue").value = TOMORROW;
  $("saveDate").click();
  await sleep(150);
  const lastErr = () => [...document.querySelectorAll(".toast.error")].at(-1)?.textContent || "";
  check("duplicate date rejected with friendly message",
    lastErr().includes("already in the register"), lastErr());

  // --- add person with duplicate identifier (p2 has EMP-002)
  $("registeredAddPerson").click();
  $("personName").value = "Dan";
  $("personId").value = "EMP-002";
  $("savePerson").click();
  await sleep(200);
  check("duplicate identifier rejected",
    lastErr().includes("already used"), lastErr());

  // --- add person OK (no photo)
  $("registeredAddPerson").click();
  $("personName").value = "Dan";
  $("personId").value = "EMP-003";
  $("savePerson").click();
  await sleep(300);
  const rowNames = () => [...document.querySelectorAll("#tbody tr td:first-child span.font-bold")].map((n) => n.textContent);
  check("person added to register", rowNames().includes("Dan"), rowNames().join(","));

  // --- person management lives in the Registered People drawer
  const cardFor = (name) => [...document.querySelectorAll(".saved-person-card")]
    .find((c) => c.querySelector(".saved-person-name")?.textContent === name);
  const openDirectory = async () => {
    if (!document.querySelector(".saved-person-card")) {
      $("savedPeopleBtn").click();
      await sleep(250);
    }
  };
  await openDirectory();
  check("directory lists saved people", !!cardFor("Dan"));

  cardFor("Dan").querySelector("[data-directory-edit]").click();
  await sleep(250);
  check("edit modal shows name", $("personName").value === "Dan");
  check("edit modal shows identifier", $("personId").value === "EMP-003");
  $("personName").value = "Daniel";
  $("savePerson").click();
  await sleep(350);
  check("person renamed in register", rowNames().includes("Daniel"), rowNames().join(","));

  // --- filters: inactive only shows Carol with restore control
  $("activeFilter").value = "inactive";
  $("activeFilter").dispatchEvent(new window.Event("change"));
  await sleep(80);
  check("inactive filter shows Carol", rowNames().includes("Carol"), rowNames().join(","));
  check("inactive row locked cells", (() => {
    const rows = [...document.querySelectorAll("#tbody tr.row-inactive")];
    return rows.length > 0 && rows.every((r) => r.querySelectorAll("[data-person-cell]").length === 0);
  })());

  // --- search filter
  $("activeFilter").value = "all";
  $("activeFilter").dispatchEvent(new window.Event("change"));
  $("searchInput").value = "alice";
  $("searchInput").dispatchEvent(new window.Event("input"));
  await sleep(400);
  const searched = rowNames();
  check("search narrows to Alice", searched.length === 1 && searched[0] === "Alice", searched.join(","));
  $("searchInput").value = "";
  $("searchInput").dispatchEvent(new window.Event("input"));
  await sleep(400);

  // --- deactivate from the drawer + custom confirm
  await openDirectory();
  cardFor("Bob").querySelector("[data-directory-deactivate]").click();
  await sleep(150);
  $("confirmYes").click();
  await sleep(350);
  await openDirectory();
  check("Bob marked inactive with restore", !!cardFor("Bob")?.querySelector("[data-directory-restore]"));
  $("activeFilter").value = "active";
  $("activeFilter").dispatchEvent(new window.Event("change"));
  await sleep(80);
  check("Bob deactivated (gone from active list)", !rowNames().includes("Bob"), rowNames().join(","));

  // restore Bob from the drawer
  $("activeFilter").value = "inactive";
  $("activeFilter").dispatchEvent(new window.Event("change"));
  await sleep(80);
  await openDirectory();
  const restoreBtn = cardFor("Bob")?.querySelector("[data-directory-restore]");
  check("Bob listed as inactive with restore", !!restoreBtn);
  restoreBtn?.click();
  await sleep(350);
  await openDirectory();
  check("Bob restored", !cardFor("Bob")?.querySelector("[data-directory-restore]"));

  // --- reports modal
  $("activeFilter").value = "all";
  $("activeFilter").dispatchEvent(new window.Event("change"));
  await sleep(80);
  $("reportsBtn").click();
  await sleep(150);
  check("reports modal renders summary", $("reportBody")?.textContent.includes("Person"));
  const summary = $("reportBody").textContent;
  check("report totals computed", /Rate/.test(summary));

  // --- attendance report: one row per person, dates with tick/cross, per-person %
  $("closeReports") && $("closeReports").click();
  await sleep(80);
  $("attendanceHistoryBtn").click();
  await sleep(300);
  const historyHead = [...document.querySelectorAll(".history-table thead th")].map((th) => th.textContent.trim());
  check("history columns trimmed to the report set", historyHead.join("|") === "Person|Attendance dates|Present|Absent|%", historyHead.join("|"));
  check("history drops event/recorded/marked columns",
    !historyHead.some((h) => /Event|Recorded|Marked/i.test(h)), historyHead.join("|"));
  const historyRows = [...document.querySelectorAll("#attendanceHistoryRows tr")];
  const historyNames = historyRows.map((r) => r.querySelector("strong")?.textContent);
  check("each person appears once", new Set(historyNames).size === historyNames.length && historyNames.length === 2, historyNames.join(","));
  const aliceRow = historyRows.find((r) => r.querySelector("strong")?.textContent === "Alice");
  const bobRow = historyRows.find((r) => r.querySelector("strong")?.textContent === "Bob");
  const chips = (row) => [...(row?.querySelectorAll(".history-mark") || [])].map((c) => c.textContent.trim());
  check("dates use tick and cross symbols",
    chips(aliceRow).some((c) => c.includes("✓")) && chips(bobRow).some((c) => c.includes("✗")),
    chips(aliceRow).join(" / ") + " || " + chips(bobRow).join(" / "));
  const pctOf = (row) => [...(row?.querySelectorAll("td") || [])].at(-1)?.textContent.trim();
  check("per-person percentage shown", pctOf(aliceRow) === "100%" && pctOf(bobRow) === "50%", pctOf(aliceRow) + " / " + pctOf(bobRow));
  const totalsText = $("attendanceHistoryTotals")?.textContent || "";
  check("totals row has overall percentage", totalsText.includes("TOTAL") && totalsText.includes("75%"), totalsText.trim());

  // single-day mode gets the compact status layout
  $("historyDateMode").value = "day";
  $("historyDayInput").value = TODAY;
  $("applyHistoryFilter") && $("applyHistoryFilter").click();
  await sleep(200);
  const dayHead = [...document.querySelectorAll(".history-table thead th")].map((th) => th.textContent.trim());
  check("single day uses status columns", dayHead.join("|") === "Person|Status|%", dayHead.join("|"));
  const dayStatuses = [...document.querySelectorAll("#attendanceHistoryRows .history-status")].map((x) => x.textContent.trim());
  check("single day shows tick and cross statuses",
    dayStatuses.includes("✓ Present") && dayStatuses.includes("✗ Absent"), dayStatuses.join(" / "));
  check("single day totals show present/absent",
    ($("attendanceHistoryTotals")?.textContent || "").includes("1 present · 1 absent"), $("attendanceHistoryTotals")?.textContent.trim());
  $("historyDateMode").value = "all";
  $("applyHistoryFilter") && $("applyHistoryFilter").click();
  await sleep(150);
  $("closeAttendanceHistory") && $("closeAttendanceHistory").click();
  await sleep(80);

  // --- audit modal
  $("closeReports") && $("closeReports").click();
  await sleep(80);
  $("auditBtn").click();
  await sleep(200);
  check("audit modal renders event", ($("auditBody")?.textContent || "").includes("INSERT"), $("auditBody")?.textContent.slice(0, 80));

  // --- invite modal
  $("closeAudit").click();
  await sleep(80);
  $("inviteBtn").click();
  await sleep(80);
  check("invite modal shows code", ($("inviteCodeText")?.textContent || "") === "abc123");
  $("closeInvite").click();

  // --- delete date cleans attendance marks (handler + DB double)
  $("newDate").click();
  $("closeDate").click();
  const delBtn = document.querySelector(`[data-date-remove="${TODAY}"]`);
  delBtn.click();
  await sleep(100);
  $("confirmYes").click();
  await sleep(300);
  check("date removed from register", !document.querySelector(`[data-date-remove="${TODAY}"]`));
  check("marks for deleted date gone from stats", $("presentCount").textContent === "0", $("presentCount")?.textContent);

  // --- sign out returns to landing
  $("logout").click();
  await sleep(200);
  check("landing page after sign out", !!document.querySelector(".home-shell"));
  check("no runtime errors at end", window.__errors.length === 0, window.__errors.join("; "));

  console.log(results.every((r) => r[1]) ? "\nDASHBOARD SMOKE: ALL PASSED (" + results.length + ")" : "\nDASHBOARD SMOKE: FAILURES");
  process.exitCode = results.every((r) => r[1]) ? 0 : 1;
} catch (e) {
  console.error("DASHBOARD SMOKE ERROR:", e);
  process.exitCode = 1;
}

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
const YESTERDAY = iso(-1);
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

  // panel search must filter live without breaking the page
  const dirSearch = document.querySelector("#savedPeopleModal .panel-search-input");
  check("directory has a working search bar", !!dirSearch);
  if (dirSearch) {
    dirSearch.value = "bob";
    dirSearch.dispatchEvent(new window.Event("input"));
    await sleep(150);
    const visibleAfterSearch = [...document.querySelectorAll(".saved-person-card")].filter((c) => !c.hidden)
      .map((c) => c.querySelector(".saved-person-name")?.textContent);
    check("panel search filters to Bob", visibleAfterSearch.join(",") === "Bob", visibleAfterSearch.join(","));
    dirSearch.value = "";
    dirSearch.dispatchEvent(new window.Event("input"));
    await sleep(150);
    check("clearing panel search restores the list",
      [...document.querySelectorAll(".saved-person-card")].filter((c) => !c.hidden).length >= 3);
  }

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
  check("report heading shows the organization name",
    document.getElementById("attendanceHistoryTitle")?.textContent === "Test Team",
    document.getElementById("attendanceHistoryTitle")?.textContent);
  const historyHead = [...document.querySelectorAll(".history-table thead th")].map((th) => th.textContent.trim());
  check("history columns trimmed to the report set", historyHead.join("|") === "Person|Attendance dates|Present|Absent|%", historyHead.join("|"));
  check("history drops event/recorded/marked columns",
    !historyHead.some((h) => /Event|Recorded|Marked/i.test(h)), historyHead.join("|"));
  const historyRows = [...document.querySelectorAll("#attendanceHistoryRows tr")];
  const historyNames = historyRows.map((r) => r.querySelector("strong")?.textContent);
  check("each person appears once", new Set(historyNames).size === historyNames.length && historyNames.length >= 2, historyNames.join(","));
  const unmarkedRow = historyRows.find((r) => r.querySelector(".history-unmarked-tag"));
  check("unmarked people are listed", Boolean(unmarkedRow), historyNames.join(","));
  check("unmarked people show dashes, not fake marks",
    !!unmarkedRow && [...unmarkedRow.querySelectorAll("td")].slice(2, 4).every((td) => td.textContent.trim() === "—"),
    unmarkedRow?.textContent.replace(/\s+/g, " ").slice(0, 80));
  const aliceRow = historyRows.find((r) => r.querySelector("strong")?.textContent === "Alice");
  const bobRow = historyRows.find((r) => r.querySelector("strong")?.textContent === "Bob");
  const datesCell = (row) => row?.querySelector("td:nth-child(2)")?.textContent.trim() || "";
  const presentCell = (row) => row?.querySelector("td:nth-child(3)")?.textContent.trim() || "";
  const absentCell = (row) => row?.querySelector("td:nth-child(4)")?.textContent.trim() || "";
  check("dates are listed without marks", /^\d{4}-\d{2}-\d{2}( · \d{4}-\d{2}-\d{2})*$/.test(datesCell(aliceRow)), datesCell(aliceRow));
  check("tick sits in the Present column without counts", presentCell(aliceRow) === "✓" && presentCell(bobRow) === "✓",
    presentCell(aliceRow) + " / " + presentCell(bobRow));
  check("cross sits in the Absent column without counts", absentCell(aliceRow) === "—" && absentCell(bobRow) === "✗",
    absentCell(aliceRow) + " / " + absentCell(bobRow));
  const markCells = [...document.querySelectorAll("#attendanceHistoryRows tr")]
    .flatMap((row) => [...row.querySelectorAll("td")].slice(2, 4).map((td) => td.textContent.trim()))
    .filter((text) => text !== "—" && text !== "");
  check("mark cells hold only ticks/crosses, no counts",
    markCells.every((text) => text === "✓" || text === "✗"),
    markCells.join(","));
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
  check("single day uses present/absent columns", dayHead.join("|") === "Person|Present|Absent|%", dayHead.join("|"));
  const dayCells = [...document.querySelectorAll("#attendanceHistoryRows tr")].map((row) =>
    [...row.querySelectorAll("td")].slice(1, 3).map((td) => td.textContent.trim()));
  check("single day ticks in Present and crosses in Absent",
    dayCells.some(([p, a]) => p === "✓" && a === "—") && dayCells.some(([p, a]) => p === "—" && a === "✗"),
    JSON.stringify(dayCells));
  check("single day totals keep marks without counts",
    ($("attendanceHistoryTotals")?.textContent || "").includes("1 present · 1 absent") &&
      !/✓\s*\d/.test($("attendanceHistoryTotals")?.textContent || ""),
    $("attendanceHistoryTotals")?.textContent.trim());

  // --- delete a date straight from the history report
  $("historyDateMode").value = "range";
  $("historyDateMode").dispatchEvent(new window.Event("change"));
  $("historyRangeStart").value = YESTERDAY;
  $("historyRangeEnd").value = TODAY;
  $("applyHistoryFilter") && $("applyHistoryFilter").click();
  await sleep(200);
  const removeChip = document.querySelector('[data-history-date-remove="' + YESTERDAY + '"]');
  check("history lists dates with a delete control", Boolean(removeChip));
  removeChip?.click();
  await sleep(150);
  $("confirmYes")?.click();
  await sleep(600);
  check("deleted date disappears from history",
    !document.querySelector('[data-history-date-remove="' + YESTERDAY + '"]') &&
      !(document.getElementById("attendanceHistoryRows").textContent || "").includes(YESTERDAY),
    [...document.querySelectorAll("[data-history-date-remove]")].map((b) => b.dataset.historyDateRemove).join(","));
  $("historyDateMode").value = "all";
  $("historyDateMode").dispatchEvent(new window.Event("change"));
  $("applyHistoryFilter") && $("applyHistoryFilter").click();
  await sleep(150);
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

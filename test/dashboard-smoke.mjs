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
  check("role badge OWNER", $("roleLabel").textContent === "OWNER");
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
  $("dateValue").value = "2026-10-06";
  $("saveDate").click();
  await sleep(200);
  check("date added to header", !!document.querySelector("[data-date-remove='2026-10-06']"));
  // duplicate date → friendly error
  $("newDate").click();
  $("dateValue").value = "2026-10-06";
  $("saveDate").click();
  await sleep(150);
  const lastErr = () => [...document.querySelectorAll(".toast.error")].at(-1)?.textContent || "";
  check("duplicate date rejected with friendly message",
    lastErr().includes("already in the register"), lastErr());

  // --- add person with duplicate identifier (p2 has EMP-002)
  $("newPerson").click();
  $("personName").value = "Dan";
  $("personId").value = "EMP-002";
  $("savePerson").click();
  await sleep(200);
  check("duplicate identifier rejected",
    lastErr().includes("already used"), lastErr());

  // --- add person OK (no photo)
  $("newPerson").click();
  $("personName").value = "Dan";
  $("personId").value = "EMP-003";
  $("savePerson").click();
  await sleep(250);
  check("person added to register", [...document.querySelectorAll("[data-person-edit]")].some((b) => b.textContent === "Dan"));

  // --- edit person modal shows current values + history
  const danBtn = [...document.querySelectorAll("[data-person-edit]")].find((b) => b.textContent === "Dan");
  danBtn.click();
  await sleep(250);
  check("edit modal shows name", $("personName").value === "Dan");
  check("edit modal shows identifier", $("personId").value === "EMP-003");
  $("personName").value = "Daniel";
  $("savePerson").click();
  await sleep(250);
  check("person renamed in register", [...document.querySelectorAll("[data-person-edit]")].some((b) => b.textContent === "Daniel"));

  // --- filters: inactive only shows Carol with restore button
  $("activeFilter").value = "inactive";
  $("activeFilter").dispatchEvent(new window.Event("change"));
  await sleep(80);
  check("inactive filter shows Carol", !!document.querySelector("[data-restore='p3']"));
  check("inactive row locked cells", !!document.querySelector(".att-locked"));

  // --- search filter
  $("activeFilter").value = "all";
  $("activeFilter").dispatchEvent(new window.Event("change"));
  $("searchInput").value = "alice";
  $("searchInput").dispatchEvent(new window.Event("input"));
  await sleep(400);
  const names = [...document.querySelectorAll("[data-person-edit]")].map((b) => b.textContent);
  check("search narrows to Alice", names.length === 1 && names[0] === "Alice", names.join(","));
  $("searchInput").value = "";
  $("searchInput").dispatchEvent(new window.Event("input"));
  await sleep(400);

  // --- deactivate via row button + custom confirm
  const removeBtn = document.querySelector("[data-person-remove='p2']");
  removeBtn.click();
  await sleep(100);
  $("confirmYes").click();
  await sleep(250);
  check("Bob marked inactive in his row", !!document.querySelector("[data-restore='p2']"));
  $("activeFilter").value = "active";
  $("activeFilter").dispatchEvent(new window.Event("change"));
  await sleep(80);
  check("Bob deactivated (gone from active list)", ![...document.querySelectorAll("[data-person-edit]")].some((b) => b.textContent === "Bob"));

  // restore Bob via inactive filter
  $("activeFilter").value = "inactive";
  $("activeFilter").dispatchEvent(new window.Event("change"));
  await sleep(80);
  const restoreBob = document.querySelector("[data-restore='p2']");
  check("Bob listed as inactive with restore", !!restoreBob);
  restoreBob?.click();
  await sleep(250);
  check("Bob restored", ![...document.querySelectorAll("[data-restore='p2']")].length === true || !document.querySelector("[data-restore='p2']"));

  // --- reports modal
  $("activeFilter").value = "all";
  $("activeFilter").dispatchEvent(new window.Event("change"));
  await sleep(80);
  $("reportsBtn").click();
  await sleep(150);
  check("reports modal renders summary", $("reportBody")?.textContent.includes("Person"));
  const summary = $("reportBody").textContent;
  check("report totals computed", /Rate/.test(summary));

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
  const delBtn = document.querySelector("[data-date-remove='2026-10-05']");
  delBtn.click();
  await sleep(100);
  $("confirmYes").click();
  await sleep(300);
  check("date removed from register", !document.querySelector("[data-date-remove='2026-10-05']"));
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

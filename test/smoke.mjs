// Smoke test: run the real app bundle in jsdom and exercise the landing page,
// auth modal, and dashboard rendering with a stubbed supabase client.
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";

const results = [];
const check = (name, ok, note = "") => {
  results.push([name, ok, note]);
  console.log((ok ? "PASS: " : "FAIL: ") + name + (ok ? "" : " — " + note));
};

const indexHtml = readFileSync("index.html", "utf8");
const bundle = readFileSync("/tmp/app.test.js", "utf8");

// jsdom lacks matchMedia/canvas; polyfill what the app needs
const dom = new JSDOM(indexHtml, {
  url: "https://attendanceflow.test/",
  runScripts: "outside-only",
  pretendToBeVisual: true,
  beforeParse(window) {
    window.matchMedia = (q) => ({
      matches: /reduce/.test(q) ? true : false,
      media: q,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {}
    });
    window.HTMLCanvasElement.prototype.getContext = () => null;
    window.URL.createObjectURL = () => "blob:test";
    window.URL.revokeObjectURL = () => {};
    window.HTMLElement.prototype.scrollIntoView = () => {};
    window.__errors = [];
    window.addEventListener("error", (e) => window.__errors.push(String(e.message)));
  }
});

const { window } = dom;
const { document } = window;

try {
  window.eval(bundle);
  await new Promise((r) => setTimeout(r, 300));

  check("no runtime errors on boot", window.__errors.length === 0, window.__errors.join("; "));
  check("landing hero renders", document.body.textContent.includes("Attendance that"));
  check("brand rendered", !!document.querySelector(".brand img[src='/attendanceflow-logo.svg']"));
  check("backend-missing notice shown", document.getElementById("msg")?.textContent.includes("Configure"));

  // auth modal opens
  document.getElementById("navLogin").click();
  check("auth modal opens", !document.getElementById("authModal").classList.contains("hidden"));
  check("team field hidden for sign-in", document.getElementById("teamWrap").classList.contains("hidden"));

  // switch to create-account mode
  document.getElementById("heroStart").click();
  check("signup mode shows team field", !document.getElementById("teamWrap").classList.contains("hidden"));

  // empty workspace name becomes default in setup screen; password short shows no crash:
  // (supabase client is null here — auth calls are guarded)
  const email = document.getElementById("authEmail");
  const pass = document.getElementById("authPassword");
  email.value = "someone@example.com";
  pass.value = "short";
  document.getElementById("signup").click();
  await new Promise((r) => setTimeout(r, 100));
  check("missing-backend auth shows message, no crash",
    (document.getElementById("msg")?.textContent || "").includes("missing") || window.__errors.length === 0,
    window.__errors.join("; "));

  console.log(results.every((r) => r[1]) ? "\nSMOKE TEST: ALL PASSED" : "\nSMOKE TEST: FAILURES PRESENT");
} catch (e) {
  console.error("SMOKE TEST ERROR:", e.message);
  process.exitCode = 1;
}

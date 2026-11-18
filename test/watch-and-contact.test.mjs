// Landing page watch + global contact persistence, in a real DOM.
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";

let fail = 0;
const check = (name, ok, detail = "") => { console.log((ok ? "PASS" : "FAIL") + ": " + name + (ok ? "" : " — " + detail)); if (!ok) fail++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function boot(seedStorage = {}, opts = {}) {
  // visitors are signed out: the landing page is what they see
  const dom = new JSDOM(readFileSync("index.html", "utf8"), { url: "https://a.test/", runScripts: "outside-only", pretendToBeVisual: true });
  const { window } = dom;
  window.matchMedia = (q) => ({ matches: /reduce/.test(q) ? false : false, addEventListener() {}, removeEventListener() {} });
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.HTMLCanvasElement.prototype.getContext = () => ({
    setTransform() {}, clearRect() {}, fillRect() {}, beginPath() {}, arc() {}, fill() {},
    stroke() {}, moveTo() {}, lineTo() {}, save() {}, restore() {}, scale() {}, translate() {}
  });
  for (const [k, v] of Object.entries(seedStorage)) window.localStorage.setItem(k, v);
  window.__afSignedOut = true;
  if (opts.failSettings) window.__afFailSettings = true;
  window.eval(readFileSync("/tmp/app.db.test.js", "utf8"));
  return window;
}

// ---- watch on the landing page
let w = boot();
await sleep(1200);
const doc = w.document;
const watch = doc.querySelector("[data-watch]");
check("landing shows the 3D watch", !!watch);
check("old SYNC orb is gone", !doc.querySelector(".hero-orb") && !doc.querySelector(".orb-face") && !/\bSYNC\b/.test(doc.querySelector(".hero-stage")?.textContent || ""));
check("floating status cards are kept", !!doc.querySelector(".card-top") && !!doc.querySelector(".card-bottom"));
check("watch has 60 minute ticks", doc.querySelectorAll(".af-watch-tick").length === 60);
check("watch has hour, minute and second needles", ["hour", "minute", "second"].every((h) => doc.querySelector('[data-hand="' + h + '"]')));
check("case has depth layers", doc.querySelectorAll(".af-watch-layer").length >= 4);
const h1 = watch.style.getPropertyValue("--second");
await sleep(350);
const h2 = watch.style.getPropertyValue("--second");
check("second needle is moving", h1 !== "" && h1 !== h2, h1 + " -> " + h2);
const now = new Date();
const minuteDeg = parseFloat(watch.style.getPropertyValue("--minute"));
const expect = (now.getMinutes() + now.getSeconds() / 60) * 6;
check("needles show the real time", Math.abs(minuteDeg - expect) < 3, minuteDeg + " vs " + expect.toFixed(1));
check("watch is decorative (hidden from screen readers)", doc.querySelector(".af-watch-scene")?.getAttribute("aria-hidden") === "true");
w.close();

// ---- global contact info: instant, permanent, and never blank
const KEY = "attendanceflow-platform-settings-v1";
const stale = JSON.stringify({ savedAt: 1, values: { contact_email: "old@device.example", contact_phone: "000" } });

// 1) database answers: it replaces an older device copy, and the copy is refreshed
w = boot({ [KEY]: stale });
await sleep(1200);
let page = w.document.body.textContent;
check("fresh database value replaces an older device copy", /founder@db\.example/.test(page) && !/old@device\.example/.test(page), page.match(/[\w.]+@[\w.]+/g)?.join(","));
const refreshed = JSON.parse(w.localStorage.getItem(KEY) || "null");
check("device copy now holds the database value", refreshed?.values?.contact_email === "founder@db.example", refreshed?.values?.contact_email);
w.close();

// 2) first ever visit, database answers: contact info appears and is remembered
w = boot({});
await sleep(1200);
check("first visit shows the saved contact info", /founder@db\.example/.test(w.document.body.textContent));
check("first visit remembers it on the device", JSON.parse(w.localStorage.getItem(KEY) || "{}")?.values?.contact_phone === "0793158326");
w.close();

// 3) connection drops: the last real values stay, never blank defaults
const good = JSON.stringify({ savedAt: 1, values: { contact_email: "last@known.example", contact_phone: "0793158326", contact_address: "Kigali" } });
w = boot({ [KEY]: good }, { failSettings: true });
await sleep(1500);
page = w.document.body.textContent;
check("a failed request keeps the last saved contact info", /last@known\.example/.test(page), page.match(/[\w.]+@[\w.]+/g)?.join(",") || "no email shown");
check("a failed request does not overwrite the saved copy", JSON.parse(w.localStorage.getItem(KEY) || "{}")?.values?.contact_email === "last@known.example");
w.close();

console.log(fail ? "WATCH + CONTACT TEST: FAILURES (" + fail + ")" : "WATCH + CONTACT TEST: ALL PASSED");
process.exit(fail ? 1 : 0);

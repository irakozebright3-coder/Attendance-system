// Regression tests for the shared panel search control.
// Verifies filtering scope, the "no results" message, Escape handling and,
// most importantly, that typing never starts a MutationObserver feedback loop
// (the bug that made every search bar clash the moment it was clicked).
import { JSDOM } from "jsdom";

const dom = new JSDOM(`<!doctype html><html><body>
  <div id="root">
    <section class="saved-people-panel" id="panelA">
      <header class="saved-people-header"><h2>People</h2></header>
      <article class="saved-person-card"><span class="saved-person-name">Alice</span></article>
      <article class="saved-person-card"><span class="saved-person-name">Bob</span></article>
      <article class="saved-person-card"><span class="saved-person-name">Carol</span></article>
    </section>
    <section class="saved-people-panel" id="panelB">
      <header class="saved-people-header"><h2>Other panel</h2></header>
      <article class="saved-person-card"><span class="saved-person-name">Robert</span></article>
    </section>
  </div>
</body></html>`, { url: "https://test.local/" });

globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.MutationObserver = dom.window.MutationObserver;

const { observePanelSearch } = await import("../src/lib/panel-search.js");

let mutations = 0;
const NativeObserver = dom.window.MutationObserver;
dom.window.MutationObserver = class extends NativeObserver {
  constructor(callback) {
    super((records, observer) => {
      mutations += records.length;
      callback(records, observer);
    });
  }
};

let passed = 0;
let failed = 0;
const check = (name, ok, note = "") => {
  if (ok) { passed += 1; console.log("PASS:", name); }
  else { failed += 1; console.log("FAIL:", name, "—", note); }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const visibleNames = (panel) =>
  [...panel.querySelectorAll(".saved-person-card")].filter((card) => !card.hidden)
    .map((card) => card.querySelector(".saved-person-name").textContent);

observePanelSearch(dom.window.document.getElementById("root"));
await sleep(80);

const panelA = dom.window.document.getElementById("panelA");
const panelB = dom.window.document.getElementById("panelB");
const inputA = panelA.querySelector(".panel-search-control input");
const inputB = panelB.querySelector(".panel-search-control input");
check("each panel gets its own search bar", Boolean(inputA) && Boolean(inputB));

const type = async (input, value) => {
  input.value = value;
  input.dispatchEvent(new dom.window.Event("input"));
  await sleep(120);
};

const before = mutations;
await type(inputA, "ali");
check("search scopes to its own panel", visibleNames(panelA).join(",") === "Alice" && visibleNames(panelB).join(",") === "Robert",
  visibleNames(panelA).join(",") + " / " + visibleNames(panelB).join(","));
check("typing does not start a mutation storm", mutations - before < 20, "mutations: " + (mutations - before));
check("input keeps its value", inputA.value === "ali");

await type(inputA, "zzz");
const message = panelA.querySelector(".panel-search-no-results");
check("no-results message appears", message && !message.hidden && message.textContent.includes("zzz"), message?.textContent);

const stormBefore = mutations;
await sleep(250);
check("page settles while a search is active", mutations - stormBefore === 0, "mutations: " + (mutations - stormBefore));

inputA.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape" }));
await sleep(120);
check("Escape clears the search", inputA.value === "" && visibleNames(panelA).length === 3, visibleNames(panelA).join(","));
check("cleared search hides the message", panelA.querySelector(".panel-search-no-results").hidden);

// A panel whose content is re-rendered must keep its search working.
const grid = panelA.querySelectorAll(".saved-person-card");
grid.forEach((card) => card.remove());
panelA.insertAdjacentHTML("beforeend", '<article class="saved-person-card"><span class="saved-person-name">Daniel</span></article>');
await sleep(150);
const inputA2 = panelA.querySelector(".panel-search-control input");
await type(inputA2, "dan");
check("search still works after panel re-render", visibleNames(panelA).join(",") === "Daniel", visibleNames(panelA).join(","));

console.log(failed ? `\nPANEL SEARCH TEST: ${failed} FAILURES` : `\nPANEL SEARCH TEST: ALL PASSED (${passed})`);
process.exit(failed ? 1 : 0);

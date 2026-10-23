// Reusable, accessible search controls for data/form panels.
// A search is scoped to its nearest panel, so searching one modal does not
// hide rows or cards that belong to a different panel.
const PANEL_SELECTOR = [
  ".saved-people-panel",
  ".modal-card",
  ".platform-card",
  ".team-group-editor",
  ".team-members-drawer",
  ".platform-stack-panel"
].join(",");

const ITEM_SELECTOR = [
  ".saved-person-card",
  ".history-table tbody tr",
  ".team-group-card",
  ".group-member-option",
  ".admin-table tbody tr",
  ".faq-admin-item",
  ".member-line",
  ".settings-grid > label",
  ".modal-card .dialog-label",
  ".modal-card form label",
  ".platform-card form label",
  ".team-group-editor form label",
  ".report-scroll tr",
  ".report-scroll > article",
  ".history-list > *",
  ".footer-stack > span"
].join(",");

function searchableText(element) {
  const values = [element.textContent || ""];
  element.querySelectorAll("input,textarea,select").forEach((field) => {
    if (field.type === "password") return;
    values.push(field.value || "", field.getAttribute("placeholder") || "");
  });
  return values.join(" ").toLocaleLowerCase();
}

function itemsForPanel(panel) {
  return [...panel.querySelectorAll(ITEM_SELECTOR)].filter((item) =>
    item.closest(PANEL_SELECTOR) === panel
  );
}

function applyFilter(panel, input, emptyMessage) {
  const term = input.value.trim().toLocaleLowerCase();
  const items = itemsForPanel(panel);
  let visibleCount = 0;

  items.forEach((item) => {
    const matches = !term || searchableText(item).includes(term);
    item.hidden = !matches;
    if (matches) visibleCount += 1;
  });

  // Do not show "no matches" when a panel has no filterable data yet.
  emptyMessage.hidden = !term || !items.length || visibleCount > 0;
  emptyMessage.textContent = term
    ? 'No results in this panel for "' + input.value.trim() + '".'
    : "";
}

function attachPanelSearch(panel) {
  // A generic confirmation message is not a searchable data panel; leave it
  // clean. Async list panels will be picked up when their content arrives.
  if (panel.matches(".modal-card") && !panel.querySelector(
    "table, .dialog-label, label, .report-scroll, .history-list, .faq-admin-list, .settings-form"
  )) return;

  if (panel.dataset.panelSearchReady === "true") {
    const input = panel.querySelector(":scope > .panel-search-control input");
    const empty = panel.querySelector(":scope > .panel-search-no-results");
    if (input && empty && input.value.trim()) applyFilter(panel, input, empty);
    return;
  }

  const wrapper = document.createElement("label");
  wrapper.className = "panel-search-control";
  const icon = document.createElement("span");
  icon.className = "panel-search-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "⌕";

  const input = document.createElement("input");
  input.type = "search";
  input.className = "panel-search-input";
  input.placeholder = "Search this panel…";
  input.setAttribute("aria-label", "Search content in this panel");
  input.autocomplete = "off";
  input.spellcheck = false;

  wrapper.append(icon, input);

  const empty = document.createElement("p");
  empty.className = "panel-search-no-results";
  empty.setAttribute("role", "status");
  empty.hidden = true;

  const anchor = panel.querySelector(
    ":scope > .saved-people-header, :scope > .platform-card-head, :scope > .group-editor-heading, :scope > .drawer-head, :scope > h2, :scope > h3"
  );
  if (anchor) anchor.insertAdjacentElement("afterend", wrapper);
  else panel.insertAdjacentElement("afterbegin", wrapper);
  wrapper.insertAdjacentElement("afterend", empty);

  input.addEventListener("input", () => applyFilter(panel, input, empty));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && input.value) {
      input.value = "";
      applyFilter(panel, input, empty);
    }
  });

  panel.dataset.panelSearchReady = "true";
  // Dynamic lists may appear after the panel. Start with everything visible.
  applyFilter(panel, input, empty);
}

export function observePanelSearch(root) {
  if (!root || root.dataset.panelSearchObserver === "true") return;
  root.dataset.panelSearchObserver = "true";

  const scan = () => {
    root.querySelectorAll(PANEL_SELECTOR).forEach(attachPanelSearch);
  };

  scan();
  const observer = new MutationObserver(scan);
  observer.observe(root, { childList: true, subtree: true });
}

// Authenticated dashboard: header, stats, toolbar, attendance register.
// Premium visual layer (af-glass, stat orbs, ambient, parallax) follows the
// AttendanceFlow design system; all data logic is database-backed.
import { esc, dateLabel, today, pct } from "../lib/util.js";
import { logoMarkup, bindParallax } from "./landing.js";
import { footerMarkup, bindFooter } from "./public-info.js";

// Keep very large teams usable without virtualization complexity.
const ROW_LIMIT = 150;
const DATE_LIMIT = 14;

export function dashboard(ctx) {
  const { S, canManage } = ctx;
  const app = document.getElementById("app");
  const manager = canManage();

  app.innerHTML =
    '<main class="app-shell dashboard-page">' +
      '<div class="dashboard-ambient dashboard-ambient-a"></div><div class="dashboard-ambient dashboard-ambient-b"></div>' +
      '<div class="af-container">' +
        '<header class="dashboard-topbar af-glass af-tilt">' +
          '<div class="dashboard-brand">' +
            '<a class="brand dashboard-brand-link" href="#" aria-label="AttendanceFlow">' +
              logoMarkup("dashboard-logo") +
              '<span><strong>Attendance<span class="brand-accent">Flow</span></strong><small id="teamLabel">Team attendance workspace</small></span>' +
            '</a>' +
            '<div class="backend-status"><i></i><span id="backendStatus">Connecting backend…</span></div>' +
          '</div>' +
          '<div class="dashboard-user">' +
            '<span id="emailLabel" class="desktop-email"></span>' +
            '<span id="roleLabel" class="role-badge"></span>' +
            '<button id="settingsBtn" class="liquid dashboard-action">Settings</button>' +
            '<button id="reportsBtn" class="liquid dashboard-action">Reports</button>' +
            (manager
              ? '<button id="inviteBtn" class="liquid dashboard-action">Invite</button>' +
                '<button id="auditBtn" class="liquid dashboard-action">Audit log</button>'
              : '') +
            (S.isPlatformAdmin
              ? '<button id="platformAdminBtn" class="liquid dashboard-action platform-admin-action">Super Admin</button>'
              : '') +
            '<button id="reload" class="liquid dashboard-action">↻ Refresh</button>' +
            '<button id="logout" class="liquid dashboard-action logout-action">Sign out</button>' +
          '</div>' +
        '</header>' +

        '<section class="dashboard-hero">' +
          '<div class="dashboard-hero-copy">' +
            '<div class="eyebrow"><span class="pulse-dot"></span> LIVE WORKSPACE</div>' +
            '<h1>Know who is <span class="gradient-text">here.</span></h1>' +
            '<p>' + (manager
              ? 'Your attendance register is connected to the real AttendanceFlow backend. Every person, date, photo and attendance change is stored for your team.'
              : 'You are a team member: you can mark attendance and view the register. Management actions belong to owners and admins.') + '</p>' +
            '<div class="dashboard-hero-meta"><span>POSTGRESQL</span><span>REALTIME</span><span>SECURE STORAGE</span></div>' +
          '</div>' +
          '<div class="dashboard-actions">' +
            (manager
              ? '<button id="newDate" class="liquid primary-cta dashboard-main-cta"><span class="cta-plus">+</span> Add attendance date <span>↗</span></button>' +
                '<button id="newPerson" class="liquid secondary-cta dashboard-main-cta"><span class="cta-plus">+</span> Add person</button>'
              : '<div class="register-live member-hint"><i></i><span>Mark cells: empty → present → absent</span></div>') +
          '</div>' +
        '</section>' +

        '<section class="dashboard-stats af-grid-12">' +
          '<article class="stat-card af-glass af-tilt af-span-3"><span class="stat-orb stat-orb-purple"></span><div class="stat-label">ACTIVE PEOPLE</div><div id="peopleCount" class="stat-value">0</div><div class="stat-caption">Saved in this workspace</div></article>' +
          '<article class="stat-card af-glass af-tilt af-span-3"><span class="stat-orb stat-orb-mint"></span><div class="stat-label">PRESENT TODAY</div><div id="presentCount" class="stat-value stat-mint">0</div><div class="stat-caption">Marked present today</div></article>' +
          '<article class="stat-card af-glass af-tilt af-span-3"><span class="stat-orb stat-orb-red"></span><div class="stat-label">ABSENT TODAY</div><div id="absentCount" class="stat-value stat-red">0</div><div class="stat-caption">Marked absent today</div></article>' +
          '<article class="stat-card af-glass af-tilt af-span-3"><span class="stat-orb stat-orb-blue"></span><div class="stat-label">ATTENDANCE RATE</div><div id="rate" class="stat-value stat-blue">0%</div><div class="stat-caption">Based on marked records</div></article>' +
        '</section>' +

        '<section class="register-shell af-glass">' +
          '<div class="register-toolbar">' +
            '<div><div class="register-kicker">SHARED REGISTER</div><h2>Attendance register</h2><p>Click a cell: <b>empty</b> → <b class="present-text">present</b> → <b class="absent-text">absent</b> → empty</p></div>' +
            '<div id="toolbar" class="toolbar flex flex-wrap items-center gap-2">' +
              '<input id="searchInput" type="search" placeholder="Search name or ID…" aria-label="Search people by name or identifier" class="toolbar-input">' +
              '<label class="sr-only" for="activeFilter">Filter people</label>' +
              '<select id="activeFilter" class="toolbar-select" aria-label="Filter by active state">' +
                '<option value="all">All people</option><option value="active" selected>Active only</option><option value="inactive">Inactive only</option>' +
              '</select>' +
              '<label class="sr-only" for="statusFilter">Filter by status</label>' +
              '<select id="statusFilter" class="toolbar-select" aria-label="Filter by latest-date status">' +
                '<option value="any" selected>Any status</option><option value="present">Present (latest date)</option><option value="absent">Absent (latest date)</option><option value="unmarked">Unmarked (latest date)</option>' +
              '</select>' +
              '<label class="sr-only" for="sortSelect">Sort people</label>' +
              '<select id="sortSelect" class="toolbar-select" aria-label="Sort people">' +
                '<option value="name-asc" selected>Name A→Z</option><option value="name-desc">Name Z→A</option>' +
                '<option value="identifier-asc">ID A→Z</option><option value="identifier-desc">ID Z→A</option>' +
                '<option value="newest">Newest first</option><option value="oldest">Oldest first</option>' +
              '</select>' +
            '</div>' +
          '</div>' +
          '<div class="register-stage"><div class="register-glow"></div><div class="overflow-x-auto register-scroll"><table class="w-full text-sm"><thead id="thead"></thead><tbody id="tbody"></tbody></table></div>' +
          '<div id="empty" class="hidden empty-register"><div class="empty-icon">＋</div><h3>No people yet</h3><p>Add your first person to start the shared register.</p><button id="emptyAddPerson" class="liquid primary-cta">Add first person ↗</button></div>' +
          '</div>' +
        '</section>' +
      '</div>' +
      footerMarkup(S.platformSettings, S.faqs) +
    '</main>' +
    '<div id="modal" class="modal hidden" role="dialog" aria-modal="true"></div>';

  document.getElementById("teamLabel").textContent = S.team?.name || "Team attendance workspace";
  document.getElementById("emailLabel").textContent = S.session?.user?.email || "";
  document.getElementById("roleLabel").textContent = (S.role || "member").toUpperCase();
  document.getElementById("logout").onclick = () => ctx.handlers.signOut();
  document.getElementById("reload").onclick = () => ctx.handlers.refresh();
  document.getElementById("settingsBtn").onclick = () => ctx.handlers.openSettings();
  document.getElementById("reportsBtn").onclick = () => ctx.handlers.openReports();
  if (S.isPlatformAdmin) {
    document.getElementById("platformAdminBtn").onclick = () => ctx.handlers.openPlatformAdmin();
  }
  bindFooter(S.platformSettings, S.faqs);
  if (manager) {
    document.getElementById("inviteBtn").onclick = () => ctx.handlers.showInvite();
    document.getElementById("auditBtn").onclick = () => ctx.handlers.openAudit();
  }
  const newDate = document.getElementById("newDate");
  if (newDate) newDate.onclick = () => ctx.handlers.addDate();
  const newPerson = document.getElementById("newPerson");
  if (newPerson) newPerson.onclick = () => ctx.handlers.addPerson();
  document.getElementById("emptyAddPerson").onclick = () => ctx.handlers.addPerson();
  document.querySelector(".dashboard-brand-link").onclick = (e) => e.preventDefault();

  // toolbar wiring
  const search = document.getElementById("searchInput");
  search.oninput = ctx.debouncedSearch(search);
  document.getElementById("activeFilter").onchange = (e) => {
    S.filters.active = e.target.value;
    renderRegister(ctx);
  };
  document.getElementById("statusFilter").onchange = (e) => {
    S.filters.status = e.target.value;
    renderRegister(ctx);
  };
  document.getElementById("sortSelect").onchange = (e) => {
    S.filters.sort = e.target.value;
    renderRegister(ctx);
  };

  bindParallax();
}

function applyFilters(ctx) {
  const { S } = ctx;
  const f = S.filters;
  const q = f.search.trim().toLowerCase();
  let list = [...S.people];
  if (q) {
    list = list.filter((p) =>
      (p.name || "").toLowerCase().includes(q) || (p.identifier || "").toLowerCase().includes(q)
    );
  }
  if (f.active === "active") list = list.filter((p) => p.active);
  else if (f.active === "inactive") list = list.filter((p) => !p.active);

  const latest = S.dates.length ? S.dates[S.dates.length - 1].date : null;
  if (latest && f.status !== "any") {
    list = list.filter((p) => (S.marks.get(p.id + "|" + latest) || "empty") === f.status);
  }

  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
  const byName = (a, b) => collator.compare(a.name || "", b.name || "");
  const byId = (a, b) => collator.compare(a.identifier || "￿", b.identifier || "￿");
  const byNew = (a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""));
  const sorters = {
    "name-asc": (a, b) => byName(a, b),
    "name-desc": (a, b) => byName(b, a),
    "identifier-asc": (a, b) => byId(a, b) || byName(a, b),
    "identifier-desc": (a, b) => byId(b, a) || byName(a, b),
    "newest": (a, b) => byNew(a, b),
    "oldest": (a, b) => byNew(b, a)
  };
  list.sort(sorters[f.sort] || sorters["name-asc"]);
  return list;
}

function statusOf(ctx, personId, date) {
  return ctx.S.marks.get(personId + "|" + date) || "empty";
}

export function renderRegister(ctx) {
  const thead = document.getElementById("thead");
  const tbody = document.getElementById("tbody");
  const empty = document.getElementById("empty");
  if (!thead || !tbody) return;
  const { S, canManage } = ctx;
  const manager = canManage();

  const people = applyFilters(ctx);
  const dates = S.showAllDates ? S.dates : S.dates.slice(-DATE_LIMIT);
  const hiddenDates = S.dates.length - dates.length;

  // header
  thead.innerHTML =
    "<tr><th scope='col' class='sticky left-0 bg-slate-950/95 text-left px-5 py-4 min-w-[260px] sticky-head'>Person</th>" +
    dates.map((d) =>
      "<th scope='col' class='px-3 py-4 min-w-[110px] align-top'>" + esc(dateLabel(d.date)) +
      (manager ? "<br><button data-date-remove='" + esc(d.date) + "' class='text-[10px] text-slate-500 hover:text-red-300 mt-1'>remove</button>" : "") +
      "</th>"
    ).join("") + "</tr>";

  // body
  const shown = S.showAllRows ? people : people.slice(0, ROW_LIMIT);
  tbody.innerHTML = shown.map((p) => personRow(ctx, p, dates, manager)).join("");

  document.querySelectorAll("[data-person-remove]").forEach((x) => {
    x.onclick = () => ctx.handlers.deactivatePerson(x.dataset.personRemove);
  });
  document.querySelectorAll("[data-restore]").forEach((x) => {
    x.onclick = () => ctx.handlers.restorePerson(x.dataset.restore);
  });
  document.querySelectorAll("[data-date-remove]").forEach((x) => {
    x.onclick = () => ctx.handlers.removeDate(x.dataset.dateRemove);
  });
  document.querySelectorAll("[data-person-cell]").forEach((x) => {
    x.onclick = () => ctx.handlers.toggle(x.dataset.personCell, x.dataset.date);
  });
  document.querySelectorAll("[data-person-edit]").forEach((x) => {
    x.onclick = () => ctx.handlers.openPerson(x.dataset.personEdit);
  });

  // empty states — real data only
  const hasPeople = S.people.length > 0;
  const hasDates = S.dates.length > 0;
  const showEmptyState = (title, text, showAdd) => {
    empty.classList.remove("hidden");
    empty.querySelector("h3").textContent = title;
    empty.querySelector("p").textContent = text;
    empty.querySelector("#emptyAddPerson").classList.toggle("hidden", !showAdd);
  };
  if (!hasPeople) {
    if (manager) showEmptyState("No people yet", "Add your first person to start the shared register.", true);
    else showEmptyState("No people yet", "An owner or admin needs to add the first person.", false);
  } else if (!hasDates) {
    if (manager) showEmptyState("No attendance dates yet", "Add your first date to open the shared register.", false);
    else showEmptyState("No attendance dates yet", "An owner or admin needs to add the first date.", false);
  } else if (people.length === 0) {
    showEmptyState("No people match", "Try clearing the search or switching filters.", false);
  } else {
    empty.classList.add("hidden");
  }

  // overflow affordances
  if (people.length > shown.length || hiddenDates > 0) {
    const note = document.createElement("div");
    note.className = "px-5 py-3 text-xs text-slate-500 border-t border-white/5";
    note.innerHTML =
      (people.length > shown.length
        ? "<button id='showAllRows' class='underline hover:text-slate-300'>Showing " + shown.length + " of " + people.length + " people — show all</button> · "
        : "") +
      (hiddenDates > 0 && !S.showAllDates
        ? "<button id='showAllDates' class='underline hover:text-slate-300'>Showing latest " + dates.length + " of " + S.dates.length + " dates — show all dates</button>"
        : "");
    document.querySelector(".register-shell").appendChild(note);
    const allRows = document.getElementById("showAllRows");
    if (allRows) allRows.onclick = () => { S.showAllRows = true; renderRegister(ctx); };
    const allDates = document.getElementById("showAllDates");
    if (allDates) allDates.onclick = () => { S.showAllDates = true; renderRegister(ctx); };
  }

  updateStats(ctx);
}

function personRow(ctx, p, dates, manager) {
  const { S } = ctx;
  const canMark = ctx.canMarkAttendance ? ctx.canMarkAttendance() : true;
  const photo = p.photo_url
    ? '<img class="avatar" loading="lazy" src="' + esc(p.photo_url) + '" alt="' + esc(p.name) + '">'
    : '<div class="avatar grid place-items-center text-violet-300 font-black" aria-hidden="true">' + esc((p.name || "?").charAt(0).toUpperCase()) + "</div>";

  const rowActions = !manager
    ? ""
    : p.active
      ? '<button data-person-remove="' + esc(p.id) + '" class="ml-auto text-slate-600 hover:text-red-300" title="Deactivate person" aria-label="Deactivate ' + esc(p.name) + '">×</button>'
      : '<button data-restore="' + esc(p.id) + '" class="ml-auto text-cyan-400 hover:text-cyan-300 underline text-xs" title="Restore person" aria-label="Restore ' + esc(p.name) + '">restore</button>';

  const cells = dates.map((d) => {
    if (!p.active) {
      return "<td class='px-3 py-3'><span class='att empty att-locked' aria-label='" + esc(p.name + " on " + dateLabel(d.date) + " — person is inactive") + "'>·</span></td>";
    }
    const s = statusOf(ctx, p.id, d.date);
    const label = !canMark
      ? esc(p.name + " on " + dateLabel(d.date) + ": attendance marking is disabled by the team.")
      : esc(p.name + " on " + dateLabel(d.date) + ": " + (s === "present" ? "present" : s === "absent" ? "absent" : "not marked") + ". Activate to " + (s === "empty" ? "mark present" : s === "present" ? "mark absent" : "clear") + ".");
    return "<td class='px-3 py-3'><button aria-label='" + label + "' " + (!canMark ? "disabled" : "data-person-cell='" + esc(p.id) + "'") + " data-date='" + esc(d.date) + "' class='att " + s + (!canMark ? " att-locked" : "") + "'>" +
      (s === "present" ? "✓" : s === "absent" ? "✕" : "•") +
    "</button></td>";
  }).join("");

  const inactive = p.active ? "" : " row-inactive";
  return "<tr class='border-t border-white/5" + inactive + "'>" +
    "<td class='sticky left-0 bg-slate-950/95 px-5 py-3'>" +
      "<div class='flex items-center gap-3'>" + photo +
        "<div><button data-person-edit='" + esc(p.id) + "' class='text-left hover:underline underline-offset-2 font-bold' title='Open person details'>" + esc(p.name) + "</button>" +
        (p.active ? "" : " <span class='badge-inactive'>inactive</span>") +
        "<div class='text-[11px] text-slate-500'>" + esc(p.identifier || "") + "</div></div>" +
        rowActions +
      "</div>" +
    "</td>" + cells + "</tr>";
}

export function updateCell(ctx, personId, date) {
  const btn = document.querySelector("[data-person-cell='" + personId + "'][data-date='" + date + "']");
  if (!btn) return;
  const s = statusOf(ctx, personId, date);
  const p = ctx.S.people.find((x) => x.id === personId);
  btn.className = "att " + s;
  btn.textContent = s === "present" ? "✓" : s === "absent" ? "✕" : "•";
  btn.setAttribute("aria-label", (p?.name || "Person") + " on " + dateLabel(date) + ": " +
    (s === "present" ? "present" : s === "absent" ? "absent" : "not marked") + ".");
  updateStats(ctx);
}

export function cellPending(ctx, personId, date, pending) {
  const btn = document.querySelector("[data-person-cell='" + personId + "'][data-date='" + date + "']");
  if (!btn) return;
  btn.disabled = pending;
  btn.classList.toggle("pending", pending);
}

export function updateStats(ctx) {
  const { S } = ctx;
  const activePeople = S.people.filter((p) => p.active);
  const t = today();
  const present = activePeople.filter((p) => S.marks.get(p.id + "|" + t) === "present").length;
  const absent = activePeople.filter((p) => S.marks.get(p.id + "|" + t) === "absent").length;
  const total = present + absent;
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };
  set("peopleCount", String(activePeople.length));
  set("presentCount", String(present));
  set("absentCount", String(absent));
  set("rate", pct(present, total));
}

export function setBackendStatus(text) {
  const el = document.getElementById("backendStatus");
  if (el) el.textContent = text;
  const dot = document.querySelector(".backend-status i");
  if (dot) {
    dot.classList.toggle("offline", /error/i.test(text));
    dot.classList.toggle("warn", /reconnect|connecting/i.test(text));
  }
}

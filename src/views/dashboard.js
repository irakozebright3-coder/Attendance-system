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
              '<span><strong>' + esc(S.platformSettings?.site_name || "AttendanceFlow") + '</strong><small id="teamLabel">Team attendance workspace</small></span>' +
            '</a>' +
            '<div class="backend-status"><i></i><span id="backendStatus">Connecting backend…</span></div>' +
          '</div>' +
          '<div class="dashboard-user">' +
            '<span id="emailLabel" class="desktop-email"></span>' +
            '<span id="roleLabel" class="role-badge"></span>' +
          '<label class="theme-picker"><span class="theme-picker-icon" aria-hidden="true">◐</span><span class="theme-picker-label">Appearance</span><select data-theme-select aria-label="Appearance mode"><option value="system">System default</option><option value="white">White mode</option><option value="black">Black mode</option></select></label>' +
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
                '<button id="savedPeopleBtn" class="liquid secondary-cta dashboard-main-cta">▣ Registered People</button>'
              : '<div class="register-live member-hint"><i></i><span>Mark cells: empty → present → absent</span></div>') +
            '<button id="attendanceHistoryBtn" type="button" class="liquid secondary-cta dashboard-main-cta dashboard-history-cta">◷ Attendance History</button>' +
            '<button id="teamGroupsBtn" type="button" class="liquid secondary-cta dashboard-main-cta dashboard-groups-cta">▦ Groups &amp; Committees</button>' +
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
              '<button id="joinedOrderToggle" type="button" class="toolbar-action" aria-label="Toggle people by newest or oldest joined">Joined: Newest ↓</button>' +
              '<label class="sr-only" for="activeFilter">Filter people</label>' +
              '<select id="activeFilter" class="toolbar-select" aria-label="Filter by active state">' +
                '<option value="all">All people</option><option value="active" selected>Active only</option><option value="inactive">Inactive only</option>' +
              '</select>' +
              '<label class="sr-only" for="statusFilter">Filter by status</label>' +
              '<select id="statusFilter" class="toolbar-select" aria-label="Filter by latest-date status">' +
                '<option value="any" selected>Any status</option><option value="present">Present (latest date)</option><option value="absent">Absent (latest date)</option><option value="unmarked">Unmarked (latest date)</option>' +
              '</select>' +

            '</div>' +
          '</div>' +
          '<div class="register-stage"><div class="register-glow"></div><div class="overflow-x-auto register-scroll"><table class="w-full text-sm"><thead id="thead"></thead><tbody id="tbody"></tbody></table></div>' +
          '<div id="empty" class="hidden empty-register"><div class="empty-icon">＋</div><h3>No people yet</h3><p>Add your first person from the Registered People page.</p>' +
            (manager ? '<button id="emptyOpenRegisteredPeople" class="liquid primary-cta">Open Registered People ↗</button>' : '') + '</div>' +
          '</div>' +
        '</section>' +
      '</div>' +
      footerMarkup(S.platformSettings, S.faqs) +
    '</main>' +
    '<div id="modal" class="modal hidden" role="dialog" aria-modal="true"></div>' +
    '<div id="savedPeopleModal" class="saved-people-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="savedPeopleTitle">' +
      '<section class="saved-people-panel"><header class="saved-people-header"><div><span class="register-kicker">PEOPLE DIRECTORY</span><h2 id="savedPeopleTitle">Registered People</h2><p id="registeredPeopleSummary">People registered in this team, listed in order.</p></div>' +
      '<div class="saved-people-header-actions">' +
        (manager ? '<button id="registeredAddPerson" class="liquid primary-cta dashboard-action">+ Add person</button>' : '') +
        '<button id="closeSavedPeople" class="liquid dashboard-action" aria-label="Return to dashboard">← Back to dashboard</button></div></header>' +
      '<div id="savedPeopleGrid" class="saved-people-grid"></div></section></div>' +
    '<div id="attendanceHistoryModal" class="saved-people-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="attendanceHistoryTitle">' +
      '<section class="saved-people-panel attendance-history-panel"><header class="saved-people-header"><div><span class="register-kicker">SAVED RECORDS</span><h2 id="attendanceHistoryTitle">Attendance History</h2><p>The latest saved attendance status per person per day — no repeated names.</p></div>' +
      '<div class="saved-people-header-actions"><button id="refreshAttendanceHistory" class="liquid dashboard-action">↻ Refresh</button><button id="closeAttendanceHistory" class="liquid dashboard-action">← Back</button></div></header>' +
      '<section class="history-export-toolbar" aria-label="Filter and export attendance history">' +
        '<div class="history-date-filters">' +
          '<label class="history-filter-field"><span>Date filter</span><select id="historyDateMode" class="toolbar-select"><option value="all">All dates</option><option value="day">Specific day</option><option value="month">Month</option><option value="year">Year</option><option value="range">Date range</option></select></label>' +
          '<label id="historyDayWrap" class="history-filter-field hidden"><span>Day</span><input id="historyDayInput" type="date" class="toolbar-select"></label>' +
          '<label id="historyMonthWrap" class="history-filter-field hidden"><span>Month</span><input id="historyMonthInput" type="month" class="toolbar-select"></label>' +
          '<label id="historyYearWrap" class="history-filter-field hidden"><span>Year</span><input id="historyYearInput" type="number" min="2000" max="2200" step="1" inputmode="numeric" placeholder="YYYY" class="toolbar-select"></label>' +
          '<div id="historyRangeWrap" class="history-range-fields hidden"><label class="history-filter-field"><span>From</span><input id="historyRangeStart" type="date" class="toolbar-select"></label><label class="history-filter-field"><span>To</span><input id="historyRangeEnd" type="date" class="toolbar-select"></label></div>' +
          '<div class="history-filter-actions"><button id="applyHistoryFilter" type="button" class="liquid primary-cta">Apply dates</button><button id="clearHistoryFilter" type="button" class="liquid dashboard-action">Clear</button></div>' +
        '</div>' +
        '<div class="history-export-actions"><span class="history-export-label">Export filtered records</span><button id="historyExportPdf" type="button" class="history-export-button history-export-pdf">↓ PDF</button><button id="historyExportCsv" type="button" class="history-export-button">↓ CSV</button><button id="historyExportTsv" type="button" class="history-export-button">↓ TSV</button><button id="historyExportJson" type="button" class="history-export-button">↓ JSON</button></div>' +
      '</section>' +
      '<p id="attendanceHistorySummary" class="history-summary">Loading saved attendance history…</p>' +
      '<div class="overflow-x-auto history-table-wrap"><table class="history-table"><thead><tr><th>Attendance date</th><th>Person</th><th>Status</th><th>Event</th><th>Recorded at</th><th>Marked by</th></tr></thead><tbody id="attendanceHistoryRows"></tbody></table></div>' +
      '</section></div>' +
    '<div id="teamGroupsModal" class="saved-people-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="teamGroupsTitle">' +
      '<section class="saved-people-panel team-groups-panel"><header class="saved-people-header"><div><span class="register-kicker">PEOPLE ORGANIZATION</span><h2 id="teamGroupsTitle">Groups & committees</h2><p>Create work groups and assign saved people. Group memberships are stored in the team database.</p></div>' +
      '<div class="saved-people-header-actions">' +
        (manager ? '<button id="createTeamGroup" class="liquid primary-cta dashboard-action">+ New group</button>' : '') +
        '<button id="closeTeamGroups" class="liquid dashboard-action">← Back</button></div></header>' +
      '<div id="teamGroupsList" class="team-groups-list"><p class="groups-loading">Loading groups…</p></div>' +
      '<section id="teamGroupEditor" class="team-group-editor hidden"><div class="group-editor-heading"><h3 id="teamGroupEditorTitle">New group</h3><p>Choose a name and select the people who belong to this group.</p></div>' +
      '<form id="teamGroupForm" class="team-group-form">' +
        '<label class="dialog-label">Group name<input id="teamGroupName" maxlength="80" required placeholder="e.g. Attendance Committee" class="dialog-input"></label>' +
        '<label class="dialog-label">Description <span class="text-slate-500">(optional)</span><textarea id="teamGroupDescription" maxlength="400" rows="2" placeholder="Purpose or responsibilities of this group" class="dialog-input"></textarea></label>' +
        '<h4 class="group-member-heading">Select people</h4><div id="teamGroupMemberPicker" class="team-group-member-picker"></div>' +
        '<div class="team-group-form-actions"><button id="cancelTeamGroup" type="button" class="liquid dashboard-action">Cancel</button><button id="saveTeamGroup" type="submit" class="liquid primary-cta">Save group</button></div>' +
      '</form></section></section></div>' +
    '<div id="photoViewer" class="photo-viewer hidden" role="dialog" aria-modal="true" aria-label="Full-size profile photo"><button id="closePhotoViewer" class="photo-viewer-close" aria-label="Close full-size photo">✕</button><button id="photoViewerPrev" class="photo-viewer-nav photo-viewer-prev" aria-label="Previous photo">‹</button><figure class="photo-viewer-figure"><img id="photoViewerImage" alt=""><figcaption id="photoViewerCaption"></figcaption></figure><button id="photoViewerNext" class="photo-viewer-nav photo-viewer-next" aria-label="Next photo">›</button></div>';

  document.getElementById("teamLabel").textContent = S.team?.name || "Team attendance workspace";
  const accountName = String(S.session?.user?.user_metadata?.full_name || S.session?.user?.user_metadata?.name || "").trim();
  const emailLabel = document.getElementById("emailLabel");
  emailLabel.textContent = accountName || String(S.platformSettings?.owner_name || "").trim() || "Admin";
  emailLabel.removeAttribute("title");
  document.getElementById("roleLabel").textContent = ["owner", "admin"].includes(String(S.role || "").toLowerCase())
    ? "ADMIN"
    : String(S.role || "member").toUpperCase();
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
  const savedPeopleBtn = document.getElementById("savedPeopleBtn");
  if (savedPeopleBtn) savedPeopleBtn.onclick = () => openSavedPeople(ctx);
  const registeredAddPerson = document.getElementById("registeredAddPerson");
  if (registeredAddPerson) registeredAddPerson.onclick = () => ctx.handlers.addPerson();
  const emptyOpenRegisteredPeople = document.getElementById("emptyOpenRegisteredPeople");
  if (emptyOpenRegisteredPeople) emptyOpenRegisteredPeople.onclick = () => openSavedPeople(ctx);
  document.getElementById("closeSavedPeople").onclick = closeSavedPeople;
  const attendanceHistoryBtn = document.getElementById("attendanceHistoryBtn");
  if (attendanceHistoryBtn) attendanceHistoryBtn.onclick = () => openAttendanceHistory(ctx);
  document.getElementById("closeAttendanceHistory").onclick = closeAttendanceHistory;
  document.getElementById("refreshAttendanceHistory").onclick = () => openAttendanceHistory(ctx);
  document.getElementById("attendanceHistoryModal").addEventListener("click", (e) => {
    if (e.target.id === "attendanceHistoryModal") closeAttendanceHistory();
  });
  const historyDateMode = document.getElementById("historyDateMode");
  historyDateMode.onchange = syncHistoryDateControls;
  document.getElementById("applyHistoryFilter").onclick = () => applyAttendanceHistoryFilter(ctx, true);
  document.getElementById("clearHistoryFilter").onclick = () => {
    historyDateMode.value = "all";
    document.getElementById("historyDayInput").value = "";
    document.getElementById("historyMonthInput").value = "";
    document.getElementById("historyYearInput").value = "";
    document.getElementById("historyRangeStart").value = "";
    document.getElementById("historyRangeEnd").value = "";
    syncHistoryDateControls();
    applyAttendanceHistoryFilter(ctx, false);
  };
  document.getElementById("historyExportCsv").onclick = () => exportAttendanceHistory(ctx, "csv");
  document.getElementById("historyExportTsv").onclick = () => exportAttendanceHistory(ctx, "tsv");
  document.getElementById("historyExportJson").onclick = () => exportAttendanceHistory(ctx, "json");
  document.getElementById("historyExportPdf").onclick = () => printAttendanceHistory(ctx);
  syncHistoryDateControls();
  const teamGroupsBtn = document.getElementById("teamGroupsBtn");
  if (teamGroupsBtn) teamGroupsBtn.onclick = () => openTeamGroups(ctx);
  document.getElementById("closeTeamGroups").onclick = closeTeamGroups;
  const createTeamGroup = document.getElementById("createTeamGroup");
  if (createTeamGroup) createTeamGroup.onclick = () => showTeamGroupEditor(ctx, null);
  document.getElementById("teamGroupsModal").addEventListener("click", (e) => {
    if (e.target.id === "teamGroupsModal") closeTeamGroups();
  });
  document.getElementById("cancelTeamGroup").onclick = () => {
    document.getElementById("teamGroupEditor").classList.add("hidden");
    document.getElementById("teamGroupForm").reset();
    delete document.getElementById("teamGroupForm").dataset.groupId;
  };
  document.getElementById("teamGroupForm").onsubmit = async (e) => {
    e.preventDefault();
    if (!ctx.canManage()) { ctx.toast("Only owners and admins can manage groups.", "error"); return; }
    const form = e.currentTarget;
    const saveButton = document.getElementById("saveTeamGroup");
    const originalLabel = saveButton.textContent;
    saveButton.disabled = true;
    saveButton.textContent = "Saving…";
    const personIds = [...form.querySelectorAll('input[name="groupPerson"]:checked')].map((input) => input.value);
    try {
      await ctx.handlers.saveGroup({
        id: form.dataset.groupId || null,
        name: document.getElementById("teamGroupName").value.trim(),
        description: document.getElementById("teamGroupDescription").value.trim(),
        personIds
      });
      document.getElementById("teamGroupEditor").classList.add("hidden");
      form.reset();
      delete form.dataset.groupId;
      ctx.toast("Group and its members were saved to the database.", "success");
      await refreshTeamGroups(ctx);
    } catch (err) {
      ctx.toast(err.message || "Could not save this group.", "error");
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = originalLabel;
    }
  };
  document.getElementById("closePhotoViewer").onclick = closePhotoViewer;
  document.getElementById("photoViewerPrev").onclick = () => stepPhoto(-1);
  document.getElementById("photoViewerNext").onclick = () => stepPhoto(1);
  document.getElementById("savedPeopleModal").addEventListener("click", (e) => {
    if (e.target.id === "savedPeopleModal") closeSavedPeople();
  });
  document.getElementById("photoViewer").addEventListener("click", (e) => {
    if (e.target.id === "photoViewer") closePhotoViewer();
  });
  document.addEventListener("keydown", onPhotoViewerKey);
  // Adding a person is intentionally routed through the Registered People directory.
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
  const joinedOrderToggle = document.getElementById("joinedOrderToggle");
  const updateJoinedOrderLabel = () => {
    if (!joinedOrderToggle) return;
    const newest = S.filters.sort !== "oldest";
    joinedOrderToggle.textContent = newest ? "Joined: Newest ↓" : "Joined: Oldest ↑";
    joinedOrderToggle.setAttribute("aria-label", newest ? "Sorted newest joined first; click to show oldest joined first" : "Sorted oldest joined first; click to show newest joined first");
  };
  if (joinedOrderToggle) joinedOrderToggle.onclick = () => {
    S.filters.sort = S.filters.sort === "oldest" ? "newest" : "oldest";
    updateJoinedOrderLabel();
    renderRegister(ctx);
  };
  updateJoinedOrderLabel();

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
  const byNew = (a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")) || collator.compare(a.id || "", b.id || "");
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
      "<th scope='col' class='px-3 py-4 min-w-[110px] align-top'>" + esc(dateLabel(d.date, S.teamSettings)) +
      (manager ? "<br><button data-date-remove='" + esc(d.date) + "' class='text-[10px] text-slate-500 hover:text-red-300 mt-1'>remove</button>" : "") +
      "</th>"
    ).join("") + "</tr>";

  // body
  const shown = S.showAllRows ? people : people.slice(0, ROW_LIMIT);
  tbody.innerHTML = shown.map((p) => personRow(ctx, p, dates, manager)).join("");

  document.querySelectorAll("[data-date-remove]").forEach((x) => {
    x.onclick = () => ctx.handlers.removeDate(x.dataset.dateRemove);
  });
  document.querySelectorAll("[data-person-cell]").forEach((x) => {
    x.onclick = () => ctx.handlers.toggle(x.dataset.personCell, x.dataset.date);
  });
  document.querySelectorAll("[data-photo-view]").forEach((x) => {
    x.onclick = (e) => { e.stopPropagation(); openPhotoViewer(ctx, x.dataset.photoView); };
  });

  // empty states — real data only
  const hasPeople = S.people.length > 0;
  const hasDates = S.dates.length > 0;
  const showEmptyState = (title, text, showAdd) => {
    empty.classList.remove("hidden");
    empty.querySelector("h3").textContent = title;
    empty.querySelector("p").textContent = text;
    const openDirectory = empty.querySelector("#emptyOpenRegisteredPeople");
    if (openDirectory) openDirectory.classList.toggle("hidden", !showAdd);
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
    ? '<button type="button" class="person-photo-open" data-photo-view="' + esc(p.id) + '" aria-label="View full-size photo of ' + esc(p.name) + '"><img class="avatar" loading="lazy" src="' + esc(p.photo_url) + '" alt="' + esc(p.name) + '"></button>'
    : '<div class="avatar grid place-items-center text-violet-300 font-black" aria-hidden="true">' + esc((p.name || "?").charAt(0).toUpperCase()) + "</div>";

  const cells = dates.map((d) => {
    if (!p.active) {
      return "<td class='px-3 py-3'><span class='att empty att-locked' aria-label='" + esc(p.name + " on " + dateLabel(d.date, S.teamSettings) + " — person is inactive") + "'>·</span></td>";
    }
    const s = statusOf(ctx, p.id, d.date);
    const label = !canMark
      ? esc(p.name + " on " + dateLabel(d.date, S.teamSettings) + ": attendance marking is disabled by the team.")
      : esc(p.name + " on " + dateLabel(d.date, S.teamSettings) + ": " + (s === "present" ? "present" : s === "absent" ? "absent" : "not marked") + ". Activate to " + (s === "empty" ? "mark present" : s === "present" ? "mark absent" : "clear") + ".");
    return "<td class='px-3 py-3'><button aria-label='" + label + "' " + (!canMark ? "disabled" : "data-person-cell='" + esc(p.id) + "'") + " data-date='" + esc(d.date) + "' class='att " + s + (!canMark ? " att-locked" : "") + "'>" +
      (s === "present" ? "✓" : s === "absent" ? "✕" : "•") +
    "</button></td>";
  }).join("");

  const inactive = p.active ? "" : " row-inactive";
  return "<tr class='border-t border-white/5" + inactive + "'>" +
    "<td class='sticky left-0 bg-slate-950/95 px-5 py-3'>" +
      "<div class='flex items-center gap-3'>" + photo +
        "<div><span class='font-bold'>" + esc(p.name) + "</span>" +
        (p.active ? "" : " <span class='badge-inactive'>inactive</span>") +
        "<div class='text-[11px] text-slate-500'>" + esc(p.identifier || "") + "</div></div>" +
      "</div>" +
    "</td>" + cells + "</tr>";
}


let currentTeamGroups = [];
let photoViewerContext = null;
let photoViewerPeople = [];
let photoViewerIndex = 0;

function closeAttendanceHistory() {
  document.getElementById("attendanceHistoryModal")?.classList.add("hidden");
  document.body.classList.remove("registered-people-open");
}

let attendanceHistoryCache = [];
let filteredAttendanceHistory = [];
const attendanceHistoryActionLabels = {
  baseline: "Existing record",
  marked: "Marked",
  changed: "Changed",
  cleared: "Cleared from register"
};

function syncHistoryDateControls() {
  const mode = document.getElementById("historyDateMode")?.value || "all";
  const toggle = (id, visible) => document.getElementById(id)?.classList.toggle("hidden", !visible);
  toggle("historyDayWrap", mode === "day");
  toggle("historyMonthWrap", mode === "month");
  toggle("historyYearWrap", mode === "year");
  toggle("historyRangeWrap", mode === "range");
}

function historyDateFilterLabel() {
  const mode = document.getElementById("historyDateMode")?.value || "all";
  if (mode === "day") return document.getElementById("historyDayInput")?.value || "selected day";
  if (mode === "month") return document.getElementById("historyMonthInput")?.value || "selected month";
  if (mode === "year") return document.getElementById("historyYearInput")?.value || "selected year";
  if (mode === "range") {
    const from = document.getElementById("historyRangeStart")?.value || "start";
    const to = document.getElementById("historyRangeEnd")?.value || "end";
    return from + "_to_" + to;
  }
  return "all_dates";
}

function filterAttendanceHistory() {
  const mode = document.getElementById("historyDateMode")?.value || "all";
  const day = document.getElementById("historyDayInput")?.value || "";
  const month = document.getElementById("historyMonthInput")?.value || "";
  const yearText = document.getElementById("historyYearInput")?.value || "";
  const start = document.getElementById("historyRangeStart")?.value || "";
  const end = document.getElementById("historyRangeEnd")?.value || "";
  if (mode === "day" && !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Choose a valid day.");
  if (mode === "month" && !/^\d{4}-\d{2}$/.test(month)) throw new Error("Choose a month.");
  if (mode === "year" && !/^\d{4}$/.test(yearText)) throw new Error("Enter a four-digit year.");
  if (mode === "range") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      throw new Error("Choose both the start and end dates.");
    }
    if (start > end) throw new Error("The start date must be on or before the end date.");
  }
  return attendanceHistoryCache.filter((row) => {
    const date = String(row.attendance_date || "");
    if (mode === "day") return date === day;
    if (mode === "month") return date.startsWith(month);
    if (mode === "year") return date.startsWith(yearText + "-");
    if (mode === "range") return date >= start && date <= end;
    return true;
  });
}

function renderAttendanceHistory(ctx) {
  const body = document.getElementById("attendanceHistoryRows");
  const summary = document.getElementById("attendanceHistorySummary");
  if (!body || !summary) return;
  const rows = filteredAttendanceHistory;
  const total = attendanceHistoryCache.length;
  const filterLabel = historyDateFilterLabel().replaceAll("_", " ");
  summary.textContent = rows.length + " of " + total + " saved record" + (total === 1 ? "" : "s") +
    " match " + filterLabel + ". One row per person per day, sorted newest recorded first.";
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="6" class="history-empty-cell">No saved attendance records match this date filter.</td></tr>';
  } else {
    body.innerHTML = rows.map((row) => {
      const status = row.status === "present" ? "Present" : "Absent";
      const recorded = row.recorded_at && !Number.isNaN(new Date(row.recorded_at).getTime())
        ? new Date(row.recorded_at).toLocaleString()
        : "—";
      const marker = row.marked_by ? String(row.marked_by).slice(0, 8) : "Unknown";
      const statusClass = row.status === "present" ? "history-present" : "history-absent";
      return "<tr>" +
        "<td>" + esc(dateLabel(row.attendance_date, ctx.S.teamSettings)) + "</td>" +
        "<td><strong>" + esc(row.person_name || "Unknown person") + "</strong></td>" +
        "<td><span class=\"history-status " + statusClass + "\">" + status + "</span></td>" +
        "<td>" + esc(attendanceHistoryActionLabels[row.action] || row.action || "Recorded") + (row.action === "cleared" ? " (previous value)" : "") + "</td>" +
        "<td>" + esc(recorded) + "</td>" +
        "<td>" + esc(marker) + "</td></tr>";
    }).join("");
  }
  ["historyExportCsv","historyExportTsv","historyExportJson","historyExportPdf"].forEach((id) => {
    const button = document.getElementById(id);
    if (button) {
      button.disabled = rows.length === 0;
      button.title = rows.length === 0 ? "There are no records to export for these dates." : "";
    }
  });
}

function applyAttendanceHistoryFilter(ctx, showValidationToast = true) {
  try {
    filteredAttendanceHistory = filterAttendanceHistory();
    renderAttendanceHistory(ctx);
    return true;
  } catch (err) {
    if (showValidationToast) ctx.toast(err.message || "Check the selected dates.", "error");
    return false;
  }
}

function downloadHistoryFile(filename, contents, mimeType) {
  const blob = new Blob([contents], { type: mimeType });
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

function historyExportRows() {
  return filteredAttendanceHistory.map((row) => ({
    attendance_date: row.attendance_date || "",
    person_name: row.person_name || "Unknown person",
    status: row.status || "",
    action: attendanceHistoryActionLabels[row.action] || row.action || "Recorded",
    recorded_at: row.recorded_at || "",
    marked_by: row.marked_by || ""
  }));
}

function csvSafeValue(value) {
  let textValue = String(value ?? "");
  if (/^[\t\r ]*[=+\-@]/.test(textValue)) textValue = "'" + textValue;
  return '"' + textValue.replaceAll('"', '""') + '"';
}

function exportAttendanceHistory(ctx, format) {
  const rows = historyExportRows();
  if (!rows.length) {
    ctx.toast("No attendance history records match the selected dates.", "error");
    return;
  }
  const filename = "attendance-history-" + historyDateFilterLabel().replaceAll(/[^a-zA-Z0-9_-]/g, "_");
  try {
    if (format === "csv") {
      const columns = ["attendance_date","person_name","status","action","recorded_at","marked_by"];
      const csv = [columns.map(csvSafeValue).join(","), ...rows.map((row) => columns.map((column) => csvSafeValue(row[column])).join(","))].join("\r\n");
      downloadHistoryFile(filename + ".csv", "\uFEFF" + csv, "text/csv;charset=utf-8");
    } else if (format === "tsv") {
      const columns = ["attendance_date","person_name","status","action","recorded_at","marked_by"];
      const tsvCell = (value) => String(value ?? "").replace(/[\t\r\n]+/g, " ").replace(/^[\t\r ]*[=+\-@]/, "'$&");
      const tsv = [columns.join("\t"), ...rows.map((row) => columns.map((column) => tsvCell(row[column])).join("\t"))].join("\r\n");
      downloadHistoryFile(filename + ".tsv", "\uFEFF" + tsv, "text/tab-separated-values;charset=utf-8");
    } else if (format === "json") {
      downloadHistoryFile(filename + ".json", JSON.stringify({
        exported_at: new Date().toISOString(),
        date_filter: historyDateFilterLabel(),
        record_count: rows.length,
        records: rows
      }, null, 2), "application/json;charset=utf-8");
    }
    ctx.toast("Exported " + rows.length + " history record" + (rows.length === 1 ? "" : "s") + " as " + format.toUpperCase() + ".", "success");
  } catch (err) {
    ctx.toast("Export failed: " + (err.message || "browser download error"), "error");
  }
}

function printAttendanceHistory(ctx) {
  const rows = historyExportRows();
  if (!rows.length) {
    ctx.toast("No attendance history records match the selected dates.", "error");
    return;
  }

  // Print a lightweight standalone document instead of rendering the entire
  // animated dashboard and its overlays in the browser's print preview.
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    ctx.toast("The PDF preview was blocked. Allow pop-ups for AttendanceFlow and try again.", "error");
    return;
  }

  const button = document.getElementById("historyExportPdf");
  const originalLabel = button?.textContent || "↓ PDF";
  if (button) {
    button.disabled = true;
    button.textContent = "Preparing…";
  }

  const title = "AttendanceFlow — Attendance History";
  const filterLabel = historyDateFilterLabel();
  const columns = [
    ["attendance_date", "Attendance date"],
    ["person_name", "Person"],
    ["status", "Status"],
    ["action", "Event"],
    ["recorded_at", "Recorded at"],
    ["marked_by", "Marked by"]
  ];
  const tableHead = columns.map(([, label]) => "<th>" + esc(label) + "</th>").join("");
  const tableRows = rows.map((row) => "<tr>" + columns.map(([key]) => {
    const value = key === "status"
      ? (row[key] === "present" ? "Present" : row[key] === "absent" ? "Absent" : row[key])
      : row[key];
    return "<td>" + esc(value || "—") + "</td>";
  }).join("") + "</tr>").join("");

  try {
    printWindow.document.open();
    printWindow.document.write("<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>" +
      esc(title + " " + filterLabel) + "</title><style>" +
      "@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{font:12px/1.45 Arial,sans-serif;color:#172033;margin:0}" +
      "h1{font-size:22px;margin:0 0 6px}p{margin:0 0 16px;color:#4b5563}.meta{font-size:11px}" +
      "table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #d1d5db;padding:7px;text-align:left;vertical-align:top;overflow-wrap:anywhere}" +
      "th{background:#eef2f7;font-weight:700}tr{break-inside:avoid}thead{display:table-header-group}" +
      ".count{margin:0 0 12px;font-weight:700;color:#111827}@media screen{body{padding:24px;max-width:1400px;margin:auto} .hint{display:block;margin-top:18px;color:#6b7280}}" +
      "@media print{.hint{display:none}}</style></head><body><h1>" + esc(title) +
      "</h1><p class=\"meta\">Date filter: " + esc(filterLabel) + "</p><p class=\"count\">" +
      rows.length + " record" + (rows.length === 1 ? "" : "s") + "</p><table><thead><tr>" +
      tableHead + "</tr></thead><tbody>" + tableRows +
      "</tbody></table><p class=\"hint\">Choose “Save as PDF” in the print destination to save this report.</p></body></html>");
    printWindow.document.close();

    let printStarted = false;
    const startPrint = () => {
      if (printStarted) return;
      printStarted = true;
      try {
        printWindow.focus();
        printWindow.print();
      } catch (err) {
        ctx.toast("Could not open the PDF print preview. Try again or use CSV export.", "error");
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = originalLabel;
        }
      }
    };
    printWindow.onload = () => setTimeout(startPrint, 50);
    // Some browsers fire load before the handler is assigned for about:blank.
    if (printWindow.document.readyState === "complete") setTimeout(startPrint, 50);
    ctx.toast("PDF preview prepared with " + rows.length + " filtered records.", "success");
  } catch (err) {
    printWindow.close();
    if (button) {
      button.disabled = false;
      button.textContent = originalLabel;
    }
    ctx.toast("PDF preview failed: " + (err.message || "browser error"), "error");
  }
}

async function openAttendanceHistory(ctx) {
  const modal = document.getElementById("attendanceHistoryModal");
  const body = document.getElementById("attendanceHistoryRows");
  const summary = document.getElementById("attendanceHistorySummary");
  if (!modal || !body || !summary) return;
  modal.classList.remove("hidden");
  document.body.classList.add("registered-people-open");
  summary.textContent = "Loading saved attendance history…";
  body.innerHTML = "<tr><td colspan=\"6\" class=\"history-empty-cell\">Loading records…</td></tr>";
  try {
    attendanceHistoryCache = await ctx.handlers.loadAttendanceHistory();
    if (!Array.isArray(attendanceHistoryCache)) attendanceHistoryCache = [];
    applyAttendanceHistoryFilter(ctx, false);
  } catch (err) {
    attendanceHistoryCache = [];
    filteredAttendanceHistory = [];
    summary.textContent = "Attendance history could not be loaded.";
    body.innerHTML = "<tr><td colspan=\"6\" class=\"history-empty-cell\">" + esc(err.message || "Database error") + "</td></tr>";
    ["historyExportCsv","historyExportTsv","historyExportJson","historyExportPdf"].forEach((id) => {
      const button = document.getElementById(id);
      if (button) {
        button.disabled = true;
        button.title = "History could not be loaded.";
      }
    });
    ctx.toast("Could not load attendance history.", "error");
  }
}

function closeTeamGroups() {
  document.getElementById("teamGroupsModal")?.classList.add("hidden");
  document.body.classList.remove("registered-people-open");
  document.getElementById("teamGroupEditor")?.classList.add("hidden");
}

async function openTeamGroups(ctx) {
  const modal = document.getElementById("teamGroupsModal");
  if (!modal) return;
  modal.classList.remove("hidden");
  document.body.classList.add("registered-people-open");
  await refreshTeamGroups(ctx);
}

async function refreshTeamGroups(ctx) {
  const host = document.getElementById("teamGroupsList");
  if (!host) return;
  host.innerHTML = '<p class="groups-loading">Loading groups from the team database…</p>';
  try {
    currentTeamGroups = await ctx.handlers.loadGroups();
    if (!currentTeamGroups.length) {
      host.innerHTML = '<div class="team-groups-empty"><div class="empty-icon">▦</div><h3>No groups yet</h3><p>Groups are useful for committees, departments, or working teams.</p>' +
        (ctx.canManage() ? '<button type="button" id="firstTeamGroup" class="liquid primary-cta">+ Create first group</button>' : '') + '</div>';
    } else {
      const peopleById = new Map(ctx.S.people.map((p) => [p.id, p]));
      host.innerHTML = currentTeamGroups.map((group) => {
        const members = (group.person_ids || []).map((id) => peopleById.get(id)).filter(Boolean);
        const memberNames = members.length
          ? members.slice(0, 5).map((p) => '<span class="group-member-chip">' + esc(p.name) + '</span>').join("") +
            (members.length > 5 ? '<span class="group-member-chip group-member-more">+' + (members.length - 5) + ' more</span>' : '')
          : '<span class="group-no-members">No people assigned yet</span>';
        const actions = ctx.canManage()
          ? '<div class="team-group-actions"><button type="button" class="liquid dashboard-action" data-group-edit="' + esc(group.id) + '">Edit group</button><button type="button" class="liquid dashboard-action group-delete-action" data-group-delete="' + esc(group.id) + '">Delete</button></div>'
          : "";
        return '<article class="team-group-card"><div class="team-group-card-top"><div><h3>' + esc(group.name) + '</h3><p>' + esc(group.description || "No description provided.") + '</p></div><span class="team-group-count">' + members.length + ' ' + (members.length === 1 ? 'person' : 'people') + '</span></div><div class="team-group-members">' + memberNames + '</div>' + actions + '</article>';
      }).join("");
    }
    const first = host.querySelector("#firstTeamGroup");
    if (first) first.onclick = () => showTeamGroupEditor(ctx, null);
    host.querySelectorAll("[data-group-edit]").forEach((button) => {
      button.onclick = () => {
        const group = currentTeamGroups.find((item) => item.id === button.dataset.groupEdit);
        if (group) showTeamGroupEditor(ctx, group);
      };
    });
    host.querySelectorAll("[data-group-delete]").forEach((button) => {
      button.onclick = async () => {
        const group = currentTeamGroups.find((item) => item.id === button.dataset.groupDelete);
        if (!group) return;
        const confirmed = await ctx.handlers.confirm({
          title: 'Delete group "' + group.name + '"?',
          message: "This removes the group and its assignments only. People, photos, attendance dates, and attendance history remain saved.",
          confirmLabel: "Delete group",
          danger: true
        });
        if (!confirmed) return;
        try {
          await ctx.handlers.deleteGroup(group.id);
          await refreshTeamGroups(ctx);
        } catch (err) {
          ctx.toast(err.message || "Could not delete this group.", "error");
        }
      };
    });
  } catch (err) {
    host.innerHTML = '<div class="team-groups-empty"><h3>Groups could not be loaded</h3><p>' + esc(err.message || "Database error") + '</p><p>Check that the AttendanceFlow history/groups SQL migration has been run in Supabase.</p></div>';
    ctx.toast("Could not load groups from the database.", "error");
  }
}

function showTeamGroupEditor(ctx, group = null) {
  if (!ctx.canManage()) {
    ctx.toast("Only owners and admins can manage groups.", "error");
    return;
  }
  const editor = document.getElementById("teamGroupEditor");
  const form = document.getElementById("teamGroupForm");
  const memberPicker = document.getElementById("teamGroupMemberPicker");
  if (!editor || !form || !memberPicker) return;
  form.dataset.groupId = group?.id || "";
  document.getElementById("teamGroupEditorTitle").textContent = group ? "Edit group" : "Create a group";
  document.getElementById("teamGroupName").value = group?.name || "";
  document.getElementById("teamGroupDescription").value = group?.description || "";
  const selected = new Set(group?.person_ids || []);
  const people = [...ctx.S.people].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" }));
  memberPicker.innerHTML = people.length ? people.map((person) =>
    '<label class="group-member-option"><input type="checkbox" name="groupPerson" value="' + esc(person.id) + '"' + (selected.has(person.id) ? " checked" : "") + '><span class="group-member-option-name">' + esc(person.name || "Unnamed person") + '<small>' + esc(person.identifier || (person.active ? "No ID" : "Inactive")) + '</small></span>' +
    (!person.active ? '<span class="badge-inactive">inactive</span>' : '') + '</label>'
  ).join("") : '<p class="group-no-members">Add people in Registered People before assigning group members.</p>';
  editor.classList.remove("hidden");
  editor.scrollIntoView({ behavior: "smooth", block: "nearest" });
  document.getElementById("teamGroupName").focus();
}

function openSavedPeople(ctx) {
  const modal = document.getElementById("savedPeopleModal");
  const grid = document.getElementById("savedPeopleGrid");
  if (!modal || !grid) return;
  ctx.refreshRegisteredPeople = () => {
    const directory = document.getElementById("savedPeopleModal");
    if (directory && !directory.classList.contains("hidden")) openSavedPeople(ctx);
  };
  const people = [...ctx.S.people].sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base", numeric: true })
  );
  grid.innerHTML = people.length ? people.map((p, index) => {
    const image = p.photo_url
      ? '<button class="saved-person-photo-button" type="button" data-photo-view="' + esc(p.id) + '" aria-label="Open full-size photo of ' + esc(p.name) + '"><img class="saved-person-photo" loading="lazy" src="' + esc(p.photo_url) + '" alt="' + esc(p.name) + '"></button>'
      : '<div class="saved-person-photo saved-person-no-photo" aria-label="No photo saved"><span>' + esc((p.name || "?").charAt(0).toUpperCase()) + '</span><small>No photo</small></div>';
    const actions = ctx.canManage()
      ? '<div class="saved-person-actions">' +
        '<button type="button" data-directory-edit="' + esc(p.id) + '" class="person-action-edit" aria-label="Edit ' + esc(p.name) + '">Edit</button>' +
        (p.active
          ? '<button type="button" data-directory-deactivate="' + esc(p.id) + '" class="person-action-deactivate" aria-label="Deactivate ' + esc(p.name) + '">Deactivate</button>'
          : '<button type="button" data-directory-restore="' + esc(p.id) + '" class="person-action-restore" aria-label="Restore ' + esc(p.name) + '">Restore</button>') +
        '<button type="button" data-directory-delete="' + esc(p.id) + '" class="person-action-delete" aria-label="Permanently delete ' + esc(p.name) + '">Delete</button>' +
      '</div>'
      : '';
    return '<article class="saved-person-card"><div class="registered-person-number">' + (index + 1) + '.</div>' + image + '<div class="saved-person-name">' + esc(p.name || "Unnamed person") + '</div><div class="registered-person-status ' + (p.active ? 'is-active' : 'is-inactive') + '">' + (p.active ? 'Active' : 'Inactive') + '</div>' + actions + '</article>';
  }).join("") : '<div class="saved-people-empty"><div class="empty-icon">◎</div><h3>No saved people yet</h3><p>Start your team directory by adding the first person.</p>' +
    (ctx.canManage() ? '<button id="registeredEmptyAddPerson" class="liquid primary-cta">+ Add first person</button>' : '') + '</div>';
  const summary = document.getElementById("registeredPeopleSummary");
  if (summary) summary.textContent = people.length + " registered " + (people.length === 1 ? "person" : "people") + " in this team, sorted by name.";
  grid.querySelectorAll("[data-photo-view]").forEach((button) => {
    button.onclick = () => openPhotoViewer(ctx, button.dataset.photoView);
  });
  const addFirstPerson = grid.querySelector("#registeredEmptyAddPerson");
  if (addFirstPerson) addFirstPerson.onclick = () => ctx.handlers.addPerson();

  grid.querySelectorAll("[data-directory-edit]").forEach((button) => {
    button.onclick = () => ctx.handlers.openPerson(button.dataset.directoryEdit);
  });
  grid.querySelectorAll("[data-directory-deactivate]").forEach((button) => {
    button.onclick = async () => {
      await ctx.handlers.deactivatePerson(button.dataset.directoryDeactivate);
      ctx.refreshRegisteredPeople?.();
    };
  });
  grid.querySelectorAll("[data-directory-restore]").forEach((button) => {
    button.onclick = async () => {
      await ctx.handlers.restorePerson(button.dataset.directoryRestore);
      ctx.refreshRegisteredPeople?.();
    };
  });
  grid.querySelectorAll("[data-directory-delete]").forEach((button) => {
    button.onclick = async () => {
      await ctx.handlers.permanentlyDeletePerson(button.dataset.directoryDelete);
      ctx.refreshRegisteredPeople?.();
    };
  });
  modal.classList.remove("hidden");
  document.body.classList.add("registered-people-open");
}
function closeSavedPeople() {
  document.getElementById("savedPeopleModal")?.classList.add("hidden");
  document.body.classList.remove("registered-people-open");
}
function openPhotoViewer(ctx, personId) {
  photoViewerContext = ctx;
  photoViewerPeople = ctx.S.people.filter((p) => p.photo_url);
  photoViewerIndex = photoViewerPeople.findIndex((p) => p.id === personId);
  if (photoViewerIndex < 0) return;
  renderPhotoViewer();
  document.getElementById("photoViewer")?.classList.remove("hidden");
  document.body.classList.add("photo-viewer-open");
}
function renderPhotoViewer() {
  const person = photoViewerPeople[photoViewerIndex];
  if (!person) return;
  const image = document.getElementById("photoViewerImage");
  image.src = person.photo_url;
  image.alt = person.name || "Saved person's photo";
  document.getElementById("photoViewerCaption").textContent = person.name || "Saved person";
  const multiple = photoViewerPeople.length > 1;
  document.getElementById("photoViewerPrev").classList.toggle("hidden", !multiple);
  document.getElementById("photoViewerNext").classList.toggle("hidden", !multiple);
}
function closePhotoViewer() {
  document.getElementById("photoViewer")?.classList.add("hidden");
  const image = document.getElementById("photoViewerImage");
  if (image) image.removeAttribute("src");
  document.body.classList.remove("photo-viewer-open");
  photoViewerContext = null;
  photoViewerPeople = [];
  photoViewerIndex = 0;
}
function stepPhoto(direction) {
  if (!photoViewerPeople.length) return;
  photoViewerIndex = (photoViewerIndex + direction + photoViewerPeople.length) % photoViewerPeople.length;
  renderPhotoViewer();
}
function onPhotoViewerKey(e) {
  const viewer = document.getElementById("photoViewer");
  if (!viewer || viewer.classList.contains("hidden")) return;
  if (e.key === "Escape") closePhotoViewer();
  if (e.key === "ArrowLeft") stepPhoto(-1);
  if (e.key === "ArrowRight") stepPhoto(1);
}

export function updateCell(ctx, personId, date) {
  const btn = document.querySelector("[data-person-cell='" + personId + "'][data-date='" + date + "']");
  if (!btn) return;
  const s = statusOf(ctx, personId, date);
  const p = ctx.S.people.find((x) => x.id === personId);
  btn.className = "att " + s;
  btn.textContent = s === "present" ? "✓" : s === "absent" ? "✕" : "•";
  btn.setAttribute("aria-label", (p?.name || "Person") + " on " + dateLabel(date, ctx.S.teamSettings) + ": " +
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
  const t = today(S.teamSettings?.timezone);
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

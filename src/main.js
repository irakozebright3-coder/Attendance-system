
import "./style.css";
import "./design-system.css";
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const db = url && key ? createClient(url, key) : null;

const S = {
  session: null,
  team: null,
  role: "member",
  people: [],
  dates: [],
  marks: new Map(),
  stream: null,
  channel: null,
  refreshTimer: null
};

const app = document.getElementById("app");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (m) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
}[m]));
const today = () => {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
};
const dateLabel = (d) => new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric"
}).format(new Date(d + "T00:00:00"));
const canManage = () => ["owner", "admin"].includes(S.role);

function logoMarkup(extraClass = "") {
  return '<img src="/attendanceflow-logo.svg" alt="AttendanceFlow" class="brand-logo ' + esc(extraClass) + '">';
}

function authScreen(message = "") {
  app.innerHTML =
    '<div class="home-shell">' +
      '<nav class="home-nav">' +
        '<a class="brand" href="#" aria-label="AttendanceFlow home">' +
          logoMarkup("") +
          '<span>Attendance<span class="brand-accent">Flow</span></span>' +
        '</a>' +
        '<div class="nav-links">' +
          '<a href="#features">Features</a>' +
          '<a href="#workflow">How it works</a>' +
          '<a href="#security">Security</a>' +
        '</div>' +
        '<button id="navLogin" class="liquid nav-cta">Sign in</button>' +
      '</nav>' +
      '<main>' +
        '<section class="hero-section">' +
          '<div class="hero-copy">' +
            '<div class="eyebrow"><span class="pulse-dot"></span> LIVE TEAM ATTENDANCE PLATFORM</div>' +
            '<h1>Attendance that <span class="gradient-text">moves with your team.</span></h1>' +
            '<p class="hero-lead">A serious, shared attendance workspace for large teams. Track people, dates, presence, photos and real-time updates from one beautiful dashboard.</p>' +
            '<div class="hero-actions">' +
              '<button id="heroStart" class="liquid primary-cta">Create your workspace <span>↗</span></button>' +
              '<button id="heroDemo" class="ghost-cta">See how it works <span>↓</span></button>' +
            '</div>' +
            '<div class="trust-row">' +
              '<span><b>REAL BACKEND</b> Supabase PostgreSQL</span>' +
              '<span><b>REALTIME</b> Live team updates</span>' +
              '<span><b>CAMERA</b> Optional photos</span>' +
            '</div>' +
          '</div>' +
          '<div class="hero-stage" aria-hidden="true">' +
            '<div class="orbital-ring ring-one"></div>' +
            '<div class="orbital-ring ring-two"></div>' +
            '<div class="hero-orb">' +
              '<div class="orb-face orb-front">' +
                '<span class="mini-label">LIVE MODE</span><strong>SYNC</strong><small>Team database</small>' +
                '<div class="orb-bars"><i></i><i></i><i></i><i></i></div>' +
              '</div>' +
              '<div class="orb-face orb-back"><span>LIVE</span><strong>✓</strong><small>Attendance stream</small></div>' +
            '</div>' +
            '<div class="float-card card-top"><span class="status-live"></span><b>Backend online</b><small>PostgreSQL + Auth</small></div>' +
            '<div class="float-card card-bottom"><div class="tiny-avatar">T</div><div><b>Team member</b><small>Attendance · synced</small></div><span class="check">✓</span></div>' +
          '</div>' +
        '</section>' +
        '<section class="ticker" aria-label="Platform capabilities"><div class="ticker-track">' +
          '<span>PEOPLE</span><i>✦</i><span>DATES</span><i>✦</i><span>PRESENCE</span><i>✦</i><span>CAMERA</span><i>✦</i><span>REALTIME</span><i>✦</i><span>SECURITY</span><i>✦</i>' +
          '<span>PEOPLE</span><i>✦</i><span>DATES</span><i>✦</i><span>PRESENCE</span><i>✦</i><span>CAMERA</span><i>✦</i><span>REALTIME</span><i>✦</i><span>SECURITY</span><i>✦</i>' +
        '</div></section>' +
        '<section id="features" class="feature-section">' +
          '<div class="section-heading"><span class="eyebrow">BUILT FOR REAL TEAMS</span><h2>Everything your register needs.<br><span class="muted-gradient">Nothing fake behind it.</span></h2></div>' +
          '<div class="feature-grid">' +
            '<article class="feature-card feature-large"><div class="feature-icon">◎</div><h3>One live register</h3><p>People and dates stay in one shared workspace. Mark present, absent, or clear with a single click.</p>' +
              '<div class="mock-register"><div><span class="mock-avatar">A</span><b>Team member</b><em>Today</em><strong>✓</strong></div><div><span class="mock-avatar">J</span><b>Another member</b><em>Today</em><strong class="red">×</strong></div><div><span class="mock-avatar">M</span><b>New member</b><em>Today</em><strong>✓</strong></div></div>' +
            '</article>' +
            '<article class="feature-card"><div class="feature-icon cyan">⌁</div><h3>Real-time sync</h3><p>Connected team screens refresh when people, dates or attendance records change.</p><div class="signal"><span></span><span></span><span></span><span></span><span></span></div></article>' +
            '<article class="feature-card"><div class="feature-icon violet">◉</div><h3>Photo + camera</h3><p>Photos are optional. Upload from a device or capture one directly through the browser camera.</p><div class="camera-preview"><span>CAMERA READY</span><div class="scan-line"></div></div></article>' +
            '<article id="security" class="feature-card"><div class="feature-icon green">✓</div><h3>Database-first</h3><p>Authentication, team isolation, PostgreSQL, storage rules and row-level security protect the real data.</p><div class="security-chip">AUTH · RLS · POSTGRES · STORAGE</div></article>' +
          '</div>' +
        '</section>' +
        '<section id="workflow" class="workflow-section"><div class="workflow-copy"><span class="eyebrow">SIMPLE FLOW. SERIOUS SYSTEM.</span><h2>From first login to a live register.</h2><p>Create a team, add people, add dates, then mark attendance. The data belongs to your real workspace—not just this browser.</p></div>' +
          '<div class="steps"><div class="step"><b>01</b><span>CREATE</span><p>Create your secure team workspace.</p></div><div class="step"><b>02</b><span>BUILD</span><p>Add people and optional photos.</p></div><div class="step"><b>03</b><span>TRACK</span><p>Add dates and mark presence.</p></div><div class="step"><b>04</b><span>SYNC</span><p>Keep your team updated in real time.</p></div></div>' +
        '</section>' +
        '<section class="final-cta"><div><span class="eyebrow">READY WHEN YOU ARE</span><h2>Make attendance feel<br><span class="gradient-text">effortless.</span></h2></div><button id="finalStart" class="liquid primary-cta">Open AttendanceFlow <span>↗</span></button></section>' +
      '</main>' +
      '<footer><span>© 2026 AttendanceFlow</span><span>Secure team attendance · Built for the web</span></footer>' +
    '</div>' +
    '<div id="authModal" class="auth-modal hidden"><div class="auth-panel">' +
      '<button id="closeAuth" class="close-auth" aria-label="Close">×</button>' +
      logoMarkup("auth-logo") +
      '<h2>Enter your workspace</h2>' +
      '<p>Sign in or create the team account that powers your real attendance database.</p>' +
      '<form id="authForm">' +
        '<label>Email<input id="authEmail" type="email" required autocomplete="email" placeholder="you@company.com"></label>' +
        '<label>Password<input id="authPassword" type="password" minlength="8" required autocomplete="current-password" placeholder="Minimum 8 characters"></label>' +
        '<label id="teamWrap">Team name<input id="team" autocomplete="organization" placeholder="Your team or organization"></label>' +
        '<div class="auth-buttons"><button id="login" type="button" class="liquid primary-cta">Sign in</button><button id="signup" type="button" class="liquid secondary-cta">Create account</button></div>' +
      '</form>' +
      '<p id="msg" class="auth-message">' + esc(message || "Your workspace is backed by Supabase PostgreSQL.") + '</p>' +
    '</div></div>';

  document.getElementById("navLogin").onclick = () => openAuth(false);
  document.getElementById("heroStart").onclick = () => openAuth(true);
  document.getElementById("heroDemo").onclick = () => document.getElementById("workflow").scrollIntoView({ behavior: "smooth" });
  document.getElementById("finalStart").onclick = () => openAuth(true);
  bindParallax();
  document.getElementById("closeAuth").onclick = closeAuth;
  document.getElementById("authModal").addEventListener("click", (e) => {
    if (e.target.id === "authModal") closeAuth();
  });
  document.getElementById("login").onclick = () => doAuth(false);
  document.getElementById("signup").onclick = () => doAuth(true);

  function openAuth(showCreate = true) {
    const modal = document.getElementById("authModal");
    modal.classList.remove("hidden");
    document.getElementById("teamWrap").classList.toggle("hidden", !showCreate);
    document.getElementById("signup").classList.toggle("hidden", !showCreate);
    document.getElementById("authPassword").autocomplete = showCreate ? "new-password" : "current-password";
    document.getElementById("authEmail").focus();
  }

  function closeAuth() {
    document.getElementById("authModal").classList.add("hidden");
  }
}

function setMessage(message, good = false) {
  const el = document.getElementById("msg");
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("success", good);
}

function toast(message, type = "info") {
  let host = document.getElementById("toastHost");
  if (!host) {
    host = document.createElement("div");
    host.id = "toastHost";
    host.className = "toast-host";
    document.body.appendChild(host);
  }
  const item = document.createElement("div");
  item.className = "toast " + type;
  item.textContent = message;
  host.appendChild(item);
  setTimeout(() => item.remove(), 3600);
}

async function doAuth(newUser) {
  if (!db) {
    setMessage("Supabase environment variables are missing.");
    return;
  }
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  const team = document.getElementById("team").value.trim() || "My Team";
  setMessage("Working…");
  let r;
  if (newUser) {
    r = await db.auth.signUp({
      email,
      password,
      options: { data: { team_name: team } }
    });
  } else {
    r = await db.auth.signInWithPassword({ email, password });
  }
  if (r.error) {
    setMessage(r.error.message);
    return;
  }
  if (newUser && !r.data.session) {
    setMessage("Account created. Confirm your email if required, then sign in.", true);
    return;
  }
  setMessage(newUser ? "Account created. Opening workspace…" : "Signed in. Opening workspace…", true);
}

function dashboard() {
  const managementControls = canManage();
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
            '<button id="reload" class="liquid dashboard-action">↻ Refresh</button>' +
            '<button id="logout" class="liquid dashboard-action logout-action">Sign out</button>' +
          '</div>' +
        '</header>' +

        '<section class="dashboard-hero">' +
          '<div class="dashboard-hero-copy">' +
            '<div class="eyebrow"><span class="pulse-dot"></span> LIVE WORKSPACE</div>' +
            '<h1>Know who is <span class="gradient-text">here.</span></h1>' +
            '<p>Your attendance register is connected to the real AttendanceFlow backend. Every person, date, photo and attendance change is stored for your team.</p>' +
            '<div class="dashboard-hero-meta"><span>POSTGRESQL</span><span>REALTIME</span><span>SECURE STORAGE</span></div>' +
          '</div>' +
          '<div class="dashboard-actions">' +
            '<button id="newDate" class="liquid primary-cta dashboard-main-cta"><span class="cta-plus">+</span> Add attendance date <span>↗</span></button>' +
            '<button id="newPerson" class="liquid secondary-cta dashboard-main-cta"><span class="cta-plus">+</span> Add person</button>' +
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
            '<div class="register-live"><i></i><span>Live database</span></div>' +
          '</div>' +
          '<div class="register-stage"><div class="register-glow"></div><div class="overflow-x-auto register-scroll"><table class="w-full text-sm"><thead id="thead"></thead><tbody id="tbody"></tbody></table></div><div id="empty" class="hidden empty-register"><div class="empty-icon">＋</div><h3>No people yet</h3><p>Add your first person to start the shared register.</p><button id="emptyAddPerson" class="liquid primary-cta">Add first person ↗</button></div></div>' +
        '</section>' +
      '</div>' +
    '</main>' +
    '<div id="modal" class="modal hidden"></div>' +
    '<div id="dateModal" class="modal hidden"></div>';

  document.getElementById("emailLabel").textContent = S.session?.user?.email || "";
  document.getElementById("roleLabel").textContent = S.role.toUpperCase();
  document.getElementById("teamLabel").textContent = S.team?.name || "Team attendance workspace";

  document.getElementById("logout").onclick = async () => {
    await db.auth.signOut();
  };
  document.getElementById("reload").onclick = () => load(true);
  document.getElementById("newDate").onclick = addDate;
  document.getElementById("newPerson").onclick = personModal;
  document.getElementById("emptyAddPerson").onclick = personModal;
  document.querySelector(".dashboard-brand-link").onclick = (e) => e.preventDefault();

  bindParallax();

  if (!managementControls) {
    const dateButton = document.getElementById("newDate");
    dateButton.classList.add("member-date-action");
  }
}


async function teamSetup() {
  const q = await db
    .from("team_members")
    .select("team_id,role,teams(id,name)")
    .eq("user_id", S.session.user.id)
    .limit(1)
    .maybeSingle();

  if (q.error) throw q.error;

  if (q.data) {
    S.team = q.data.teams;
    S.role = q.data.role || "member";
    return;
  }

  const name = S.session.user.user_metadata?.team_name || "My Team";
  const created = await db.rpc("create_team", { p_name: name });
  if (created.error) throw created.error;

  S.team = created.data;
  S.role = "owner";
}

async function load(showToast = false) {
  if (!S.team) return;
  const [peopleRes, datesRes, attendanceRes] = await Promise.all([
    db.from("people").select("*").eq("team_id", S.team.id).eq("active", true).order("name"),
    db.from("attendance_dates").select("*").eq("team_id", S.team.id).order("date"),
    db.from("attendance").select("*").eq("team_id", S.team.id)
  ]);

  const error = peopleRes.error || datesRes.error || attendanceRes.error;
  if (error) {
    setBackendStatus("Backend error");
    toast(error.message, "error");
    throw error;
  }

  S.people = peopleRes.data || [];
  S.dates = datesRes.data || [];
  S.marks = new Map((attendanceRes.data || []).map((x) => [x.person_id + "|" + x.date, x.status]));

  const photoPaths = S.people.filter((p) => p.photo_path).map((p) => p.photo_path);
  if (photoPaths.length) {
    const signed = await db.storage.from("avatars").createSignedUrls(photoPaths, 3600);
    if (!signed.error) {
      const lookup = new Map((signed.data || []).map((x) => [x.path, x.signedUrl]));
      S.people = S.people.map((p) => ({ ...p, photo_url: p.photo_path ? (lookup.get(p.photo_path) || null) : null }));
    }
  }

  render();
  setBackendStatus("Backend connected");
  if (showToast) toast("Data refreshed from the database.", "success");
}

function setBackendStatus(text) {
  const el = document.getElementById("backendStatus");
  if (el) el.textContent = text;
  const dot = document.querySelector(".backend-status i");
  if (dot) dot.classList.toggle("offline", text.toLowerCase().includes("error"));
}

function render() {
  const h = document.getElementById("thead");
  const b = document.getElementById("tbody");
  if (!h || !b) return;

  const manager = canManage();
  h.innerHTML =
    "<tr><th class='sticky left-0 bg-slate-950/95 text-left px-5 py-4 min-w-[260px]'>Person</th>" +
    S.dates.map((d) =>
      "<th class='px-3 py-4 min-w-[120px]'>" + esc(dateLabel(d.date)) +
      (manager ? "<br><button data-date-remove='" + esc(d.date) + "' class='text-[10px] text-slate-500 hover:text-red-300 mt-1'>remove</button>" : "") +
      "</th>"
    ).join("") + "</tr>";

  b.innerHTML = S.people.map((p) => {
    const photo = p.photo_url
      ? '<img class="avatar" src="' + esc(p.photo_url) + '" alt="' + esc(p.name) + '">'
      : '<div class="avatar grid place-items-center text-violet-300 font-black">' + esc(p.name.charAt(0).toUpperCase()) + "</div>";
    const removeButton = manager
      ? '<button data-person-remove="' + esc(p.id) + '" class="ml-auto text-slate-600 hover:text-red-300" title="Remove person">×</button>'
      : "";
    return "<tr class='border-t border-white/5'>" +
      "<td class='sticky left-0 bg-slate-950/95 px-5 py-3'><div class='flex items-center gap-3'>" +
        photo +
        "<div><b>" + esc(p.name) + "</b><div class='text-[11px] text-slate-500'>" + esc(p.identifier || "") + "</div></div>" +
        removeButton +
      "</div></td>" +
      S.dates.map((d) => {
        const s = S.marks.get(p.id + "|" + d.date) || "empty";
        return "<td class='px-3 py-3'><button aria-label='" + esc(p.name + " on " + dateLabel(d.date) + " is " + s) + "' data-person='" + esc(p.id) + "' data-date='" + esc(d.date) + "' class='att " + s + "'>" +
          (s === "present" ? "✓" : s === "absent" ? "✕" : "•") +
        "</button></td>";
      }).join("") +
      "</tr>";
  }).join("");

  document.getElementById("empty").classList.toggle("hidden", S.people.length > 0);

  document.querySelectorAll("[data-person]").forEach((x) => {
    x.onclick = () => toggle(x.dataset.person, x.dataset.date);
  });
  document.querySelectorAll("[data-person-remove]").forEach((x) => {
    x.onclick = () => removePerson(x.dataset.personRemove);
  });
  document.querySelectorAll("[data-date-remove]").forEach((x) => {
    x.onclick = () => removeDate(x.dataset.dateRemove);
  });

  stats();
}

function stats() {
  const v = S.people.map((p) => S.marks.get(p.id + "|" + today())).filter(Boolean);
  const present = v.filter((x) => x === "present").length;
  const absent = v.filter((x) => x === "absent").length;
  const total = present + absent;

  document.getElementById("peopleCount").textContent = S.people.length;
  document.getElementById("presentCount").textContent = present;
  document.getElementById("absentCount").textContent = absent;
  document.getElementById("rate").textContent = total ? Math.round((present / total) * 100) + "%" : "0%";
}

async function toggle(pid, date) {
  const k = pid + "|" + date;
  const old = S.marks.get(k) || "empty";
  const next = old === "empty" ? "present" : old === "present" ? "absent" : "empty";

  if (next === "empty") {
    const r = await db.from("attendance").delete()
      .eq("team_id", S.team.id)
      .eq("person_id", pid)
      .eq("date", date);
    if (r.error) {
      toast(r.error.message, "error");
      return;
    }
    S.marks.delete(k);
  } else {
    const r = await db.from("attendance").upsert({
      team_id: S.team.id,
      person_id: pid,
      date,
      status: next,
      marked_by: S.session.user.id
    }, { onConflict: "team_id,person_id,date" });
    if (r.error) {
      toast(r.error.message, "error");
      return;
    }
    S.marks.set(k, next);
  }

  render();
}

function addDate() {
  const modal = document.getElementById("dateModal");
  modal.classList.remove("hidden");
  modal.innerHTML =
    '<div class="glass rounded-3xl w-full max-w-md p-6 date-dialog">' +
      '<div class="flex justify-between items-start"><div><h2 class="text-xl font-black">Add attendance date</h2><p class="text-xs text-slate-500 mt-1">The date is saved to your team database.</p></div><button id="closeDate" class="text-2xl">×</button></div>' +
      '<label class="dialog-label mt-5">Date<input id="dateValue" type="date" value="' + today() + '" class="dialog-input"></label>' +
      '<div class="flex gap-2 mt-5"><button id="cancelDate" class="liquid rounded-xl bg-white/5 px-4 py-3 font-bold">Cancel</button><button id="saveDate" class="liquid rounded-xl bg-violet-600 px-4 py-3 font-bold ml-auto">Save date</button></div>' +
    '</div>';

  const close = () => modal.classList.add("hidden");
  document.getElementById("closeDate").onclick = close;
  document.getElementById("cancelDate").onclick = close;
  document.getElementById("saveDate").onclick = async () => {
    const d = document.getElementById("dateValue").value;
    if (!d) return;
    const r = await db.from("attendance_dates").insert({ team_id: S.team.id, date: d });
    if (r.error) {
      toast(r.error.message, "error");
      return;
    }
    close();
    await load();
    toast("Date added to the shared register.", "success");
  };
}

function personModal() {
  const m = document.getElementById("modal");
  m.classList.remove("hidden");
  m.innerHTML =
    '<div class="glass rounded-3xl w-full max-w-lg p-6">' +
      '<div class="flex justify-between"><div><h2 class="text-xl font-black">Add person</h2><p class="text-xs text-slate-500">Photo is optional.</p></div><button id="closeModal" class="text-2xl">×</button></div>' +
      '<form id="personForm" class="space-y-4 mt-5">' +
        '<input id="personName" required placeholder="Full name" class="w-full rounded-xl bg-slate-950/70 border border-white/10 px-4 py-3">' +
        '<input id="personId" maxlength="80" placeholder="ID / employee number (optional)" class="w-full rounded-xl bg-slate-950/70 border border-white/10 px-4 py-3">' +
        '<div class="rounded-2xl border border-dashed border-white/10 p-4"><b>Photo</b> <span class="text-xs text-slate-500">(optional)</span>' +
          '<div class="flex gap-2 mt-3 flex-wrap"><button type="button" id="upload" class="liquid rounded-xl bg-white/5 px-4 py-2">Upload from device</button><button type="button" id="camera" class="liquid rounded-xl bg-violet-600 px-4 py-2">Take with camera</button></div>' +
          '<input id="file" type="file" accept="image/*" class="hidden">' +
          '<div id="cameraBox" class="hidden mt-3"><video id="video" autoplay playsinline class="w-full rounded-xl bg-black"></video><button type="button" id="capture" class="w-full mt-2 rounded-xl bg-cyan-600 py-2 font-bold">Capture photo</button></div>' +
          '<canvas id="canvas" class="hidden"></canvas><img id="preview" alt="Photo preview" class="hidden mt-3 w-24 h-24 rounded-2xl object-cover">' +
        '</div>' +
        '<button id="savePerson" class="liquid w-full rounded-xl bg-violet-600 py-3 font-bold">Save person</button>' +
      '</form>' +
    '</div>';

  let photo = null;
  document.getElementById("closeModal").onclick = closeModal;
  document.getElementById("upload").onclick = () => document.getElementById("file").click();
  document.getElementById("file").onchange = (e) => {
    photo = e.target.files?.[0] || null;
    showPreview(photo);
  };
  document.getElementById("camera").onclick = startCamera;
  document.getElementById("capture").onclick = () => {
    const v = document.getElementById("video");
    const c = document.getElementById("canvas");
    c.width = v.videoWidth || 640;
    c.height = v.videoHeight || 480;
    c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
    c.toBlob((blob) => {
      photo = blob;
      showPreview(blob);
      stopCamera();
    }, "image/jpeg", 0.86);
  };

  document.getElementById("personForm").onsubmit = async (e) => {
    e.preventDefault();
    const save = document.getElementById("savePerson");
    save.disabled = true;
    save.textContent = "Saving…";

    const name = document.getElementById("personName").value.trim();
    const identifier = document.getElementById("personId").value.trim();
    let photoPath = null;

    if (photo) {
      const allowed = ["image/jpeg", "image/png", "image/webp"];
      if (photo.type && !allowed.includes(photo.type)) {
        toast("Use JPG, PNG or WebP for the photo.", "error");
        save.disabled = false;
        save.textContent = "Save person";
        return;
      }

      const ext = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
      photoPath = S.team.id + "/" + crypto.randomUUID() + "." + ext;
      const up = await db.storage.from("avatars").upload(photoPath, photo, {
        contentType: photo.type || "image/jpeg",
        upsert: false
      });

      if (up.error) {
        toast(up.error.message, "error");
        save.disabled = false;
        save.textContent = "Save person";
        return;
      }
    }

    const r = await db.from("people").insert({
      team_id: S.team.id,
      name,
      identifier: identifier || null,
      photo_url: null,
      photo_path: photoPath
    });

    if (r.error) {
      if (photoPath) await db.storage.from("avatars").remove([photoPath]);
      toast(r.error.message, "error");
      save.disabled = false;
      save.textContent = "Save person";
      return;
    }

    closeModal();
    await load();
    toast("Person saved to the shared database.", "success");
  };
}

function showPreview(blob) {
  const img = document.getElementById("preview");
  if (!img || !blob) return;
  if (img.dataset.objectUrl) URL.revokeObjectURL(img.dataset.objectUrl);
  const objectUrl = URL.createObjectURL(blob);
  img.dataset.objectUrl = objectUrl;
  img.src = objectUrl;
  img.classList.remove("hidden");
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    toast("Camera access requires HTTPS or localhost.", "error");
    return;
  }
  try {
    stopCamera();
    S.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    document.getElementById("cameraBox").classList.remove("hidden");
    document.getElementById("video").srcObject = S.stream;
  } catch {
    toast("Camera permission was denied or no camera is available.", "error");
  }
}

function stopCamera() {
  if (S.stream) {
    S.stream.getTracks().forEach((t) => t.stop());
    S.stream = null;
  }
}

function closeModal() {
  stopCamera();
  const img = document.getElementById("preview");
  if (img?.dataset.objectUrl) URL.revokeObjectURL(img.dataset.objectUrl);
  document.getElementById("modal")?.classList.add("hidden");
}

async function removePerson(id) {
  if (!canManage()) {
    toast("Only an owner or admin can remove people.", "error");
    return;
  }
  if (!confirm("Remove this person from the active register? Their attendance history will remain stored.")) return;
  const r = await db.from("people")
    .update({ active: false })
    .eq("id", id)
    .eq("team_id", S.team.id);
  if (r.error) toast(r.error.message, "error");
  else {
    await load();
    toast("Person removed from the active register.", "success");
  }
}

async function removeDate(date) {
  if (!canManage()) {
    toast("Only an owner or admin can remove dates.", "error");
    return;
  }
  if (!confirm("Remove this date and all attendance marks recorded for it?")) return;
  const r = await db.from("attendance_dates")
    .delete()
    .eq("team_id", S.team.id)
    .eq("date", date);
  if (r.error) toast(r.error.message, "error");
  else {
    await load();
    toast("Date and its attendance marks were removed.", "success");
  }
}

function scheduleRealtimeReload() {
  clearTimeout(S.refreshTimer);
  S.refreshTimer = setTimeout(() => load().catch(() => {}), 250);
}

function stopRealtime() {
  if (S.channel) {
    db.removeChannel(S.channel);
    S.channel = null;
  }
}

function realtime() {
  stopRealtime();
  S.channel = db.channel("team-" + S.team.id);
  ["people", "attendance_dates", "attendance"].forEach((table) => {
    S.channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table, filter: "team_id=eq." + S.team.id },
      scheduleRealtimeReload
    );
  });
  S.channel.subscribe((status) => {
    if (status === "SUBSCRIBED") setBackendStatus("Backend connected · realtime");
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setBackendStatus("Realtime reconnecting…");
  });
}

function visual() {
  const c = document.getElementById("ambientCanvas");
  if (!c) return;
  const x = c.getContext("2d");
  let p = [];
  function resize() {
    const ratio = Math.min(devicePixelRatio || 1, 2);
    c.width = innerWidth * ratio;
    c.height = innerHeight * ratio;
    c.style.width = innerWidth + "px";
    c.style.height = innerHeight + "px";
    x.setTransform(ratio, 0, 0, ratio, 0, 0);
    p = Array.from({ length: 45 }, () => ({
      x: Math.random() * innerWidth,
      y: Math.random() * innerHeight,
      r: Math.random() * 1.5 + 0.3,
      v: (Math.random() - 0.5) * 0.2
    }));
  }
  function draw() {
    x.clearRect(0, 0, innerWidth, innerHeight);
    p.forEach((q) => {
      q.y += q.v;
      if (q.y < 0) q.y = innerHeight;
      if (q.y > innerHeight) q.y = 0;
      x.beginPath();
      x.arc(q.x, q.y, q.r, 0, Math.PI * 2);
      x.fillStyle = "rgba(167,139,250,.35)";
      x.fill();
    });
    requestAnimationFrame(draw);
  }
  resize();
  addEventListener("resize", resize);
  draw();
}

function cursor() {
  const o = document.getElementById("cursorOuter");
  const d = document.getElementById("cursorDot");
  if (!o || !d || matchMedia("(pointer:coarse)").matches) return;

  let tx = innerWidth / 2;
  let ty = innerHeight / 2;
  let x = tx;
  let y = ty;

  addEventListener("mousemove", (e) => {
    tx = e.clientX;
    ty = e.clientY;
  });

  function draw() {
    x += (tx - x) * 0.18;
    y += (ty - y) * 0.18;
    o.style.left = x + "px";
    o.style.top = y + "px";
    d.style.left = tx + "px";
    d.style.top = ty + "px";
    requestAnimationFrame(draw);
  }
  draw();

  document.addEventListener("mouseover", (e) => {
    const target = e.target.closest("a,button,.feature-card,.step,.float-card,.brand");
    if (target) {
      o.classList.add("cursor-hover");
      d.classList.add("cursor-hover-dot");
    }
  });
  document.addEventListener("mouseout", (e) => {
    const target = e.target.closest("a,button,.feature-card,.step,.float-card,.brand");
    if (target && !target.contains(e.relatedTarget)) {
      o.classList.remove("cursor-hover");
      d.classList.remove("cursor-hover-dot");
    }
  });
}


function bindParallax() {
  if (matchMedia("(pointer:coarse)").matches || matchMedia("(prefers-reduced-motion:reduce)").matches) return;
  const targets = document.querySelectorAll(".feature-card,.step,.final-cta,.float-card");
  targets.forEach((el) => {
    if (el.dataset.parallaxBound === "1") return;
    el.dataset.parallaxBound = "1";
    el.classList.add("af-tilt");

    const reset = () => {
      el.style.setProperty("--tilt-x", "0deg");
      el.style.setProperty("--tilt-y", "0deg");
      el.style.setProperty("--mx", "50%");
      el.style.setProperty("--my", "50%");
    };

    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      const rotateY = (px - 0.5) * 7;
      const rotateX = (0.5 - py) * 7;
      el.style.setProperty("--tilt-x", rotateX.toFixed(2) + "deg");
      el.style.setProperty("--tilt-y", rotateY.toFixed(2) + "deg");
      el.style.setProperty("--mx", Math.round(px * 100) + "%");
      el.style.setProperty("--my", Math.round(py * 100) + "%");
    });
    el.addEventListener("pointerleave", reset);
    reset();
  });
}

async function start() {
  visual();
  cursor();
  bindParallax();

  if (!db) {
    authScreen("Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel.");
    return;
  }

  const s = await db.auth.getSession();
  S.session = s.data.session;

  db.auth.onAuthStateChange((_event, session) => {
    S.session = session;
    setTimeout(() => {
      if (session) loadApp().catch((e) => {
        console.error(e);
        authScreen("Unable to open your workspace. Check the Supabase database setup.");
      });
      else {
        stopRealtime();
        authScreen();
      }
    }, 0);
  });

  if (S.session) {
    await loadApp();
  } else {
    authScreen();
  }
}

async function loadApp() {
  await teamSetup();
  if (!S.team) throw new Error("No team workspace is available.");
  dashboard();
  await load();
  realtime();
}

start().catch((e) => {
  console.error(e);
  authScreen(e.message || "Something went wrong.");
});

import "./style.css";
import "./design-system.css";
import { db, hasBackend } from "./lib/supabase.js";
import * as api from "./lib/api.js";
import { friendlyError, debounce } from "./lib/util.js";
import { authScreen, setMessage, workspaceSetupScreen, bindParallax } from "./views/landing.js";
import {
  dashboard, renderRegister, updateCell, cellPending, setBackendStatus
} from "./views/dashboard.js";
import {
  personModal, dateModal, confirmDialog, showInviteDialog, reportsModal, auditModal, closeModal
} from "./views/modals.js";

const REDUCED_MOTION = matchMedia("(prefers-reduced-motion: reduce)").matches;

const S = {
  session: null,
  team: null,
  role: "member",
  people: [],
  dates: [],
  marks: new Map(),
  channel: null,
  refreshTimer: null,
  currentUserId: null,
  loading: false,
  filters: { search: "", active: "active", status: "any", sort: "name-asc" },
  showAllRows: false,
  showAllDates: false
};

const canManage = () => ["owner", "admin"].includes(S.role);

const toast = (message, type = "info") => {
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
  item.setAttribute("role", "status");
  host.appendChild(item);
  setTimeout(() => item.remove(), 4200);
};

const ctx = {
  S,
  canManage,
  toast,
  refresh: () => load(false),
  debouncedSearch: (input) => debounce(() => {
    S.filters.search = input.value;
    S.showAllRows = false;
    renderRegister(ctx);
  }, 250),
  handlers: {
    signOut: async () => {
      try {
        await api.signOut();
      } catch (err) {
        toast(err.message, "error");
      }
      // onAuthChange renders the landing page
    },
    refresh: () => load(true),
    addDate: () => { if (canManage()) dateModal(ctx); else toast("Only owners and admins can manage dates.", "error"); },
    addPerson: () => { if (canManage()) personModal(ctx, null); else toast("Only owners and admins can add people.", "error"); },
    openPerson: (id) => personModal(ctx, S.people.find((p) => p.id === id) || null),
    showInvite: () => showInviteDialog(S.team),
    openReports: () => reportsModal(ctx),
    openAudit: () => auditModal(ctx),
    toggle: (pid, date) => toggle(pid, date),
    removeDate: async (date) => {
      if (!canManage()) { toast("Only owners and admins can remove dates.", "error"); return; }
      const ok = await confirmDialog({
        title: "Remove this date?",
        message: "The date and all attendance marks recorded for it will be deleted from the database. This cannot be undone.",
        confirmLabel: "Remove date", danger: true
      });
      if (!ok) return;
      try {
        await api.deleteDate(S.team.id, date);
        await load(false);
        toast("Date and its attendance marks were removed.", "success");
      } catch (err) {
        toast(err.message, "error");
      }
    },
    deactivatePerson: async (id) => {
      if (!canManage()) { toast("Only owners and admins can deactivate people.", "error"); return; }
      const p = S.people.find((x) => x.id === id);
      const ok = await confirmDialog({
        title: "Deactivate " + (p?.name || "this person") + "?",
        message: "They disappear from the active register, but their attendance history stays stored in the database. You can restore them later from the “Inactive only” filter.",
        confirmLabel: "Deactivate", danger: true
      });
      if (!ok) return;
      try {
        await api.deactivatePerson(id, S.team.id);
        await load(false);
        toast("Person deactivated. Their history is preserved.", "success");
      } catch (err) {
        toast(err.message, "error");
      }
    },
    restorePerson: async (id) => {
      try {
        await api.restorePerson(id, S.team.id);
        await load(false);
        toast("Person restored to the active register.", "success");
      } catch (err) {
        toast(err.message, "error");
      }
    }
  }
};

// ---------------- data loading ----------------

async function load(showToast = false) {
  if (!S.team || S.loading) return;
  S.loading = true;
  try {
    const data = await api.loadTeamData(S.team.id);
    S.people = await api.attachPhotoUrls(data.people);
    S.dates = data.dates;
    S.marks = new Map(data.attendance.map((x) => [x.person_id + "|" + x.date, x.status]));
    renderRegister(ctx);
    setBackendStatus("Backend connected" + (S.channel ? " · realtime" : ""));
    if (showToast) toast("Data refreshed from the database.", "success");
  } catch (err) {
    setBackendStatus("Backend error");
    toast(friendlyError(err), "error");
  } finally {
    S.loading = false;
  }
}

async function toggle(pid, date) {
  const key = pid + "|" + date;
  const current = S.marks.get(key) || "empty";
  const next = current === "empty" ? "present" : current === "present" ? "absent" : "empty";
  const person = S.people.find((p) => p.id === pid);
  if (!person || !person.active) return;

  cellPending(ctx, pid, date, true);
  try {
    if (next === "empty") {
      await api.clearAttendance(S.team.id, pid, date);
      S.marks.delete(key);
    } else {
      await api.markAttendance(S.team.id, pid, date, next, S.session.user.id);
      S.marks.set(key, next);
    }
    updateCell(ctx, pid, date);
  } catch (err) {
    toast(friendlyError(err), "error");
    // never fake success: reload the true state from the database
    await load(false);
  } finally {
    cellPending(ctx, pid, date, false);
  }
}

// ---------------- auth / workspace flows ----------------

async function doAuth(newUser) {
  if (!hasBackend) { setMessage("Supabase environment variables are missing."); return; }
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  const team = document.getElementById("team").value.trim() || "My Team";
  const loginBtn = document.getElementById("login");
  const signupBtn = document.getElementById("signup");
  loginBtn.disabled = signupBtn.disabled = true;
  setMessage("Working…");
  try {
    if (newUser) {
      const data = await api.signUp(email, password, team);
      if (!data.session) {
        setMessage("Account created. Confirm your email if required, then sign in.", true);
        return;
      }
      setMessage("Account created. Opening workspace…", true);
    } else {
      await api.signIn(email, password);
      setMessage("Signed in. Opening workspace…", true);
    }
  } catch (err) {
    setMessage(err.message || "Authentication failed.");
  } finally {
    loginBtn.disabled = signupBtn.disabled = false;
  }
}

async function teamSetup() {
  const membership = await api.findMembership(S.session.user.id);
  if (membership) {
    S.team = membership.team;
    S.role = membership.role;
    return true;
  }
  // signed in but no team: create or join
  const defaultName = S.session.user.user_metadata?.team_name || "";
  workspaceSetupScreen({
    defaultName,
    onSignOut: () => {
      api.signOut().catch((err) => toast(err.message, "error"));
    },
    onCreate: async (name) => {
      await api.createTeam(name);
      await loadApp();
    },
    onJoin: async (code) => {
      await api.joinTeam(code);
      await loadApp();
    }
  });
  return false;
}

async function loadApp() {
  const found = await teamSetup();
  if (!found) return; // setup screen shown
  dashboard(ctx);
  await load();
  realtime();
}

// ---------------- realtime ----------------

function scheduleRealtimeReload() {
  clearTimeout(S.refreshTimer);
  S.refreshTimer = setTimeout(() => load(false).catch(() => {}), 300);
}

function stopRealtime() {
  if (S.channel) {
    db.removeChannel(S.channel);
    S.channel = null;
  }
}

function realtime() {
  stopRealtime();
  if (!S.team) return;
  S.channel = db.channel("team-" + S.team.id + "-" + Date.now());
  ["people", "attendance_dates", "attendance"].forEach((table) => {
    S.channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table, filter: "team_id=eq." + S.team.id },
      scheduleRealtimeReload
    );
  });
  S.channel.subscribe((status) => {
    if (status === "SUBSCRIBED") setBackendStatus("Backend connected · realtime");
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
      setBackendStatus("Realtime reconnecting…");
    }
  });
}

// ---------------- landing visuals (reduced-motion aware) ----------------

function visual() {
  const c = document.getElementById("ambientCanvas");
  if (!c || REDUCED_MOTION) return;
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
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
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
  if (!o || !d || REDUCED_MOTION || matchMedia("(pointer:coarse)").matches) return;

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

// ---------------- bootstrap ----------------

function resetState() {
  S.team = null;
  S.role = "member";
  S.people = [];
  S.dates = [];
  S.marks = new Map();
  S.showAllRows = false;
  S.showAllDates = false;
  S.filters = { search: "", active: "active", status: "any", sort: "name-asc" };
}

async function boot() {
  visual();
  cursor();
  bindParallax();

  if (!hasBackend) {
    const view = authScreen("Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel.");
    view.doAuth(doAuth);
    return;
  }

  const session = await api.getSession();
  S.session = session;

  db.auth.onAuthStateChange((_event, session) => {
    // Run outside the auth callback to avoid supabase-js lock warnings.
    setTimeout(() => {
      const uid = session?.user?.id || null;
      if (session) {
        // Ignore token refresh / duplicate events when the same user is
        // already rendered — prevents re-render loops and duplicate
        // realtime subscriptions.
        const alreadyHere = uid === S.currentUserId && document.querySelector(".app-shell, .setup-shell");
        S.session = session;
        if (!alreadyHere) {
          S.currentUserId = uid;
          resetState();
          loadApp().catch((e) => {
            console.error(e);
            const view = authScreen(friendlyError(e) || "Unable to open your workspace. Check the Supabase database setup.");
            view.doAuth(doAuth);
          });
        }
      } else {
        S.currentUserId = null;
        S.session = null;
        resetState();
        closeModal();
        stopRealtime();
        const view = authScreen();
        view.doAuth(doAuth);
      }
    }, 0);
  });

  if (S.session) {
    S.currentUserId = S.session.user.id;
    try {
      await loadApp();
    } catch (e) {
      const view = authScreen(friendlyError(e) || "Unable to open your workspace. Check the Supabase database setup.");
      view.doAuth(doAuth);
    }
  } else {
    const view = authScreen();
    view.doAuth(doAuth);
  }
}

boot().catch((e) => {
  console.error(e);
  const view = authScreen(friendlyError(e) || "Something went wrong.");
  view.doAuth(doAuth);
});

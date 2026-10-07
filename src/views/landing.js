// Public landing page + auth modal + first-run workspace setup screen.
import { esc } from "../lib/util.js";
import { DEFAULT_PLATFORM_SETTINGS, DEFAULT_FAQS, normalizePlatformSettings, footerMarkup, bindFooter, openPublicInfo } from "./public-info.js";

export function logoMarkup(extraClass = "") {
  return '<img src="/attendanceflow-logo.svg" alt="AttendanceFlow" class="brand-logo ' + esc(extraClass) + '">';
}

// Desktop-only 3D tilt/parallax physics (skipped for touch + reduced motion).
export function bindParallax() {
  if (matchMedia("(pointer:coarse)").matches || matchMedia("(prefers-reduced-motion:reduce)").matches) return;
  const targets = document.querySelectorAll(".feature-card,.step,.final-cta,.float-card,.stat-card");
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

export function authScreen(message = "", platformSettings = DEFAULT_PLATFORM_SETTINGS, faqs = DEFAULT_FAQS) {
  const app = document.getElementById("app");
  const settings = normalizePlatformSettings(platformSettings);
  const faqList = faqs && faqs.length ? faqs : DEFAULT_FAQS;
  const registration = settings.registration_enabled !== false;
  app.innerHTML =
    '<div class="home-shell">' +
      '<nav class="home-nav">' +
        '<a class="brand" href="#" aria-label="AttendanceFlow home">' +
          logoMarkup("") +
          '<span>' + esc(settings.site_name) + '</span>' +
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
            '<div class="eyebrow"><span class="pulse-dot"></span> ' + esc(settings.hero_kicker) + '</div>' +
            '<h1>' + esc(settings.hero_title) + '</h1>' +
            '<p class="hero-lead">' + esc(settings.hero_subtitle) + '</p>' +
            '<div class="hero-actions">' +
              '<button id="heroStart" class="liquid primary-cta ' + (registration ? '' : 'hidden') + '">Create your workspace <span>↗</span></button>' +
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
      footerMarkup(settings, faqList) +
    '</div>' +
    '<div id="authModal" class="auth-modal hidden" role="dialog" aria-modal="true" aria-labelledby="authTitle"><div class="auth-panel">' +
      '<button id="closeAuth" class="close-auth" aria-label="Close">×</button>' +
      logoMarkup("auth-logo") +
      '<h2 id="authTitle">Enter your workspace</h2>' +
      '<p>Sign in or create the team account that powers your real attendance database.</p>' +
      '<form id="authForm">' +
        '<label>Email<input id="authEmail" type="email" required autocomplete="email" placeholder="you@company.com"></label>' +
        '<label>Password<input id="authPassword" type="password" minlength="8" required autocomplete="current-password" placeholder="Minimum 8 characters"></label>' +
        '<label id="teamWrap">Team name<input id="team" autocomplete="organization" placeholder="Your team or organization"></label>' +
        '<div class="auth-buttons"><button id="login" type="button" class="liquid primary-cta">Sign in</button><button id="signup" type="button" class="liquid secondary-cta">Create account</button></div>' +
      '</form>' +
      '<p id="msg" class="auth-message">' + esc(message || "Your workspace is backed by Supabase PostgreSQL.") + '</p>' +
    '</div></div>';

  const $ = (id) => document.getElementById(id);

  function openAuth(showCreate = true) {
    $("authModal").classList.remove("hidden");
    $("teamWrap").classList.toggle("hidden", !showCreate);
    $("signup").classList.toggle("hidden", !showCreate);
    $("authPassword").autocomplete = showCreate ? "new-password" : "current-password";
    $("authEmail").focus();
  }
  const closeAuth = () => $("authModal").classList.add("hidden");

  bindParallax();
  bindFooter(settings, faqList);
  $("navLogin").onclick = () => openAuth(false);
  $("heroStart").onclick = () => openAuth(true);
  $("heroDemo").onclick = () => $("workflow").scrollIntoView({ behavior: "smooth" });
  $("finalStart").onclick = () => openAuth(true);
  $("closeAuth").onclick = closeAuth;
  $("authModal").addEventListener("click", (e) => {
    if (e.target.id === "authModal") closeAuth();
  });

  return { openAuth, doAuth: (cb) => {
    $("login").onclick = () => cb(false);
    $("signup").onclick = () => cb(true);
  } };
}

export function setMessage(message, good = false) {
  const el = document.getElementById("msg");
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("success", good);
}

// Shown to a signed-in user who does not belong to any team yet:
// create a workspace or join one with an invite code.
export function workspaceSetupScreen({ onCreate, onJoin, onSignOut, defaultName = "" }) {
  const app = document.getElementById("app");
  app.innerHTML =
    '<main class="setup-shell">' +
      '<div class="glass rounded-3xl setup-panel">' +
        logoMarkup("auth-logo") +
        '<h1 class="text-2xl font-black mt-3">Set up your workspace</h1>' +
        '<p class="text-slate-400 text-sm mt-2">Create a new team workspace, or join an existing team with the invite code its admin shares with you.</p>' +
        '<div class="setup-grid mt-6">' +
          '<form id="createTeamForm" class="setup-card rounded-2xl border border-white/10 p-5">' +
            '<h2 class="font-bold">Create a workspace</h2>' +
            '<p class="text-xs text-slate-500 mt-1">You become its owner.</p>' +
            '<input id="newTeamName" maxlength="120" placeholder="Team or organization name" value="' + esc(defaultName) + '" required class="dialog-input mt-4">' +
            '<button id="createTeamBtn" type="submit" class="liquid rounded-xl bg-violet-600 px-4 py-3 font-bold w-full mt-4">Create workspace</button>' +
          '</form>' +
          '<form id="joinTeamForm" class="setup-card rounded-2xl border border-white/10 p-5">' +
            '<h2 class="font-bold">Join a team</h2>' +
            '<p class="text-xs text-slate-500 mt-1">Have an invite code? Enter it here.</p>' +
            '<input id="inviteCode" maxlength="64" placeholder="Invite code" class="dialog-input mt-4">' +
            '<button id="joinTeamBtn" type="submit" class="liquid rounded-xl bg-white/5 px-4 py-3 font-bold w-full mt-4">Join team</button>' +
          '</form>' +
        '</div>' +
        '<p id="setupMsg" class="setup-message" role="status"></p>' +
        '<button id="setupSignOut" class="text-xs text-slate-500 hover:text-slate-300 mt-6">Sign out</button>' +
      '</div>' +
    '</main>';

  const msg = document.getElementById("setupMsg");
  const setMsg = (m, ok = false) => {
    msg.textContent = m;
    msg.classList.toggle("success", ok);
  };
  const busy = (b) => {
    for (const id of ["createTeamBtn", "joinTeamBtn"]) {
      const el = document.getElementById(id);
      el.disabled = b;
    }
  };

  document.getElementById("createTeamForm").onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById("createTeamBtn");
    btn.disabled = true;
    btn.textContent = "Creating…";
    try {
      await onCreate(document.getElementById("newTeamName").value.trim());
    } catch (err) {
      setMsg(err.message || String(err));
      btn.disabled = false;
      btn.textContent = "Create workspace";
    }
  };

  document.getElementById("joinTeamForm").onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById("joinTeamBtn");
    btn.disabled = true;
    btn.textContent = "Joining…";
    try {
      await onJoin(document.getElementById("inviteCode").value.trim());
    } catch (err) {
      setMsg(err.message || String(err));
      btn.disabled = false;
      btn.textContent = "Join team";
    }
  };

  document.getElementById("setupSignOut").onclick = () => {
    if (onSignOut) onSignOut();
  };
  return { setMsg, busy };
}

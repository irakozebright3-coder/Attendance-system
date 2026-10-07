// Platform super-admin panel.
// Access is granted only by the public.is_platform_admin() database function.
// Public-site settings intentionally contain public contact/content only;
// never store passwords, service-role keys or API secrets here.

import { esc, timeLabel } from "../lib/util.js";
import * as api from "../lib/api.js";
import { DEFAULT_PLATFORM_SETTINGS, DEFAULT_FAQS } from "./public-info.js";

export async function platformAdminPanel(ctx) {
  const { S, toast } = ctx;
  const app = document.getElementById("app");

  app.innerHTML =
    '<main class="platform-admin-page">' +
      '<div class="platform-admin-bg"></div>' +
      '<div class="af-container">' +
        '<header class="platform-admin-header af-glass">' +
          '<div class="platform-admin-brand"><img src="/attendanceflow-logo.svg" class="platform-logo" alt="AttendanceFlow"><div><div class="eyebrow">PLATFORM CONTROL</div><h1>Super Admin</h1><p>Global site controls, registered teams, users, support content and platform settings.</p></div></div>' +
          '<button id="backWorkspace" class="liquid dashboard-action">← Back to workspace</button>' +
        '</header>' +

        '<section class="platform-metrics af-grid-12">' +
          '<article class="platform-metric af-glass af-span-3"><span>REGISTERED TEAMS</span><b id="platformTeamsCount">—</b></article>' +
          '<article class="platform-metric af-glass af-span-3"><span>REGISTERED USERS</span><b id="platformUsersCount">—</b></article>' +
          '<article class="platform-metric af-glass af-span-3"><span>ACTIVE PEOPLE</span><b id="platformPeopleCount">—</b></article>' +
          '<article class="platform-metric af-glass af-span-3"><span>ATTENDANCE RECORDS</span><b id="platformAttendanceCount">—</b></article>' +
        '</section>' +

        '<section class="platform-grid">' +
          '<div class="af-glass platform-card"><div class="platform-card-head"><div><div class="register-kicker">GLOBAL WEBSITE</div><h2>Site & contact settings</h2><p>Edit the public website content shown in the footer, help center and landing page.</p></div><span class="admin-lock">SUPER ADMIN ONLY</span></div>' +
            '<form id="platformSettingsForm" class="settings-form">' +
              '<div class="settings-grid">' +
                '<label>Site name<input name="site_name" maxlength="120"></label>' +
                '<label>Tagline<input name="tagline" maxlength="240"></label>' +
                '<label>Hero kicker<input name="hero_kicker" maxlength="120"></label>' +
                '<label>Copyright start year<input name="copyright_start_year" type="number" min="2000" max="2100"></label>' +
                '<label class="full">Hero title<input name="hero_title" maxlength="240"></label>' +
                '<label class="full">Hero subtitle<textarea name="hero_subtitle" rows="3" maxlength="1200"></textarea></label>' +
                '<label class="full">About us<textarea name="about_text" rows="4" maxlength="2500"></textarea></label>' +
                '<label>Contact email<input name="contact_email" type="email" maxlength="240"></label>' +
                '<label>Contact phone<input name="contact_phone" maxlength="60"></label>' +
                '<label>Contact address<input name="contact_address" maxlength="240"></label>' +
                '<label>Support hours<input name="support_hours" maxlength="160"></label>' +
                '<label>Owner name<input name="owner_name" maxlength="160"></label>' +
                '<label>Owner title<input name="owner_title" maxlength="160"></label>' +
                '<label>Owner public email<input name="owner_email" type="email" maxlength="240"></label>' +
                '<label>Owner public phone<input name="owner_phone" maxlength="60"></label>' +
                '<label class="full">Footer note<textarea name="footer_note" rows="2" maxlength="300"></textarea></label>' +
                '<label class="full"><div class="setting-toggle-row"><input id="registrationEnabled" name="registration_enabled" type="checkbox"><span>Allow new public account registration</span></div></label>' +
              '</div>' +
              '<div class="admin-safety-note">These fields are for public owner/support information only. Never enter a password, Supabase service key, API secret, or other private credential here. User login credentials remain in Supabase Auth.</div>' +
              '<button class="liquid primary-cta" type="submit">Save website settings</button>' +
              '<span id="platformSaveMsg" class="settings-message"></span>' +
            '</form>' +
          '</div>' +

          '<div class="af-glass platform-card"><div class="platform-card-head"><div><div class="register-kicker">FREQUENTLY ASKED</div><h2>Help Center / FAQs</h2><p>Edit answers that appear publicly in the footer Help Center and FAQ dialog.</p></div></div>' +
            '<form id="faqForm" class="faq-admin-form"><input id="faqQuestion" placeholder="Question" maxlength="240" required><textarea id="faqAnswer" placeholder="Answer" rows="3" maxlength="2000" required></textarea><button class="liquid secondary-cta" type="submit">Add FAQ</button></form>' +
            '<div id="faqAdminList" class="faq-admin-list"></div>' +
          '</div>' +
        '</section>' +

        '<section class="af-glass platform-card platform-wide"><div class="platform-card-head"><div><div class="register-kicker">ALL REGISTERED TEAMS</div><h2>Teams & owner emails</h2><p>Super-admin overview of workspaces registered on this AttendanceFlow installation.</p></div><button id="refreshPlatform" class="liquid dashboard-action">↻ Refresh data</button></div>' +
          '<div class="overflow-x-auto admin-table"><table><thead><tr><th>Team</th><th>Owner email</th><th>Members</th><th>People</th><th>Attendance</th><th>Created</th><th></th></tr></thead><tbody id="teamsTable"></tbody></table></div>' +
          '<div id="teamMembersDrawer" class="team-members-drawer hidden"></div>' +
        '</section>' +

        '<section class="af-glass platform-card platform-wide"><div class="platform-card-head"><div><div class="register-kicker">AUTH USERS</div><h2>Registered users & emails</h2><p>Platform administrators can review account metadata; passwords are never exposed.</p></div></div>' +
          '<div class="overflow-x-auto admin-table"><table><thead><tr><th>Email</th><th>Teams</th><th>Platform role</th><th>Created</th><th>Last sign-in</th></tr></thead><tbody id="usersTable"></tbody></table></div>' +
        '</section>' +

        '<section class="platform-stack-panel"><div><div class="eyebrow">PLATFORM STACK</div><h2>AttendanceFlow infrastructure</h2></div><div class="footer-stack large"><span>GitHub</span><span>Vercel</span><span>Supabase</span><span>PostgreSQL</span><span>Vite</span><span>JavaScript</span><span>Tailwind CSS</span><span>HTML5 Canvas</span><span>CSS3</span><span>WebGL-ready</span></div></section>' +
      '</div>' +
    '</main>';

  document.getElementById("backWorkspace").onclick = async () => {
    await ctx.backToWorkspace();
  };
  document.getElementById("refreshPlatform").onclick = () => loadAdminData();

  const settings = await api.loadPlatformSettings().catch(() => DEFAULT_PLATFORM_SETTINGS);
  fillSettingsForm(settings);
  const faqRows = await api.loadPublicFaqs().catch(() => DEFAULT_FAQS);
  renderFaqs(faqRows);
  await loadAdminData();

  document.getElementById("platformSettingsForm").onsubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const btn = form.querySelector("button[type=submit]");
    const msg = document.getElementById("platformSaveMsg");
    btn.disabled = true;
    msg.textContent = "Saving…";
    try {
      const fd = new FormData(form);
      const payload = Object.fromEntries(fd.entries());
      payload.copyright_start_year = Number(payload.copyright_start_year);
      payload.registration_enabled = document.getElementById("registrationEnabled").checked;
      const saved = await api.savePlatformSettings(payload);
      S.platformSettings = saved;
      msg.textContent = "Saved globally.";
      toast("Website settings saved.", "success");
    } catch (err) {
      msg.textContent = err.message || "Could not save settings.";
      toast(err.message || "Could not save settings.", "error");
    } finally {
      btn.disabled = false;
    }
  };

  document.getElementById("faqForm").onsubmit = async (e) => {
    e.preventDefault();
    const question = document.getElementById("faqQuestion").value.trim();
    const answer = document.getElementById("faqAnswer").value.trim();
    if (!question || !answer) return;
    try {
      await api.createPlatformFaq({ question, answer, sort_order: document.querySelectorAll("#faqAdminList .faq-admin-item").length });
      document.getElementById("faqQuestion").value = "";
      document.getElementById("faqAnswer").value = "";
      const rows = await api.loadPublicFaqs();
      renderFaqs(rows);
      toast("FAQ added.", "success");
    } catch (err) {
      toast(err.message, "error");
    }
  };

  async function loadAdminData() {
    try {
      const [teams, users] = await Promise.all([api.loadPlatformTeams(), api.loadPlatformUsers()]);
      document.getElementById("platformTeamsCount").textContent = teams.length;
      document.getElementById("platformUsersCount").textContent = users.length;
      document.getElementById("platformPeopleCount").textContent = teams.reduce((n, x) => n + Number(x.people_count || 0), 0);
      document.getElementById("platformAttendanceCount").textContent = teams.reduce((n, x) => n + Number(x.attendance_count || 0), 0);

      document.getElementById("teamsTable").innerHTML = teams.length ? teams.map((t) =>
        '<tr><td><b>' + esc(t.team_name) + '</b></td><td>' + esc(t.owner_email || "—") + '</td><td>' + esc(t.member_count) + '</td><td>' + esc(t.people_count) + '</td><td>' + esc(t.attendance_count) + '</td><td>' + esc(timeLabel(t.created_at)) + '</td><td><button class="liquid small-admin-btn" data-team-members="' + esc(t.team_id) + '">Members</button></td></tr>'
      ).join("") : '<tr><td colspan="7" class="empty-table">No teams registered yet.</td></tr>';

      document.querySelectorAll("[data-team-members]").forEach((b) => {
        b.onclick = async () => {
          const drawer = document.getElementById("teamMembersDrawer");
          drawer.classList.remove("hidden");
          drawer.innerHTML = '<div class="drawer-loading">Loading members…</div>';
          try {
            const members = await api.loadPlatformTeamMembers(b.dataset.teamMembers);
            drawer.innerHTML = '<div class="drawer-head"><b>Team members</b><button class="liquid small-admin-btn" id="closeDrawer">Close</button></div>' +
              (members.length ? members.map((m) => '<div class="member-line"><span>' + esc(m.email) + '</span><span class="role-badge">' + esc(m.role) + '</span></div>').join("") : '<p class="text-slate-500">No members found.</p>');
            document.getElementById("closeDrawer").onclick = () => drawer.classList.add("hidden");
          } catch (err) {
            drawer.innerHTML = '<div class="drawer-loading error">Could not load members: ' + esc(err.message) + '</div>';
          }
        };
      });

      document.getElementById("usersTable").innerHTML = users.length ? users.map((u) =>
        '<tr><td><b>' + esc(u.email || "—") + '</b></td><td>' + esc(u.team_count) + '</td><td>' + (u.is_platform_admin ? '<span class="role-badge">SUPER ADMIN</span>' : '<span class="user-role">User</span>') + '</td><td>' + esc(timeLabel(u.created_at)) + '</td><td>' + esc(u.last_sign_in_at ? timeLabel(u.last_sign_in_at) : "Never") + '</td></tr>'
      ).join("") : '<tr><td colspan="5" class="empty-table">No users found.</td></tr>';
    } catch (err) {
      toast(err.message || "Could not load platform data.", "error");
    }
  }

  function fillSettingsForm(s) {
    const form = document.getElementById("platformSettingsForm");
    for (const [name, value] of Object.entries(s || {})) {
      const field = form.elements.namedItem(name);
      if (!field) continue;
      if (field.type === "checkbox") field.checked = Boolean(value);
      else field.value = value ?? "";
    }
  }

  function renderFaqs(rows) {
    const list = document.getElementById("faqAdminList");
    if (!rows.length) {
      list.innerHTML = '<p class="text-slate-500">No FAQs configured.</p>';
      return;
    }
    list.innerHTML = rows.map((f) =>
      '<article class="faq-admin-item" data-faq-id="' + esc(f.id) + '">' +
        '<div class="faq-admin-head"><b>FAQ</b><button class="text-red-300" data-faq-delete="' + esc(f.id) + '">Delete</button></div>' +
        '<input data-faq-question="' + esc(f.id) + '" value="' + esc(f.question) + '" maxlength="240">' +
        '<textarea data-faq-answer="' + esc(f.id) + '" rows="3" maxlength="2000">' + esc(f.answer) + '</textarea>' +
        '<button class="liquid small-admin-btn" data-faq-save="' + esc(f.id) + '">Save FAQ</button>' +
      '</article>'
    ).join("");

    list.querySelectorAll("[data-faq-save]").forEach((b) => b.onclick = async () => {
      const id = b.dataset.faqSave;
      try {
        await api.updatePlatformFaq(id, {
          question: list.querySelector("[data-faq-question='" + id + "']").value.trim(),
          answer: list.querySelector("[data-faq-answer='" + id + "']").value.trim()
        });
        toast("FAQ updated.", "success");
      } catch (err) { toast(err.message, "error"); }
    });
    list.querySelectorAll("[data-faq-delete]").forEach((b) => b.onclick = async () => {
      if (!confirm("Delete this FAQ?")) return;
      try {
        await api.deletePlatformFaq(b.dataset.faqDelete);
        renderFaqs(await api.loadPublicFaqs());
        toast("FAQ deleted.", "success");
      } catch (err) { toast(err.message, "error"); }
    });
  }
}

// Public footer and support/help-center content.
// Only intentionally public contact/site content is rendered here.
// Never put passwords, service keys, API secrets, or private credentials in it.

import { esc } from "../lib/util.js";

export const DEFAULT_PLATFORM_SETTINGS = Object.freeze({
  site_name: "AttendanceFlow",
  tagline: "Real-time team attendance, built for serious work.",
  hero_kicker: "LIVE TEAM ATTENDANCE PLATFORM",
  hero_title: "Attendance that moves with your team.",
  hero_subtitle: "A serious, shared attendance workspace for large teams. Track people, dates, presence, photos and real-time updates from one beautiful dashboard.",
  about_text: "AttendanceFlow is a secure, database-backed attendance workspace for teams and organizations.",
  contact_email: "",
  contact_phone: "",
  contact_address: "",
  owner_name: "",
  owner_title: "Platform Owner",
  owner_email: "",
  owner_phone: "",
  support_hours: "",
  footer_note: "Secure team attendance · Built for the web",
  copyright_start_year: new Date().getFullYear(),
  registration_enabled: true
});

export const DEFAULT_FAQS = Object.freeze([
  { id: "d1", question: "How do I add a person?", answer: "Sign in as a team owner or admin, open the workspace, and choose Add person. Photos are optional." },
  { id: "d2", question: "Can I capture a person photo with the camera?", answer: "Yes. On HTTPS or localhost, choose Take with camera and grant browser camera permission." },
  { id: "d3", question: "Where is attendance stored?", answer: "Attendance records are stored in the team's PostgreSQL database and protected with Row Level Security." },
  { id: "d4", question: "Can multiple people use the same team?", answer: "Yes. Team members can use the shared register and realtime updates keep connected screens synchronized." }
]);

export function normalizePlatformSettings(settings) {
  return { ...DEFAULT_PLATFORM_SETTINGS, ...(settings || {}) };
}

function copyrightText(settings) {
  const current = new Date().getFullYear();
  const start = Number(settings.copyright_start_year) || current;
  const years = start < current ? start + "–" + current : String(current);
  return "© " + years + " " + esc(settings.site_name || "AttendanceFlow");
}

export function footerMarkup(settings, faqs = []) {
  const s = normalizePlatformSettings(settings);
  const faqCount = (faqs || []).length;
  const contactEmail = s.contact_email || s.owner_email;
  const contactPhone = s.contact_phone || s.owner_phone;

  return '<footer class="site-footer">' +
    '<div class="footer-main">' +
      '<div class="footer-brand-col">' +
        '<a class="brand footer-brand" href="#" data-info="about" aria-label="About ' + esc(s.site_name) + '">' +
          '<img src="/attendanceflow-logo.svg" class="brand-logo" alt="' + esc(s.site_name) + '">' +
          '<span>' + esc(s.site_name) + '</span>' +
        '</a>' +
        '<p>' + esc(s.footer_note || s.tagline) + '</p>' +
      '</div>' +
      '<div class="footer-col"><b>Product</b><button data-info="about">About us</button><button data-info="help">Help Center</button><button data-info="faq">FAQs' + (faqCount ? " (" + faqCount + ")" : "") + '</button></div>' +
      '<div class="footer-col"><b>Contact</b>' +
        (contactEmail ? '<a href="mailto:' + esc(contactEmail) + '">' + esc(contactEmail) + '</a>' : '<button data-info="contact">Contact us</button>') +
        (contactPhone ? '<a href="tel:' + esc(contactPhone.replace(/[^+\d]/g, "")) + '">' + esc(contactPhone) + '</a>' : '') +
        (s.contact_address ? '<span>' + esc(s.contact_address) + '</span>' : '') +
        (s.support_hours ? '<span>' + esc(s.support_hours) + '</span>' : '') +
      '</div>' +
    '</div>' +
    '<div class="footer-bottom"><span>' + copyrightText(s) + '</span><span id="footerOwnerName">' + (s.owner_name ? 'Owner: ' + esc(s.owner_name) + ' · ' : '') + esc(s.site_name) + ' · Secure team attendance</span></div>' +
  '</footer>';
}

function ensureHost() {
  let host = document.getElementById("publicInfoModal");
  if (host) return host;
  host = document.createElement("div");
  host.id = "publicInfoModal";
  host.className = "public-info-modal hidden";
  document.body.appendChild(host);
  return host;
}

export function openPublicInfo(type, settings, faqs = []) {
  const s = normalizePlatformSettings(settings);
  const host = ensureHost();
  const rows = (faqs && faqs.length ? faqs : DEFAULT_FAQS).filter((x) => x.active !== false);

  let title = "About AttendanceFlow";
  let body = '<p>' + esc(s.about_text) + '</p>';

  if (type === "contact") {
    title = "Contact us";
    body =
      '<p>Reach the AttendanceFlow owner/support contact using the details below.</p>' +
      '<div class="public-contact-grid">' +
        '<div><span>Name</span><b>' + esc(s.owner_name || "Platform owner") + '</b><small>' + esc(s.owner_title || "") + '</small></div>' +
        '<div><span>Email</span><b>' + (s.contact_email || s.owner_email ? '<a href="mailto:' + esc(s.contact_email || s.owner_email) + '">' + esc(s.contact_email || s.owner_email) + '</a>' : "Not configured") + '</b></div>' +
        '<div><span>Phone</span><b>' + (s.contact_phone || s.owner_phone ? '<a href="tel:' + esc((s.contact_phone || s.owner_phone).replace(/[^+\d]/g, "")) + '">' + esc(s.contact_phone || s.owner_phone) + '</a>' : "Not configured") + '</b></div>' +
        '<div><span>Address</span><b>' + esc(s.contact_address || "Not configured") + '</b></div>' +
        '<div><span>Support hours</span><b>' + esc(s.support_hours || "Not configured") + '</b></div>' +
      '</div>';
  } else if (type === "faq" || type === "help") {
    title = type === "help" ? "Help Center" : "Frequently asked questions";
    body =
      '<p>' + (type === "help"
        ? "Find quick answers, support contacts and safe setup guidance."
        : "Common AttendanceFlow questions and answers.") + '</p>' +
      '<div class="faq-list">' +
        rows.map((x) =>
          '<details><summary>' + esc(x.question) + '</summary><p>' + esc(x.answer) + '</p></details>'
        ).join("") +
      '</div>' +
      (type === "help"
        ? '<div class="help-owner-note"><b>Need the owner?</b><span>' + esc(s.owner_name || "Platform owner") + '</span><button data-info="contact">View contact details</button></div>'
        : "");
  }

  host.innerHTML =
    '<div class="public-info-panel glass" role="dialog" aria-modal="true" aria-labelledby="publicInfoTitle">' +
      '<button class="public-info-close" data-close-info aria-label="Close">×</button>' +
      '<div class="eyebrow">ATTENDANCEFLOW SUPPORT</div>' +
      '<h2 id="publicInfoTitle">' + esc(title) + '</h2>' +
      '<div class="public-info-body">' + body + '</div>' +
    '</div>';
  host.classList.remove("hidden");

  const close = () => {
    host.classList.add("hidden");
    host.innerHTML = "";
  };
  host.querySelector("[data-close-info]").onclick = close;
  host.onclick = (e) => {
    if (e.target === host) close();
    const info = e.target.closest("[data-info]");
    if (info) {
      e.preventDefault();
      openPublicInfo(info.dataset.info, s, rows);
    }
  };
}

export function bindFooter(settings, faqs = []) {
  document.querySelectorAll("[data-info]").forEach((el) => {
    if (el.dataset.infoBound === "1") return;
    el.dataset.infoBound = "1";
    el.addEventListener("click", (e) => {
      e.preventDefault();
      openPublicInfo(el.dataset.info, settings, faqs);
    });
  });
}

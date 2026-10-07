// All dashboard modals: person add/edit, date, confirm, invite, reports, audit.
import { esc, dateLabel, today, timeLabel, pct, downloadCsv, validatePhoto } from "../lib/util.js";
import * as api from "../lib/api.js";

const modalHost = () => document.getElementById("modal");

export function closeModal() {
  stopCamera();
  const m = modalHost();
  if (!m) return;
  m.classList.add("hidden");
  m.innerHTML = "";
}

function openModal(html) {
  const m = modalHost();
  m.innerHTML = '<div class="modal-card glass rounded-3xl">' + html + "</div>";
  m.classList.remove("hidden");
  m.onclick = (e) => { if (e.target === m) closeModal(); };
  m.onkeydown = (e) => { if (e.key === "Escape") closeModal(); };
  // let keyboard users reach inputs/canvas inside
  m.tabIndex = -1;
  return m;
}

// Promise-based accessible confirmation dialog.
export function confirmDialog({ title, message, confirmLabel = "Confirm", danger = false }) {
  return new Promise((resolve) => {
    const m = openModal(
      '<div class="p-6" role="alertdialog" aria-modal="true" aria-labelledby="confirmTitle">' +
        '<h2 id="confirmTitle" class="text-xl font-black">' + esc(title) + "</h2>" +
        '<p class="text-sm text-slate-400 mt-2">' + esc(message) + "</p>" +
        '<div class="flex gap-2 mt-6"><button id="confirmNo" class="liquid rounded-xl bg-white/5 px-4 py-3 font-bold">Cancel</button>' +
        '<button id="confirmYes" class="liquid rounded-xl px-4 py-3 font-bold ml-auto ' + (danger ? "bg-red-600" : "bg-violet-600") + '">' + esc(confirmLabel) + "</button></div>" +
      "</div>"
    );
    const yes = m.querySelector("#confirmYes");
    const no = m.querySelector("#confirmNo");
    m.onclick = (e) => { if (e.target === m) done(false); };
    const done = (v) => { closeModal(); resolve(v); };
    yes.onclick = () => done(true);
    no.onclick = () => done(false);
    m.onkeydown = (e) => {
      if (e.key === "Escape") done(false);
      if (e.key === "Enter") done(true);
    };
    yes.focus();
  });
}

export function showInviteDialog(team) {
  openModal(
    '<div class="p-6" role="dialog" aria-modal="true" aria-labelledby="inviteTitle">' +
      '<div class="flex justify-between items-start"><div><h2 id="inviteTitle" class="text-xl font-black">Invite your team</h2>' +
      '<p class="text-xs text-slate-500 mt-1">Share this code with teammates. They sign in, then choose “Join a team” on the setup screen.</p></div>' +
      '<button id="closeInvite" class="text-2xl" aria-label="Close">×</button></div>' +
      '<div class="mt-5 rounded-2xl border border-white/10 p-4 text-center">' +
      '<div class="text-[10px] uppercase tracking-[.18em] text-slate-500">Team invite code</div>' +
      '<div id="inviteCodeText" class="font-mono text-lg font-black mt-2 break-all">' + esc(team.invite_code || "") + "</div></div>" +
      '<button id="copyInvite" class="liquid rounded-xl bg-violet-600 px-4 py-3 font-bold w-full mt-4">Copy code</button>' +
    "</div>"
  );
  document.getElementById("closeInvite").onclick = closeModal;
  document.getElementById("copyInvite").onclick = async (e) => {
    const btn = e.target;
    try {
      await navigator.clipboard.writeText(team.invite_code || "");
      btn.textContent = "Copied!";
    } catch {
      btn.textContent = "Copy failed — select it manually";
    }
  };
}

// ---------------- Person modal (add / edit / view) ----------------
// ctx: { S, canManage, toast, refresh }

export async function personModal(ctx, person = null) {
  const { S, canManage } = ctx;
  const manager = canManage();
  const isEdit = Boolean(person);

  const current = person
    ? { name: person.name || "", identifier: person.identifier || "", photo_url: person.photo_url || null, photo_path: person.photo_path || null }
    : { name: "", identifier: "", photo_url: null, photo_path: null };

  openModal(
    '<div class="p-6" role="dialog" aria-modal="true" aria-labelledby="personTitle">' +
      '<div class="flex justify-between items-start"><div>' +
        '<h2 id="personTitle" class="text-xl font-black">' + (isEdit ? "Person details" : "Add person") + "</h2>" +
        '<p class="text-xs text-slate-500 mt-1">' + (isEdit ? "Changes are saved to the team database." : "Photo is optional — you can add or capture one now.") + "</p>" +
      '</div><button id="closeModal" class="text-2xl" aria-label="Close">×</button></div>' +

      (isEdit
        ? '<div class="person-stats mt-4 grid grid-cols-3 gap-2">' +
            '<div class="rounded-xl bg-slate-950/60 p-3 text-center"><div class="text-[10px] text-slate-500 uppercase tracking-wide">Present</div><div id="pPresent" class="text-lg font-black text-green-300">–</div></div>' +
            '<div class="rounded-xl bg-slate-950/60 p-3 text-center"><div class="text-[10px] text-slate-500 uppercase tracking-wide">Absent</div><div id="pAbsent" class="text-lg font-black text-red-300">–</div></div>' +
            '<div class="rounded-xl bg-slate-950/60 p-3 text-center"><div class="text-[10px] text-slate-500 uppercase tracking-wide">Rate</div><div id="pRate" class="text-lg font-black text-cyan-300">–</div></div>' +
          "</div>"
        : "") +

      '<form id="personForm" class="space-y-4 mt-5">' +
        '<div id="photoZone">' +
          '<div class="flex items-center gap-4">' +
            '<div id="photoPreviewWrap">' +
              (current.photo_url
                ? '<img id="preview" alt="Current photo" class="w-20 h-20 rounded-2xl object-cover" src="' + esc(current.photo_url) + '">'
                : '<div class="avatar grid place-items-center text-violet-300 font-black w-20 h-20" aria-hidden="true">' + esc((current.name || "?").charAt(0).toUpperCase()) + "</div>") +
            "</div>" +
            (manager
              ? '<div class="flex flex-col gap-2 text-xs"><button type="button" id="upload" class="liquid rounded-xl bg-white/5 px-4 py-2">Upload photo</button>' +
                '<button type="button" id="camera" class="liquid rounded-xl bg-violet-600 px-4 py-2">Take with camera</button>' +
                (current.photo_path ? '<button type="button" id="removePhoto" class="text-slate-500 hover:text-red-300 underline">Remove photo</button>' : "") +
              "</div>"
              : '<span class="text-xs text-slate-500">Photo</span>') +
          "</div>" +
          '<input id="file" type="file" accept="image/jpeg,image/png,image/webp" class="hidden">' +
          '<div id="cameraBox" class="hidden mt-3"><video id="video" autoplay playsinline muted class="camera-video w-full rounded-xl bg-black" aria-label="Live camera preview"></video>' +
          '<button type="button" id="capture" class="w-full mt-2 rounded-xl bg-cyan-600 py-2 font-bold">Capture photo</button></div>' +
        "</div>" +
        '<label class="dialog-label">Full name<input id="personName" required maxlength="160" ' + (manager ? "" : "disabled") + ' value="' + esc(current.name) + '" placeholder="Full name" class="dialog-input"></label>' +
        '<label class="dialog-label">ID / employee number <span class="text-slate-500">(optional)</span><input id="personId" maxlength="80" ' + (manager ? "" : "disabled") + ' value="' + esc(current.identifier) + '" placeholder="Optional" class="dialog-input"></label>' +
        (manager
          ? '<button id="savePerson" type="submit" class="liquid w-full rounded-xl bg-violet-600 py-3 font-bold">' + (isEdit ? "Save changes" : "Save person") + "</button>"
          : '<p class="text-xs text-slate-500">You are viewing this person. Only owners and admins can edit people.</p>') +
      "</form>" +

      (isEdit
        ? '<div class="mt-5 border-t border-white/10 pt-4"><h3 class="text-xs font-bold uppercase tracking-wide text-slate-400">Recent attendance</h3>' +
          '<div id="historyBox" class="mt-2 text-sm text-slate-400">Loading history…</div></div>'
        : "") +
    "</div>"
  );

  document.getElementById("closeModal").onclick = closeModal;
  document.getElementById("personForm").onsubmit = (e) => {
    e.preventDefault();
    if (!manager) return;
    savePerson(ctx, person);
  };

  let photo = null; // { file, url } — new photo chosen in this modal
  let removedPhoto = false;

  if (manager) {
    document.getElementById("upload").onclick = () => document.getElementById("file").click();
    document.getElementById("file").onchange = (e) => {
      const file = e.target.files?.[0] || null;
      if (!file) return;
      const err = validatePhoto(file);
      if (err) { ctx.toast(err, "error"); e.target.value = ""; return; }
      photo = { file, url: URL.createObjectURL(file) };
      removedPhoto = false;
      swapPreview(photo.url);
      document.getElementById("removePhoto")?.classList.remove("hidden");
      document.getElementById("personName")?.dispatchEvent(new Event("input"));
    };
    document.getElementById("camera").onclick = async () => {
      await startCamera(ctx);
    };
    document.getElementById("capture").onclick = () => {
      const v = document.getElementById("video");
      const c = document.createElement("canvas");
      c.width = v.videoWidth || 640;
      c.height = v.videoHeight || 480;
      c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
      c.toBlob((blob) => {
        if (!blob) { ctx.toast("Camera capture failed. Try again.", "error"); return; }
        photo = { file: blob, url: URL.createObjectURL(blob) };
        removedPhoto = false;
        stopCamera();
        swapPreview(photo.url);
        document.getElementById("removePhoto")?.classList.remove("hidden");
      }, "image/jpeg", 0.86);
    };
    const rm = document.getElementById("removePhoto");
    if (rm) rm.onclick = () => {
      photo = null;
      removedPhoto = true;
      swapPreview(null);
      rm.classList.add("hidden");
    };
    // keep the initial letter avatar in sync while typing a new name
    const nameInput = document.getElementById("personName");
    nameInput.addEventListener("input", () => {
      if (!photo && !current.photo_url) swapPreview(null);
    });
  }

  function swapPreview(url) {
    const wrap = document.getElementById("photoPreviewWrap");
    if (!wrap) return;
    wrap.innerHTML = url
      ? '<img id="preview" alt="Photo preview" class="w-20 h-20 rounded-2xl object-cover" src="' + esc(url) + '">'
      : '<div class="avatar grid place-items-center text-violet-300 font-black w-20 h-20" aria-hidden="true">' + esc((document.getElementById("personName").value || "?").charAt(0).toUpperCase()) + "</div>";
  }

  async function savePerson(ctx2, existing) {
    const save = document.getElementById("savePerson");
    save.disabled = true;
    save.textContent = "Saving…";
    const name = document.getElementById("personName").value.trim();
    const identifier = document.getElementById("personId").value.trim();

    if (!name) { ctx.toast("Enter the person’s full name.", "error"); save.disabled = false; save.textContent = isEdit ? "Save changes" : "Save person"; return; }

    const requireIdentifier = Boolean(S.teamSettings?.require_identifier);
    const requirePhoto = Boolean(S.teamSettings?.require_photo);
    const currentPhotoExists = Boolean(existing?.photo_path);
    const resultingPhotoExists = Boolean(photo || (currentPhotoExists && !removedPhoto));

    if (requireIdentifier && !identifier) {
      ctx.toast("This team requires an identifier / employee number.", "error");
      save.disabled = false;
      save.textContent = isEdit ? "Save changes" : "Save person";
      return;
    }

    if (requirePhoto && !resultingPhotoExists) {
      ctx.toast("This team requires a photo for every person.", "error");
      save.disabled = false;
      save.textContent = isEdit ? "Save changes" : "Save person";
      return;
    }

    try {
      if (existing) {
        // upload new photo first, update DB, then delete the old file
        let newPhotoPath = existing.photo_path || null;
        let uploadedPath = null;
        if (photo) {
          uploadedPath = await api.uploadPhoto(S.team.id, photo.file);
        }
        const fields = { name, identifier: identifier || null };
        if (photo) { fields.photo_path = uploadedPath; newPhotoPath = uploadedPath; }
        else if (removedPhoto) { fields.photo_path = null; newPhotoPath = null; }
        try {
          await api.updatePerson(existing.id, S.team.id, fields);
        } catch (err) {
          if (uploadedPath) await api.removePhotos([uploadedPath]); // orphan cleanup
          throw err;
        }
        const oldPath = existing.photo_path;
        if (photo && oldPath) await api.removePhotos([oldPath]);
        if (removedPhoto && oldPath) await api.removePhotos([oldPath]);
        ctx.toast("Person updated in the database.", "success");
      } else {
        let photoPath = null;
        if (photo) photoPath = await api.uploadPhoto(S.team.id, photo.file);
        try {
          await api.createPerson(S.team.id, { name, identifier, photoPath });
        } catch (err) {
          if (photoPath) await api.removePhotos([photoPath]); // orphan cleanup
          throw err;
        }
        ctx.toast("Person saved to the shared database.", "success");
      }
      closeModal();
      await ctx.refresh();
    } catch (err) {
      ctx.toast(err.message || "Could not save the person.", "error");
      save.disabled = false;
      save.textContent = isEdit ? "Save changes" : "Save person";
    }
  }

  if (isEdit) {
    loadHistory(ctx, person);
  }
}

async function loadHistory(ctx, person) {
  const box = document.getElementById("historyBox");
  if (!box) return;
  try {
    const history = await api.loadPersonHistory(ctx.S.team.id, person.id);
    const present = history.filter((h) => h.status === "present").length;
    const absent = history.filter((h) => h.status === "absent").length;
    const marked = history.length;
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = v;
    };
    set("pPresent", String(present));
    set("pAbsent", String(absent));
    set("pRate", pct(present, marked));
    box.innerHTML = marked
      ? '<ul class="history-list">' + history.slice(0, 12).map((h) =>
          "<li><span class='hist-date'>" + esc(dateLabel(h.date)) + "</span>" +
          "<span class='hist-status " + esc(h.status) + "'>" + (h.status === "present" ? "✓ Present" : "✕ Absent") + "</span>" +
          '<span class="hist-by">by ' + esc(h.marked_by ? h.marked_by.slice(0, 8) : "team") + " · " + esc(timeLabel(h.marked_at)) + "</span></li>"
        ).join("") + "</ul>"
      : "<p>No attendance history yet for this person.</p>";
  } catch (err) {
    box.textContent = "Could not load history: " + (err.message || "database error");
  }
}

// ---------------- Camera ----------------

async function startCamera(ctx) {
  if (!navigator.mediaDevices?.getUserMedia) {
    ctx.toast("Camera access requires HTTPS or localhost.", "error");
    return;
  }

  stopCamera();

  const cameraBox = document.getElementById("cameraBox");
  const video = document.getElementById("video");
  if (!cameraBox || !video) {
    ctx.toast("Camera panel could not be opened. Please close and reopen the person dialog.", "error");
    return;
  }

  video.pause();
  video.srcObject = null;

  try {
    ctxCameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: cameraFacingMode },
        width: { ideal: 1280, min: 640 },
        height: { ideal: 720, min: 480 }
      },
      audio: false
    });

    video.srcObject = ctxCameraStream;
    cameraBox.classList.remove("hidden");
    video.classList.add("camera-live");

    // Some browsers attach the MediaStream successfully but do not start
    // rendering until metadata is available / play() is requested.
    await new Promise((resolve) => {
      if (video.readyState >= 2) {
        resolve();
        return;
      }
      const done = () => {
        video.removeEventListener("loadedmetadata", done);
        resolve();
      };
      video.addEventListener("loadedmetadata", done, { once: true });
      setTimeout(done, 1800);
    });

    try {
      await video.play();
    } catch {
      ctx.toast("Camera opened, but the browser blocked video playback. Click the preview and try again.", "error");
    }
  } catch (err) {
    const reason = err?.name === "NotAllowedError"
      ? "Camera permission was denied. Allow camera access in your browser, then try again."
      : err?.name === "NotFoundError"
        ? "No camera was found on this device."
        : "The camera could not be started. Check browser permissions and HTTPS.";
    ctx.toast(reason, "error");
  }
}

let ctxCameraStream = null;
let cameraFacingMode = "user";

export function stopCamera() {
  if (ctxCameraStream) {
    ctxCameraStream.getTracks().forEach((t) => t.stop());
    ctxCameraStream = null;
  }
  const video = document.getElementById("video");
  if (video) {
    video.pause();
    video.srcObject = null;
    video.classList.remove("camera-live");
  }
}

// ---------------- Date modal ----------------

export function dateModal(ctx) {
  openModal(
    '<div class="p-6" role="dialog" aria-modal="true" aria-labelledby="dateTitle">' +
      '<div class="flex justify-between items-start"><div><h2 id="dateTitle" class="text-xl font-black">Add attendance date</h2>' +
      '<p class="text-xs text-slate-500 mt-1">The date is saved to your team database.</p></div>' +
      '<button id="closeDate" class="text-2xl" aria-label="Close">×</button></div>' +
      '<label class="dialog-label mt-5">Date<input id="dateValue" type="date" value="' + today() + '" class="dialog-input"></label>' +
      '<div class="flex gap-2 mt-5"><button id="cancelDate" class="liquid rounded-xl bg-white/5 px-4 py-3 font-bold">Cancel</button>' +
      '<button id="saveDate" class="liquid rounded-xl bg-violet-600 px-4 py-3 font-bold ml-auto">Save date</button></div>' +
    "</div>"
  );
  document.getElementById("closeDate").onclick = closeModal;
  document.getElementById("cancelDate").onclick = closeModal;
  document.getElementById("saveDate").onclick = async (e) => {
    const btn = e.target;
    const d = document.getElementById("dateValue").value;
    if (!d) { ctx.toast("Choose a date first.", "error"); return; }
    btn.disabled = true;
    btn.textContent = "Saving…";
    try {
      await api.addDate(ctx.S.team.id, d);
      closeModal();
      await ctx.refresh();
      ctx.toast("Date added to the shared register.", "success");
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "Save date";
      ctx.toast(err.message || "Could not add the date.", "error");
    }
  };
}

// ---------------- Reports ----------------

export function reportsModal(ctx) {
  const { S } = ctx;
  const dates = S.dates.map((d) => d.date).sort();
  const from = dates[0] || today();
  const to = dates[dates.length - 1] || today();

  openModal(
    '<div class="p-6" role="dialog" aria-modal="true" aria-labelledby="reportsTitle">' +
      '<div class="flex justify-between items-start"><div><h2 id="reportsTitle" class="text-xl font-black">Attendance reports</h2>' +
      '<p class="text-xs text-slate-500 mt-1">Computed from your real PostgreSQL data.</p></div>' +
      '<button id="closeReports" class="text-2xl" aria-label="Close">×</button></div>' +
      '<div class="grid grid-cols-2 gap-3 mt-4">' +
        '<label class="dialog-label">From<input id="rangeFrom" type="date" value="' + esc(from) + '" class="dialog-input"></label>' +
        '<label class="dialog-label">To<input id="rangeTo" type="date" value="' + esc(to) + '" class="dialog-input"></label>' +
      "</div>" +
      '<div id="reportBody" class="mt-4 text-sm"></div>' +
      '<div class="flex flex-wrap gap-2 mt-5">' +
        '<button id="printReport" class="liquid rounded-xl bg-white/5 px-4 py-3 font-bold text-sm">Print report</button>' +
        '<button id="exportPeople" class="liquid rounded-xl bg-white/5 px-4 py-3 font-bold text-sm">Export people CSV</button>' +
        '<button id="exportDaily" class="liquid rounded-xl bg-violet-600 px-4 py-3 font-bold text-sm">Export daily CSV</button>' +
      "</div>" +
    "</div>"
  );
  document.getElementById("closeReports").onclick = closeModal;
  const render = () => renderReport(ctx);
  document.getElementById("rangeFrom").onchange = render;
  document.getElementById("rangeTo").onchange = render;
  document.getElementById("printReport").onclick = () => printReport(ctx, readRange());
  document.getElementById("exportPeople").onclick = () => exportPeopleCsv(ctx, readRange());
  document.getElementById("exportDaily").onclick = () => exportDailyCsv(ctx, readRange());
  render();
}

function readRange() {
  let from = document.getElementById("rangeFrom")?.value;
  let to = document.getElementById("rangeTo")?.value;
  if (from && to && from > to) [from, to] = [to, from];
  return { from, to };
}

function rangeData(ctx, { from, to }) {
  const { S } = ctx;
  const people = S.people.filter((p) => p.active);
  const dates = S.dates
    .map((d) => d.date)
    .filter((d) => (!from || d >= from) && (!to || d <= to))
    .sort();
  const perDate = dates.map((date) => {
    const present = people.filter((p) => S.marks.get(p.id + "|" + date) === "present").length;
    const absent = people.filter((p) => S.marks.get(p.id + "|" + date) === "absent").length;
    return { date, present, absent, unmarked: people.length - present - absent };
  });
  const perPerson = people.map((p) => {
    const present = dates.filter((d) => S.marks.get(p.id + "|" + d) === "present").length;
    const absent = dates.filter((d) => S.marks.get(p.id + "|" + d) === "absent").length;
    return { person: p, present, absent, unmarked: dates.length - present - absent, marked: present + absent };
  });
  const totalPresent = perDate.reduce((n, x) => n + x.present, 0);
  const totalAbsent = perDate.reduce((n, x) => n + x.absent, 0);
  return { dates, perDate, perPerson, totalPresent, totalAbsent, totalMarked: totalPresent + totalAbsent };
}

function renderReport(ctx) {
  const body = document.getElementById("reportBody");
  const range = readRange();
  const r = rangeData(ctx, range);
  body.innerHTML =
    '<div class="grid grid-cols-4 gap-2 mb-4">' +
      '<div class="rounded-xl bg-slate-950/60 p-3 text-center"><div class="text-[10px] text-slate-500 uppercase">Dates</div><div class="text-lg font-black">' + r.dates.length + "</div></div>" +
      '<div class="rounded-xl bg-slate-950/60 p-3 text-center"><div class="text-[10px] text-slate-500 uppercase">Present</div><div class="text-lg font-black text-green-300">' + r.totalPresent + "</div></div>" +
      '<div class="rounded-xl bg-slate-950/60 p-3 text-center"><div class="text-[10px] text-slate-500 uppercase">Absent</div><div class="text-lg font-black text-red-300">' + r.totalAbsent + "</div></div>" +
      '<div class="rounded-xl bg-slate-950/60 p-3 text-center"><div class="text-[10px] text-slate-500 uppercase">Rate</div><div class="text-lg font-black text-cyan-300">' + pct(r.totalPresent, r.totalMarked) + "</div></div>" +
    "</div>" +
    (r.dates.length === 0
      ? "<p class='text-slate-500'>No dates in this range.</p>"
      : '<div class="report-scroll overflow-auto max-h-[300px] border border-white/10 rounded-xl"><table class="w-full text-xs">' +
        "<thead><tr><th class='text-left px-3 py-2'>Person</th><th class='px-2'>ID</th><th class='px-2'>Present</th><th class='px-2'>Absent</th><th class='px-2'>Unmarked</th><th class='px-2'>Rate</th></tr></thead><tbody>" +
        r.perPerson.map((x) =>
          "<tr class='border-t border-white/5'><td class='px-3 py-2 font-bold'>" + esc(x.person.name) + "</td>" +
          "<td class='px-2 text-center text-slate-500'>" + esc(x.person.identifier || "–") + "</td>" +
          "<td class='px-2 text-center text-green-300'>" + x.present + "</td>" +
          "<td class='px-2 text-center text-red-300'>" + x.absent + "</td>" +
          "<td class='px-2 text-center text-slate-500'>" + x.unmarked + "</td>" +
          "<td class='px-2 text-center font-bold'>" + pct(x.present, x.marked) + "</td></tr>"
        ).join("") + "</tbody></table></div>");
}

function exportPeopleCsv(ctx, range) {
  const r = rangeData(ctx, range);
  const rows = [
    ["Name", "Identifier", "Dates in range", "Present", "Absent", "Unmarked", "Attendance rate %"],
    ...r.perPerson.map((x) => [
      x.person.name,
      x.person.identifier || "",
      r.dates.length,
      x.present,
      x.absent,
      x.unmarked,
      x.marked ? Math.round((x.present / x.marked) * 100) : 0
    ])
  ];
  downloadCsv("attendanceflow-people-" + (range.from || "all") + "-to-" + (range.to || "all") + ".csv", rows);
}

function exportDailyCsv(ctx, range) {
  const r = rangeData(ctx, range);
  const rows = [
    ["Date", "Active people", "Present", "Absent", "Unmarked", "Attendance rate %"],
    ...r.perDate.map((x) => [
      x.date,
      x.unmarked + x.present + x.absent,
      x.present,
      x.absent,
      x.unmarked,
      x.present + x.absent ? Math.round((x.present / (x.present + x.absent)) * 100) : 0
    ])
  ];
  downloadCsv("attendanceflow-daily-" + (range.from || "all") + "-to-" + (range.to || "all") + ".csv", rows);
}

function printReport(ctx, range) {
  const r = rangeData(ctx, range);
  const { S } = ctx;
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) { ctx.toast("Allow pop-ups to print the report.", "error"); return; }
  const personRows = r.perPerson.map((x) =>
    "<tr><td>" + esc(x.person.name) + "</td><td>" + esc(x.person.identifier || "") + "</td><td>" + x.present + "</td><td>" + x.absent + "</td><td>" + x.unmarked + "</td><td>" + pct(x.present, x.marked) + "</td></tr>"
  ).join("");
  const dateRows = r.perDate.map((x) =>
    "<tr><td>" + esc(dateLabel(x.date)) + "</td><td>" + x.present + "</td><td>" + x.absent + "</td><td>" + x.unmarked + "</td></tr>"
  ).join("");
  w.document.write(
    "<!doctype html><html><head><title>AttendanceFlow report — " + esc(S.team.name) + "</title>" +
    "<style>body{font-family:system-ui,Arial,sans-serif;color:#111;margin:32px}" +
    "h1{margin:0 0 4px}h2{margin-top:28px;border-bottom:1px solid #ccc;padding-bottom:4px}" +
    "table{border-collapse:collapse;width:100%;font-size:12px}td,th{border:1px solid #ccc;padding:6px 8px;text-align:left}" +
    "th{background:#f3f4f6}.muted{color:#666;font-size:12px}</style></head><body>" +
    "<h1>AttendanceFlow — " + esc(S.team.name) + "</h1>" +
    '<p class="muted">Range: ' + esc(range.from || "earliest") + " → " + esc(range.to || "latest") + " · Printed " + new Date().toLocaleString() + "</p>" +
    "<p>Total marked: " + r.totalMarked + " · Present: " + r.totalPresent + " · Absent: " + r.totalAbsent + " · Rate: " + pct(r.totalPresent, r.totalMarked) + "</p>" +
    "<h2>Per person</h2><table><tr><th>Name</th><th>Identifier</th><th>Present</th><th>Absent</th><th>Unmarked</th><th>Rate</th></tr>" + personRows + "</table>" +
    "<h2>Per date</h2><table><tr><th>Date</th><th>Present</th><th>Absent</th><th>Unmarked</th></tr>" + dateRows + "</table>" +
    "</body></html>"
  );
  w.document.close();
  w.focus();
  w.print();
}

// ---------------- Audit log ----------------

export async function auditModal(ctx) {
  openModal(
    '<div class="p-6" role="dialog" aria-modal="true" aria-labelledby="auditTitle">' +
      '<div class="flex justify-between items-start"><div><h2 id="auditTitle" class="text-xl font-black">Audit log</h2>' +
      '<p class="text-xs text-slate-500 mt-1">Latest 200 database events for your team.</p></div>' +
      '<button id="closeAudit" class="text-2xl" aria-label="Close">×</button></div>' +
      '<div id="auditBody" class="mt-4 text-sm">Loading…</div>' +
    "</div>"
  );
  document.getElementById("closeAudit").onclick = closeModal;
  const body = document.getElementById("auditBody");
  try {
    const events = await api.loadAudit(ctx.S.team.id);
    body.innerHTML = events.length
      ? '<div class="report-scroll overflow-auto max-h-[420px] border border-white/10 rounded-xl"><table class="w-full text-xs">' +
        "<thead><tr><th class='text-left px-3 py-2'>When</th><th class='px-2'>Action</th><th class='px-2'>Entity</th><th class='text-left px-2'>Actor</th><th class='text-left px-2'>Details</th></tr></thead><tbody>" +
        events.map((e) => {
          const d = e.details || {};
          const bits = [d.name, d.identifier, d.status, d.date, d.role].filter(Boolean).join(" · ");
          return "<tr class='border-t border-white/5'>" +
            "<td class='px-3 py-2 whitespace-nowrap text-slate-400'>" + esc(timeLabel(e.created_at)) + "</td>" +
            "<td class='px-2 text-center'>" + esc(e.action) + "</td>" +
            "<td class='px-2 text-center text-slate-400'>" + esc(e.entity) + "</td>" +
            "<td class='px-2 text-slate-400 font-mono'>" + esc(e.actor_user_id ? e.actor_user_id.slice(0, 8) : "system") + "</td>" +
            "<td class='px-2 text-slate-400 max-w-[220px] truncate' title='" + esc(bits) + "'>" + esc(bits || (e.entity_id ? String(e.entity_id).slice(0, 8) : "")) + "</td></tr>";
        }).join("") + "</tbody></table></div>"
      : "<p class='text-slate-500'>No audit events yet.</p>";
  } catch (err) {
    body.innerHTML = "<p class='text-red-300'>Could not load the audit log: " + esc(err.message) + "</p>";
  }
}


export async function teamSettingsModal(ctx) {
  const { S, canManage, toast } = ctx;
  const manager = canManage();
  let settings;
  try {
    settings = await api.getTeamSettings(S.team.id);
  } catch (err) {
    toast(err.message || "Could not load team settings.", "error");
    return;
  }

  openModal(
    '<div class="p-6" role="dialog" aria-modal="true" aria-labelledby="teamSettingsTitle">' +
      '<div class="flex justify-between items-start"><div><div class="register-kicker">WORKSPACE CONTROL</div><h2 id="teamSettingsTitle" class="text-xl font-black mt-1">Team settings</h2><p class="text-xs text-slate-500 mt-1">These settings belong only to <b>' + esc(S.team.name) + '</b>.</p></div><button id="closeTeamSettings" class="text-2xl" aria-label="Close">×</button></div>' +
      '<form id="teamSettingsForm" class="settings-form mt-5">' +
        '<div class="settings-grid">' +
          '<label>Timezone<select name="timezone" class="dialog-input"><option value="Africa/Kigali">Africa/Kigali</option><option value="UTC">UTC</option><option value="Africa/Nairobi">Africa/Nairobi</option><option value="Africa/Kampala">Africa/Kampala</option><option value="Europe/London">Europe/London</option><option value="America/New_York">America/New_York</option></select></label>' +
          '<label>Date format<select name="date_format" class="dialog-input"><option value="YYYY-MM-DD">YYYY-MM-DD</option><option value="DD/MM/YYYY">DD/MM/YYYY</option><option value="MM/DD/YYYY">MM/DD/YYYY</option></select></label>' +
          '<label>Week starts on<select name="week_starts_on" class="dialog-input"><option value="1">Monday</option><option value="0">Sunday</option></select></label>' +
          '<label>Access policy<div class="setting-toggle-row"><input id="allowMemberAttendance" name="allow_member_attendance" type="checkbox"><span>Members can mark attendance</span></div></label>' +
          '<label>Photo policy<div class="setting-toggle-row"><input id="requirePhoto" name="require_photo" type="checkbox"><span>Require a photo for new people</span></div></label>' +
          '<label>Identity policy<div class="setting-toggle-row"><input id="requireIdentifier" name="require_identifier" type="checkbox"><span>Require an ID / employee number</span></div></label>' +
        '</div>' +
        '<div class="admin-safety-note mt-4">These settings apply to this team only. They never change another team's register.</div>' +
        (manager ? '<button id="saveTeamSettings" class="liquid primary-cta mt-4" type="submit">Save team settings</button>' : '<p class="text-xs text-slate-500 mt-4">You can view these settings, but only an owner or admin can change them.</p>') +
        '<span id="teamSettingsMsg" class="settings-message"></span>' +
      '</form>' +
    '</div>'
  );

  const form = document.getElementById("teamSettingsForm");
  form.elements.namedItem("timezone").value = settings.timezone || "Africa/Kigali";
  form.elements.namedItem("date_format").value = settings.date_format || "YYYY-MM-DD";
  form.elements.namedItem("week_starts_on").value = String(settings.week_starts_on ?? 1);
  document.getElementById("allowMemberAttendance").checked = settings.allow_member_attendance !== false;
  document.getElementById("requirePhoto").checked = Boolean(settings.require_photo);
  document.getElementById("requireIdentifier").checked = Boolean(settings.require_identifier);

  document.getElementById("closeTeamSettings").onclick = closeModal;
  if (manager) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const btn = document.getElementById("saveTeamSettings");
      const msg = document.getElementById("teamSettingsMsg");
      btn.disabled = true;
      msg.textContent = "Saving…";
      try {
        const saved = await api.saveTeamSettings(S.team.id, {
          timezone: form.elements.namedItem("timezone").value,
          date_format: form.elements.namedItem("date_format").value,
          week_starts_on: Number(form.elements.namedItem("week_starts_on").value),
          allow_member_attendance: document.getElementById("allowMemberAttendance").checked,
          require_photo: document.getElementById("requirePhoto").checked,
          require_identifier: document.getElementById("requireIdentifier").checked
        });
        S.teamSettings = saved;
        msg.textContent = "Saved.";
        toast("Team settings saved.", "success");
        setTimeout(closeModal, 450);
      } catch (err) {
        msg.textContent = err.message || "Could not save settings.";
        toast(err.message || "Could not save settings.", "error");
      } finally {
        btn.disabled = false;
      }
    };
  }
}

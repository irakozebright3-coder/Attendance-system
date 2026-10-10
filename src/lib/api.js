// Every database/storage operation in one place. The rest of the app calls
// these helpers — no raw queries scattered across click handlers.
import { db } from "./supabase.js";
import { friendlyError, photoExt, today, isValidDate, validatePhoto } from "./util.js";

const BUCKET = "avatars";

function fail(err) {
  throw new Error(friendlyError(err));
}

// ---------- session / team ----------

export async function getSession() {
  const { data, error } = await db.auth.getSession();
  if (error) fail(error);
  return data.session;
}

export function onAuthChange(cb) {
  return db.auth.onAuthStateChange(cb);
}

export async function signIn(email, password) {
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) fail(error);
  return data;
}

export async function signUp(email, password, teamName) {
  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: { data: { team_name: teamName } }
  });
  if (error) fail(error);
  return data;
}

export async function signOut() {
  const { error } = await db.auth.signOut();
  if (error) fail(error);
}

// Find the caller's membership. Returns { team, role } or null.
export async function findMembership(userId) {
  const { data, error } = await db
    .from("team_members")
    .select("team_id,role,teams(id,name)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error) fail(error);
  if (!data || !data.teams) return null;
  return { team: data.teams, role: data.role || "member" };
}

export async function createTeam(name) {
  const { data, error } = await db.rpc("create_team", { p_name: name });
  if (error) fail(error);
  return data;
}

export async function joinTeam(code) {
  const { data, error } = await db.rpc("join_team", { p_code: code });
  if (error) fail(error);
  return data;
}

export async function getTeamSettings(teamId) {
  const { data, error } = await db
    .from("team_settings")
    .select("*")
    .eq("team_id", teamId)
    .maybeSingle();
  if (error) fail(error);
  if (data) return data;

  const { data: ensured, error: ensureError } = await db.rpc("ensure_team_settings", { p_team_id: teamId });
  if (ensureError) fail(ensureError);
  return ensured;
}

export async function saveTeamSettings(teamId, settings) {
  const { data, error } = await db.rpc("save_team_settings", {
    p_team_id: teamId,
    p_settings: settings
  });
  if (error) fail(error);
  return data;
}

// ---------- public/platform administration ----------

export async function loadPublicPlatformSettings() {
  const { data, error } = await db
    .from("platform_settings")
    .select("site_name,tagline,hero_kicker,hero_title,hero_subtitle,about_text,contact_email,contact_phone,contact_address,owner_name,owner_title,owner_email,owner_phone,support_hours,footer_note,copyright_start_year,registration_enabled")
    .eq("id", 1)
    .maybeSingle();
  if (error) fail(error);
  return data;
}

export async function loadPublicFaqs() {
  const { data, error } = await db
    .from("platform_faqs")
    .select("id,question,answer,sort_order,active")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) fail(error);
  return data || [];
}

export async function isPlatformAdmin() {
  const { data, error } = await db.rpc("is_platform_admin");
  if (error) fail(error);
  return Boolean(data);
}

export async function loadPlatformSettings() {
  const { data, error } = await db
    .from("platform_settings")
    .select("*")
    .eq("id", 1)
    .single();
  if (error) fail(error);
  return data;
}

export async function savePlatformSettings(settings) {
  const { data, error } = await db.rpc("platform_save_settings", { p_settings: settings });
  if (error) fail(error);
  return data;
}

export async function loadPlatformTeams() {
  const { data, error } = await db.rpc("platform_list_teams");
  if (error) fail(error);
  return data || [];
}

export async function loadPlatformUsers() {
  const { data, error } = await db.rpc("platform_list_users");
  if (error) fail(error);
  return data || [];
}

export async function loadPlatformTeamMembers(teamId) {
  const { data, error } = await db.rpc("platform_list_team_members", { p_team_id: teamId });
  if (error) fail(error);
  return data || [];
}

export async function createPlatformFaq({ question, answer, sort_order = 0, active = true }) {
  const { data, error } = await db
    .from("platform_faqs")
    .insert({ question, answer, sort_order, active })
    .select("id,question,answer,sort_order,active")
    .single();
  if (error) fail(error);
  return data;
}

export async function updatePlatformFaq(id, fields) {
  const { error } = await db.from("platform_faqs").update(fields).eq("id", id);
  if (error) fail(error);
}

export async function deletePlatformFaq(id) {
  const { error } = await db.from("platform_faqs").delete().eq("id", id);
  if (error) fail(error);
}

// ---------- bulk load ----------

export async function loadTeamData(teamId) {
  const [peopleRes, datesRes, attendanceRes] = await Promise.all([
    db.from("people").select("*").eq("team_id", teamId).order("name"),
    db.from("attendance_dates").select("*").eq("team_id", teamId).order("date"),
    db.from("attendance").select("person_id,date,status,marked_by,marked_at").eq("team_id", teamId)
  ]);
  const error = peopleRes.error || datesRes.error || attendanceRes.error;
  if (error) fail(error);
  return {
    people: peopleRes.data || [],
    dates: datesRes.data || [],
    attendance: attendanceRes.data || []
  };
}

// Attach short-lived signed URLs for private photos (batched).
export async function attachPhotoUrls(people) {
  const paths = people.filter((p) => p.photo_path).map((p) => p.photo_path);
  if (!paths.length) return people;

  const { data, error } = await db.storage.from(BUCKET).createSignedUrls(paths, 3600);
  if (error) {
    console.warn("Could not create signed photo URLs. Check the private avatars bucket and its team-folder SELECT policy.", error);
  }

  const normalizePath = (value) => String(value || "")
    .replace(/^\/+/, "")
    .replace(/^avatars\//, "");

  const lookup = new Map();
  (data || []).forEach((item, index) => {
    const path = normalizePath(item.path || paths[index]);
    const url = item.signedUrl || item.signedURL || null;
    if (path && url) lookup.set(path, url);
  });

  return people.map((person) => {
    if (!person.photo_path) return person;
    return {
      ...person,
      photo_url: lookup.get(normalizePath(person.photo_path)) || person.photo_url || null
    };
  });
}

// ---------- people ----------

export async function createPerson(teamId, { name, identifier, photoPath }) {
  const { data, error } = await db
    .from("people")
    .insert({ team_id: teamId, name, identifier: identifier || null, photo_path: photoPath || null })
    .select("id")
    .single();
  if (error) fail(error);
  return data;
}

export async function updatePerson(personId, teamId, fields) {
  const { error } = await db
    .from("people")
    .update(fields)
    .eq("id", personId)
    .eq("team_id", teamId);
  if (error) fail(error);
}

export async function deactivatePerson(personId, teamId) {
  await updatePerson(personId, teamId, { active: false });
}

export async function restorePerson(personId, teamId) {
  await updatePerson(personId, teamId, { active: true });
}

export async function permanentlyDeletePerson(personId, teamId) {
  const { data, error } = await db.rpc("delete_person_permanently", {
    p_person_id: personId,
    p_team_id: teamId
  });
  if (error) fail(error);

  let photoCleanupFailed = false;
  const photoPath = data?.photo_path || null;
  if (photoPath) {
    const { error: storageError } = await db.storage.from(BUCKET).remove([photoPath]);
    if (storageError) {
      // The database deletion is already committed; report storage cleanup
      // separately rather than claiming the person still exists.
      console.warn("Person deleted, but photo cleanup failed:", storageError);
      photoCleanupFailed = true;
    }
  }

  return {
    deleted: Boolean(data?.deleted),
    deletedAttendanceRecords: Number(data?.deleted_attendance_records || 0),
    photoCleanupFailed
  };
}

export async function loadPersonHistory(teamId, personId) {
  const { data, error } = await db
    .from("attendance")
    .select("date,status,marked_by,marked_at")
    .eq("team_id", teamId)
    .eq("person_id", personId)
    .order("date", { ascending: false })
    .limit(60);
  if (error) fail(error);
  return data || [];
}

// ---------- attendance dates ----------

export async function addDate(teamId, date) {
  if (!isValidDate(date)) throw new Error("Enter a valid date.");
  const { error } = await db.from("attendance_dates").insert({ team_id: teamId, date });
  if (error) fail(error);
}

export async function deleteDate(teamId, date) {
  if (!isValidDate(date)) throw new Error("Enter a valid date.");
  const { error } = await db.from("attendance_dates").delete().eq("team_id", teamId).eq("date", date);
  if (error) fail(error);
}

// ---------- attendance ----------

export async function markAttendance(teamId, personId, date, status, userId) {
  const { error } = await db
    .from("attendance")
    .upsert(
      { team_id: teamId, person_id: personId, date, status, marked_by: userId },
      { onConflict: "team_id,person_id,date" }
    );
  if (error) fail(error);
}

export async function clearAttendance(teamId, personId, date) {
  const { error } = await db
    .from("attendance")
    .delete()
    .eq("team_id", teamId)
    .eq("person_id", personId)
    .eq("date", date);
  if (error) fail(error);
}

// ---------- audit ----------

export async function loadAudit(teamId) {
  const { data, error } = await db
    .from("audit_events")
    .select("id,actor_user_id,action,entity,entity_id,details,created_at")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) fail(error);
  return data || [];
}

// ---------- storage ----------

export async function uploadPhoto(teamId, file) {
  if (!teamId) throw new Error("Select a team before uploading a photo.");
  if (!file || typeof file.size !== "number" || file.size <= 0) {
    throw new Error("The selected photo is empty. Capture or choose the photo again.");
  }

  const photoError = validatePhoto(file);
  if (photoError) throw new Error(photoError);

  const contentType = file.type || "image/jpeg";
  const extension = photoExt(contentType);
  const uniqueId = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
  const path = teamId + "/" + uniqueId + "." + extension;

  const { data, error } = await db.storage.from(BUCKET).upload(path, file, {
    contentType,
    cacheControl: "3600",
    upsert: false
  });

  if (error) fail(error);
  return data?.path || path;
}

export async function removePhotos(paths) {
  const list = (paths || []).filter(Boolean);
  if (!list.length) return;
  const { error } = await db.storage.from(BUCKET).remove(list);
  if (error) fail(error);
}

export { BUCKET, today };

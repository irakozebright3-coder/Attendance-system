// Every database/storage operation in one place. The rest of the app calls
// these helpers — no raw queries scattered across click handlers.
import { db } from "./supabase.js";
import { friendlyError, photoExt, today, isValidDate } from "./util.js";

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
  if (error || !data) return people; // photos stay hidden, data still renders
  const lookup = new Map(data.map((x) => [x.path, x.signedUrl || null]));
  return people.map((p) => ({ ...p, photo_url: p.photo_path ? lookup.get(p.photo_path) || null : null }));
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
  const ext = photoExt(file.type || "image/jpeg");
  const path = teamId + "/" + crypto.randomUUID() + "." + ext;
  const { error } = await db.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: false
  });
  if (error) fail(error);
  return path;
}

export async function removePhotos(paths) {
  const list = (paths || []).filter(Boolean);
  if (!list.length) return;
  await db.storage.from(BUCKET).remove(list);
}

export { BUCKET, today };

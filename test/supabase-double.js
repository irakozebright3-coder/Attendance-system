// TEST-ONLY Supabase client double (jsdom smoke tests). The shipped app always
// talks to the real @supabase/supabase-js client; this file exists so the
// dashboard UI logic can be exercised without a live project.
const uuid = () => crypto.randomUUID();

const TEAM = { id: "team-1", name: "Test Team", invite_code: "abc123", created_by: "u1" };

const db = {
  teams: [{ ...TEAM }],
  team_members: [{ team_id: "team-1", user_id: "u1", role: "owner" }],
  people: [
    { id: "p1", team_id: "team-1", name: "Alice", identifier: "EMP-001", photo_path: null, active: true, created_at: "2026-10-01T10:00:00Z" },
    { id: "p2", team_id: "team-1", name: "Bob", identifier: "EMP-002", photo_path: null, active: true, created_at: "2026-10-02T10:00:00Z" },
    { id: "p3", team_id: "team-1", name: "Carol", identifier: null, photo_path: null, active: false, created_at: "2026-10-03T10:00:00Z" }
  ],
  attendance_dates: [{ id: "d1", team_id: "team-1", date: new Date().toISOString().slice(0, 10), created_at: new Date().toISOString() }],
  attendance: [],
  saved_reports: [],
  attendance_history: (() => {
    const day = (offset) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + offset); return d.toISOString().slice(0, 10); };
    const at = (offset) => new Date(Date.now() + offset * 60000).toISOString();
    return [
      { id: 6, team_id: "team-1", person_id: "p1", person_name: "Alice", attendance_date: day(0), status: "present", action: "marked", marked_by: "u1", recorded_at: at(0) },
      { id: 5, team_id: "team-1", person_id: "p2", person_name: "Bob", attendance_date: day(0), status: "absent", action: "marked", marked_by: "u1", recorded_at: at(-1) },
      { id: 4, team_id: "team-1", person_id: "p1", person_name: "Alice", attendance_date: day(-1), status: "present", action: "marked", marked_by: "u1", recorded_at: at(-2) },
      { id: 3, team_id: "team-1", person_id: "p2", person_name: "Bob", attendance_date: day(-1), status: "present", action: "marked", marked_by: "u1", recorded_at: at(-3) },
      { id: 2, team_id: "team-1", person_id: "p1", person_name: "Alice", attendance_date: day(-1), status: "absent", action: "marked", marked_by: "u1", recorded_at: at(-10) },
      { id: 1, team_id: "team-1", person_id: "p1", person_name: "Alice", attendance_date: day(-2), status: "absent", action: "cleared", marked_by: "u1", recorded_at: at(-20) }
    ];
  })(),
  audit_events: [
    { id: 1, team_id: "team-1", actor_user_id: "u1", action: "INSERT", entity: "people", entity_id: "p1", details: { name: "Alice" }, created_at: "2026-10-05T09:00:00Z" }
  ]
};

function rowEq(rows, key, val) {
  return rows.filter((r) => String(r[key]) === String(val));
}

// supabase-js allows insert(...).select(...).single(); mirror that.
function insertResult(row, error = null) {
  const out = { data: row ? [row] : null, error };
  return {
    select() { return this; },
    single() { return Promise.resolve({ data: row || null, error }); },
    maybeSingle() { return Promise.resolve({ data: row || null, error }); },
    then(resolve, reject) { return Promise.resolve(out).then(resolve, reject); }
  };
}

function from(table) {
  const state = { table, conds: [], sortKey: null, sortAsc: true, limitN: null, op: null, payload: null, sel: "" };
  const res = {
    select(cols) { state.sel = cols || ""; return builder(); },
    insert(obj) { state.op = "insert"; state.payload = obj; return apply(); },
    update(fields) { state.op = "update"; state.payload = fields; return builder(); },
    delete() { state.op = "delete"; return builder(); },
    upsert(obj) { state.op = "upsert"; state.payload = obj; return apply(); }
  };
  function builder() {
    return {
      eq(k, v) { state.conds.push([k, v]); return builder(); },
      order(k, opts = {}) { state.sortKey = k; state.sortAsc = !opts.ascending; return builder(); },
      limit(n) { state.limitN = n; return builder(); },
      range(from, to) { state.rangeFrom = from; state.rangeTo = to; return builder(); },
      maybeSingle() { return run().then((x) => ({ ...x, data: x.data ? x.data[0] ?? null : null })); },
      single() { return run().then((x) => ({ ...x, data: x.data ? x.data[0] ?? null : null })); },
      then(resolve) { return run().then(resolve); }
    };
  }
  async function run() {
    let rows = db[table] ? db[table].map((r) => ({ ...r })) : [];
    for (const [k, v] of state.conds) rows = rowEq(rows, k, v);
    if (state.op === "update") {
      const targets = db[table].filter((r) => state.conds.every(([k, v]) => String(r[k]) === String(v)));
      targets.forEach((r) => Object.assign(r, state.payload));
      return { data: null, error: null };
    }
    if (state.op === "delete") {
      const n = db[table].length;
      db[table] = db[table].filter((r) => !state.conds.every(([k, v]) => String(r[k]) === String(v)));
      // mirror the database trigger: deleting a date removes its attendance marks
      if (table === "attendance_dates") {
        const target = state.conds.find(([k]) => k === "date");
        if (target) db.attendance = db.attendance.filter((r) => String(r.date) !== String(target[1]));
      }
      return { data: null, error: null, count: n - db[table].length };
    }
    // select with "teams(...)" join
    if (state.sel.includes("teams(")) {
      rows = rows.map((r) => ({
        ...r,
        teams: db.teams.find((t) => t.id === r.team_id) || null
      }));
    }
    if (state.sortKey) {
      rows.sort((a, b) =>
        state.sortAsc ? String(a[state.sortKey]).localeCompare(String(b[state.sortKey]))
          : String(b[state.sortKey]).localeCompare(String(a[state.sortKey]))
      );
    }
    if (typeof state.rangeFrom === "number") rows = rows.slice(state.rangeFrom, state.rangeTo + 1);
    if (state.limitN) rows = rows.slice(0, state.limitN);
    return { data: rows, error: null };
  }
  function apply() {
    if (state.op === "insert") {
      const p = Array.isArray(state.payload) ? state.payload[0] : state.payload;
      if (table === "people" && db.people.some((r) => r.team_id === p.team_id && r.identifier && r.identifier === p.identifier)) {
        return insertResult(null, { message: 'duplicate key value violates unique constraint "people_team_identifier_unique"' });
      }
      if (table === "attendance_dates" && db.attendance_dates.some((r) => r.team_id === p.team_id && r.date === p.date)) {
        return insertResult(null, { message: 'duplicate key value violates unique constraint "attendance_dates_team_id_date_key"' });
      }
      // mirror PostgreSQL column defaults the app relies on
      const defaults = table === "people" ? { active: true } : table === "saved_reports" ? { saved_at: new Date().toISOString() } : {};
      const row = { id: uuid(), created_at: new Date().toISOString(), ...defaults, ...p };
      db[table].push(row);
      if (table === "attendance") {
        db.attendance = db.attendance.filter(
          (r) => !(r.team_id === p.team_id && r.person_id === p.person_id && r.date === p.date)
        );
        db.attendance.push(row);
      }
      return insertResult(row);
    }
    if (state.op === "upsert") {
      const p = state.payload;
      db.attendance = db.attendance.filter(
        (r) => !(r.team_id === p.team_id && r.person_id === p.person_id && r.date === p.date)
      );
      db.attendance.push({ id: uuid(), marked_at: new Date().toISOString(), ...p });
      return Promise.resolve({ data: null, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  }
  // async query interface used with await directly
  res.then = undefined;
  return {
    ...res,
    then(resolve, reject) { builder().then(resolve, reject); }
  };
}

const authState = { session: { user: { id: "u1", email: "owner@test.dev", user_metadata: { team_name: "Test Team" } } } };

let authListener = null;

// Knobs used by test/platform-delete.test.mjs to simulate deployment states.
export const platformDeleteControl = {
  rpcAvailable: true,
  deleted: [],
  functionCalls: 0,
  functionOutcome: "ok" // "ok" | "fetchError" | "httpError"
};

export function createClient(url, key) {
  // test-only: let the smoke test assert on what actually reached the database
  if (typeof window !== "undefined") window.__afDb = db;
  return {
    auth: {
      getSession: () => Promise.resolve({ data: { session: authState.session }, error: null }),
      onAuthStateChange(cb) { authListener = cb; return { data: { subscription: { unsubscribe() {} } } }; },
      signInWithPassword: () => Promise.resolve({ data: { session: authState.session }, error: null }),
      signUp: ({ options }) => {
        authState.session.user.user_metadata.team_name = options?.data?.team_name;
        return Promise.resolve({ data: { session: authState.session }, error: null });
      },
      signOut: () => {
        if (authListener) setTimeout(() => authListener("SIGNED_OUT", null), 0);
        return Promise.resolve({ error: null });
      }
    },
    rpc(name, args) {
      if (name === "create_team") {
        const t = { id: uuid(), name: args.p_name, invite_code: "newcode", created_by: "u1" };
        db.teams.push(t);
        db.team_members.push({ team_id: t.id, user_id: "u1", role: "owner" });
        return Promise.resolve({ data: t, error: null });
      }
      if (name === "join_team") {
        const t = db.teams.find((x) => x.invite_code === args.p_code);
        if (!t) return Promise.resolve({ data: null, error: { message: "Invite code not recognized" } });
        return Promise.resolve({ data: t, error: null });
      }
      if (name === "is_platform_admin") {
        return Promise.resolve({ data: false, error: null });
      }
      if (name === "ensure_team_settings") {
        const existing = (db.team_settings || []).find((t) => t.team_id === args.p_team_id);
        if (existing) return Promise.resolve({ data: existing, error: null });
        const row = {
          team_id: args.p_team_id,
          timezone: "Africa/Kigali",
          date_format: "YYYY-MM-DD",
          week_starts_on: 1,
          allow_member_attendance: true,
          require_photo: false,
          require_identifier: false
        };
        db.team_settings = db.team_settings || [];
        db.team_settings.push(row);
        return Promise.resolve({ data: row, error: null });
      }
      if (name === "delete_attendance_date") {
        db.attendance = (db.attendance || []).filter((r) => !(r.team_id === args.p_team_id && String(r.date) === String(args.p_date)));
        db.attendance_dates = (db.attendance_dates || []).filter((r) => !(r.team_id === args.p_team_id && String(r.date) === String(args.p_date)));
        db.attendance_history = (db.attendance_history || []).filter((r) => !(r.team_id === args.p_team_id && String(r.attendance_date) === String(args.p_date)));
        return Promise.resolve({ data: { ok: true, date: args.p_date }, error: null });
      }
      if (name === "platform_delete_user") {
        if (!platformDeleteControl.rpcAvailable) {
          return Promise.resolve({ data: null, error: { code: "PGRST202", message: "Could not find the function public.platform_delete_user(p_user_id) in the schema cache" } });
        }
        platformDeleteControl.deleted.push(args.p_user_id);
        return Promise.resolve({ data: { ok: true, deletedUserId: args.p_user_id }, error: null });
      }
      return Promise.resolve({ data: null, error: { message: "unknown rpc" } });
    },
    functions: {
      invoke() {
        platformDeleteControl.functionCalls += 1;
        if (platformDeleteControl.functionOutcome === "fetchError") {
          const err = new Error("Failed to send a request to the Edge Function");
          err.name = "FunctionsFetchError";
          return Promise.resolve({ data: null, error: err });
        }
        platformDeleteControl.deleted.push("via-function");
        return Promise.resolve({ data: { ok: true }, error: null });
      }
    },
    from,
    storage: {
      from() {
        return {
          upload: (path) => Promise.resolve({ data: { path }, error: null }),
          remove: () => Promise.resolve({ data: null, error: null }),
          createSignedUrls: (paths) => Promise.resolve({ data: paths.map((p) => ({ path: p, signedUrl: "https://signed.test/" + p })), error: null })
        };
      }
    },
    channel(name) {
      const ch = { handlers: [], name, on(_evt, filter, cb) { this.handlers.push({ filter, cb }); return this; }, subscribe(cb) { setTimeout(() => cb?.("SUBSCRIBED"), 0); return this; } };
      return ch;
    },
    removeChannel() { return Promise.resolve(); },
    __db: db,
    __emit(event, payload) { this.handlers?.forEach(() => {}); }
  };
}

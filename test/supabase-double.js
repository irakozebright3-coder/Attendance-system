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
  attendance_dates: [{ id: "d1", team_id: "team-1", date: "2026-10-05", created_at: "2026-10-05T08:00:00Z" }],
  attendance: [],
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
      const defaults = table === "people" ? { active: true } : {};
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

export function createClient(url, key) {
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
      return Promise.resolve({ data: null, error: { message: "unknown rpc" } });
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

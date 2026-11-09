// Tests for deletePlatformUser: database function first, Edge Function fallback.
// Run: node test/platform-delete.test.mjs   (bundled with the Supabase double)
import assert from "node:assert";

const { deletePlatformUser, platformDeleteControl } = await import("../dist-test/platform-api.mjs");

let passed = 0;
let failed = 0;

function check(name, ok, note = "") {
  if (ok) {
    passed += 1;
    console.log("PASS:", name);
  } else {
    failed += 1;
    console.log("FAIL:", name, "—", note);
  }
}

// 1. RPC path: succeeds and never touches the Edge Function.
platformDeleteControl.rpcAvailable = true;
platformDeleteControl.functionCalls = 0;
platformDeleteControl.deleted.length = 0;
let result = await deletePlatformUser("user-a");
check("database deletion succeeds", result?.ok === true);
check("database deletion used RPC", platformDeleteControl.deleted[0] === "user-a");
check("no Edge Function call when RPC works", platformDeleteControl.functionCalls === 0);

// 2. Missing RPC: falls back to the Edge Function.
platformDeleteControl.rpcAvailable = false;
platformDeleteControl.functionCalls = 0;
platformDeleteControl.functionOutcome = "ok";
result = await deletePlatformUser("user-b");
check("falls back to Edge Function when SQL is older", result?.ok === true && platformDeleteControl.functionCalls === 1);

// 3. Function unreachable: actionable error message.
platformDeleteControl.functionOutcome = "fetchError";
let message = "";
try {
  await deletePlatformUser("user-c");
} catch (err) {
  message = err.message;
}
check("unreachable function explains the fix", /schema\.sql|FINAL_SETUP\.sql|deploy/i.test(message), message);

// 4. Missing user id is rejected before any call.
let rejected = false;
try {
  await deletePlatformUser("");
} catch {
  rejected = true;
}
check("empty user id rejected", rejected);

console.log(failed ? `\nPLATFORM DELETE TEST: ${failed} FAILURES` : `\nPLATFORM DELETE TEST: ALL PASSED (${passed})`);
process.exit(failed ? 1 : 0);

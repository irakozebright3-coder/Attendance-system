// Bundle entry: api functions + the double's control knobs share one module instance.
export { deletePlatformUser } from "../src/lib/api.js";
export { platformDeleteControl } from "./supabase-double.js";

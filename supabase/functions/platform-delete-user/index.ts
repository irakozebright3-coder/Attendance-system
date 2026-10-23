// Secure platform-owner account deletion for AttendanceFlow.
// Deploy this as Supabase Edge Function: platform-delete-user.
// The service/secret key is used only server-side and must never be placed in Vite.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8"
};

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return reply(405, { error: "Use POST for this operation." });

  try {
    const authorization = request.headers.get("Authorization") || "";
    const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!bearer) return reply(401, { error: "Please sign in before deleting an account." });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const publicKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const secretKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY");
    if (!supabaseUrl || !publicKey || !secretKey) {
      console.error("Account deletion function is missing server environment configuration.");
      return reply(500, { error: "Account deletion is not configured yet. Ask the platform owner to configure the Supabase Edge Function secrets." });
    }

    // Use the caller's JWT to check identity and the existing platform-admin policy.
    const callerClient = createClient(supabaseUrl, publicKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: "Bearer " + bearer } }
    });
    const { data: callerData, error: callerError } = await callerClient.auth.getUser(bearer);
    if (callerError || !callerData?.user) {
      return reply(401, { error: "Your login session is invalid or expired. Sign in again." });
    }

    const { data: isPlatformAdmin, error: roleError } = await callerClient.rpc("is_platform_admin");
    if (roleError) {
      console.error("Platform admin authorization check failed.");
      return reply(500, { error: "Could not verify platform-owner permissions. No account was deleted." });
    }
    if (isPlatformAdmin !== true) {
      return reply(403, { error: "Only the platform owner can delete web accounts." });
    }

    const payload = await request.json().catch(() => null);
    const targetUserId = typeof payload?.userId === "string" ? payload.userId.trim() : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetUserId)) {
      return reply(400, { error: "A valid user account ID is required." });
    }
    if (targetUserId === callerData.user.id) {
      return reply(400, { error: "You cannot delete the account you are currently using." });
    }

    // Admin Auth calls require this secret client. It never leaves the function.
    const adminClient = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: targetResult, error: targetError } = await adminClient.auth.admin.getUserById(targetUserId);
    if (targetError || !targetResult?.user) {
      return reply(404, { error: "That user account was not found. Refresh the user list and try again." });
    }
    const targetUser = targetResult.user;

    // Never allow a platform administrator to remove another platform administrator
    // through the regular-user deletion control.
    const { data: adminRecord, error: adminCheckError } = await adminClient
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", targetUserId)
      .maybeSingle();
    if (adminCheckError) {
      console.error("Could not check target account's platform-admin role.");
      return reply(500, { error: "Could not verify the selected account's role. No account was deleted." });
    }
    if (adminRecord) {
      return reply(409, { error: "Platform administrator accounts are protected from this delete action." });
    }

    // Teams created by or owned by this user depend on their account. Refuse deletion
    // rather than orphaning a workspace or destroying other people's team data.
    const { data: ownedMemberships, error: ownerCheckError } = await adminClient
      .from("team_members")
      .select("team_id")
      .eq("user_id", targetUserId)
      .eq("role", "owner")
      .limit(1);
    if (ownerCheckError) {
      console.error("Could not check selected user's team ownership.");
      return reply(500, { error: "Could not check team ownership. No account was deleted." });
    }

    const { data: createdTeams, error: createdTeamError } = await adminClient
      .from("teams")
      .select("id")
      .eq("created_by", targetUserId)
      .limit(1);
    if (createdTeamError) {
      console.error("Could not check selected user's created workspaces.");
      return reply(500, { error: "Could not check workspace dependencies. No account was deleted." });
    }
    if ((ownedMemberships || []).length || (createdTeams || []).length) {
      return reply(409, {
        error: "This account owns or created a team workspace. Transfer ownership or remove that workspace first; no account or team data was deleted."
      });
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetUserId, false);
    if (deleteError) {
      console.error("Supabase Auth account deletion failed.");
      return reply(500, { error: "Supabase could not delete this account. No success was reported; check the Supabase Auth logs." });
    }

    // Audit is best-effort: an audit-write issue must not turn a successful delete into a false failure.
    const { error: auditError } = await adminClient.from("audit_events").insert({
      team_id: null,
      actor_user_id: callerData.user.id,
      action: "platform_user_deleted",
      entity: "auth_user",
      entity_id: targetUserId,
      details: { target_email: targetUser.email || "", operation: "permanent_auth_delete" }
    });
    if (auditError) console.warn("The account was deleted, but its optional audit event could not be written.");

    return reply(200, {
      ok: true,
      deletedUserId: targetUserId,
      email: targetUser.email || ""
    });
  } catch (error) {
    console.error("Unexpected platform account deletion failure.");
    return reply(500, { error: "Unexpected account-deletion error. No success was reported." });
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization")!;

    // Verify caller with their own JWT (not service role)
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin client for privileged ops
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Confirm caller is admin
    const { data: roles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin");

    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, ...params } = await req.json();
    let result: any;

    switch (action) {
      case "deactivate_student": {
        const { user_id, deactivate } = params;
        if (!user_id) throw new Error("user_id required");
        await adminClient.from("profiles").update({ is_active: !deactivate }).eq("user_id", user_id);
        if (deactivate) {
          // Ban for ~100 years and kill active session
          await adminClient.auth.admin.updateUserById(user_id, { ban_duration: "876000h" });
          await adminClient.from("active_sessions").delete().eq("user_id", user_id);
        } else {
          await adminClient.auth.admin.updateUserById(user_id, { ban_duration: "none" });
        }
        result = { success: true };
        break;
      }

      case "update_class": {
        const { user_id, class_level, enrollment_status } = params;
        if (!user_id || !class_level) throw new Error("user_id and class_level required");
        const update: any = { class_level, updated_at: new Date().toISOString() };
        if (enrollment_status) update.enrollment_status = enrollment_status;
        await adminClient.from("profiles").update(update).eq("user_id", user_id);
        result = { success: true };
        break;
      }

      case "remove_from_class": {
        const { user_id } = params;
        if (!user_id) throw new Error("user_id required");
        await adminClient.from("profiles").update({
          enrollment_status: "removed",
          updated_at: new Date().toISOString(),
        }).eq("user_id", user_id);
        // Force logout so removed student can't stay on dashboard
        await adminClient.auth.admin.signOut(user_id, "global");
        await adminClient.from("active_sessions").delete().eq("user_id", user_id);
        result = { success: true };
        break;
      }

      case "reset_password": {
        const { user_id, new_password } = params;
        if (!user_id || !new_password) throw new Error("user_id and new_password required");
        if (new_password.length < 6) throw new Error("Password must be at least 6 characters");
        const { error } = await adminClient.auth.admin.updateUserById(user_id, {
          password: new_password,
        });
        if (error) throw error;
        result = { success: true };
        break;
      }

      case "force_logout": {
        const { user_id } = params;
        if (!user_id) throw new Error("user_id required");
        await adminClient.auth.admin.signOut(user_id, "global");
        await adminClient.from("active_sessions").delete().eq("user_id", user_id);
        result = { success: true };
        break;
      }

      case "delete_user": {
        const { user_id } = params;
        if (!user_id) throw new Error("user_id required");
        // Kill session first
        await adminClient.auth.admin.signOut(user_id, "global");
        await adminClient.from("active_sessions").delete().eq("user_id", user_id);
        // Delete profile (cascade will clean up progress, badges, etc. if FK set up)
        await adminClient.from("profiles").delete().eq("user_id", user_id);
        // Delete auth user last
        const { error } = await adminClient.auth.admin.deleteUser(user_id);
        if (error) throw error;
        result = { success: true };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("admin-actions error:", error);
    return new Response(JSON.stringify({ error: error.message ?? "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

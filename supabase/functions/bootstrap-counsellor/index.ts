// One-time bootstrap to create the fixed counsellor (setter) account.
// Idempotent: returns success if the user already exists.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COUNSELLOR_EMAIL = "counsellor@lightacademy.ac.ug";
const COUNSELLOR_PASSWORD = "counsellor2026";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Check if user already exists by listing
    const { data: existing } = await admin.auth.admin.listUsers();
    const found = existing?.users?.find((u) => u.email?.toLowerCase() === COUNSELLOR_EMAIL);

    const ensureProfile = async (uid: string) => {
      // Check if a profile row exists; if not, insert one with the setter role.
      const { data: existingProfile } = await admin
        .from("profiles")
        .select("id, role")
        .eq("user_id", uid)
        .maybeSingle();
      if (!existingProfile) {
        await admin.from("profiles").insert({
          user_id: uid,
          role: "setter",
          full_name: "School Counsellor",
        });
      } else if (existingProfile.role !== "setter") {
        await admin.from("profiles").update({ role: "setter" }).eq("user_id", uid);
      }
    };

    if (found) {
      await ensureProfile(found.id);
      return new Response(JSON.stringify({ ok: true, created: false, user_id: found.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await admin.auth.admin.createUser({
      email: COUNSELLOR_EMAIL,
      password: COUNSELLOR_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "School Counsellor", role: "setter" },
    });
    if (error) throw error;

    // Ensure profile is set with setter role (the trigger normally handles it,
    // but we re-check here so this function always returns with a usable setter).
    if (data.user) {
      await ensureProfile(data.user.id);
    }

    return new Response(JSON.stringify({ ok: true, created: true, user_id: data.user?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("bootstrap-counsellor error", e);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

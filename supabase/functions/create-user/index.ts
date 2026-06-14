import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify the user making the request is an admin or manager
    const authHeader = req.headers.get("Authorization")!;
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: userResponse, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (userError || !userResponse.user) {
      throw new Error("Unauthorized: " + (userError?.message || "Invalid token"));
    }

    const { data: callerRoles, error: rolesError } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userResponse.user.id);

    const isAuthorized = callerRoles?.some(
      (r) => r.role === "super_admin" || r.role === "manager"
    );

    if (!isAuthorized) {
      throw new Error("Forbidden: You do not have permission to create users");
    }

    // Now initialize the admin client to bypass RLS and create the user
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { email, password, fullName, phone, role } = await req.json();

    if (!email || !password || !fullName || !role) {
      throw new Error("Missing required fields");
    }

    console.log("Creating user:", email, role);

    // 1. Create the user in auth.users
    const { data: authData, error: authCreateError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm since an admin creates it
      user_metadata: { full_name: fullName },
    });

    if (authCreateError) throw authCreateError;
    const newUserId = authData.user.id;

    // 2. Insert into profiles (Handling case where trigger might have already created it)
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      user_id: newUserId,
      full_name: fullName,
      email: email,
      phone: phone || null,
    });

    if (profileError) {
      console.warn("Profile creation/upsert error:", profileError);
    }

    // 3. Assign the role in user_roles
    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
      user_id: newUserId,
      role: role,
    });

    if (roleError) throw roleError;

    return new Response(JSON.stringify({ user: authData.user }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error creating user:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

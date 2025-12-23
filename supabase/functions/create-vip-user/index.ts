import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Strict CORS validation - only allow trusted origins
const getAllowedOrigin = (requestOrigin: string | null): string => {
  if (!requestOrigin) {
    return "https://rbqafiykevtbgztczizr.lovableproject.com";
  }
  
  const allowedPatterns = [
    /^https:\/\/rbqafiykevtbgztczizr\.lovableproject\.com$/,
    /^https:\/\/gmbinarypro\.lovable\.app$/,
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/,
  ];
  
  for (const pattern of allowedPatterns) {
    if (pattern.test(requestOrigin)) {
      return requestOrigin;
    }
  }
  
  console.log("Rejected origin:", requestOrigin);
  return "https://rbqafiykevtbgztczizr.lovableproject.com";
};

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = {
    "Access-Control-Allow-Origin": getAllowedOrigin(origin),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // ========== AUTHENTICATION CHECK ==========
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "Unauthorized - No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's auth token to verify identity
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      console.error("Authentication failed:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized - Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== ADMIN AUTHORIZATION CHECK ==========
    // Create admin client for role check
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Check if user has admin role using the has_role function
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError) {
      console.error("Error checking admin role:", roleError);
      return new Response(
        JSON.stringify({ error: "Failed to verify admin status" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!roleData) {
      console.error("User is not an admin:", user.id);
      return new Response(
        JSON.stringify({ error: "Forbidden - Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Admin authorization verified for user:", user.id);

    // ========== PROCESS VIP CREATION ==========
    const { email, paymentRequestId } = await req.json();

    if (!email || !paymentRequestId) {
      return new Response(
        JSON.stringify({ error: "Email and payment request ID are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate paymentRequestId is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(paymentRequestId)) {
      return new Response(
        JSON.stringify({ error: "Invalid payment request ID format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify payment request exists and is pending
    const { data: paymentRequest, error: prError } = await supabaseAdmin
      .from("payment_requests")
      .select("id, status, email")
      .eq("id", paymentRequestId)
      .maybeSingle();

    if (prError || !paymentRequest) {
      console.error("Payment request not found:", prError);
      return new Response(
        JSON.stringify({ error: "Payment request not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (paymentRequest.status !== "pending") {
      return new Response(
        JSON.stringify({ error: "Payment request already processed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate a random password
    const password = generatePassword();

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    let userId: string;

    if (existingUser) {
      // User exists, just use their ID
      userId = existingUser.id;
      
      // Update their password
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: password,
      });

      if (updateError) {
        console.error("Error updating user password:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update user password" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.log("Updated existing user password:", userId);
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (createError) {
        console.error("Error creating user:", createError);
        return new Response(
          JSON.stringify({ error: "Failed to create user: " + createError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userId = newUser.user.id;
      console.log("Created new user:", userId);
    }

    // Calculate expiration date (30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Create/update subscription
    const { error: subError } = await supabaseAdmin
      .from("subscriptions")
      .upsert({
        user_id: userId,
        tier: "vip",
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id",
      });

    if (subError) {
      console.error("Error creating subscription:", subError);
      return new Response(
        JSON.stringify({ error: "Failed to create subscription" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update payment request with user_id, status, reviewed_by, and generated password
    const { error: paymentError } = await supabaseAdmin
      .from("payment_requests")
      .update({
        user_id: userId,
        status: "approved",
        reviewed_by: user.id, // Track which admin approved
        reviewed_at: new Date().toISOString(),
        generated_password: password,
      })
      .eq("id", paymentRequestId);

    if (paymentError) {
      console.error("Error updating payment request:", paymentError);
    }

    console.log("VIP creation successful for:", email, "by admin:", user.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        email,
        password,
        userId,
        expiresAt: expiresAt.toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  let password = "";
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

import { NextResponse } from "next/server";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  createAdminClient,
  isPlaceholderEmail,
} from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "staff_admin"].includes(profile.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { user, profile };
}

function getSiteUrl(request: Request) {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl && envUrl.length > 0) return envUrl.replace(/\/$/, "");
  const origin = request.headers.get("origin");
  if (origin) return origin.replace(/\/$/, "");
  return "";
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const body = await request.json();
    const userId = String(body.user_id || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const sendResetLink = body.send_reset_link !== false;

    if (!userId) {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 });
    }

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    }

    if (isPlaceholderEmail(email)) {
      return NextResponse.json(
        { error: "Cannot set another placeholder email" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data: profile, error: profileLookupError } = await admin
      .from("profiles")
      .select("id, email, email_is_placeholder, role, gdpr_erased_at")
      .eq("id", userId)
      .single();

    if (profileLookupError || !profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (profile.gdpr_erased_at) {
      return NextResponse.json({ error: "User has been erased" }, { status: 400 });
    }

    if (!profile.email_is_placeholder && !isPlaceholderEmail(profile.email || "")) {
      return NextResponse.json(
        {
          error:
            "This account already has a real email. Change it in Supabase Auth if needed.",
        },
        { status: 400 }
      );
    }

    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .neq("id", userId)
      .is("gdpr_erased_at", null)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Another user already uses this email" },
        { status: 400 }
      );
    }

    const { error: authUpdateError } = await admin.auth.admin.updateUserById(userId, {
      email,
      email_confirm: true,
    });

    if (authUpdateError) {
      const msg = authUpdateError.message || "";
      if (/already|registered|exists/i.test(msg)) {
        return NextResponse.json(
          { error: "This email is already registered in Auth" },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { error: profileUpdateError } = await admin
      .from("profiles")
      .update({
        email,
        email_is_placeholder: false,
      })
      .eq("id", userId);

    if (profileUpdateError) {
      return NextResponse.json(
        {
          error:
            "Auth email updated, but profile update failed: " +
            profileUpdateError.message,
        },
        { status: 500 }
      );
    }

    let resetSent = false;
    let resetError: string | null = null;

    if (sendResetLink) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const siteUrl = getSiteUrl(request);

      if (url && anonKey && siteUrl) {
        const anon = createSupabaseJsClient(url, anonKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const { error } = await anon.auth.resetPasswordForEmail(email, {
          redirectTo: `${siteUrl}/reset-password`,
        });
        if (error) {
          resetError = error.message;
        } else {
          resetSent = true;
        }
      } else {
        resetError = "Missing site URL or anon key — could not send reset email";
      }
    }

    return NextResponse.json({
      success: true,
      email,
      reset_sent: resetSent,
      reset_error: resetError,
      message: resetSent
        ? `Email set to ${email}. Password reset link sent — client can set their password from the email.`
        : resetError
          ? `Email set to ${email}, but reset link failed: ${resetError}. Ask the client to use Forgot password on the login page.`
          : `Email set to ${email}. Ask the client to use Forgot password on the login page.`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

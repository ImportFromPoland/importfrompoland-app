import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildPlaceholderEmail,
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
    .select("role, offer_prefix")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "staff_admin"].includes(profile.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { user, profile };
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const body = await request.json();
    const fullName = String(body.full_name || "").trim();
    const phone = String(body.phone || "").trim();
    let email = String(body.email || "").trim().toLowerCase();
    const companyName = String(body.company_name || "").trim();

    if (!fullName) {
      return NextResponse.json({ error: "full_name is required" }, { status: 400 });
    }

    if (!email && !phone) {
      return NextResponse.json(
        { error: "email or phone is required" },
        { status: 400 }
      );
    }

    const emailIsPlaceholder = !email;
    if (emailIsPlaceholder) {
      email = buildPlaceholderEmail(phone);
    }

    const admin = createAdminClient();

    const { data: existingAuth, error: lookupError } =
      await admin.auth.admin.getUserByEmail(email);
    if (lookupError) {
      const notFound =
        lookupError.status === 404 ||
        /not found/i.test(lookupError.message || "");
      if (!notFound) {
        return NextResponse.json({ error: lookupError.message }, { status: 400 });
      }
    }
    if (existingAuth?.user) {
      return NextResponse.json(
        {
          error:
            "A user with this email already exists. They can sign in via Forgot password, or find them in the user list.",
        },
        { status: 400 }
      );
    }

    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const userId = authUser.user.id;
    const resolvedCompanyName = companyName || fullName;

    const { data: company, error: companyError } = await admin
      .from("companies")
      .insert({
        name: resolvedCompanyName,
        phone: phone || null,
      })
      .select("id")
      .single();

    if (companyError) {
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: companyError.message }, { status: 400 });
    }

    const profilePayload = {
      id: userId,
      email,
      full_name: fullName,
      phone: phone || null,
      email_is_placeholder: emailIsPlaceholder,
      role: "client" as const,
      company_id: company.id,
      gdpr_erased_at: null,
      deleted_at: null,
    };

    // Auth hook may auto-insert a bare profile row — upsert avoids profiles_pkey conflict.
    const { error: profileError } = await admin
      .from("profiles")
      .upsert(profilePayload, { onConflict: "id" });

    if (profileError) {
      await admin.from("companies").delete().eq("id", company.id);
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      user_id: userId,
      company_id: company.id,
      email,
      email_is_placeholder: emailIsPlaceholder,
      message: emailIsPlaceholder
        ? "Client created with placeholder email. Update email later or client can use forgot password after you set a real email."
        : "Client created. They can sign in via Forgot password.",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: actor } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (actor?.role !== "staff_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { profile_id: profileId } = await request.json();
    if (!profileId) {
      return NextResponse.json({ error: "profile_id is required" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: profile } = await admin
      .from("profiles")
      .select("id, role, company_id")
      .eq("id", profileId)
      .single();

    if (!profile || profile.role !== "client") {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const erasedAt = new Date().toISOString();
    const anonymizedEmail = `erased-${profileId}@erased.ifp.local`;

    await admin
      .from("profiles")
      .update({
        email: anonymizedEmail,
        full_name: "Erased user",
        phone: null,
        company_id: null,
        email_is_placeholder: true,
        gdpr_erased_at: erasedAt,
        deleted_at: erasedAt,
      })
      .eq("id", profileId);

    if (profile.company_id) {
      await admin
        .from("companies")
        .update({
          name: "Erased client",
          vat_number: null,
          address_line1: null,
          address_line2: null,
          city: null,
          postal_code: null,
          phone: null,
        })
        .eq("id", profile.company_id);
    }

    const { error: deleteAuthError } = await admin.auth.admin.deleteUser(profileId);
    if (deleteAuthError) {
      return NextResponse.json({ error: deleteAuthError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

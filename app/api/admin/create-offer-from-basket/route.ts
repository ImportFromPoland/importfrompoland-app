import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLN_TO_EUR_RATE } from "@/lib/constants";

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
    .select("id, role, offer_prefix")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "staff_admin"].includes(profile.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { user, profile, supabase };
}

function lineNetEur(item: any, orderVat: number): number {
  const qty = Number(item.quantity) || 1;
  const vat = Number(item.vat_rate_override ?? orderVat ?? 23);
  if (item.original_net_price != null && !Number.isNaN(Number(item.original_net_price))) {
    const disc = Number(item.discount_percent || 0) / 100;
    return Number(item.original_net_price) * (1 - disc);
  }
  let grossUnit = Number(item.unit_price) || 0;
  if (item.currency === "PLN") {
    const rate = Number(item.fx_rate) || PLN_TO_EUR_RATE;
    grossUnit = grossUnit * rate;
  }
  const disc = Number(item.discount_percent || 0) / 100;
  const grossAfterDisc = grossUnit * (1 - disc);
  return grossAfterDisc / (1 + vat / 100);
}

async function insertVersionWithDiscountFallback(
  admin: ReturnType<typeof createAdminClient>,
  payload: Record<string, unknown>
) {
  let { data: version, error: versionError } = await admin
    .from("individual_offer_versions")
    .insert(payload)
    .select("id, version_number")
    .single();

  if (versionError && /discount_/i.test(versionError.message || "")) {
    const retryPayload = { ...payload };
    delete retryPayload.discount_percent;
    delete retryPayload.discount_amount;
    delete retryPayload.discount_type;
    const retry = await admin
      .from("individual_offer_versions")
      .insert(retryPayload)
      .select("id, version_number")
      .single();
    version = retry.data;
    versionError = retry.error;
  }

  return { version, versionError };
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const body = await request.json();
    const orderId = String(body.order_id || "").trim();
    const title = String(body.title || "").trim();
    const adminDiscountPercent = Number(body.discount_percent || 0);

    if (!orderId) {
      return NextResponse.json({ error: "order_id is required" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: order, error: orderError } = await admin
      .from("orders")
      .select(
        `
        *,
        company:companies(*),
        created_by_profile:profiles!created_by(id, full_name, email, phone, email_is_placeholder, role),
        items:order_items(*)
      `
      )
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order/basket not found" }, { status: 404 });
    }

    const items = (order.items || []).filter(
      (i: any) => i.product_name && Number(i.unit_price) > 0
    );
    if (items.length === 0) {
      return NextResponse.json(
        { error: "Basket has no items to include in the offer" },
        { status: 400 }
      );
    }

    const company = order.company;
    const createdBy = order.created_by_profile;

    let clientProfile = createdBy?.role === "client" ? createdBy : null;
    if (!clientProfile && order.company_id) {
      const { data: companyClient } = await admin
        .from("profiles")
        .select("id, full_name, email, phone, email_is_placeholder, role")
        .eq("company_id", order.company_id)
        .eq("role", "client")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      clientProfile = companyClient;
    }

    const guestSnapshot = {
      guest_name: clientProfile?.full_name || company?.name || null,
      guest_email: clientProfile?.email_is_placeholder
        ? null
        : clientProfile?.email || null,
      guest_phone: clientProfile?.phone || company?.phone || null,
      guest_address_line1: company?.address_line1 || null,
      guest_address_line2: company?.address_line2 || null,
      guest_city: company?.city || null,
      guest_postal_code: company?.postal_code || null,
      guest_country: company?.country || null,
      client_profile_id: clientProfile?.id || null,
    };

    // Reuse existing basket offer for this order → next version (V2, V3…)
    const { data: existingOffer } = await admin
      .from("individual_offers")
      .select("id, offer_number, current_version_id")
      .eq("source_order_id", order.id)
      .eq("offer_kind", "basket")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let offerId: string;
    let offerNumber: string;
    let versionNumber = 1;
    let isNewOffer = false;

    if (existingOffer) {
      offerId = existingOffer.id;
      offerNumber = existingOffer.offer_number;

      const { data: latestVersion } = await admin
        .from("individual_offer_versions")
        .select("version_number")
        .eq("offer_id", offerId)
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      versionNumber = (latestVersion?.version_number ?? 0) + 1;

      if (existingOffer.current_version_id) {
        await admin
          .from("individual_offer_versions")
          .update({
            status: "superseded",
            superseded_at: new Date().toISOString(),
          })
          .eq("id", existingOffer.current_version_id)
          .neq("status", "accepted");
      }

      await admin
        .from("individual_offers")
        .update({
          ...guestSnapshot,
          company_id: order.company_id,
        })
        .eq("id", offerId);
    } else {
      isNewOffer = true;
      const { data: generatedNumber, error: numberError } = await admin.rpc(
        "generate_individual_offer_number",
        { p_owner_id: auth.user.id }
      );

      if (numberError || !generatedNumber) {
        return NextResponse.json(
          { error: numberError?.message || "Failed to generate offer number" },
          { status: 400 }
        );
      }

      offerNumber = generatedNumber;

      const { data: offer, error: offerError } = await admin
        .from("individual_offers")
        .insert({
          offer_number: offerNumber,
          owner_id: auth.user.id,
          company_id: order.company_id,
          source_order_id: order.id,
          offer_kind: "basket",
          ...guestSnapshot,
        })
        .select("id")
        .single();

      if (offerError || !offer) {
        return NextResponse.json(
          { error: offerError?.message || "Failed to create offer" },
          { status: 400 }
        );
      }

      offerId = offer.id;
      versionNumber = 1;
    }

    const offerTitle =
      title ||
      order.client_notes ||
      `Offer from basket ${order.number || order.id.slice(0, 8)}`;

    const validUntilDate = new Date();
    validUntilDate.setDate(validUntilDate.getDate() + 30);
    const validUntil = validUntilDate.toISOString().slice(0, 10);

    const discountType =
      order.discount_type === "amount" ? "amount" : "percent";
    const discountPercent =
      adminDiscountPercent > 0
        ? adminDiscountPercent
        : Number(order.discount_percent || 0);
    const discountAmount =
      discountType === "amount" ? Number(order.discount_amount || 0) : 0;

    const versionPayload: Record<string, unknown> = {
      offer_id: offerId,
      version_number: versionNumber,
      status: "sent",
      title: offerTitle,
      client_notes: order.client_notes,
      admin_notes:
        discountPercent > 0 || discountAmount > 0
          ? `Discount applied: ${
              discountType === "amount"
                ? `${discountAmount} EUR`
                : `${discountPercent}%`
            }`
          : null,
      payment_link_url: order.payment_link_url || null,
      valid_until: validUntil,
      discount_percent: discountPercent,
      discount_amount: discountAmount,
      discount_type: discountType,
      created_by: auth.user.id,
    };

    const { version, versionError } = await insertVersionWithDiscountFallback(
      admin,
      versionPayload
    );

    if (versionError || !version) {
      if (isNewOffer) {
        await admin.from("individual_offers").delete().eq("id", offerId);
      }
      return NextResponse.json(
        { error: versionError?.message || "Failed to create offer version" },
        { status: 400 }
      );
    }

    const vatRate = Number(order.vat_rate) || 23;
    const linesPayload = items
      .sort((a: any, b: any) => (a.line_number || 0) - (b.line_number || 0))
      .map((item: any, index: number) => {
        const qty = Number(item.quantity) || 1;
        const unitNet = lineNetEur(item, vatRate);
        const amountNet = unitNet * qty;
        return {
          offer_version_id: version.id,
          line_number: index + 1,
          label: item.product_name,
          product_name: item.product_name,
          supplier_name: item.supplier_name || null,
          website_url: item.website_url || null,
          quantity: qty,
          unit_of_measure: item.unit_of_measure || "unit",
          unit_price_net: Math.round(unitNet * 10000) / 10000,
          amount: Math.round(amountNet * 100) / 100,
          vat_rate: Number(item.vat_rate_override ?? vatRate),
          notes: item.notes || null,
          specification: null,
        };
      });

    const { error: linesError } = await admin
      .from("individual_offer_lines")
      .insert(linesPayload);

    if (linesError) {
      await admin.from("individual_offer_versions").delete().eq("id", version.id);
      if (isNewOffer) {
        await admin.from("individual_offers").delete().eq("id", offerId);
      }
      return NextResponse.json({ error: linesError.message }, { status: 400 });
    }

    await admin
      .from("individual_offers")
      .update({ current_version_id: version.id })
      .eq("id", offerId);

    return NextResponse.json({
      success: true,
      offer_id: offerId,
      offer_number: offerNumber,
      version_id: version.id,
      version_number: version.version_number ?? versionNumber,
      is_new_version: !isNewOffer,
      message: isNewOffer
        ? `Offer ${offerNumber} created from basket.`
        : `Offer ${offerNumber} updated to version v${version.version_number ?? versionNumber}.`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

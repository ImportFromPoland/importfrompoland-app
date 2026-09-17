export type PdfCustomerProfile = {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  email_is_placeholder?: boolean | null;
  role?: string | null;
};

export type PdfCompany = {
  name?: string | null;
  email?: string | null;
  vat_number?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  postal_code?: string | null;
  country?: string | null;
  phone?: string | null;
};

function isUsableEmail(email?: string | null, isPlaceholder?: boolean | null) {
  if (!email || isPlaceholder) return false;
  if (String(email).endsWith("@placeholder.ifp.local")) return false;
  return true;
}

/** Prefer company + client contact; never invent admin as the customer. */
export function buildPdfCustomer(opts: {
  company?: PdfCompany | null;
  customerProfile?: PdfCustomerProfile | null;
}) {
  const company = opts.company || null;
  const profile = opts.customerProfile || null;

  const companyName = company?.name?.trim() || "";
  const personName = profile?.full_name?.trim() || "";

  const displayName = companyName || personName || "—";
  const contactName =
    companyName && personName && personName !== companyName ? personName : null;

  const email =
    (isUsableEmail(profile?.email, profile?.email_is_placeholder)
      ? profile!.email
      : null) ||
    (isUsableEmail(company?.email) ? company!.email : null) ||
    null;

  const phone = company?.phone?.trim() || profile?.phone?.trim() || null;

  const addressParts = [
    company?.address_line1,
    company?.address_line2,
    [company?.city, company?.postal_code].filter(Boolean).join(", "),
    company?.country,
  ].filter((line) => Boolean(line && String(line).trim()));

  return {
    displayName,
    contactName,
    email,
    phone,
    vatNumber: company?.vat_number?.trim() || null,
    addressParts: addressParts as string[],
  };
}

/** Pick a client-facing profile: client role preferred over admin creator. */
export function resolveCustomerProfile(opts: {
  createdByProfile?: PdfCustomerProfile | null;
  clientProfile?: PdfCustomerProfile | null;
}): PdfCustomerProfile | null {
  const client = opts.clientProfile;
  if (client?.full_name || client?.email || client?.phone) return client;

  const created = opts.createdByProfile;
  if (!created) return null;
  if (created.role && created.role !== "client") return null;
  return created;
}

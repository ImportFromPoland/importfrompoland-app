import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Link,
} from "@react-pdf/renderer";
import "@/lib/pdf-open-links-new-window";
import { orderLineGrossEURDisplay, orderLineUnitGrossEURDisplay } from "@/lib/utils";

const RED = "#E94444";
const TEXT = "#1a1a1a";
const MUTED = "#6b6b6b";
const BORDER = "#e8e8e8";
const CARD_BG = "#fafafa";

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 56,
    paddingHorizontal: 36,
    fontSize: 9,
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
    color: TEXT,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 18,
    paddingBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: RED,
  },
  brandName: {
    fontSize: 16,
    fontWeight: "bold",
    color: RED,
    marginBottom: 3,
  },
  brandMeta: {
    fontSize: 8,
    color: MUTED,
    marginBottom: 1,
  },
  logo: {
    width: 100,
    height: 48,
    objectFit: "contain",
  },
  docTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: TEXT,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  orderNumberHero: {
    fontSize: 12,
    fontWeight: "bold",
    color: RED,
    marginBottom: 14,
  },
  cardsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  card: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 6,
    padding: 10,
  },
  cardTitle: {
    fontSize: 8,
    fontWeight: "bold",
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  cardLine: {
    fontSize: 9,
    color: TEXT,
    marginBottom: 3,
    lineHeight: 1.35,
  },
  cardMuted: {
    fontSize: 8,
    color: MUTED,
  },
  sectionLabel: {
    fontSize: 8,
    fontWeight: "bold",
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: RED,
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  tableHeaderText: {
    color: "#ffffff",
    fontSize: 7.5,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: BORDER,
    paddingVertical: 7,
    paddingHorizontal: 6,
    alignItems: "flex-start",
  },
  tableRowAlt: {
    backgroundColor: "#fcfcfc",
  },
  colNum: { width: "5%" },
  colProduct: { width: "32%", paddingRight: 4 },
  colSupplier: { width: "14%", paddingRight: 3 },
  colQty: { width: "9%", textAlign: "right", paddingRight: 4 },
  colUnit: { width: "8%", textAlign: "center" },
  colPrice: { width: "12%", textAlign: "right", paddingRight: 4 },
  colTotal: { width: "12%", textAlign: "right", paddingRight: 4 },
  colLink: { width: "8%", textAlign: "center" },
  productName: {
    fontSize: 9,
    fontWeight: "bold",
    color: TEXT,
    marginBottom: 2,
  },
  productSpec: {
    fontSize: 7.5,
    color: MUTED,
    marginBottom: 2,
  },
  productNote: {
    fontSize: 7,
    color: "#888",
    fontStyle: "italic",
  },
  cellText: {
    fontSize: 8,
    color: TEXT,
  },
  viewLink: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: RED,
    textDecoration: "none",
  },
  dash: {
    fontSize: 8,
    color: "#bbb",
  },
  totalsWrap: {
    marginTop: 14,
    marginLeft: "auto",
    width: "42%",
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 6,
    padding: 12,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  totalLabel: {
    fontSize: 9,
    color: MUTED,
  },
  totalValue: {
    fontSize: 9,
    color: TEXT,
    fontWeight: "bold",
  },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1.5,
    borderTopColor: RED,
  },
  grandLabel: {
    fontSize: 11,
    fontWeight: "bold",
    color: TEXT,
  },
  grandValue: {
    fontSize: 12,
    fontWeight: "bold",
    color: RED,
  },
  paymentRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  paymentCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 6,
    padding: 12,
    backgroundColor: CARD_BG,
  },
  paymentTitle: {
    fontSize: 9,
    fontWeight: "bold",
    color: RED,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  paymentDetail: {
    fontSize: 8,
    color: TEXT,
    marginBottom: 3,
    lineHeight: 1.35,
  },
  payButton: {
    marginTop: 10,
    backgroundColor: RED,
    borderRadius: 5,
    paddingVertical: 9,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  payButtonText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "bold",
    textDecoration: "none",
  },
  payHint: {
    fontSize: 7.5,
    color: MUTED,
    marginBottom: 4,
  },
  footer: {
    position: "absolute",
    bottom: 22,
    left: 36,
    right: 36,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 8,
  },
  footerTagline: {
    fontSize: 8,
    fontWeight: "bold",
    color: RED,
    marginBottom: 4,
  },
  footerText: {
    fontSize: 7,
    color: MUTED,
    lineHeight: 1.35,
  },
  pageNumber: {
    position: "absolute",
    bottom: 10,
    right: 36,
    fontSize: 7,
    color: MUTED,
  },
});

export function formatOrderUnit(unitOfMeasure?: string | null): string {
  if (!unitOfMeasure) return "—";
  const u = String(unitOfMeasure).toLowerCase();
  if (u === "m2" || u === "m²") return "m²";
  if (u === "unit" || u === "each" || u === "pcs" || u === "pc") return "each";
  return String(unitOfMeasure);
}

function formatQty(quantity: number | string | null | undefined): string {
  const n = Number(quantity);
  if (!Number.isFinite(n)) return "—";
  return Number.isInteger(n) ? String(n) : String(n);
}

interface OrderPDFProps {
  order: any;
  company: any;
  items: any[];
  totals: any;
  createdByProfile?: any;
  /** When set, renders as Offer document instead of Order Confirmation */
  documentKind?: "order" | "offer";
}

export const OrderPDF: React.FC<OrderPDFProps> = ({
  order,
  company,
  items,
  totals,
  createdByProfile,
  documentKind = "order",
}) => {
  const isOffer = documentKind === "offer";
  const currency = order.currency || "EUR";

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency,
    }).format(amount || 0);

  const formatDate = (date?: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-IE", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const customerName =
    createdByProfile?.full_name ||
    company?.name ||
    "—";
  const customerEmail =
    createdByProfile?.email &&
    !String(createdByProfile.email).endsWith("@placeholder.ifp.local")
      ? createdByProfile.email
      : company?.email || null;

  const addressParts = [
    company?.address_line1,
    company?.address_line2,
    [company?.city, company?.postal_code].filter(Boolean).join(", "),
    company?.country,
  ].filter(Boolean);

  const docNumber = isOffer
    ? order.offer_number || order.number
    : order.number || "—";
  const docDate = isOffer
    ? order.offer_date || order.created_at
    : order.submitted_at || order.confirmed_at || order.created_at;
  const statusLabel = isOffer
    ? "OFFER"
    : String(order.status || "").toUpperCase();

  const subtotal =
    totals?.items_net ??
    totals?.subtotal_without_vat ??
    totals?.items_net_before_header ??
    0;
  const vatAmount = totals?.vat_amount ?? 0;
  const grandTotal = totals?.grand_total ?? 0;
  const headerDiscount =
    totals?.header_discount_amt ??
    ((order.discount_percent || 0) > 0
      ? (totals?.items_net_before_header || subtotal) *
        ((order.discount_percent || 0) / 100)
      : 0);

  // Bank details always; PAY CTA only when admin set a payment link
  const showPayButton = Boolean(order.payment_link_url);
  const payHref = order.payment_link_url as string | null;

  const sortedItems = [...(items || [])].sort(
    (a, b) => (a.line_number || 0) - (b.line_number || 0)
  );

  const TableHeader = (
    <View style={styles.tableHeader} fixed>
      <Text style={[styles.tableHeaderText, styles.colNum]}>#</Text>
      <Text style={[styles.tableHeaderText, styles.colProduct]}>Product</Text>
      <Text style={[styles.tableHeaderText, styles.colSupplier]}>Supplier</Text>
      <Text style={[styles.tableHeaderText, styles.colQty]}>Qty</Text>
      <Text style={[styles.tableHeaderText, styles.colUnit]}>Unit</Text>
      <Text style={[styles.tableHeaderText, styles.colPrice]}>Unit price</Text>
      <Text style={[styles.tableHeaderText, styles.colTotal]}>Total</Text>
      <Text style={[styles.tableHeaderText, styles.colLink]}>Link</Text>
    </View>
  );

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header}>
          <View>
            <Text style={styles.brandName}>ImportFromPoland</Text>
            <Text style={styles.brandMeta}>
              info@importfrompoland.com · +48 791 350 527
            </Text>
            <Text style={styles.brandMeta}>importfrompoland.com</Text>
          </View>
          <Image src="/logo.png" style={styles.logo} />
        </View>

        <Text style={styles.docTitle}>
          {isOffer ? "OFFER" : "ORDER CONFIRMATION"}
        </Text>
        <Text style={styles.orderNumberHero}>
          {isOffer ? "Offer" : "Order"} {docNumber}
        </Text>

        <View style={styles.cardsRow}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {isOffer ? "Offer information" : "Order information"}
            </Text>
            <Text style={styles.cardLine}>
              Number: <Text style={{ fontWeight: "bold" }}>{docNumber}</Text>
            </Text>
            <Text style={styles.cardLine}>Date: {formatDate(docDate)}</Text>
            <Text style={styles.cardLine}>
              Status: <Text style={{ fontWeight: "bold" }}>{statusLabel}</Text>
            </Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Customer</Text>
            <Text style={[styles.cardLine, { fontWeight: "bold" }]}>
              {customerName}
            </Text>
            {customerEmail && (
              <Text style={styles.cardLine}>{customerEmail}</Text>
            )}
            {company?.vat_number && (
              <Text style={styles.cardMuted}>VAT: {company.vat_number}</Text>
            )}
            {addressParts.map((line, i) => (
              <Text key={i} style={styles.cardMuted}>
                {line}
              </Text>
            ))}
            {(company?.phone || createdByProfile?.phone) && (
              <Text style={styles.cardMuted}>
                {company?.phone || createdByProfile?.phone}
              </Text>
            )}
          </View>
        </View>

        <Text style={styles.sectionLabel}>
          {isOffer ? "Offer items" : "Order items"} · Prices in EUR
        </Text>

        {TableHeader}

        {sortedItems.map((item, index) => {
          const unitGross = orderLineUnitGrossEURDisplay(item, order);
          const lineGross = orderLineGrossEURDisplay(item, order);
          const vat = Number(item.vat_rate_override ?? order.vat_rate ?? 23);
          const unitNet =
            vat === 0 ? unitGross / 1.23 : unitGross / (1 + vat / 100);
          const lineTotal = vat === 0 ? unitNet * Number(item.quantity) : lineGross;
          const url = (item.website_url || "").trim();

          return (
            <View
              key={item.id || index}
              style={[
                styles.tableRow,
                index % 2 === 1 ? styles.tableRowAlt : {},
              ]}
              wrap={false}
            >
              <Text style={[styles.cellText, styles.colNum]}>
                {item.line_number ?? index + 1}
              </Text>
              <View style={styles.colProduct}>
                <Text style={styles.productName}>{item.product_name}</Text>
                {item.specification && (
                  <Text style={styles.productSpec}>{item.specification}</Text>
                )}
                {item.notes && (
                  <Text style={styles.productNote}>{item.notes}</Text>
                )}
              </View>
              <Text style={[styles.cellText, styles.colSupplier]}>
                {item.supplier_name || "—"}
              </Text>
              <Text style={[styles.cellText, styles.colQty]}>
                {formatQty(item.quantity)}
              </Text>
              <Text style={[styles.cellText, styles.colUnit]}>
                {formatOrderUnit(item.unit_of_measure)}
              </Text>
              <Text style={[styles.cellText, styles.colPrice]}>
                {formatCurrency(unitNet)}
              </Text>
              <Text style={[styles.cellText, styles.colTotal]}>
                {formatCurrency(lineTotal)}
              </Text>
              <View style={styles.colLink}>
                {url ? (
                  <Link src={url} style={styles.viewLink}>
                    VIEW
                  </Link>
                ) : (
                  <Text style={styles.dash}>—</Text>
                )}
              </View>
            </View>
          );
        })}

        <View style={styles.totalsWrap} wrap={false}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal excl. VAT</Text>
            <Text style={styles.totalValue}>{formatCurrency(subtotal)}</Text>
          </View>
          {headerDiscount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                Discount
                {order.discount_percent ? ` (${order.discount_percent}%)` : ""}
              </Text>
              <Text style={styles.totalValue}>
                −{formatCurrency(headerDiscount)}
              </Text>
            </View>
          )}
          {(order.vat_rate || 0) > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>VAT ({order.vat_rate}%)</Text>
              <Text style={styles.totalValue}>{formatCurrency(vatAmount)}</Text>
            </View>
          )}
          {(totals?.shipping_cost || order.shipping_cost || 0) > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Shipping</Text>
              <Text style={styles.totalValue}>
                {formatCurrency(totals?.shipping_cost || order.shipping_cost)}
              </Text>
            </View>
          )}
          <View style={styles.grandRow}>
            <Text style={styles.grandLabel}>TOTAL</Text>
            <Text style={styles.grandValue}>{formatCurrency(grandTotal)}</Text>
          </View>
        </View>

        <View style={styles.paymentRow} wrap={false}>
          <View style={styles.paymentCard}>
            <Text style={styles.paymentTitle}>Bank transfer</Text>
            <Text style={styles.paymentDetail}>Bank: PKO Bank Polski</Text>
            <Text style={styles.paymentDetail}>
              IBAN: PL 77 1020 2313 0000 3602 1175 9752
            </Text>
            <Text style={styles.paymentDetail}>BIC/SWIFT: BPKOPLPW</Text>
            <Text style={styles.paymentDetail}>
              Payment reference: {docNumber}
            </Text>
          </View>
          {showPayButton && payHref && (
            <View style={styles.paymentCard}>
              <Text style={styles.paymentTitle}>Pay by card</Text>
              <Text style={styles.payHint}>Secure online payment</Text>
              <Link src={payHref} style={styles.payButton}>
                <Text style={styles.payButtonText}>
                  PAY {formatCurrency(grandTotal)}
                </Text>
              </Link>
            </View>
          )}
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerTagline}>
            One order. One delivery. One contact.
          </Text>
          <Text style={styles.footerText}>
            All prices include delivery to Ireland. VAT at {order.vat_rate ?? 23}
            % applies.
          </Text>
          <Text style={styles.footerText}>
            ImportFromPoland P.S.A. · KRS 0001190377 · REGON 542 538 814 ·
            PL6343059711
          </Text>
          <Text style={styles.footerText}>
            Al. Wojciecha Korfantego 113/3, 40-156 Katowice, Poland
          </Text>
        </View>
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
};

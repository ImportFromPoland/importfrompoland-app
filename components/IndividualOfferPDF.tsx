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
import {
  offerLineGrossAmount,
  offerLineNetAmount,
  offerLineVatAmount,
  offerLinesGrossTotal,
  offerLinesNetTotal,
  offerLinesVatTotal,
} from "@/lib/individual-offer-totals";

const COLORS = {
  navy: "#1a2744",
  navyLight: "#243352",
  red: "#c73e3e",
  redMuted: "#d45656",
  bg: "#f7f5f2",
  card: "#ffffff",
  border: "#e5e0d8",
  text: "#2c2c2c",
  muted: "#6b6560",
  light: "#9a948d",
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: COLORS.text,
    backgroundColor: COLORS.bg,
    paddingBottom: 52,
  },
  headerBand: {
    backgroundColor: COLORS.navy,
    paddingHorizontal: 36,
    paddingTop: 28,
    paddingBottom: 22,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerBrand: {
    flex: 1,
  },
  headerLogo: {
    width: 110,
    height: 52,
    objectFit: "contain",
  },
  headerCompany: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 4,
  },
  headerTagline: {
    fontSize: 8.5,
    color: "#c8d0e0",
    marginBottom: 2,
  },
  body: {
    paddingHorizontal: 36,
    paddingTop: 22,
  },
  docTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.navy,
    marginBottom: 6,
  },
  statusBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#fff5f5",
    borderWidth: 1,
    borderColor: COLORS.redMuted,
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginBottom: 16,
  },
  statusText: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: COLORS.red,
    letterSpacing: 0.8,
  },
  metaRow: {
    flexDirection: "row",
    gap: 24,
    marginBottom: 14,
  },
  metaBlock: {},
  metaLabel: {
    fontSize: 7.5,
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  metaValue: {
    fontSize: 10,
    fontWeight: "bold",
    color: COLORS.navy,
  },
  intro: {
    fontSize: 9,
    lineHeight: 1.55,
    color: COLORS.muted,
    marginBottom: 18,
    maxWidth: "92%",
  },
  heroCard: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroLabel: {
    fontSize: 9,
    color: COLORS.muted,
    marginBottom: 4,
  },
  heroGross: {
    fontSize: 22,
    fontWeight: "bold",
    color: COLORS.navy,
  },
  heroSub: {
    fontSize: 8,
    color: COLORS.light,
    marginTop: 4,
  },
  statRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  statLabel: {
    fontSize: 7,
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 10,
    fontWeight: "bold",
    color: COLORS.navy,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: COLORS.navy,
    marginBottom: 10,
    marginTop: 4,
  },
  table: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
    marginBottom: 18,
  },
  tableHead: {
    flexDirection: "row",
    backgroundColor: COLORS.navy,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  th: {
    color: "#ffffff",
    fontSize: 7.5,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tableRowAlt: {
    flexDirection: "row",
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: "#fafaf8",
  },
  tableTotal: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: "#f0ede8",
  },
  colItem: { width: "6%" },
  colProduct: { width: "38%" },
  colMoney: { width: "18%", textAlign: "right" },
  specCard: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 10,
  },
  specTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: COLORS.navy,
    marginBottom: 6,
  },
  specNotes: {
    fontSize: 8.5,
    lineHeight: 1.45,
    color: COLORS.muted,
    marginBottom: 8,
  },
  specLinkLabel: {
    fontSize: 7.5,
    color: COLORS.light,
    marginBottom: 4,
  },
  linkButton: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.navy,
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 4,
    marginBottom: 4,
  },
  linkButtonText: {
    color: "#ffffff",
    fontSize: 8,
    fontWeight: "bold",
  },
  twoCol: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  card: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },
  cardTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: COLORS.navy,
    marginBottom: 8,
  },
  bullet: {
    flexDirection: "row",
    marginBottom: 5,
    paddingRight: 8,
  },
  bulletDot: {
    width: 10,
    fontSize: 9,
    color: COLORS.red,
  },
  bulletText: {
    flex: 1,
    fontSize: 8.5,
    lineHeight: 1.4,
    color: COLORS.muted,
  },
  stepRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 9,
    fontWeight: "bold",
    color: COLORS.navy,
    marginBottom: 2,
  },
  stepDesc: {
    fontSize: 8,
    lineHeight: 1.4,
    color: COLORS.muted,
  },
  paymentItem: {
    fontSize: 8.5,
    lineHeight: 1.45,
    color: COLORS.muted,
    marginBottom: 6,
  },
  importantBox: {
    backgroundColor: "#fff9f0",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e8d4b8",
    padding: 12,
    marginTop: 4,
  },
  importantTitle: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#8a6d3b",
    marginBottom: 6,
  },
  importantText: {
    fontSize: 8.5,
    lineHeight: 1.45,
    color: COLORS.muted,
  },
  footer: {
    position: "absolute",
    bottom: 18,
    left: 36,
    right: 36,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    fontSize: 7,
    color: COLORS.light,
  },
  draftWatermark: {
    fontSize: 8,
    color: COLORS.red,
    marginBottom: 8,
    fontStyle: "italic",
  },
});

export type IndividualOfferPDFLine = {
  label: string;
  amount: number;
  vat_rate: number;
  notes?: string | null;
  specLinks?: IndividualOfferPDFLink[];
};

export type IndividualOfferPDFLink = {
  title: string;
  url: string;
  line_number?: number;
};

export type IndividualOfferPDFProps = {
  offerNumber: string;
  versionNumber?: number;
  title: string;
  validUntil: string;
  clientName?: string | null;
  clientEmail?: string | null;
  companyName?: string | null;
  clientNotes?: string | null;
  lines: IndividualOfferPDFLine[];
  specLinks?: IndividualOfferPDFLink[];
  isDraft?: boolean;
  preparedBy?: string;
  deliveryNote?: string;
};

const DEFAULT_INTRO =
  "Thank you for your enquiry. This offer has been prepared based on the details provided. Please review the pricing and linked specification below. If anything needs to be changed, we can update the offer before confirmation.";

const INCLUDED_ITEMS = [
  "Products listed in the offer summary",
  "Preparation for secure international delivery",
  "Insured delivery to Ireland, unless stated otherwise",
  "One point of contact throughout the process",
  "ImportFromPoland aftersales service",
];

const USP_ITEMS = [
  "Clear, project-specific quotations",
  "Trusted supply from Poland",
  "Professional support before and after purchase",
];

const PAYMENT_TERMS = [
  "Orders above €5,000: 50% deposit to start production, 50% before dispatch from the ImportFromPoland warehouse.",
  "Full upfront payment: 2% discount.",
  "Orders below €5,000: full payment required.",
];

const NEXT_STEPS = [
  {
    title: "Review",
    desc: "Check the offer and linked specification.",
  },
  {
    title: "Update",
    desc: "Let us know if any changes are required.",
  },
  {
    title: "Confirm",
    desc: "Confirm by email if you would like to proceed.",
  },
  {
    title: "Payment",
    desc: "We issue the invoice/payment request. After payment, we begin preparing the order.",
  },
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(date: string) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-IE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function clientDisplayName(props: IndividualOfferPDFProps): string {
  return (
    props.clientName?.trim() ||
    props.companyName?.trim() ||
    props.clientEmail?.trim() ||
    "Client"
  );
}

function PdfFooter({
  offerNumber,
  page,
  totalPages,
}: {
  offerNumber: string;
  page: number;
  totalPages: number;
}) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>
        ImportFromPoland | info@importfrompoland.com | +48 791 350 527 |
        www.importfrompoland.com
      </Text>
      <Text style={styles.footerText}>
        Office &amp; warehouse: Southern Poland · {offerNumber} · Page {page} of{" "}
        {totalPages}
      </Text>
    </View>
  );
}

function PdfHeader() {
  return (
    <View style={styles.headerBand}>
      <View style={styles.headerRow}>
        <View style={styles.headerBrand}>
          <Text style={styles.headerCompany}>ImportFromPoland</Text>
          <Text style={styles.headerTagline}>
            Your trusted partner for buying from Poland
          </Text>
        </View>
        <Image src="/logo.png" style={styles.headerLogo} />
      </View>
    </View>
  );
}

export const IndividualOfferPDF: React.FC<IndividualOfferPDFProps> = (props) => {
  const {
    offerNumber,
    versionNumber,
    validUntil,
    clientNotes,
    lines,
    isDraft,
    preparedBy = "IFP Team",
    deliveryNote = "Included*",
  } = props;

  const totalNet = offerLinesNetTotal(lines);
  const totalVat = offerLinesVatTotal(lines);
  const totalGross = offerLinesGrossTotal(lines);
  const intro = clientNotes?.trim() || DEFAULT_INTRO;
  const linesWithSpecs = lines.filter((l) => (l.specLinks?.length ?? 0) > 0);

  return (
    <Document>
      {/* Page 1 — pricing & specification */}
      <Page size="A4" style={styles.page}>
        <PdfHeader />
        <View style={styles.body}>
          <Text style={styles.docTitle}>Individual offer</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>
              PROPOSAL — NOT AN ORDER CONFIRMATION
            </Text>
          </View>
          {isDraft ? (
            <Text style={styles.draftWatermark}>
              Draft preview — not yet shared with client
              {versionNumber ? ` · v${versionNumber}` : ""}
            </Text>
          ) : null}

          <View style={styles.metaRow}>
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>Offer number</Text>
              <Text style={styles.metaValue}>
                {offerNumber}
                {versionNumber ? ` · v${versionNumber}` : ""}
              </Text>
            </View>
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>Valid until</Text>
              <Text style={styles.metaValue}>{formatDate(validUntil)}</Text>
            </View>
          </View>

          <Text style={styles.intro}>
            <Text style={{ fontWeight: "bold", color: COLORS.navy }}>
              Prepared for: {clientDisplayName(props)}
            </Text>
            {"\n\n"}
            {intro}
          </Text>

          <View style={styles.heroCard}>
            <View>
              <Text style={styles.heroLabel}>Total gross</Text>
              <Text style={styles.heroGross}>{formatCurrency(totalGross)}</Text>
              <Text style={styles.heroSub}>
                Net {formatCurrency(totalNet)} | VAT {formatCurrency(totalVat)}
              </Text>
            </View>
          </View>

          <View style={styles.statRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Total net</Text>
              <Text style={styles.statValue}>{formatCurrency(totalNet)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>VAT</Text>
              <Text style={styles.statValue}>{formatCurrency(totalVat)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Delivery</Text>
              <Text style={styles.statValue}>{deliveryNote}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Prepared by</Text>
              <Text style={styles.statValue}>{preparedBy}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Offer summary</Text>
          <View style={styles.table}>
            <View style={styles.tableHead}>
              <Text style={[styles.th, styles.colItem]}>Item</Text>
              <Text style={[styles.th, styles.colProduct]}>Product / Package</Text>
              <Text style={[styles.th, styles.colMoney]}>Net</Text>
              <Text style={[styles.th, styles.colMoney]}>VAT</Text>
              <Text style={[styles.th, styles.colMoney]}>Gross</Text>
            </View>
            {lines.length === 0 ? (
              <View style={styles.tableRow}>
                <Text style={styles.colItem}>—</Text>
                <Text style={styles.colProduct}>No items</Text>
                <Text style={styles.colMoney}>—</Text>
                <Text style={styles.colMoney}>—</Text>
                <Text style={styles.colMoney}>—</Text>
              </View>
            ) : (
              lines.map((line, index) => {
                const rowStyle =
                  index % 2 === 1 ? styles.tableRowAlt : styles.tableRow;
                return (
                  <View key={index} style={rowStyle}>
                    <Text style={styles.colItem}>{index + 1}</Text>
                    <Text style={styles.colProduct}>{line.label}</Text>
                    <Text style={styles.colMoney}>
                      {formatCurrency(offerLineNetAmount(line))}
                    </Text>
                    <Text style={styles.colMoney}>
                      {formatCurrency(offerLineVatAmount(line))}
                    </Text>
                    <Text style={styles.colMoney}>
                      {formatCurrency(offerLineGrossAmount(line))}
                    </Text>
                  </View>
                );
              })
            )}
            <View style={styles.tableTotal}>
              <Text style={[styles.colItem, { fontWeight: "bold" }]} />
              <Text
                style={[
                  styles.colProduct,
                  { fontWeight: "bold", color: COLORS.navy },
                ]}
              >
                Total
              </Text>
              <Text
                style={[
                  styles.colMoney,
                  { fontWeight: "bold", color: COLORS.navy },
                ]}
              >
                {formatCurrency(totalNet)}
              </Text>
              <Text
                style={[
                  styles.colMoney,
                  { fontWeight: "bold", color: COLORS.navy },
                ]}
              >
                {formatCurrency(totalVat)}
              </Text>
              <Text
                style={[
                  styles.colMoney,
                  { fontWeight: "bold", color: COLORS.navy },
                ]}
              >
                {formatCurrency(totalGross)}
              </Text>
            </View>
          </View>

          {linesWithSpecs.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>
                Product details &amp; specification links
              </Text>
              {lines.map((line, index) => {
                const links = line.specLinks ?? [];
                if (links.length === 0) return null;
                return (
                  <View key={index} style={styles.specCard} wrap={false}>
                    <Text style={styles.specTitle}>
                      {index + 1} {line.label}
                    </Text>
                    {line.notes ? (
                      <Text style={styles.specNotes}>{line.notes}</Text>
                    ) : null}
                    <Text style={styles.specLinkLabel}>Linked file available:</Text>
                    {links.map((link, li) => (
                      <Link key={li} src={link.url}>
                        <View style={styles.linkButton}>
                          <Text style={styles.linkButtonText}>
                            {link.title?.trim() ||
                              "View specification & breakdown"}
                          </Text>
                        </View>
                      </Link>
                    ))}
                  </View>
                );
              })}
            </>
          ) : null}
        </View>
        <PdfFooter offerNumber={offerNumber} page={1} totalPages={2} />
      </Page>

      {/* Page 2 — included, next steps, terms */}
      <Page size="A4" style={styles.page}>
        <PdfHeader />
        <View style={styles.body}>
          <View style={styles.twoCol}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Included in this offer</Text>
              {INCLUDED_ITEMS.map((item) => (
                <View key={item} style={styles.bullet}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>{item}</Text>
                </View>
              ))}
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Why ImportFromPoland</Text>
              {USP_ITEMS.map((item) => (
                <View key={item} style={styles.bullet}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.twoCol}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Next steps</Text>
              {NEXT_STEPS.map((step, i) => (
                <View key={step.title} style={styles.stepRow}>
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      backgroundColor: COLORS.navy,
                      marginRight: 8,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: "#ffffff",
                        fontSize: 8,
                        fontWeight: "bold",
                      }}
                    >
                      {i + 1}
                    </Text>
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>{step.title}</Text>
                    <Text style={styles.stepDesc}>{step.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Payment terms</Text>
              {PAYMENT_TERMS.map((term, i) => (
                <Text key={i} style={styles.paymentItem}>
                  {i + 1}. {term}
                </Text>
              ))}
            </View>
          </View>

          <View style={styles.importantBox}>
            <Text style={styles.importantTitle}>Important note</Text>
            <Text style={styles.importantText}>
              Installation, site measurements, unloading equipment and additional
              products not listed in the offer are not included unless stated
              otherwise.
            </Text>
          </View>
        </View>
        <PdfFooter offerNumber={offerNumber} page={2} totalPages={2} />
      </Page>
    </Document>
  );
};

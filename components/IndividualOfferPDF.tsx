import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Times-Roman",
    backgroundColor: "#ffffff",
  },
  header: {
    marginBottom: 24,
    borderBottom: "3pt solid #E94444",
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerLeft: { flex: 1 },
  headerRight: { alignItems: "flex-end" },
  logo: { width: 120, height: 60, objectFit: "contain" },
  companyInfo: { marginTop: 6, fontSize: 9, color: "#666" },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#E94444",
    marginBottom: 16,
  },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#333",
    borderBottom: "1pt solid #ddd",
    paddingBottom: 4,
  },
  row: { flexDirection: "row", marginBottom: 4 },
  label: { width: "32%", fontWeight: "bold", color: "#555" },
  value: { width: "68%", color: "#333" },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#E94444",
    color: "#fff",
    padding: 8,
    fontWeight: "bold",
    fontSize: 9,
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "1pt solid #eee",
    padding: 8,
    fontSize: 9,
  },
  colLabel: { width: "55%" },
  colAmount: { width: "25%", textAlign: "right" },
  colVat: { width: "20%", textAlign: "right" },
  notesBox: {
    backgroundColor: "#f9f9f9",
    padding: 10,
    borderRadius: 4,
    border: "1pt solid #ddd",
    marginTop: 6,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 12,
    paddingTop: 8,
    borderTop: "2pt solid #E94444",
  },
  totalLabel: { fontSize: 12, fontWeight: "bold", marginRight: 12 },
  totalValue: { fontSize: 12, fontWeight: "bold", color: "#E94444" },
  draftBadge: {
    fontSize: 9,
    color: "#888",
    marginBottom: 8,
  },
  linkRow: { fontSize: 9, marginBottom: 3, color: "#333" },
});

export type IndividualOfferPDFLine = {
  label: string;
  amount: number;
  vat_rate: number;
  notes?: string | null;
};

export type IndividualOfferPDFLink = {
  title: string;
  url: string;
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
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
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

export const IndividualOfferPDF: React.FC<IndividualOfferPDFProps> = ({
  offerNumber,
  versionNumber,
  title,
  validUntil,
  clientName,
  clientEmail,
  companyName,
  clientNotes,
  lines,
  specLinks = [],
  isDraft,
}) => {
  const totalGross = lines.reduce((sum, line) => sum + Number(line.amount), 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <Text style={{ fontSize: 18, fontWeight: "bold", color: "#E94444" }}>
                ImportFromPoland
              </Text>
              <Text style={styles.companyInfo}>
                Your trusted partner for buying from Poland
              </Text>
              <Text style={styles.companyInfo}>
                Email: info@importfrompoland.com | Phone: +48 791 350 527
              </Text>
            </View>
            <View style={styles.headerRight}>
              <Image src="/logo.png" style={styles.logo} />
            </View>
          </View>
        </View>

        <Text style={styles.title}>INDIVIDUAL OFFER</Text>
        {isDraft && (
          <Text style={styles.draftBadge}>
            Preview — not yet shared with client
          </Text>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Offer details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Offer number:</Text>
            <Text style={styles.value}>
              {offerNumber}
              {versionNumber ? ` (v${versionNumber})` : ""}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Title:</Text>
            <Text style={styles.value}>{title || "—"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Valid until:</Text>
            <Text style={styles.value}>{formatDate(validUntil)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Client</Text>
          {companyName && companyName !== clientName ? (
            <View style={styles.row}>
              <Text style={styles.label}>Company:</Text>
              <Text style={styles.value}>{companyName}</Text>
            </View>
          ) : null}
          <View style={styles.row}>
            <Text style={styles.label}>Name:</Text>
            <Text style={styles.value}>{clientName || "—"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Email:</Text>
            <Text style={styles.value}>{clientEmail || "—"}</Text>
          </View>
        </View>

        {clientNotes ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <View style={styles.notesBox}>
              <Text style={{ fontSize: 9, lineHeight: 1.4 }}>{clientNotes}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.tableHeader}>
            <Text style={styles.colLabel}>Description</Text>
            <Text style={styles.colAmount}>Amount (EUR gross)</Text>
            <Text style={styles.colVat}>VAT %</Text>
          </View>
          {lines.length === 0 ? (
            <View style={styles.tableRow}>
              <Text style={styles.colLabel}>—</Text>
              <Text style={styles.colAmount}>—</Text>
              <Text style={styles.colVat}>—</Text>
            </View>
          ) : (
            lines.map((line, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={styles.colLabel}>
                  {line.label}
                  {line.notes ? `\n${line.notes}` : ""}
                </Text>
                <Text style={styles.colAmount}>
                  {formatCurrency(Number(line.amount))}
                </Text>
                <Text style={styles.colVat}>{line.vat_rate}%</Text>
              </View>
            ))
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total gross:</Text>
            <Text style={styles.totalValue}>{formatCurrency(totalGross)}</Text>
          </View>
        </View>

        {specLinks.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Specification links</Text>
            {specLinks.map((link, index) => (
              <Text key={index} style={styles.linkRow}>
                {link.title}: {link.url}
              </Text>
            ))}
          </View>
        ) : null}
      </Page>
    </Document>
  );
};

import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

// PDF Styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  watermark: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    opacity: 0.05,
    width: 400,
    height: 400,
  },
  header: {
    marginBottom: 30,
    borderBottom: '3pt solid #E94444',
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  logo: {
    width: 120,
    height: 60,
    objectFit: 'contain',
  },
  companyInfo: {
    marginTop: 10,
    fontSize: 9,
    color: '#666',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#E94444',
    marginBottom: 20,
    marginTop: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
    borderBottom: '1pt solid #ddd',
    paddingBottom: 5,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  label: {
    width: '30%',
    fontWeight: 'bold',
    color: '#555',
  },
  value: {
    width: '70%',
    color: '#333',
  },
  table: {
    marginTop: 10,
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#E94444',
    color: '#fff',
    padding: 8,
    fontWeight: 'bold',
    fontSize: 9,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1pt solid #eee',
    padding: 8,
    fontSize: 9,
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottom: '1pt solid #eee',
    backgroundColor: '#f9f9f9',
    padding: 8,
    fontSize: 9,
  },
  col1: { width: '5%' },
  col2: { width: '30%' },
  col3: { width: '18%' },
  col4: { width: '10%' },
  col5: { width: '12%' },
  col6: { width: '10%' },
  col7: { width: '15%', textAlign: 'right' },
  totalsSection: {
    marginTop: 20,
    marginLeft: 'auto',
    width: '50%',
    borderTop: '2pt solid #E94444',
    paddingTop: 10,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
    paddingHorizontal: 10,
  },
  totalLabel: {
    fontSize: 10,
    color: '#555',
  },
  totalValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#333',
  },
  grandTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTop: '1pt solid #ddd',
    paddingHorizontal: 10,
  },
  grandTotalLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#E94444',
  },
  grandTotalValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#E94444',
  },
  footer: {
    marginTop: 40,
    paddingTop: 20,
    borderTop: '1pt solid #ddd',
    fontSize: 8,
    color: '#666',
  },
  footerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLeft: {
    flex: 1,
    textAlign: 'left',
  },
  footerRight: {
    alignItems: 'center',
  },
  footerLogo: {
    width: 80,
    height: 40,
    objectFit: 'contain',
  },
  paymentBox: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    marginTop: 20,
    borderRadius: 5,
    border: '1pt solid #ddd',
  },
  paymentTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#E94444',
  },
  paymentDetail: {
    fontSize: 9,
    marginBottom: 4,
    color: '#333',
  },
  notesBox: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 5,
    border: '1pt solid #ddd',
    marginTop: 8,
  },
  notesText: {
    fontSize: 9,
    color: '#333',
    lineHeight: 1.4,
  },
});

interface OrderPDFProps {
  order: any;
  company: any;
  items: any[];
  totals: any;
  createdByProfile?: any;
}

export const OrderPDF: React.FC<OrderPDFProps> = ({ order, company, items, totals, createdByProfile }) => {
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-IE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Watermark - Logo will be added here */}
        {/* <Image src="/logo.png" style={styles.watermark} /> */}

        {/* Header with Logo */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#E94444' }}>
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
              <Image src="/logo.png" style={styles.logo} alt="Company Logo" />
            </View>
          </View>
        </View>

        {/* Document Title */}
        <Text style={styles.title}>ORDER CONFIRMATION</Text>

        {/* Order Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Information</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Order Number:</Text>
            <Text style={styles.value}>{order.number}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Order Date:</Text>
            <Text style={styles.value}>
              {formatDate(order.submitted_at || order.created_at)}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Status:</Text>
            <Text style={styles.value}>{order.status.toUpperCase()}</Text>
          </View>
          {order.client_notes && (
            <View style={styles.row}>
              <Text style={styles.label}>Reference:</Text>
              <Text style={styles.value}>{order.client_notes}</Text>
            </View>
          )}
        </View>

        {/* Customer Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Details</Text>
          
          {/* Check if it's a company (has VAT number) or individual */}
          {company.vat_number ? (
            // Company format
            <>
              <View style={styles.row}>
                <Text style={styles.label}>Company:</Text>
                <Text style={styles.value}>{company.name}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>VAT Number:</Text>
                <Text style={styles.value}>{company.vat_number}</Text>
              </View>
              {createdByProfile?.full_name && (
                <View style={styles.row}>
                  <Text style={styles.label}>Contact Person:</Text>
                  <Text style={styles.value}>{createdByProfile.full_name}</Text>
                </View>
              )}
              {createdByProfile?.email && (
                <View style={styles.row}>
                  <Text style={styles.label}>Email:</Text>
                  <Text style={styles.value}>{createdByProfile.email}</Text>
                </View>
              )}
            </>
          ) : (
            // Individual format
            <>
              {createdByProfile?.full_name && (
                <View style={styles.row}>
                  <Text style={styles.label}>Name:</Text>
                  <Text style={styles.value}>{createdByProfile.full_name}</Text>
                </View>
              )}
              {createdByProfile?.email && (
                <View style={styles.row}>
                  <Text style={styles.label}>Email:</Text>
                  <Text style={styles.value}>{createdByProfile.email}</Text>
                </View>
              )}
            </>
          )}
          
          {/* Address information */}
          {company.address_line1 && (
            <>
              <View style={styles.row}>
                <Text style={styles.label}>Address:</Text>
                <Text style={styles.value}>{company.address_line1}</Text>
              </View>
              {company.address_line2 && (
                <View style={styles.row}>
                  <Text style={styles.label}></Text>
                  <Text style={styles.value}>{company.address_line2}</Text>
                </View>
              )}
              <View style={styles.row}>
                <Text style={styles.label}></Text>
                <Text style={styles.value}>
                  {company.city}, {company.postal_code}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}></Text>
                <Text style={styles.value}>{company.country}</Text>
              </View>
            </>
          )}
          {company.phone && (
            <View style={styles.row}>
              <Text style={styles.label}>Phone:</Text>
              <Text style={styles.value}>{company.phone}</Text>
            </View>
          )}
        </View>

        {/* Order Items Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Items</Text>
          <View style={styles.table}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={styles.col1}>#</Text>
              <Text style={styles.col2}>Product</Text>
              <Text style={styles.col3}>Supplier</Text>
              <Text style={styles.col4}>Qty</Text>
              <Text style={styles.col5}>Price EUR excl VAT</Text>
              <Text style={styles.col6}>VAT Rate</Text>
              <Text style={styles.col7}>Total (EUR)</Text>
            </View>

            {/* Table Rows */}
            {items.map((item, index) => {
              // Client enters GROSS price in PLN (incl. VAT)
              // Convert to EUR: PLN / 3.1 = EUR (gross)
              const grossEUR = item.unit_price / 3.1;
              
              // For 0% VAT orders, show the same net price as 23% VAT orders would have
              // This ensures consistency and avoids confusion
              let netEUR, lineTotal, displayTotal;
              
              if (order.vat_rate === 0) {
                // For 0% VAT: calculate what the net price would be at 23% VAT
                // This ensures the "Price EUR excl VAT" shows the same value as 23% VAT orders
                const netAt23Percent = grossEUR / 1.23;
                netEUR = netAt23Percent;
                lineTotal = netAt23Percent * item.quantity;
                displayTotal = lineTotal; // Show net total for 0% VAT
              } else {
                // For 23% VAT: normal calculation
                netEUR = grossEUR / (1 + (order.vat_rate / 100));
                lineTotal = netEUR * item.quantity;
                displayTotal = grossEUR * item.quantity; // Show gross total for 23% VAT
              }
              
              return (
                <View
                  key={item.id}
                  style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
                >
                  <Text style={styles.col1}>{item.line_number}</Text>
                  <Text style={styles.col2}>{item.product_name}</Text>
                  <Text style={styles.col3}>{item.supplier_name || '-'}</Text>
                  <Text style={styles.col4}>
                    {item.quantity} {item.unit_of_measure === 'm2' ? 'm²' : 'pcs'}
                  </Text>
                  <Text style={styles.col5}>
                    {formatCurrency(netEUR, 'EUR')}
                  </Text>
                  <Text style={styles.col6}>
                    {order.vat_rate}%
                  </Text>
                  <Text style={styles.col7}>
                    {formatCurrency(displayTotal, 'EUR')}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              {order.vat_rate === 0 ? 'Subtotal (net):' : 'Subtotal (excl. VAT):'}
            </Text>
            <Text style={styles.totalValue}>
              {formatCurrency(totals?.subtotal_without_vat || 0, order.currency)}
            </Text>
          </View>
          {order.vat_rate > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>VAT ({order.vat_rate}%):</Text>
              <Text style={styles.totalValue}>
                {formatCurrency(totals?.vat_amount || 0, order.currency)}
              </Text>
            </View>
          )}
          {(totals?.shipping_cost || 0) > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Shipping:</Text>
              <Text style={styles.totalValue}>
                {formatCurrency(totals.shipping_cost, order.currency)}
              </Text>
            </View>
          )}
          <View style={styles.grandTotal}>
            <Text style={styles.grandTotalLabel}>
              {order.vat_rate === 0 ? 'TOTAL (net):' : 'GRAND TOTAL:'}
            </Text>
            <Text style={styles.grandTotalValue}>
              {formatCurrency(totals?.grand_total || 0, order.currency)}
            </Text>
          </View>
        </View>

        {/* Order Notes */}
        {order.client_notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Order Notes</Text>
            <View style={styles.notesBox}>
              <Text style={styles.notesText}>{order.client_notes}</Text>
            </View>
          </View>
        )}

        {/* Payment Information */}
        <View style={styles.paymentBox}>
          <Text style={styles.paymentTitle}>Payment Information</Text>
          <Text style={styles.paymentDetail}>
            Bank Name: PKO Bank Polski
          </Text>
          <Text style={styles.paymentDetail}>
            Account Number (IBAN): PL 77 1020 2313 0000 3602 1175 9752
          </Text>
          <Text style={styles.paymentDetail}>
            BIC/SWIFT: BPKOPLPW
          </Text>
          <Text style={styles.paymentDetail}>
            Reference: {order.number}
          </Text>
          <Text style={{ ...styles.paymentDetail, marginTop: 8, fontWeight: 'bold' }}>
            Please include the order number in your payment reference.
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerContent}>
            <View style={styles.footerLeft}>
              <Text>ImportFromPoland | Company Registration: PL6343059711</Text>
              <Text>Registered office: Al Wojciecha Korfantego 113/3</Text>
              <Text>40-156 Katowice, Poland</Text>
              <Text>REGON: 542 538 814 | KRS: 0001190377</Text>
              <Text style={{ marginTop: 5 }}>
                All prices include delivery to Ireland. VAT at {order.vat_rate}% applies.
              </Text>
              <Text style={{ marginTop: 5 }}>
                Thank you for your business!
              </Text>
            </View>
            <View style={styles.footerRight}>
              <Image src="/logo.png" style={styles.footerLogo} alt="Company Logo" />
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
};


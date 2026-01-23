import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Register Roboto font with full Unicode support for Polish characters
// Roboto supports all Polish characters (ą, ć, ę, ł, ń, ó, ś, ź, ż)
try {
  Font.register({
    family: 'Roboto',
    fonts: [
      {
        src: 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxP.ttf',
      },
      {
        src: 'https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlfBBc4.ttf',
        fontWeight: 'bold',
      },
    ],
  });
} catch (error) {
  // Font already registered or registration failed - use fallback
  console.warn('Font registration failed, using fallback:', error);
}

// PDF Styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Roboto',
    backgroundColor: '#ffffff',
  },
  header: {
    marginBottom: 30,
    borderBottom: '3pt solid #E94444',
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#E94444',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  section: {
    marginTop: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
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
  col1: { width: '8%' },
  col2: { width: '40%' },
  col3: { width: '20%' },
  col4: { width: '15%', textAlign: 'center' },
  col5: { width: '17%', textAlign: 'right' },
  footer: {
    marginTop: 30,
    paddingTop: 20,
    borderTop: '1pt solid #eee',
    fontSize: 8,
    color: '#666',
    textAlign: 'center',
  },
});

interface WarehouseDeliveryPDFProps {
  supplier: string;
  orderDate: string;
  items: Array<{
    product_name: string;
    polish_product_name?: string;
    order_number: string;
    customer_name: string;
    customer_profile?: { full_name: string };
    quantity_ordered: number;
    quantity_received: number;
    unit_of_measure: string;
  }>;
  type: 'incoming' | 'outgoing';
  order?: {
    number: string;
    company: { name: string };
    created_by_profile?: { full_name: string };
    created_at: string;
    items: Array<{
      line_number: number;
      product_name: string;
      polish_product_name?: string;
      supplier_name?: string;
      quantity: number;
      unit_of_measure: string;
      received_in_warehouse: boolean;
      packed: boolean;
    }>;
  };
}

export const WarehouseDeliveryPDF: React.FC<WarehouseDeliveryPDFProps> = ({ 
  supplier, 
  orderDate, 
  items,
  type,
  order 
}) => {
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('pl-PL', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  if (type === 'incoming') {
    // Incoming delivery from supplier
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.title}>Dostawa od Dostawcy</Text>
            <Text style={styles.subtitle}>Dostawca: {supplier}</Text>
            <Text style={styles.subtitle}>Data zamówienia: {formatDate(orderDate)}</Text>
            <Text style={styles.subtitle}>Liczba pozycji: {items.length}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pozycje do odbioru</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.col1}>#</Text>
                <Text style={styles.col2}>Produkt</Text>
                <Text style={styles.col3}>Zamówienie</Text>
                <Text style={styles.col4}>Klient</Text>
                <Text style={styles.col4}>Ilość</Text>
                <Text style={styles.col5}>Dostarczone</Text>
              </View>
              {items.map((item, index) => (
                <View
                  key={index}
                  style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
                >
                  <Text style={styles.col1}>{index + 1}</Text>
                  <Text style={styles.col2}>
                    {item.polish_product_name || item.product_name}
                  </Text>
                  <Text style={styles.col3}>{item.order_number}</Text>
                  <View style={styles.col4}>
                    <Text>{item.customer_name}</Text>
                    {item.customer_profile?.full_name && (
                      <Text style={{ fontSize: 8, color: '#666' }}>
                        {item.customer_profile.full_name}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.col4}>
                    {item.quantity_ordered} {item.unit_of_measure === 'm2' ? 'm²' : 'szt'}
                  </Text>
                  <Text style={styles.col5}>
                    {item.quantity_received > 0 ? '✓' : '□'}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.footer}>
            <Text>Wygenerowano: {formatDate(new Date().toISOString())}</Text>
          </View>
        </Page>
      </Document>
    );
  } else {
    // Outgoing order to client
    if (!order) return null;

    const receivedCount = order.items.filter(item => item.received_in_warehouse).length;
    const packedCount = order.items.filter(item => item.packed).length;

    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.title}>Zamówienie do Pakowania</Text>
            <Text style={styles.subtitle}>Numer zamówienia: {order.number}</Text>
            <Text style={styles.subtitle}>Klient: {order.company.name}</Text>
            {order.created_by_profile?.full_name && (
              <Text style={styles.subtitle}>Kontakt: {order.created_by_profile.full_name}</Text>
            )}
            <Text style={styles.subtitle}>Data: {formatDate(order.created_at)}</Text>
            <Text style={styles.subtitle}>
              Status: {receivedCount}/{order.items.length} dostarczone, {packedCount}/{order.items.length} spakowane
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pozycje do pakowania</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.col1}>#</Text>
                <Text style={styles.col2}>Produkt</Text>
                <Text style={styles.col3}>Dostawca</Text>
                <Text style={styles.col4}>Ilość</Text>
                <Text style={styles.col4}>Dostarczone</Text>
                <Text style={styles.col5}>Spakowane</Text>
              </View>
              {order.items.map((item, index) => (
                <View
                  key={index}
                  style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
                >
                  <Text style={styles.col1}>{item.line_number}</Text>
                  <Text style={styles.col2}>
                    {item.polish_product_name || item.product_name}
                  </Text>
                  <Text style={styles.col3}>{item.supplier_name || '-'}</Text>
                  <Text style={styles.col4}>
                    {item.quantity} {item.unit_of_measure === 'm2' ? 'm²' : 'szt'}
                  </Text>
                  <Text style={styles.col4}>
                    {item.received_in_warehouse ? '✓' : '□'}
                  </Text>
                  <Text style={styles.col5}>
                    {item.packed ? '✓' : '□'}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.footer}>
            <Text>Wygenerowano: {formatDate(new Date().toISOString())}</Text>
          </View>
        </Page>
      </Document>
    );
  }
};

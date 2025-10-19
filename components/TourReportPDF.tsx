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
  col1: { width: '15%' },
  col2: { width: '25%' },
  col3: { width: '20%' },
  col4: { width: '15%' },
  col5: { width: '15%' },
  col6: { width: '10%' },
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
  itineraryBox: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    marginTop: 8,
    borderRadius: 5,
    border: '1pt solid #ddd',
  },
  itineraryTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 6,
    color: '#E94444',
  },
  itineraryText: {
    fontSize: 9,
    color: '#333',
    lineHeight: 1.4,
  },
});

interface TourReportPDFProps {
  tour: any;
  bookings: any[];
}

export const TourReportPDF: React.FC<TourReportPDFProps> = ({ tour, bookings }) => {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-IE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (time: string) => {
    if (!time) return '';
    return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-IE', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const confirmedBookings = bookings.filter(b => b.status === 'confirmed');
  const pendingBookings = bookings.filter(b => b.status === 'pending');

  return (
    <Document>
      <Page size="A4" style={styles.page}>
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
        <Text style={styles.title}>TOUR REPORT</Text>

        {/* Tour Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tour Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Tour Title:</Text>
            <Text style={styles.value}>{tour.title}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Dates:</Text>
            <Text style={styles.value}>
              {formatDate(tour.start_date)} - {formatDate(tour.end_date)}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Route:</Text>
            <Text style={styles.value}>
              {tour.departure_airport} → {tour.arrival_airport}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Max Spaces:</Text>
            <Text style={styles.value}>{tour.max_spaces}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Price (Single):</Text>
            <Text style={styles.value}>€{tour.price_single}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Price (Double):</Text>
            <Text style={styles.value}>€{tour.price_double}</Text>
          </View>
        </View>

        {/* Flight Information */}
        {(tour.outbound_carrier || tour.return_carrier) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Flight Information</Text>
            
            {tour.outbound_carrier && (
              <View style={styles.itineraryBox}>
                <Text style={styles.itineraryTitle}>Outbound Flight</Text>
                <Text style={styles.itineraryText}>
                  {tour.outbound_carrier} • {formatTime(tour.outbound_departure_time)} - {formatTime(tour.outbound_arrival_time)}
                </Text>
                <Text style={styles.itineraryText}>
                  {formatDate(tour.outbound_departure_date || tour.start_date)} • {tour.departure_airport} → {tour.arrival_airport}
                </Text>
              </View>
            )}

            {tour.return_carrier && (
              <View style={styles.itineraryBox}>
                <Text style={styles.itineraryTitle}>Return Flight</Text>
                <Text style={styles.itineraryText}>
                  {tour.return_carrier} • {formatTime(tour.return_departure_time)} - {formatTime(tour.return_arrival_time)}
                </Text>
                <Text style={styles.itineraryText}>
                  {formatDate(tour.return_departure_date || tour.end_date)} • {tour.arrival_airport} → {tour.departure_airport}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Daily Itinerary */}
        {(tour.day1_hotel || tour.day2_hotel || tour.day3_hotel) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Daily Itinerary</Text>
            
            {tour.day1_hotel && (
              <View style={styles.itineraryBox}>
                <Text style={styles.itineraryTitle}>Day 1 - {formatDate(tour.start_date)}</Text>
                <Text style={styles.itineraryText}>
                  <Text style={{ fontWeight: 'bold' }}>Hotel:</Text> {tour.day1_hotel}
                </Text>
                {tour.day1_dinner && (
                  <Text style={styles.itineraryText}>
                    <Text style={{ fontWeight: 'bold' }}>Dinner:</Text> {tour.day1_dinner}
                  </Text>
                )}
                {tour.day1_activities && (
                  <Text style={styles.itineraryText}>
                    <Text style={{ fontWeight: 'bold' }}>Activities:</Text> {tour.day1_activities}
                  </Text>
                )}
              </View>
            )}

            {tour.day2_hotel && (
              <View style={styles.itineraryBox}>
                <Text style={styles.itineraryTitle}>Day 2 - {formatDate(tour.start_date, 1)}</Text>
                <Text style={styles.itineraryText}>
                  <Text style={{ fontWeight: 'bold' }}>Hotel:</Text> {tour.day2_hotel}
                </Text>
                {tour.day2_dinner && (
                  <Text style={styles.itineraryText}>
                    <Text style={{ fontWeight: 'bold' }}>Dinner:</Text> {tour.day2_dinner}
                  </Text>
                )}
                {tour.day2_activities && (
                  <Text style={styles.itineraryText}>
                    <Text style={{ fontWeight: 'bold' }}>Activities:</Text> {tour.day2_activities}
                  </Text>
                )}
              </View>
            )}

            {tour.day3_hotel && (
              <View style={styles.itineraryBox}>
                <Text style={styles.itineraryTitle}>Day 3 - {formatDate(tour.end_date)}</Text>
                <Text style={styles.itineraryText}>
                  <Text style={{ fontWeight: 'bold' }}>Hotel:</Text> {tour.day3_hotel}
                </Text>
                {tour.day3_dinner && (
                  <Text style={styles.itineraryText}>
                    <Text style={{ fontWeight: 'bold' }}>Dinner:</Text> {tour.day3_dinner}
                  </Text>
                )}
                {tour.day3_activities && (
                  <Text style={styles.itineraryText}>
                    <Text style={{ fontWeight: 'bold' }}>Activities:</Text> {tour.day3_activities}
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* Confirmed Participants */}
        {confirmedBookings.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Confirmed Participants ({confirmedBookings.length})</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.col1}>#</Text>
                <Text style={styles.col2}>Company</Text>
                <Text style={styles.col3}>Attendee 1</Text>
                <Text style={styles.col4}>Attendee 2</Text>
                <Text style={styles.col5}>Contact</Text>
                <Text style={styles.col6}>Type</Text>
              </View>
              {confirmedBookings.map((booking, index) => (
                <View
                  key={booking.id}
                  style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
                >
                  <Text style={styles.col1}>{index + 1}</Text>
                  <Text style={styles.col2}>{booking.company?.name || '-'}</Text>
                  <Text style={styles.col3}>{booking.attendee1_name}</Text>
                  <Text style={styles.col4}>{booking.attendee2_name || '-'}</Text>
                  <Text style={styles.col5}>{booking.contact_number}</Text>
                  <Text style={styles.col6}>{booking.booking_type === 'single' ? 'Single' : 'Double'}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Pending Participants */}
        {pendingBookings.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pending Participants ({pendingBookings.length})</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.col1}>#</Text>
                <Text style={styles.col2}>Company</Text>
                <Text style={styles.col3}>Attendee 1</Text>
                <Text style={styles.col4}>Attendee 2</Text>
                <Text style={styles.col5}>Contact</Text>
                <Text style={styles.col6}>Type</Text>
              </View>
              {pendingBookings.map((booking, index) => (
                <View
                  key={booking.id}
                  style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
                >
                  <Text style={styles.col1}>{index + 1}</Text>
                  <Text style={styles.col2}>{booking.company?.name || '-'}</Text>
                  <Text style={styles.col3}>{booking.attendee1_name}</Text>
                  <Text style={styles.col4}>{booking.attendee2_name || '-'}</Text>
                  <Text style={styles.col5}>{booking.contact_number}</Text>
                  <Text style={styles.col6}>{booking.booking_type === 'single' ? 'Single' : 'Double'}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Total Bookings:</Text>
            <Text style={styles.value}>{bookings.length}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Confirmed:</Text>
            <Text style={styles.value}>{confirmedBookings.length}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Pending:</Text>
            <Text style={styles.value}>{pendingBookings.length}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Available Spaces:</Text>
            <Text style={styles.value}>{tour.max_spaces - confirmedBookings.length}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerContent}>
            <View style={styles.footerLeft}>
              <Text>ImportFromPoland | Company Registration: PL6343059711</Text>
              <Text>
                Tour Report generated on {formatDate(new Date().toISOString())}
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

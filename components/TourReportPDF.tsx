import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

// PDF Styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Times-Roman',
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
  dayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dayBadge: {
    backgroundColor: '#E94444',
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 10,
  },
  dayHeaderMeta: {
    flex: 1,
  },
  dayDate: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#111',
  },
  dayHotel: {
    fontSize: 8,
    color: '#666',
    marginTop: 2,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingBottom: 8,
    borderBottom: '0.5pt solid #e5e5e5',
  },
  stopTimeline: {
    width: 14,
    alignItems: 'center',
    marginRight: 6,
  },
  stopDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#E94444',
  },
  stopLogo: {
    width: 28,
    height: 28,
    objectFit: 'contain',
    marginRight: 8,
  },
  stopLogoPlaceholder: {
    width: 28,
    height: 28,
    marginRight: 8,
    backgroundColor: '#eee',
    borderRadius: 3,
  },
  stopBody: {
    flex: 1,
    paddingRight: 8,
  },
  stopName: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 2,
  },
  stopDesc: {
    fontSize: 8,
    color: '#555',
    lineHeight: 1.35,
  },
  stopDuration: {
    fontSize: 8,
    color: '#888',
    width: 48,
    textAlign: 'right',
    marginRight: 8,
  },
  stopThumb: {
    width: 72,
    height: 48,
    objectFit: 'cover',
    borderRadius: 3,
  },
  stopThumbPlaceholder: {
    width: 72,
    height: 48,
    backgroundColor: '#e8e8e8',
    borderRadius: 3,
  },
});

interface TourReportPDFProps {
  tour: any;
  bookings: any[];
  stops?: any[];
}

export const TourReportPDF: React.FC<TourReportPDFProps> = ({
  tour,
  bookings,
  stops = [],
}) => {
  const formatDate = (date: string, addDays = 0) => {
    const d = new Date(date);
    if (addDays) d.setDate(d.getDate() + addDays);
    return d.toLocaleDateString('en-IE', {
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

  const formatDuration = (mins: number | null | undefined) => {
    if (mins == null || mins <= 0) return '';
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h ${m}min` : `${h}h`;
  };

  const stopsForDay = (day: number) =>
    (stops || [])
      .filter((s: any) => s.day_number === day)
      .sort((a: any, b: any) => a.sort_order - b.sort_order);

  const renderDayStops = (day: number, legacyActivities?: string) => {
    const dayStops = stopsForDay(day);
    if (dayStops.length > 0) {
      return dayStops.map((s: any, i: number) => {
        const name = s.place?.name || 'Stop';
        const dur = formatDuration(s.planned_duration_minutes);
        const desc = s.place?.short_description || s.place?.highlights;
        const note = s.notes;
        const logoUrl = s.place?.logo_url;
        const thumbUrl = s.place?.thumbnail_url;
        return (
          <View key={s.id || i} style={styles.stopRow} wrap={false}>
            <View style={styles.stopTimeline}>
              <View style={styles.stopDot} />
            </View>
            {logoUrl ? (
              <Image src={logoUrl} style={styles.stopLogo} />
            ) : (
              <View style={styles.stopLogoPlaceholder} />
            )}
            <View style={styles.stopBody}>
              <Text style={styles.stopName}>{name}</Text>
              {desc ? <Text style={styles.stopDesc}>{desc}</Text> : null}
              {note ? (
                <Text style={styles.stopDesc}>{note}</Text>
              ) : null}
            </View>
            <Text style={styles.stopDuration}>{dur || ''}</Text>
            {thumbUrl ? (
              <Image src={thumbUrl} style={styles.stopThumb} />
            ) : (
              <View style={styles.stopThumbPlaceholder} />
            )}
          </View>
        );
      });
    }
    if (legacyActivities) {
      return (
        <Text style={styles.itineraryText}>
          <Text style={{ fontWeight: 'bold' }}>Activities:</Text> {legacyActivities}
        </Text>
      );
    }
    return null;
  };

  const renderDayBlock = (
    day: number,
    dateLabel: string,
    hotel?: string,
    dinner?: string,
    legacyActivities?: string
  ) => {
    const dayStops = stopsForDay(day);
    if (!hotel && !dinner && !legacyActivities && dayStops.length === 0) {
      return null;
    }
    return (
      <View style={styles.itineraryBox} wrap={false}>
        <View style={styles.dayHeaderRow}>
          <Text style={styles.dayBadge}>DAY {day}</Text>
          <View style={styles.dayHeaderMeta}>
            <Text style={styles.dayDate}>{dateLabel}</Text>
            {hotel ? (
              <Text style={styles.dayHotel}>Hotel: {hotel}</Text>
            ) : null}
            {dinner ? (
              <Text style={styles.dayHotel}>Dinner: {dinner}</Text>
            ) : null}
          </View>
        </View>
        {renderDayStops(day, legacyActivities)}
      </View>
    );
  };

  const hasAnyDay =
    tour.day1_hotel ||
    tour.day2_hotel ||
    tour.day3_hotel ||
    tour.day1_activities ||
    tour.day2_activities ||
    tour.day3_activities ||
    (stops && stops.length > 0);

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
        {hasAnyDay && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Daily Itinerary</Text>
            {renderDayBlock(
              1,
              formatDate(tour.start_date),
              tour.day1_hotel,
              tour.day1_dinner,
              tour.day1_activities
            )}
            {renderDayBlock(
              2,
              formatDate(tour.start_date, 1),
              tour.day2_hotel,
              tour.day2_dinner,
              tour.day2_activities
            )}
            {renderDayBlock(
              3,
              formatDate(tour.end_date),
              tour.day3_hotel,
              tour.day3_dinner,
              tour.day3_activities
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

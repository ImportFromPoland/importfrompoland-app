"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import { Plus, Calendar, MapPin, Users, Edit, Trash2, Archive, CheckCircle, FileText } from "lucide-react";
import { TourPlacesManager } from "@/components/admin/TourPlacesManager";
import { TourDayStopsEditor } from "@/components/admin/TourDayStopsEditor";
import {
  stopsToActivitiesText,
  type TourPlace,
  type TourStopRow,
} from "@/lib/tour-places";

interface Tour {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  departure_airport: string;
  arrival_airport: string;
  max_spaces: number;
  price_single: number;
  price_double: number;
  itinerary: string;
  included_items: string[];
  booking_process: string;
  is_active: boolean;
  is_archived: boolean;
  available_spaces: number;
  outbound_carrier?: string;
  outbound_departure_time?: string;
  outbound_arrival_time?: string;
  outbound_departure_date?: string;
  outbound_arrival_date?: string;
  return_carrier?: string;
  return_departure_time?: string;
  return_arrival_time?: string;
  return_departure_date?: string;
  return_arrival_date?: string;
  day1_hotel?: string;
  day1_dinner?: string;
  day1_activities?: string;
  day2_hotel?: string;
  day2_dinner?: string;
  day2_activities?: string;
  day3_hotel?: string;
  day3_dinner?: string;
  day3_activities?: string;
}

export default function AdminToursPage() {
  const supabase = createClient();
  const [tours, setTours] = useState<Tour[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTour, setEditingTour] = useState<Tour | null>(null);
  const [activeTab, setActiveTab] = useState("active");
  const [places, setPlaces] = useState<TourPlace[]>([]);
  const [tourStops, setTourStops] = useState<TourStopRow[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    start_date: '',
    end_date: '',
    departure_airport: '',
    arrival_airport: '',
    max_spaces: 6,
    price_single: 350,
    price_double: 550,
    itinerary: '',
    included_items: `✈️ Airport Transfers: from Katowice (KTW) or Kraków (KRK)
🏨 2 nights at a 3★ hotel in Katowice with breakfast
🍽️ Group dinner — with vegetarian and gluten-free options
🛒 Guided store & showroom visits —windows, doors, tiles, flooring, furniture and more!
📋 Personalised assistance — we help you understand details, specification and compatibility when you need`,
    booking_process: `1. Reserve your places using the form below (48-hour pending reservation)
2. Book your flights in line with the tour dates
3. Send us confirmation via email (info@importfrompoland.com), WhatsApp, Facebook or Instagram message
4. We'll confirm your places once flight booking is verified
5. You're all set for your Polish adventure!`,
    is_active: true,
    is_archived: false,
    // Flight information
    outbound_carrier: '',
    outbound_departure_time: '',
    outbound_arrival_time: '',
    outbound_departure_date: '',
    outbound_arrival_date: '',
    return_carrier: '',
    return_departure_time: '',
    return_arrival_time: '',
    return_departure_date: '',
    return_arrival_date: '',
    // Daily itinerary
    day1_hotel: '',
    day1_dinner: '',
    day1_activities: '',
    day2_hotel: '',
    day2_dinner: '',
    day2_activities: '',
    day3_hotel: '',
    day3_dinner: '',
    day3_activities: ''
  });

  useEffect(() => {
    loadTours();
    loadBookings();
    loadPlaces();
  }, []);

  const loadPlaces = async () => {
    try {
      const { data, error } = await supabase
        .from("tour_places")
        .select("*")
        .order("name");
      if (error) throw error;
      setPlaces((data || []) as TourPlace[]);
    } catch (e) {
      console.error("Error loading tour places:", e);
    }
  };

  const loadTourStops = async (tourId: string) => {
    try {
      const { data, error } = await supabase
        .from("tour_stops")
        .select("*, place:tour_places(*)")
        .eq("tour_id", tourId)
        .order("day_number")
        .order("sort_order");
      if (error) throw error;
      setTourStops(
        (data || []).map((row: any) => ({
          id: row.id,
          place_id: row.place_id,
          day_number: row.day_number,
          sort_order: row.sort_order,
          planned_duration_minutes: row.planned_duration_minutes,
          notes: row.notes,
          place: row.place as TourPlace | null,
        }))
      );
    } catch (e) {
      console.error("Error loading tour stops:", e);
      setTourStops([]);
    }
  };

  const saveTourStops = async (tourId: string, stops: TourStopRow[]) => {
    const { error: delError } = await supabase
      .from("tour_stops")
      .delete()
      .eq("tour_id", tourId);
    if (delError) throw delError;

    if (stops.length === 0) return;

    const rows = stops.map((s) => ({
      tour_id: tourId,
      place_id: s.place_id,
      day_number: s.day_number,
      sort_order: s.sort_order,
      planned_duration_minutes: s.planned_duration_minutes,
      notes: s.notes,
    }));

    const { error: insError } = await supabase.from("tour_stops").insert(rows);
    if (insError) throw insError;
  };

  const hotelPlaces = places.filter((p) => p.kind === "hotel" && p.is_active);

  const hotelSelectValue = (hotelName: string) => {
    const match = hotelPlaces.find((h) => h.name === hotelName);
    return match?.id || (hotelName ? "__custom__" : "__none__");
  };

  const applyHotelSelection = (
    dayKey: "day1_hotel" | "day2_hotel" | "day3_hotel",
    placeId: string
  ) => {
    if (placeId === "__none__") {
      setFormData((prev) => ({ ...prev, [dayKey]: "" }));
      return;
    }
    if (placeId === "__custom__") return;
    const place = places.find((p) => p.id === placeId);
    if (place) {
      setFormData((prev) => ({ ...prev, [dayKey]: place.name }));
    }
  };

  const loadTours = async () => {
    try {
      const { data: tours, error } = await supabase
        .from('tours')
        .select('*')
        .order('start_date', { ascending: true });

      if (error) throw error;

      // Calculate available spaces for each tour
      const toursWithSpaces = await Promise.all(
        (tours || []).map(async (tour) => {
          const { data: bookings } = await supabase
            .from('tour_bookings')
            .select('booking_type')
            .eq('tour_id', tour.id)
            .eq('status', 'confirmed');

          const bookedSpaces = bookings?.reduce((total, booking) => {
            return total + (booking.booking_type === 'single' ? 1 : 2);
          }, 0) || 0;

          return {
            ...tour,
            available_spaces: tour.max_spaces - bookedSpaces
          };
        })
      );

      setTours(toursWithSpaces);
    } catch (error) {
      console.error("Error loading tours:", error);
      // Fallback to mock data if database fails
      const mockTours: Tour[] = [
        {
          id: "1",
          title: "Shannon to Krakow Tour",
          start_date: "2024-10-22",
          end_date: "2024-10-24",
          departure_airport: "Shannon (SNN)",
          arrival_airport: "Krakow (KRK)",
          max_spaces: 6,
          price_single: 350,
          price_double: 550,
          itinerary: "Mock itinerary",
          included_items: ["Mock included items"],
          booking_process: "Mock booking process",
          is_active: true,
          is_archived: false,
          available_spaces: 6
        }
      ];
      setTours(mockTours);
    } finally {
      setLoading(false);
    }
  };

  const loadBookings = async () => {
    try {
      // First try to get all bookings without joins to see if RLS is the issue
      const { data: allBookings, error: allError } = await supabase
        .from('tour_bookings')
        .select('*')
        .order('created_at', { ascending: false });

      console.log("All bookings (no joins):", allBookings);
      console.log("All bookings error:", allError);

      // Then try with joins - get bookings for upcoming tours (regardless of archive status)
      const { data: bookings, error } = await supabase
        .from('tour_bookings')
        .select(`
          *,
          tour:tours(*),
          company:companies(*)
        `)
        .gte('tour.start_date', new Date().toISOString().split('T')[0]) // Only upcoming tours
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error loading bookings with joins:", error);
        // If joins fail, use the data without joins but filter manually
        const filteredBookings = (allBookings || []).filter(booking => {
          // We can't filter by tour details without joins, so we'll show all
          // This is a fallback - ideally the join should work
          return true;
        });
        setBookings(filteredBookings);
        return;
      }
      
      console.log("Bookings with joins loaded:", bookings);
      
      // Sort bookings chronologically by tour start date (nearest first)
      const sortedBookings = (bookings || []).sort((a, b) => {
        const dateA = new Date(a.tour?.start_date || a.created_at);
        const dateB = new Date(b.tour?.start_date || b.created_at);
        return dateA.getTime() - dateB.getTime();
      });
      
      setBookings(sortedBookings);
    } catch (error) {
      console.error("Error loading bookings:", error);
    }
  };

  const confirmBooking = async (bookingId: string) => {
    try {
      const { error } = await supabase
        .from('tour_bookings')
        .update({ status: 'confirmed' })
        .eq('id', bookingId);

      if (error) throw error;
      alert('Booking confirmed successfully!');
      loadBookings();
    } catch (error) {
      console.error("Error confirming booking:", error);
      alert("Error confirming booking. Please try again.");
    }
  };

  const deleteBooking = async (bookingId: string) => {
    if (!confirm("Czy na pewno chcesz usunąć tę rezerwację? Ta operacja jest nieodwracalna!")) {
      return;
    }

    try {
      const { error } = await supabase
        .from('tour_bookings')
        .delete()
        .eq('id', bookingId);

      if (error) throw error;
      alert('Rezerwacja została usunięta!');
      await loadBookings();
    } catch (error) {
      console.error('Error deleting booking:', error);
      alert('Błąd podczas usuwania rezerwacji');
    }
  };

  const generateVisitorReport = async (tourId: string, tourTitle: string, startDate: string, endDate: string) => {
    try {
      // Get all confirmed bookings for this tour
      const { data: tourBookings, error } = await supabase
        .from('tour_bookings')
        .select(`
          *,
          company:companies(*)
        `)
        .eq('tour_id', tourId)
        .eq('status', 'confirmed');

      if (error) throw error;

      // Create HTML report
      const reportHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            @page { size: A4; margin: 20mm; }
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #E94444; padding-bottom: 20px; }
            .logo { font-size: 24px; font-weight: bold; color: #E94444; margin-bottom: 10px; }
            .title { font-size: 20px; font-weight: bold; margin-bottom: 10px; }
            .dates { font-size: 14px; color: #666; margin-bottom: 20px; }
            .participants { margin-top: 30px; }
            .participant { 
              border: 1px solid #ddd; 
              padding: 15px; 
              margin-bottom: 10px; 
              border-radius: 5px;
              background: #f9f9f9;
            }
            .company-name { font-weight: bold; font-size: 16px; color: #333; margin-bottom: 5px; }
            .contact-info { font-size: 14px; color: #666; }
            .summary { 
              margin-top: 30px; 
              padding: 20px; 
              background: #f0f0f0; 
              border-radius: 5px;
              text-align: center;
            }
            .summary h3 { margin: 0 0 10px 0; color: #E94444; }
            .summary p { margin: 5px 0; font-size: 16px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">ImportFromPoland</div>
            <div class="title">Raport Odwiedzających Wycieczkę</div>
            <div class="dates">${tourTitle} - ${formatDate(startDate)} do ${formatDate(endDate)}</div>
          </div>

          <div class="participants">
            <h3>Lista Uczestników:</h3>
            ${tourBookings.map((booking, index) => `
              <div class="participant">
                <div class="company-name">${index + 1}. ${booking.company?.name || 'Nieznana firma'}</div>
                <div class="contact-info">
                  <strong>Uczestnicy:</strong><br>
                  ${booking.attendee1_name ? `• ${booking.attendee1_name}` : ''}
                  ${booking.attendee2_name ? `<br>• ${booking.attendee2_name}` : ''}
                  ${booking.attendee3_name ? `<br>• ${booking.attendee3_name}` : ''}
                  ${booking.attendee4_name ? `<br>• ${booking.attendee4_name}` : ''}
                  ${booking.attendee5_name ? `<br>• ${booking.attendee5_name}` : ''}
                  ${booking.attendee6_name ? `<br>• ${booking.attendee6_name}` : ''}
                  <br><br>
                  <strong>Kontakt:</strong> ${booking.company?.contact_person || 'Brak danych'}<br>
                  <strong>Email:</strong> ${booking.company?.email || 'Brak danych'}<br>
                  <strong>Telefon:</strong> ${booking.company?.phone || 'Brak danych'}<br>
                  <strong>Adres:</strong> ${booking.company?.address || 'Brak danych'}
                </div>
              </div>
            `).join('')}
          </div>

          <div class="summary">
            <h3>Podsumowanie</h3>
            <p><strong>Liczba uczestników:</strong> ${tourBookings.length}</p>
            <p><strong>Data wycieczki:</strong> ${formatDate(startDate)} - ${formatDate(endDate)}</p>
            <p><strong>Data wygenerowania raportu:</strong> ${new Date().toLocaleDateString('pl-PL')}</p>
          </div>
        </body>
        </html>
      `;

      // Open in new window for printing
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(reportHTML);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 250);
      }
    } catch (error) {
      console.error('Error generating visitor report:', error);
      alert('Błąd generowania raportu odwiedzających');
    }
  };

  const generateTourReport = async (tourId: string) => {
    try {
      // Get tour details
      const { data: tour } = await supabase
        .from('tours')
        .select('*')
        .eq('id', tourId)
        .single();

      if (!tour) {
        alert('Tour not found');
        return;
      }

      // Get bookings for this tour
      const { data: tourBookings } = await supabase
        .from('tour_bookings')
        .select(`
          *,
          company:companies(*)
        `)
        .eq('tour_id', tourId)
        .order('created_at', { ascending: true });

      const { data: stopsData } = await supabase
        .from("tour_stops")
        .select("*, place:tour_places(*)")
        .eq("tour_id", tourId)
        .order("day_number")
        .order("sort_order");

      // Dynamic import to avoid SSR issues with react-pdf
      const { pdf } = await import('@react-pdf/renderer');
      const { TourReportPDF } = await import('@/components/TourReportPDF');
      const React = await import('react');

      // Generate PDF
      const blob = await pdf(
        React.createElement(TourReportPDF, {
          tour,
          bookings: tourBookings || [],
          stops: stopsData || [],
        }) as any
      ).toBlob();

      // Download PDF
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Tour_Report_${tour.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('PDF generation error:', error);
      alert("Error generating PDF: " + error.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const day1_activities = tourStops.some((s) => s.day_number === 1)
        ? stopsToActivitiesText(tourStops, 1)
        : formData.day1_activities;
      const day2_activities = tourStops.some((s) => s.day_number === 2)
        ? stopsToActivitiesText(tourStops, 2)
        : formData.day2_activities;
      const day3_activities = tourStops.some((s) => s.day_number === 3)
        ? stopsToActivitiesText(tourStops, 3)
        : formData.day3_activities;

      // First try with basic fields only
      const basicTourData = {
        title: formData.title,
        start_date: formData.start_date,
        end_date: formData.end_date,
        departure_airport: formData.departure_airport,
        arrival_airport: formData.arrival_airport,
        max_spaces: parseInt(formData.max_spaces.toString()),
        price_single: parseFloat(formData.price_single.toString()),
        price_double: parseFloat(formData.price_double.toString()),
        itinerary: formData.itinerary,
        included_items: formData.included_items.split('\n').filter(item => item.trim()),
        booking_process: formData.booking_process,
        is_active: formData.is_active,
        is_archived: formData.is_archived
      };

      // Try to add new fields if they exist
      const tourData = {
        ...basicTourData,
        // Only include new fields if they have values
        ...(formData.outbound_carrier && { outbound_carrier: formData.outbound_carrier }),
        ...(formData.outbound_departure_time && { outbound_departure_time: formData.outbound_departure_time }),
        ...(formData.outbound_arrival_time && { outbound_arrival_time: formData.outbound_arrival_time }),
        ...(formData.outbound_departure_date && { outbound_departure_date: formData.outbound_departure_date }),
        ...(formData.outbound_arrival_date && { outbound_arrival_date: formData.outbound_arrival_date }),
        ...(formData.return_carrier && { return_carrier: formData.return_carrier }),
        ...(formData.return_departure_time && { return_departure_time: formData.return_departure_time }),
        ...(formData.return_arrival_time && { return_arrival_time: formData.return_arrival_time }),
        ...(formData.return_departure_date && { return_departure_date: formData.return_departure_date }),
        ...(formData.return_arrival_date && { return_arrival_date: formData.return_arrival_date }),
        day1_hotel: formData.day1_hotel || null,
        day1_dinner: formData.day1_dinner || null,
        day1_activities: day1_activities || null,
        day2_hotel: formData.day2_hotel || null,
        day2_dinner: formData.day2_dinner || null,
        day2_activities: day2_activities || null,
        day3_hotel: formData.day3_hotel || null,
        day3_dinner: formData.day3_dinner || null,
        day3_activities: day3_activities || null,
      };

      let tourId = editingTour?.id;

      if (editingTour) {
        const { error } = await supabase
          .from('tours')
          .update(tourData)
          .eq('id', editingTour.id);
        
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('tours')
          .insert([tourData])
          .select('id')
          .single();
        
        if (error) throw error;
        tourId = data.id;
      }

      if (tourId) {
        await saveTourStops(tourId, tourStops);
      }

      alert(editingTour ? "Tour updated successfully!" : "Tour created successfully!");
      setShowForm(false);
      setEditingTour(null);
      setTourStops([]);
      resetForm();
      loadTours();
    } catch (error) {
      console.error("Error saving tour:", error);
      alert(`Error saving tour: ${(error as Error).message || 'Please try again.'}`);
    }
  };

  const resetForm = () => {
    setTourStops([]);
    setFormData({
      title: '',
      start_date: '',
      end_date: '',
      departure_airport: '',
      arrival_airport: '',
      max_spaces: 6,
      price_single: 350,
      price_double: 550,
      itinerary: '',
      included_items: `✈️ Airport Transfers: from Katowice (KTW) or Kraków (KRK)
🏨 2 nights at a 3★ hotel in Katowice with breakfast
🍽️ Group dinner — with vegetarian and gluten-free options
🛒 Guided store & showroom visits —windows, doors, tiles, flooring, furniture and more!
📋 Personalised assistance — we help you understand details, specification and compatibility when you need`,
      booking_process: `1. Reserve your places using the form below (48-hour pending reservation)
2. Book your flights in line with the tour dates
3. Send us confirmation via email (info@importfrompoland.com), WhatsApp, Facebook or Instagram message
4. We'll confirm your places once flight booking is verified
5. You're all set for your Polish adventure!`,
      is_active: true,
      is_archived: false,
      // Flight information
      outbound_carrier: '',
      outbound_departure_time: '',
      outbound_arrival_time: '',
      outbound_departure_date: '',
      outbound_arrival_date: '',
      return_carrier: '',
      return_departure_time: '',
      return_arrival_time: '',
      return_departure_date: '',
      return_arrival_date: '',
      // Daily itinerary
      day1_hotel: '',
      day1_dinner: '',
      day1_activities: '',
      day2_hotel: '',
      day2_dinner: '',
      day2_activities: '',
      day3_hotel: '',
      day3_dinner: '',
      day3_activities: ''
    });
  };

  const handleArchive = async (tourId: string) => {
    try {
      const { error } = await supabase
        .from('tours')
        .update({ is_archived: true })
        .eq('id', tourId);

      if (error) throw error;

      alert("Wycieczka została przeniesiona do archiwum!");
      await loadTours();
    } catch (error) {
      console.error("Error archiving tour:", error);
      alert("Błąd podczas archiwizacji wycieczki. Spróbuj ponownie.");
    }
  };

  const handleRestore = async (tourId: string) => {
    try {
      const { error } = await supabase
        .from('tours')
        .update({ is_archived: false })
        .eq('id', tourId);

      if (error) throw error;

      alert("Wycieczka została przywrócona z archiwum!");
      await loadTours();
    } catch (error) {
      console.error("Error restoring tour:", error);
      alert("Błąd podczas przywracania wycieczki. Spróbuj ponownie.");
    }
  };

  const handleDelete = async (tourId: string) => {
    if (!confirm("Czy na pewno chcesz usunąć tę wycieczkę? Ta operacja jest nieodwracalna!")) {
      return;
    }

    try {
      // Get tour details to check if it's archived
      const { data: tour } = await supabase
        .from('tours')
        .select('is_archived')
        .eq('id', tourId)
        .single();

      if (!tour) {
        alert("Wycieczka nie została znaleziona.");
        return;
      }

      // If tour is not archived, check for bookings
      if (!tour.is_archived) {
        const { data: bookings } = await supabase
          .from('tour_bookings')
          .select('id')
          .eq('tour_id', tourId);

        if (bookings && bookings.length > 0) {
          alert("Nie można usunąć aktywnej wycieczki, która ma rezerwacje. Najpierw przenieś wycieczkę do archiwum, a następnie usuń wszystkie rezerwacje.");
          return;
        }
      }

      // Delete the tour
      const { error } = await supabase
        .from('tours')
        .delete()
        .eq('id', tourId);

      if (error) throw error;

      alert("Wycieczka została usunięta!");
      await loadTours();
      await loadBookings(); // Refresh bookings as well
    } catch (error) {
      console.error("Error deleting tour:", error);
      alert("Błąd podczas usuwania wycieczki. Spróbuj ponownie.");
    }
  };

  const handleEdit = async (tour: Tour) => {
    setEditingTour(tour);
    setFormData({
      title: tour.title || '',
      start_date: tour.start_date || '',
      end_date: tour.end_date || '',
      departure_airport: tour.departure_airport || '',
      arrival_airport: tour.arrival_airport || '',
      max_spaces: tour.max_spaces || 6,
      price_single: tour.price_single || 350,
      price_double: tour.price_double || 550,
      itinerary: tour.itinerary || '',
      included_items: Array.isArray(tour.included_items) ? tour.included_items.join('\n') : (tour.included_items || ''),
      booking_process: tour.booking_process || '',
      is_active: tour.is_active ?? true,
      is_archived: tour.is_archived ?? false,
      // Flight information
      outbound_carrier: tour.outbound_carrier || '',
      outbound_departure_time: tour.outbound_departure_time || '',
      outbound_arrival_time: tour.outbound_arrival_time || '',
      outbound_departure_date: tour.outbound_departure_date || '',
      outbound_arrival_date: tour.outbound_arrival_date || '',
      return_carrier: tour.return_carrier || '',
      return_departure_time: tour.return_departure_time || '',
      return_arrival_time: tour.return_arrival_time || '',
      return_departure_date: tour.return_departure_date || '',
      return_arrival_date: tour.return_arrival_date || '',
      // Daily itinerary
      day1_hotel: tour.day1_hotel || '',
      day1_dinner: tour.day1_dinner || '',
      day1_activities: tour.day1_activities || '',
      day2_hotel: tour.day2_hotel || '',
      day2_dinner: tour.day2_dinner || '',
      day2_activities: tour.day2_activities || '',
      day3_hotel: tour.day3_hotel || '',
      day3_dinner: tour.day3_dinner || '',
      day3_activities: tour.day3_activities || ''
    });
    await loadPlaces();
    await loadTourStops(tour.id);
    setShowForm(true);
  };

  // Memoize sorting to avoid re-sorting on every render
  const activeTours = React.useMemo(() => 
    tours.filter(tour => !tour.is_archived).sort((a, b) => {
      const dateA = new Date(a.start_date);
      const dateB = new Date(b.start_date);
      return dateA.getTime() - dateB.getTime();
    }), [tours]
  );
  
  const archivedTours = React.useMemo(() => 
    tours.filter(tour => tour.is_archived).sort((a, b) => {
      const dateA = new Date(a.start_date);
      const dateB = new Date(b.start_date);
      return dateB.getTime() - dateA.getTime();
    }), [tours]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p>Loading tours...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tour Management</h1>
          <p className="text-muted-foreground">Manage factory tours and bookings</p>
        </div>
        <Button
          onClick={() => {
            loadPlaces();
            setTourStops([]);
            setEditingTour(null);
            setShowForm(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Tour
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingTour ? 'Edit Tour' : 'Add New Tour'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title">Tour Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="max_spaces">Max Spaces</Label>
                  <Input
                    id="max_spaces"
                    type="number"
                    value={formData.max_spaces}
                    onChange={(e) => setFormData({...formData, max_spaces: parseInt(e.target.value)})}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="departure_airport">Departure Airport</Label>
                  <Input
                    id="departure_airport"
                    value={formData.departure_airport}
                    onChange={(e) => setFormData({...formData, departure_airport: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="arrival_airport">Arrival Airport</Label>
                  <Input
                    id="arrival_airport"
                    value={formData.arrival_airport}
                    onChange={(e) => setFormData({...formData, arrival_airport: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="price_single">Single Person Price (€)</Label>
                  <Input
                    id="price_single"
                    type="number"
                    step="0.01"
                    value={formData.price_single}
                    onChange={(e) => setFormData({...formData, price_single: parseFloat(e.target.value)})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="price_double">Two People Price (€)</Label>
                  <Input
                    id="price_double"
                    type="number"
                    step="0.01"
                    value={formData.price_double}
                    onChange={(e) => setFormData({...formData, price_double: parseFloat(e.target.value)})}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="itinerary">Itinerary</Label>
                <Textarea
                  id="itinerary"
                  value={formData.itinerary}
                  onChange={(e) => setFormData({...formData, itinerary: e.target.value})}
                  rows={6}
                  required
                />
              </div>

              <div>
                <Label htmlFor="included_items">Included Items (one per line)</Label>
                <Textarea
                  id="included_items"
                  value={formData.included_items}
                  onChange={(e) => setFormData({...formData, included_items: e.target.value})}
                  rows={4}
                  placeholder="✈️ Airport Transfers&#10;🏨 Hotel accommodation&#10;🍽️ Group dinner"
                />
              </div>

              <div>
                <Label htmlFor="booking_process">Booking Process</Label>
                <Textarea
                  id="booking_process"
                  value={formData.booking_process}
                  onChange={(e) => setFormData({...formData, booking_process: e.target.value})}
                  rows={4}
                  required
                />
              </div>

              {/* Flight Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Flight Information</h3>
                
                {/* Outbound Flight */}
                <div className="space-y-3">
                  <h4 className="font-medium">Outbound Flight</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="outbound_carrier">Carrier</Label>
                      <Input
                        id="outbound_carrier"
                        value={formData.outbound_carrier}
                        onChange={(e) => setFormData({...formData, outbound_carrier: e.target.value})}
                        placeholder="e.g., Ryanair"
                      />
                    </div>
                    <div>
                      <Label htmlFor="outbound_departure_time">Departure Time</Label>
                      <Input
                        id="outbound_departure_time"
                        type="time"
                        value={formData.outbound_departure_time}
                        onChange={(e) => setFormData({...formData, outbound_departure_time: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="outbound_arrival_time">Arrival Time</Label>
                      <Input
                        id="outbound_arrival_time"
                        type="time"
                        value={formData.outbound_arrival_time}
                        onChange={(e) => setFormData({...formData, outbound_arrival_time: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="outbound_departure_date">Departure Date</Label>
                      <Input
                        id="outbound_departure_date"
                        type="date"
                        value={formData.outbound_departure_date}
                        onChange={(e) => setFormData({...formData, outbound_departure_date: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                {/* Return Flight */}
                <div className="space-y-3">
                  <h4 className="font-medium">Return Flight</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="return_carrier">Carrier</Label>
                      <Input
                        id="return_carrier"
                        value={formData.return_carrier}
                        onChange={(e) => setFormData({...formData, return_carrier: e.target.value})}
                        placeholder="e.g., Ryanair"
                      />
                    </div>
                    <div>
                      <Label htmlFor="return_departure_time">Departure Time</Label>
                      <Input
                        id="return_departure_time"
                        type="time"
                        value={formData.return_departure_time}
                        onChange={(e) => setFormData({...formData, return_departure_time: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="return_arrival_time">Arrival Time</Label>
                      <Input
                        id="return_arrival_time"
                        type="time"
                        value={formData.return_arrival_time}
                        onChange={(e) => setFormData({...formData, return_arrival_time: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="return_departure_date">Departure Date</Label>
                      <Input
                        id="return_departure_date"
                        type="date"
                        value={formData.return_departure_date}
                        onChange={(e) => setFormData({...formData, return_departure_date: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Daily Itinerary */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Daily Itinerary</h3>
                <p className="text-sm text-muted-foreground">
                  Hotel z katalogu Places; przystanki (sklepy/showroomy) dodajesz per dzień.
                  Stare tury bez stops nadal pokażą tekst Activities poniżej.
                </p>

                {([1, 2, 3] as const).map((day) => {
                  const hotelKey = `day${day}_hotel` as "day1_hotel" | "day2_hotel" | "day3_hotel";
                  const dinnerKey = `day${day}_dinner` as "day1_dinner" | "day2_dinner" | "day3_dinner";
                  const activitiesKey = `day${day}_activities` as
                    | "day1_activities"
                    | "day2_activities"
                    | "day3_activities";
                  const hasStructuredStops = tourStops.some((s) => s.day_number === day);

                  return (
                    <div key={day} className="space-y-3 p-4 border rounded-lg bg-slate-50/50">
                      <h4 className="font-medium">Day {day}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Hotel</Label>
                          <Select
                            value={hotelSelectValue(formData[hotelKey])}
                            onValueChange={(v) => applyHotelSelection(hotelKey, v)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Wybierz hotel z katalogu…" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">— brak —</SelectItem>
                              {hotelPlaces.map((h) => (
                                <SelectItem key={h.id} value={h.id}>
                                  {h.name}
                                  {h.city ? ` · ${h.city}` : ""}
                                </SelectItem>
                              ))}
                              {formData[hotelKey] &&
                                !hotelPlaces.some((h) => h.name === formData[hotelKey]) && (
                                  <SelectItem value="__custom__">
                                    Ręcznie: {formData[hotelKey]}
                                  </SelectItem>
                                )}
                            </SelectContent>
                          </Select>
                          <Input
                            value={formData[hotelKey]}
                            onChange={(e) =>
                              setFormData({ ...formData, [hotelKey]: e.target.value })
                            }
                            placeholder="lub wpisz nazwę hotelu ręcznie"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Dinner</Label>
                          <Input
                            value={formData[dinnerKey]}
                            onChange={(e) =>
                              setFormData({ ...formData, [dinnerKey]: e.target.value })
                            }
                            placeholder="np. Welcome dinner at Restaurant Polska"
                          />
                        </div>
                      </div>

                      <TourDayStopsEditor
                        dayNumber={day}
                        places={places}
                        stops={tourStops}
                        onChange={setTourStops}
                      />

                      {!hasStructuredStops && (
                        <div>
                          <Label>Activities (legacy — one per line)</Label>
                          <Textarea
                            value={formData[activitiesKey]}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                [activitiesKey]: e.target.value,
                              })
                            }
                            rows={2}
                            placeholder="Używane tylko gdy nie ma strukturalnych przystanków"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <Button type="submit">
                  {editingTour ? 'Update Tour' : 'Create Tour'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setShowForm(false);
                    setEditingTour(null);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v);
          if (v === "active" || v === "places") loadPlaces();
        }}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="active">Aktywne Wycieczki</TabsTrigger>
          <TabsTrigger value="places">Places</TabsTrigger>
          <TabsTrigger value="bookings">Rezerwacje</TabsTrigger>
          <TabsTrigger value="archived">Archiwum</TabsTrigger>
        </TabsList>

        <TabsContent value="places" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <TourPlacesManager />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="active" className="space-y-4">
          <div className="grid gap-4">
            {activeTours.map((tour) => (
              <Card key={tour.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl">{tour.title}</CardTitle>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {formatDate(tour.start_date)} - {formatDate(tour.end_date)}
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {tour.departure_airport} → {tour.arrival_airport}
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {tour.available_spaces} of {tour.max_spaces} spaces available
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={tour.is_active ? "default" : "secondary"}>
                        {tour.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateTourReport(tour.id)}
                        title="Generate Tour Report PDF"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(tour)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleArchive(tour.id)}
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-4">
                        <div className="text-sm">
                          <span className="text-muted-foreground">Single person:</span>
                          <span className="font-semibold ml-2">€{tour.price_single}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Two people sharing:</span>
                          <span className="font-semibold ml-2">€{tour.price_double}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <div>Created: {formatDate(new Date().toISOString())}</div>
                      <div>Status: {tour.is_active ? 'Live' : 'Draft'}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="bookings" className="space-y-4">
          <div className="grid gap-4">
            {bookings.map((booking) => (
              <Card key={booking.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl">{booking.tour?.title || `Tour ID: ${booking.tour_id}`}</CardTitle>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        {booking.tour ? (
                          <>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {formatDate(booking.tour.start_date)} - {formatDate(booking.tour.end_date)}
                            </div>
                            <div className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {booking.tour.departure_airport} → {booking.tour.arrival_airport}
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            Tour details not loaded
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {booking.company?.name || `Company ID: ${booking.company_id}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={booking.status === 'confirmed' ? "default" : "secondary"}>
                        {booking.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                      </Badge>
                      {booking.status === 'pending' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => confirmBooking(booking.id)}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Confirm
                        </Button>
                      )}
                      {booking.tour && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => generateVisitorReport(
                            booking.tour.id, 
                            booking.tour.title, 
                            booking.tour.start_date, 
                            booking.tour.end_date
                          )}
                        >
                          <FileText className="h-4 w-4 mr-1" />
                          Raport
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteBooking(booking.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Usuń
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-semibold text-sm text-muted-foreground">Attendee 1</h4>
                        <p className="text-sm">{booking.attendee1_name}</p>
                      </div>
                      {booking.attendee2_name && (
                        <div>
                          <h4 className="font-semibold text-sm text-muted-foreground">Attendee 2</h4>
                          <p className="text-sm">{booking.attendee2_name}</p>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-semibold text-sm text-muted-foreground">Contact Number</h4>
                        <p className="text-sm">{booking.contact_number}</p>
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm text-muted-foreground">Booking Type</h4>
                        <p className="text-sm">{booking.booking_type === 'single' ? 'Single Room' : 'Double/Twin Room'}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-semibold text-sm text-muted-foreground">Total Price</h4>
                        <p className="text-sm">
                          {booking.tour ? 
                            `€${booking.booking_type === 'single' ? booking.tour.price_single : booking.tour.price_double}` :
                            'Price not available'
                          }
                        </p>
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm text-muted-foreground">Booked</h4>
                        <p className="text-sm">{formatDate(booking.created_at)}</p>
                      </div>
                    </div>
                    {booking.reservation_expires_at && booking.status === 'pending' && (
                      <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                        <p className="text-sm text-yellow-800">
                          <strong>Reservation expires:</strong> {formatDate(booking.reservation_expires_at)}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {bookings.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Users className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No tour bookings yet</h3>
                  <p className="text-muted-foreground">
                    Tour bookings will appear here when customers make reservations
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="archived" className="space-y-4">
          <div className="grid gap-4">
            {archivedTours.map((tour) => (
              <Card key={tour.id} className="opacity-75">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl">{tour.title}</CardTitle>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {formatDate(tour.start_date)} - {formatDate(tour.end_date)}
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {tour.departure_airport} → {tour.arrival_airport}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Archived</Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestore(tour.id)}
                        title="Przywróć z archiwum"
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(tour)}
                        title="Edytuj wycieczkę"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(tour.id)}
                        title="Usuń wycieczkę"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-4">
                        <div className="text-sm">
                          <span className="text-muted-foreground">Single person:</span>
                          <span className="font-semibold ml-2">€{tour.price_single}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Two people sharing:</span>
                          <span className="font-semibold ml-2">€{tour.price_double}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <div>Archived: {formatDate(new Date().toISOString())}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

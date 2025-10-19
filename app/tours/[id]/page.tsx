"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/Logo";
import { formatDate } from "@/lib/utils";
import { Calendar, MapPin, Users, Plane, CheckCircle, Clock, Mail, MessageCircle } from "lucide-react";

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
  available_spaces: number;
  // Flight information
  outbound_flight: {
    carrier: string;
    departure_time: string;
    arrival_time: string;
    departure_date: string;
    arrival_date: string;
  };
  return_flight: {
    carrier: string;
    departure_time: string;
    arrival_time: string;
    departure_date: string;
    arrival_date: string;
  };
  // Daily itinerary
  daily_itinerary: {
    day1: {
      hotel: string;
      dinner: string;
      activities: string[];
    };
    day2: {
      hotel: string;
      dinner: string;
      activities: string[];
    };
    day3: {
      hotel: string;
      dinner: string;
      activities: string[];
    };
  };
}

export default function TourDetailPage() {
  const params = useParams();
  const supabase = createClient();
  const [tour, setTour] = useState<Tour | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingType, setBookingType] = useState<'single' | 'double'>('single');
  const [attendee1Name, setAttendee1Name] = useState('');
  const [attendee2Name, setAttendee2Name] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [userBooking, setUserBooking] = useState<any>(null);

  useEffect(() => {
    loadTour();
  }, [params.id]);

  const loadTour = async () => {
    try {
      // Get current user's company ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setTour(null);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      // Load tour from database
      const { data: tour, error } = await supabase
        .from('tours')
        .select('*')
        .eq('id', params.id)
        .eq('is_active', true)
        .eq('is_archived', false)
        .single();

      if (error) throw error;

      if (!tour) {
        setTour(null);
        return;
      }

      // Check if user has already booked this tour
      if (profile?.company_id) {
        const { data: booking } = await supabase
          .from('tour_bookings')
          .select('*')
          .eq('tour_id', params.id)
          .eq('company_id', profile.company_id)
          .single();

        setUserBooking(booking);
      }

      // Calculate available spaces
      const { data: bookings } = await supabase
        .from('tour_bookings')
        .select('booking_type')
        .eq('tour_id', tour.id)
        .eq('status', 'confirmed');

      const bookedSpaces = bookings?.reduce((total, booking) => {
        return total + (booking.booking_type === 'single' ? 1 : 2);
      }, 0) || 0;

      // Convert database fields to the expected format
      const tourData: Tour = {
        id: tour.id,
        title: tour.title,
        start_date: tour.start_date,
        end_date: tour.end_date,
        departure_airport: tour.departure_airport,
        arrival_airport: tour.arrival_airport,
        max_spaces: tour.max_spaces,
        price_single: tour.price_single,
        price_double: tour.price_double,
        itinerary: tour.itinerary || '',
        included_items: tour.included_items || [],
        booking_process: tour.booking_process || '',
        available_spaces: tour.max_spaces - bookedSpaces,
        outbound_flight: {
          carrier: tour.outbound_carrier || '',
          departure_time: tour.outbound_departure_time || '',
          arrival_time: tour.outbound_arrival_time || '',
          departure_date: tour.outbound_departure_date || tour.start_date,
          arrival_date: tour.outbound_arrival_date || tour.start_date
        },
        return_flight: {
          carrier: tour.return_carrier || '',
          departure_time: tour.return_departure_time || '',
          arrival_time: tour.return_arrival_time || '',
          departure_date: tour.return_departure_date || tour.end_date,
          arrival_date: tour.return_arrival_date || tour.end_date
        },
        daily_itinerary: {
          day1: {
            hotel: tour.day1_hotel || '',
            dinner: tour.day1_dinner || '',
            activities: tour.day1_activities ? tour.day1_activities.split('\n').filter(item => item.trim()) : []
          },
          day2: {
            hotel: tour.day2_hotel || '',
            dinner: tour.day2_dinner || '',
            activities: tour.day2_activities ? tour.day2_activities.split('\n').filter(item => item.trim()) : []
          },
          day3: {
            hotel: tour.day3_hotel || '',
            dinner: tour.day3_dinner || '',
            activities: tour.day3_activities ? tour.day3_activities.split('\n').filter(item => item.trim()) : []
          }
        }
      };

      setTour(tourData);
    } catch (error) {
      console.error("Error loading tour:", error);
      // Fallback to mock data if database fails
      const mockTour: Tour = {
        id: params.id as string,
        title: "Tour Not Found",
        start_date: "2024-10-22",
        end_date: "2024-10-24",
        departure_airport: "N/A",
        arrival_airport: "N/A",
        max_spaces: 0,
        price_single: 0,
        price_double: 0,
        itinerary: "This tour could not be loaded.",
        included_items: [],
        booking_process: "Please contact support.",
        available_spaces: 0,
        outbound_flight: {
          carrier: "",
          departure_time: "",
          arrival_time: "",
          departure_date: "",
          arrival_date: ""
        },
        return_flight: {
          carrier: "",
          departure_time: "",
          arrival_time: "",
          departure_date: "",
          arrival_date: ""
        },
        daily_itinerary: {
          day1: { hotel: "", dinner: "", activities: [] },
          day2: { hotel: "", dinner: "", activities: [] },
          day3: { hotel: "", dinner: "", activities: [] }
        }
      };
      setTour(mockTour);
    } finally {
      setLoading(false);
    }
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Get current user's company ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Please log in to book a tour.');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile?.company_id) {
        alert('Company profile not found. Please contact support.');
        return;
      }

      // Create booking
      const bookingData = {
        tour_id: params.id,
        company_id: profile.company_id,
        booking_type: bookingType,
        attendee1_name: attendee1Name,
        attendee2_name: bookingType === 'double' ? attendee2Name : null,
        contact_number: contactNumber,
        status: 'pending',
        reservation_expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() // 48 hours from now
      };
      
      console.log("Creating booking with data:", bookingData);
      
      const { data: bookingResult, error } = await supabase
        .from('tour_bookings')
        .insert([bookingData])
        .select();

      if (error) {
        console.error("Error creating booking:", error);
        throw error;
      }
      
      console.log("Booking created successfully:", bookingResult);

      alert('Booking submitted successfully! You have 48 hours to book your flights and confirm. You will receive a confirmation email shortly.');
      
      // Redirect back to tours tab
      window.location.href = '/?tab=tours';
    } catch (error) {
      console.error("Error submitting booking:", error);
      alert("Error submitting booking. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p>Loading tour details...</p>
      </div>
    );
  }

  if (!tour) {
    return (
      <div className="flex items-center justify-center py-12">
        <p>Tour not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Logo width={200} height={80} linkToDashboard={true} />
            <div>
              <h1 className="text-2xl font-bold">{tour.title}</h1>
              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {formatDate(tour.start_date)} - {formatDate(tour.end_date)}
                </div>
                <div className="flex items-center gap-1">
                  <Plane className="h-4 w-4" />
                  {tour.departure_airport} → {tour.arrival_airport}
                </div>
                <Badge variant={tour.available_spaces > 0 ? "default" : "secondary"}>
                  {tour.available_spaces} spaces available
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">

      {/* Flight Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plane className="h-5 w-5" />
            Flight Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Outbound Flight */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Outbound Flight</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{tour.outbound_flight.carrier}</span>
                  <span className="text-sm text-muted-foreground">{tour.departure_airport} → {tour.arrival_airport}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground">Departure</div>
                    <div className="font-medium">{tour.outbound_flight.departure_time}</div>
                    <div className="text-sm">{formatDate(tour.outbound_flight.departure_date)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Arrival</div>
                    <div className="font-medium">{tour.outbound_flight.arrival_time}</div>
                    <div className="text-sm">{formatDate(tour.outbound_flight.arrival_date)}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Return Flight */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Return Flight</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{tour.return_flight.carrier}</span>
                  <span className="text-sm text-muted-foreground">{tour.arrival_airport} → {tour.departure_airport}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground">Departure</div>
                    <div className="font-medium">{tour.return_flight.departure_time}</div>
                    <div className="text-sm">{formatDate(tour.return_flight.departure_date)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Arrival</div>
                    <div className="font-medium">{tour.return_flight.arrival_time}</div>
                    <div className="text-sm">{formatDate(tour.return_flight.arrival_date)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Daily Itinerary */}
      <Card>
        <CardHeader>
          <CardTitle>Tour Itinerary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Day 1 */}
            <div className="bg-blue-50 p-6 rounded-lg">
              <h3 className="font-bold text-lg mb-4 text-blue-900">Day 1 - {formatDate(tour.start_date)}</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="font-semibold mb-2">🏨 Hotel</h4>
                  <p className="text-sm">{tour.daily_itinerary.day1.hotel}</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">🍽️ Dinner</h4>
                  <p className="text-sm">{tour.daily_itinerary.day1.dinner}</p>
                </div>
              </div>
              <div className="mt-4">
                <h4 className="font-semibold mb-2">Activities</h4>
                <ul className="space-y-1">
                  {tour.daily_itinerary.day1.activities.map((activity, index) => (
                    <li key={index} className="text-sm flex items-start gap-2">
                      <span className="text-blue-500 mt-1">•</span>
                      <span>{activity}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Day 2 */}
            <div className="bg-green-50 p-6 rounded-lg">
              <h3 className="font-bold text-lg mb-4 text-green-900">Day 2 - {formatDate(tour.start_date, 1)}</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="font-semibold mb-2">🏨 Hotel</h4>
                  <p className="text-sm">{tour.daily_itinerary.day2.hotel}</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">🍽️ Dinner</h4>
                  <p className="text-sm">{tour.daily_itinerary.day2.dinner}</p>
                </div>
              </div>
              <div className="mt-4">
                <h4 className="font-semibold mb-2">Activities</h4>
                <ul className="space-y-1">
                  {tour.daily_itinerary.day2.activities.map((activity, index) => (
                    <li key={index} className="text-sm flex items-start gap-2">
                      <span className="text-green-500 mt-1">•</span>
                      <span>{activity}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Day 3 */}
            <div className="bg-purple-50 p-6 rounded-lg">
              <h3 className="font-bold text-lg mb-4 text-purple-900">Day 3 - {formatDate(tour.end_date)}</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="font-semibold mb-2">🏨 Hotel</h4>
                  <p className="text-sm">{tour.daily_itinerary.day3.hotel}</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">🍽️ Dinner</h4>
                  <p className="text-sm">{tour.daily_itinerary.day3.dinner}</p>
                </div>
              </div>
              <div className="mt-4">
                <h4 className="font-semibold mb-2">Activities</h4>
                <ul className="space-y-1">
                  {tour.daily_itinerary.day3.activities.map((activity, index) => (
                    <li key={index} className="text-sm flex items-start gap-2">
                      <span className="text-purple-500 mt-1">•</span>
                      <span>{activity}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* What's Included */}
      <Card>
        <CardHeader>
          <CardTitle>What&apos;s Included</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {tour.included_items.map((item, index) => (
              <li key={index} className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                <span className="text-sm">{item}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Booking Process */}
      <Card>
        <CardHeader>
          <CardTitle>Booking Process</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <Clock className="h-4 w-4 mt-0.5 text-blue-500 flex-shrink-0" />
              <span className="text-sm">{tour.booking_process}</span>
            </div>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm font-medium text-blue-900 mb-2">Contact us to confirm:</p>
              <div className="space-y-1 text-sm text-blue-800">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  info@importfrompoland.com
                </div>
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp, Facebook or Instagram
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Booking Status or Form */}
      {userBooking ? (
        <Card>
          <CardHeader>
            <CardTitle>Your Booking Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="font-semibold text-lg mb-2">Booking Details</h3>
                <div className="space-y-2 text-sm">
                  <div><strong>Status:</strong> <span className={`px-2 py-1 rounded text-xs ${userBooking.status === 'confirmed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{userBooking.status === 'confirmed' ? 'Confirmed' : 'Pending'}</span></div>
                  <div><strong>Attendee 1:</strong> {userBooking.attendee1_name}</div>
                  {userBooking.attendee2_name && (
                    <div><strong>Attendee 2:</strong> {userBooking.attendee2_name}</div>
                  )}
                  <div><strong>Contact Number:</strong> {userBooking.contact_number}</div>
                  <div><strong>Booking Type:</strong> {userBooking.booking_type === 'single' ? 'Single Room' : 'Double/Twin Room'}</div>
                  <div><strong>Total Price:</strong> €{userBooking.booking_type === 'single' ? tour.price_single : tour.price_double}</div>
                </div>
              </div>
              
              {userBooking.status === 'pending' && (
                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <h4 className="font-semibold text-yellow-800 mb-2">Next Steps</h4>
                  <p className="text-sm text-yellow-700">
                    Your booking is pending confirmation. Please book your flights and contact us to confirm your reservation within 48 hours.
                  </p>
                </div>
              )}

              {userBooking.status === 'confirmed' && (
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <h4 className="font-semibold text-green-800 mb-2">Confirmed!</h4>
                  <p className="text-sm text-green-700">
                    Your booking has been confirmed. We&apos;ll contact you with further details closer to the tour date.
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <Button 
                  variant="outline"
                  className="flex-1"
                  onClick={() => window.location.href = '/?tab=tours'}
                >
                  Back to Tours
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Book Your Tour</CardTitle>
          </CardHeader>
          <CardContent>
          <form onSubmit={handleBooking} className="space-y-6">
            {/* Booking Type */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Room Preference</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setBookingType('single')}
                  className={`p-4 border rounded-lg text-left transition-colors ${
                    bookingType === 'single' 
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-lg">Single Room</div>
                  <div className="text-sm text-muted-foreground mt-1">1 Person</div>
                  <div className="text-lg font-bold text-primary mt-2">€{tour.price_single}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setBookingType('double')}
                  className={`p-4 border rounded-lg text-left transition-colors ${
                    bookingType === 'double' 
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-lg">Double/Twin Room</div>
                  <div className="text-sm text-muted-foreground mt-1">2 People Sharing</div>
                  <div className="text-lg font-bold text-primary mt-2">€{tour.price_double}</div>
                </button>
              </div>
            </div>

            {/* Attendee Names */}
            <div className="space-y-4">
              <h3 className="font-medium text-base">Attendee Information</h3>
              <div>
                <Label htmlFor="attendee1">Attendee 1 Name *</Label>
                <Input
                  id="attendee1"
                  value={attendee1Name}
                  onChange={(e) => setAttendee1Name(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
              {bookingType === 'double' && (
                <div>
                  <Label htmlFor="attendee2">Attendee 2 Name *</Label>
                  <Input
                    id="attendee2"
                    value={attendee2Name}
                    onChange={(e) => setAttendee2Name(e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>
              )}
            </div>

            {/* Contact Number */}
            <div>
              <Label htmlFor="contact">Contact Number *</Label>
              <Input
                id="contact"
                type="tel"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                required
                className="mt-1"
                placeholder="+353 XX XXX XXXX"
              />
            </div>

            {/* Total Price */}
            <div className="p-4 bg-gray-50 rounded-lg border">
              <div className="flex justify-between items-center">
                <span className="font-medium text-lg">Total Price:</span>
                <span className="text-2xl font-bold text-primary">
                  €{bookingType === 'single' ? tour.price_single : tour.price_double}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {bookingType === 'single' ? 'Single room occupancy' : 'Double/Twin room sharing'}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button 
                type="button"
                variant="outline"
                className="flex-1 py-3 text-lg"
                onClick={() => window.location.href = '/?tab=tours'}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="flex-1 py-3 text-lg" 
                disabled={submitting || tour.available_spaces === 0}
              >
                {submitting ? 'Submitting...' : 'Reserve Places (48h pending)'}
              </Button>
            </div>

            {tour.available_spaces === 0 && (
              <p className="text-sm text-red-600 text-center">
                This tour is fully booked
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    )}
        </div>
      </main>
    </div>
  );
}

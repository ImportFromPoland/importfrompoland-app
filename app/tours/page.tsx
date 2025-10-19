"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { Calendar, MapPin, Users, Plane } from "lucide-react";
import Link from "next/link";

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
  available_spaces: number;
}

export default function ToursPage() {
  const supabase = createClient();
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTours();
  }, []);

  const loadTours = async () => {
    try {
      // For now, we'll use mock data since we can't run migrations
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
          available_spaces: 4
        }
      ];

      // Filter out past tours
      const today = new Date().toISOString().split('T')[0];
      const futureTours = mockTours.filter(tour => tour.start_date >= today);
      
      setTours(futureTours);
    } catch (error) {
      console.error("Error loading tours:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p>Loading tours...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Factory Tours</h1>
        <p className="text-muted-foreground">
          Join our guided tours to Poland to see products firsthand
        </p>
      </div>

      {tours.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No upcoming tours available at the moment.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {tours.map((tour) => (
            <Card key={tour.id} className="hover:shadow-md transition-shadow">
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
                        <Plane className="h-4 w-4" />
                        {tour.departure_airport} → {tour.arrival_airport}
                      </div>
                    </div>
                  </div>
                  <Badge variant={tour.available_spaces > 0 ? "default" : "secondary"}>
                    {tour.available_spaces} of {tour.max_spaces} spaces available
                  </Badge>
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
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      {tour.available_spaces} spaces remaining
                    </div>
                  </div>
                  <Link href={`/tours/${tour.id}`}>
                    <Button disabled={tour.available_spaces === 0}>
                      {tour.available_spaces === 0 ? "Fully Booked" : "View Details & Book"}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

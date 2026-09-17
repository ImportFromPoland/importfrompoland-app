export type TourPlaceKind =
  | "showroom"
  | "shop"
  | "hotel"
  | "restaurant"
  | "other";

export type TourPlace = {
  id: string;
  name: string;
  kind: TourPlaceKind;
  city: string | null;
  short_description: string | null;
  highlights: string | null;
  typical_duration_minutes: number | null;
  is_active: boolean;
  logo_url?: string | null;
  thumbnail_url?: string | null;
};

export type TourStopRow = {
  id?: string;
  place_id: string;
  day_number: number;
  sort_order: number;
  planned_duration_minutes: number | null;
  notes: string | null;
  place?: TourPlace | null;
};

export const PLACE_KIND_LABELS: Record<TourPlaceKind, string> = {
  showroom: "Showroom",
  shop: "Shop",
  hotel: "Hotel",
  restaurant: "Restaurant",
  other: "Other",
};

export function formatDurationMinutes(mins: number | null | undefined): string {
  if (mins == null || mins <= 0) return "";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

export type TourStopDisplay = {
  name: string;
  durationLabel: string;
  description: string | null;
  highlights: string | null;
  notes: string | null;
  logoUrl: string | null;
  thumbnailUrl: string | null;
};

export function stopsForDay(
  stops: TourStopRow[],
  dayNumber: number
): TourStopRow[] {
  return stops
    .filter((s) => s.day_number === dayNumber)
    .sort((a, b) => a.sort_order - b.sort_order);
}

export function toStopDisplay(stop: TourStopRow): TourStopDisplay {
  return {
    name: stop.place?.name || "Stop",
    durationLabel: formatDurationMinutes(stop.planned_duration_minutes),
    description: stop.place?.short_description || null,
    highlights: stop.place?.highlights || null,
    notes: stop.notes?.trim() || null,
    logoUrl: stop.place?.logo_url || null,
    thumbnailUrl: stop.place?.thumbnail_url || null,
  };
}

/** Build legacy dayN_activities text from structured stops (compat). */
export function stopsToActivitiesText(
  stops: TourStopRow[],
  dayNumber: number
): string {
  return stopsForDay(stops, dayNumber)
    .map((s) => {
      const d = toStopDisplay(s);
      return [d.name, d.durationLabel ? `(${d.durationLabel})` : null, d.notes]
        .filter(Boolean)
        .join(" — ");
    })
    .join("\n");
}

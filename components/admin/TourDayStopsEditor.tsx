"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import {
  formatDurationMinutes,
  type TourPlace,
  type TourStopRow,
} from "@/lib/tour-places";

type Props = {
  dayNumber: number;
  places: TourPlace[];
  stops: TourStopRow[];
  onChange: (stops: TourStopRow[]) => void;
  /** kinds allowed for stops (showroom/shop/other) */
  stopKinds?: Array<TourPlace["kind"]>;
};

export function TourDayStopsEditor({
  dayNumber,
  places,
  stops,
  onChange,
  stopKinds = ["showroom", "shop", "other"],
}: Props) {
  const dayStops = stops
    .filter((s) => s.day_number === dayNumber)
    .sort((a, b) => a.sort_order - b.sort_order);

  const catalog = places.filter(
    (p) => p.is_active && stopKinds.includes(p.kind)
  );

  const usedIds = new Set(dayStops.map((s) => s.place_id));

  const syncDay = (nextDayStops: TourStopRow[]) => {
    const others = stops.filter((s) => s.day_number !== dayNumber);
    const renumbered = nextDayStops.map((s, i) => ({
      ...s,
      day_number: dayNumber,
      sort_order: i,
    }));
    onChange([...others, ...renumbered]);
  };

  const addStop = (placeId: string) => {
    if (!placeId || usedIds.has(placeId)) return;
    const place = places.find((p) => p.id === placeId);
    if (!place) return;
    syncDay([
      ...dayStops,
      {
        place_id: placeId,
        day_number: dayNumber,
        sort_order: dayStops.length,
        planned_duration_minutes: place.typical_duration_minutes,
        notes: null,
        place,
      },
    ]);
  };

  const removeAt = (index: number) => {
    syncDay(dayStops.filter((_, i) => i !== index));
  };

  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= dayStops.length) return;
    const next = [...dayStops];
    [next[index], next[j]] = [next[j], next[index]];
    syncDay(next);
  };

  const updateAt = (index: number, patch: Partial<TourStopRow>) => {
    const next = dayStops.map((s, i) => (i === index ? { ...s, ...patch } : s));
    syncDay(next);
  };

  const available = catalog.filter((p) => !usedIds.has(p.id));

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label>Dodaj przystanek (sklep / showroom)</Label>
          {available.length === 0 ? (
            <p className="text-xs text-muted-foreground border rounded-md px-3 py-2">
              Brak dostępnych miejsc — dodaj w zakładce Places
            </p>
          ) : (
            <Select
              key={`add-stop-${dayNumber}-${dayStops.length}`}
              onValueChange={(v) => {
                if (v) addStop(v);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="+ Wybierz z katalogu…" />
              </SelectTrigger>
              <SelectContent>
                {available.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                    {p.city ? ` · ${p.city}` : ""}
                    {p.typical_duration_minutes
                      ? ` (${formatDurationMinutes(p.typical_duration_minutes)})`
                      : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {dayStops.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Brak przystanków na ten dzień.
        </p>
      ) : (
        <div className="space-y-2">
          {dayStops.map((stop, index) => (
            <div
              key={`${stop.place_id}-${index}`}
              className="border rounded-md p-3 bg-white space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-sm">
                    {index + 1}. {stop.place?.name || "—"}
                  </div>
                  {stop.place?.short_description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {stop.place.short_description}
                    </p>
                  )}
                  {stop.place?.highlights && (
                    <p className="text-xs text-muted-foreground">
                      Warto zobaczyć: {stop.place.highlights}
                    </p>
                  )}
                </div>
                <div className="flex gap-0.5 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => move(index, 1)}
                    disabled={index === dayStops.length - 1}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAt(index)}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Czas (min)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={stop.planned_duration_minutes ?? ""}
                    onChange={(e) =>
                      updateAt(index, {
                        planned_duration_minutes: e.target.value
                          ? parseInt(e.target.value, 10)
                          : null,
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Notatka</Label>
                  <Input
                    value={stop.notes || ""}
                    onChange={(e) =>
                      updateAt(index, { notes: e.target.value || null })
                    }
                    placeholder="opcjonalnie"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Plus className="h-3 w-3" />
        Nowe miejsca dodajesz w zakładce Places, potem wybierasz tutaj.
      </p>
    </div>
  );
}

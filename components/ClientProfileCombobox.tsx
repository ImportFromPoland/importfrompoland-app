"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type ClientProfileOption = {
  id: string;
  full_name: string | null;
  email: string | null;
  company_id?: string | null;
  company?: { name: string | null } | null;
};

export function formatClientProfileLabel(client: ClientProfileOption): string {
  const name = client.full_name?.trim() || "—";
  const email = client.email?.trim() || "";
  const company = client.company?.name?.trim();
  if (company && company !== name) {
    return `${name} · ${company}${email ? ` (${email})` : ""}`;
  }
  return email ? `${name} (${email})` : name;
}

function searchHaystack(client: ClientProfileOption): string {
  return [
    client.full_name ?? "",
    client.email ?? "",
    client.company?.name ?? "",
  ]
    .join(" ")
    .toLowerCase()
    .normalize("NFKD");
}

function matchesQuery(client: ClientProfileOption, raw: string): boolean {
  const q = raw.trim().toLowerCase().normalize("NFKD");
  if (!q) return true;
  return searchHaystack(client).includes(q);
}

type ClientProfileComboboxProps = {
  clients: ClientProfileOption[];
  value: string;
  onValueChange: (profileId: string) => void;
  placeholder?: string;
  id?: string;
};

export function ClientProfileCombobox({
  clients,
  value,
  onValueChange,
  placeholder = "Search by name or email…",
  id,
}: ClientProfileComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = useMemo(
    () => clients.find((c) => c.id === value),
    [clients, value]
  );

  const filtered = useMemo(
    () => clients.filter((c) => matchesQuery(c, search)),
    [clients, search]
  );

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-auto min-h-10 w-full justify-between py-2 font-normal"
        >
          <span className="flex min-w-0 flex-1 items-start gap-2 text-left">
            <User className="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
            {selected ? (
              <span className="min-w-0 break-words">
                {formatClientProfileLabel(selected)}
              </span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <div className="rounded-md border border-border bg-popover text-popover-foreground shadow-md outline-none">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              type="text"
              placeholder="Name, email, company…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              autoFocus
            />
          </div>
          <div
            className="max-h-[300px] overflow-y-auto overflow-x-hidden p-1"
            role="listbox"
            aria-label="Clients"
          >
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No client matches.
              </div>
            ) : (
              filtered.map((client) => {
                const label = formatClientProfileLabel(client);
                const isSelected = value === client.id;
                return (
                  <button
                    key={client.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={cn(
                      "relative flex w-full cursor-pointer items-start gap-2 rounded-sm px-2 py-2 text-left text-sm text-foreground",
                      "outline-none hover:bg-accent hover:text-accent-foreground",
                      "focus-visible:bg-accent focus-visible:text-accent-foreground",
                      isSelected && "bg-accent text-accent-foreground"
                    )}
                    onClick={() => {
                      onValueChange(client.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 break-words leading-snug">
                      {label}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

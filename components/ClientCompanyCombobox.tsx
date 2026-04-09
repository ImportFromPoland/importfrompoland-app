"use client";

import { useMemo, useState } from "react";
import { Building2, Check, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type CompanyProfileRow = {
  full_name: string | null;
  email: string | null;
};

export type CompanyWithProfiles = {
  id: string;
  name: string;
  vat_number?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  postal_code?: string | null;
  country?: string | null;
  profiles?: CompanyProfileRow[] | null;
};

function contactNames(company: CompanyWithProfiles): string {
  const raw = (company.profiles ?? [])
    .map((p) => p.full_name?.trim())
    .filter((s): s is string => Boolean(s));
  const seen = new Set<string>();
  const names: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    const s = raw[i];
    if (!seen.has(s)) {
      seen.add(s);
      names.push(s);
    }
  }
  return names.join(", ");
}

/** Shown in the trigger and list rows: company plus linked client name(s) when available. */
export function formatCompanyClientLabel(company: CompanyWithProfiles): string {
  const contacts = contactNames(company);
  return contacts ? `${company.name} — ${contacts}` : company.name;
}

function searchHaystack(company: CompanyWithProfiles): string {
  const parts: string[] = [
    company.name,
    company.vat_number ?? "",
    contactNames(company),
    ...(company.profiles ?? []).map((p) => [p.full_name, p.email].join(" ")),
  ];
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .normalize("NFKD");
}

function matchesQuery(company: CompanyWithProfiles, raw: string): boolean {
  const q = raw.trim().toLowerCase().normalize("NFKD");
  if (!q) return true;
  const hay = searchHaystack(company);
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  return tokens.every((t) => hay.includes(t));
}

type ClientCompanyComboboxProps = {
  companies: CompanyWithProfiles[];
  value: string;
  onValueChange: (companyId: string) => void;
  placeholder?: string;
  id?: string;
};

export function ClientCompanyCombobox({
  companies,
  value,
  onValueChange,
  placeholder = "Search company or client name…",
  id,
}: ClientCompanyComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = useMemo(
    () => companies.find((c) => c.id === value),
    [companies, value]
  );

  const filtered = useMemo(
    () => companies.filter((c) => matchesQuery(c, search)),
    [companies, search]
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
            <Building2 className="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
            {selected ? (
              <span className="min-w-0 break-words">
                {formatCompanyClientLabel(selected)}
                {selected.vat_number ? (
                  <span className="text-muted-foreground">
                    {" "}
                    (VAT: {selected.vat_number})
                  </span>
                ) : null}
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
              placeholder="Filter by company, name, or email…"
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
              filtered.map((company) => {
                const label = formatCompanyClientLabel(company);
                const isSelected = value === company.id;
                return (
                  <button
                    key={company.id}
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
                      onValueChange(company.id);
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
                      <span className="font-medium">{label}</span>
                      {company.vat_number ? (
                        <span className="text-muted-foreground font-normal">
                          {" "}
                          (VAT: {company.vat_number})
                        </span>
                      ) : null}
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

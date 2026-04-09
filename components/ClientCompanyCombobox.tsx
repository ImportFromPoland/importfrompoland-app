"use client";

import { useMemo, useState } from "react";
import { Building2, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Type to filter by company, name, or email…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No client matches.</CommandEmpty>
            <CommandGroup>
              {filtered.map((company) => {
                const label = formatCompanyClientLabel(company);
                return (
                  <CommandItem
                    key={company.id}
                    value={company.id}
                    onSelect={() => {
                      onValueChange(company.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        value === company.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="min-w-0 break-words">
                      {label}
                      {company.vat_number ? (
                        <span className="text-muted-foreground">
                          {" "}
                          (VAT: {company.vat_number})
                        </span>
                      ) : null}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

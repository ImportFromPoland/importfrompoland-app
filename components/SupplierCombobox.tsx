"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, ChevronsUpDown, Search } from "lucide-react";
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

const SUPPLIERS = [
  "Agata",
  "BelPol",
  "BlackRedWhite",
  "Braider",
  "Bricoman",
  "Castorama",
  "Komfort",
  "LazienkaPlus",
  "Leroy Merlin",
  "Mera",
  "Mexen",
  "Nexterio",
  "Novodworski",
  "Obi",
  "Plytki24.pl",
  "Rea",
].sort();

interface SupplierComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  label?: string;
}

export function SupplierCombobox({ 
  value, 
  onChange, 
  placeholder = "Select or type supplier name",
  id,
  label = "Supplier Name"
}: SupplierComboboxProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);

  // Update input value when prop value changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleSelect = (selectedValue: string) => {
    setInputValue(selectedValue);
    onChange(selectedValue);
    setOpen(false);
  };

  const handleInputChange = (newValue: string) => {
    setInputValue(newValue);
    // Don't call onChange immediately when typing - only when selecting an option
  };

  const filteredSuppliers = SUPPLIERS.filter((supplier) =>
    supplier.toLowerCase().includes(inputValue.toLowerCase())
  );

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Popover open={open} onOpenChange={(newOpen) => {
        setOpen(newOpen);
        if (!newOpen && inputValue && inputValue !== value) {
          // If closing and there's a typed value that's different from current value, save it
          onChange(inputValue);
        }
      }}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {inputValue || placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <div className="border rounded-md bg-popover text-popover-foreground">
            <div className="flex items-center border-b px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <input
                placeholder="Search suppliers..."
                value={inputValue}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && inputValue && inputValue !== value) {
                    onChange(inputValue);
                    setOpen(false);
                  }
                }}
                className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                autoFocus
              />
            </div>
            <div className="max-h-[300px] overflow-y-auto overflow-x-hidden">
              {filteredSuppliers.length === 0 ? (
                <div className="py-6 text-center text-sm">
                  {inputValue ? (
                    <div className="py-2 text-center text-sm">
                      Press Enter to add &quot;{inputValue}&quot; as custom supplier
                    </div>
                  ) : (
                    "No suppliers found."
                  )}
                </div>
              ) : (
                <div className="p-1">
                  {filteredSuppliers.map((supplier) => (
                    <div
                      key={supplier}
                      onClick={() => handleSelect(supplier)}
                      className="relative flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          inputValue === supplier ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {supplier}
                    </div>
                  ))}
                  {inputValue && !SUPPLIERS.includes(inputValue) && (
                    <div
                      onClick={() => handleSelect(inputValue)}
                      className="relative flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground text-blue-600"
                    >
                      <Check className="mr-2 h-4 w-4 opacity-0" />
                      Add &quot;{inputValue}&quot; as custom supplier
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

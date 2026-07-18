"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
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
import { PropertyService } from "@/services/property-service";
import type { Property } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const NO_PROPERTY_VALUE = "__no_property__";

function propertyLabel(property: Property) {
  return (
    [property.address, property.city, property.state, property.zip]
      .filter(Boolean)
      .join(", ") || "Untitled property"
  );
}

export default function CampaignPropertySelector({
  value,
  onChange,
}: {
  value?: string | null;
  // `label` is the property's address label (or null when cleared) so the parent
  // can show it in a collapsed summary without a second fetch. Optional second
  // arg — single-arg callers keep working.
  onChange: (propertyId: string | null, label?: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    PropertyService.listAllProperties()
      .then((rows) => {
        if (alive) setProperties(rows);
      })
      .catch((error) => {
        console.error("Failed to load campaign property options:", error);
        if (alive) setProperties([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === value) ?? null,
    [properties, value],
  );

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Property (optional)</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            <span className="truncate">
              {selectedProperty
                ? propertyLabel(selectedProperty)
                : "Select a property"}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] p-0"
          align="start"
        >
          <Command>
            <CommandInput placeholder="Search properties..." />
            <CommandList>
              <CommandEmpty>
                {loading ? "Loading properties..." : "No properties found."}
              </CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value={NO_PROPERTY_VALUE}
                  onSelect={() => {
                    onChange(null, null);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      !value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  No property attribution
                </CommandItem>
                {properties.map((property) => (
                  <CommandItem
                    key={property.id}
                    value={`${property.id} ${propertyLabel(property)}`}
                    onSelect={() => {
                      onChange(property.id, propertyLabel(property));
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === property.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="truncate">{propertyLabel(property)}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <p className="text-xs text-muted-foreground">
        Attribute this campaign&apos;s cost to a property so closed-deal ROI can
        be calculated.
      </p>
    </div>
  );
}

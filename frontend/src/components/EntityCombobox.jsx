import React, { useMemo, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const normalise = (text) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/**
 * Combobox (Popover + Command, the shadcn pattern) that picks an existing entry (Koleksi Kitab /
 * Penceramah) or creates one inline with a "+ Tambah '…'" row (spec §8.3.7).
 *
 * `options`: `[{ id, label }]`. `value`: `{ id, label }` or `null`; `id === null` means "new,
 * created on save". `onChange` receives the same shape. Typing only filters the list.
 */
export function EntityCombobox({ options, value, onChange, placeholder, searchPlaceholder, createLabel, emptyLabel, id }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const typed = query.trim();
  const rows = useMemo(() => {
    const q = normalise(query);
    const shown = q ? options.filter((o) => normalise(o.label).includes(q)) : options;
    const exists = options.some((o) => normalise(o.label) === q);
    return { shown, canCreate: typed !== "" && !exists };
  }, [options, query, typed]);

  function handleOpenChange(next) {
    setOpen(next);
    if (!next) setQuery("");
  }

  function pick(entity) {
    onChange(entity);
    handleOpenChange(false);
  }

  const isSelected = (o) => value && value.id !== null && value.id === o.id;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
          {value ? (
            <span className="truncate">{value.label}</span>
          ) : (
            <span className="truncate text-muted-foreground">{placeholder}</span>
          )}
          <ChevronDown className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) gap-0 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={query} onValueChange={setQuery} placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              {rows.canCreate && (
                <CommandItem value={`new:${typed}`} onSelect={() => pick({ id: null, label: typed })}>
                  <Plus />
                  {createLabel(typed)}
                </CommandItem>
              )}
              {rows.shown.map((o) => (
                <CommandItem key={o.id} value={`id:${o.id}`} data-checked={isSelected(o)} onSelect={() => pick(o)}>
                  <span className="truncate">{o.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

import React from "react";
import { Link } from "react-router";
import {
  ArrowDown01,
  ArrowDown10,
  ArrowDownAZ,
  ArrowDownZA,
  ArrowUpDown,
  CalendarArrowDown,
  CalendarArrowUp,
  Funnel,
  Heart,
  LibraryBig,
  User,
  Video,
} from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SORT_OPTIONS } from "@/lib/library";

const KIND_OPTIONS = {
  video: { label: "Video Ceramah", icon: Video },
  collection: { label: "Koleksi Kitab", icon: LibraryBig },
  speaker: { label: "Penceramah", icon: User },
};

const SORT_ICONS = {
  date_desc: CalendarArrowUp,
  date_asc: CalendarArrowDown,
  title_asc: ArrowDownAZ,
  title_desc: ArrowDownZA,
  series_asc: ArrowDown01,
  series_desc: ArrowDown10,
};

// Order follows the Figma "Susun" menu (Abjad, then Tarikh Muat Naik); Siri leads inside a collection.
const SORT_GROUPS = [
  { label: "Mengikut Siri", options: ["series_asc", "series_desc"], onlyIn: "collection" },
  { label: "Mengikut Abjad", options: ["title_asc", "title_desc"] },
  { label: "Mengikut Tarikh Muat Naik", options: ["date_desc", "date_asc"] },
];

/** Breadcrumb from `[{ label, to? }]`; the last crumb is the current page. */
export function LibraryBreadcrumb({ crumbs }) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <React.Fragment key={`${i}-${crumb.label}`}>
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={crumb.to}>{crumb.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

/**
 * Tapis | Susun joined buttons (spec §8.3.4).
 * - `kinds`: card kinds this view can contain; `tickedKinds`: the ticked subset (never empty).
 * - `filterCount`: badge on Tapis when the filter differs from the default.
 */
export function FilterSortControls({
  mode,
  kinds,
  tickedKinds,
  onToggleKind,
  favouritesOnly,
  onFavouritesOnlyChange,
  sort,
  onSortChange,
}) {
  const allTicked = kinds.every((k) => tickedKinds.has(k));
  const isDefault = allTicked && !favouritesOnly;
  const filterCount = isDefault ? 0 : kinds.filter((k) => tickedKinds.has(k)).length + (favouritesOnly ? 1 : 0);

  // Keep the menu open so several options can be ticked in one go.
  const keepOpen = (event) => event.preventDefault();

  return (
    <ButtonGroup>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <Funnel />
            Tapis
            {filterCount > 0 && <Badge variant="secondary">{filterCount}</Badge>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {kinds.length > 0 && (
            <>
              <DropdownMenuGroup>
                <DropdownMenuLabel>Tapis Carian</DropdownMenuLabel>
                {kinds.map((kind) => {
                  const { label, icon: Icon } = KIND_OPTIONS[kind];
                  const checked = tickedKinds.has(kind);
                  return (
                    <DropdownMenuCheckboxItem
                      key={kind}
                      checked={checked}
                      // The last ticked kind cannot be unticked.
                      disabled={checked && tickedKinds.size === 1}
                      onCheckedChange={() => onToggleKind(kind)}
                      onSelect={keepOpen}
                    >
                      <Icon />
                      {label}
                    </DropdownMenuCheckboxItem>
                  );
                })}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuGroup>
            <DropdownMenuCheckboxItem
              checked={favouritesOnly}
              onCheckedChange={onFavouritesOnlyChange}
              onSelect={keepOpen}
            >
              <Heart />
              Kegemaran Sahaja
            </DropdownMenuCheckboxItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <ArrowUpDown />
            Susun
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {/* One radio group across all sections: a single selection (spec §8.3.4). */}
          <DropdownMenuRadioGroup value={sort} onValueChange={onSortChange}>
            {SORT_GROUPS.filter((g) => !g.onlyIn || g.onlyIn === mode).map((group, i) => (
              <React.Fragment key={group.label}>
                {i > 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
                {group.options.map((option) => {
                  const Icon = SORT_ICONS[option];
                  return (
                    <DropdownMenuRadioItem key={option} value={option}>
                      <Icon />
                      {SORT_OPTIONS[option]}
                    </DropdownMenuRadioItem>
                  );
                })}
              </React.Fragment>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  );
}

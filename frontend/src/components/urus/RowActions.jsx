import React from "react";
import { EllipsisVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Row actions in a Dropdown Menu (spec §8.3.8). `actions`: `[{ label, icon, onSelect, disabled?, destructive? }]`;
 * destructive actions are separated from the rest.
 */
export function RowActions({ label, actions }) {
  const normal = actions.filter((a) => !a.destructive);
  const destructive = actions.filter((a) => a.destructive);

  const renderItem = ({ label: text, icon: Icon, onSelect, disabled, destructive: isDestructive }) => (
    <DropdownMenuItem
      key={text}
      variant={isDestructive ? "destructive" : "default"}
      disabled={disabled}
      onSelect={onSelect}
    >
      <Icon />
      {text}
    </DropdownMenuItem>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label}>
          <EllipsisVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {normal.map(renderItem)}
        {normal.length > 0 && destructive.length > 0 && <DropdownMenuSeparator />}
        {destructive.map(renderItem)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

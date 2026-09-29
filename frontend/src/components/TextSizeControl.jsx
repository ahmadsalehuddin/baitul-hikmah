import React from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
import { DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { useCurrentUser } from "@/hooks/use-current-user";
import { TEXT_SIZES } from "@/lib/text-size";

/**
 * Saiz Teks (spec §8.3.9) for the profile menu: a − / + Button Group with the current step label.
 * The group sits in a menu item so keyboard users reach it with the arrow keys and change the size
 * with Left / Right; touch and mouse use the buttons. The menu stays open while adjusting.
 */
export function TextSizeControl() {
  const { textSize, setTextSize, textSizeError } = useCurrentUser();
  const index = Math.max(0, TEXT_SIZES.findIndex((s) => s.value === textSize));
  const current = TEXT_SIZES[index];

  const step = (delta) => {
    const next = TEXT_SIZES[index + delta];
    if (next) setTextSize(next.value);
  };

  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>Saiz Teks</DropdownMenuLabel>
      <DropdownMenuItem
        onSelect={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            event.stopPropagation();
            step(event.key === "ArrowLeft" ? -1 : 1);
          }
        }}
      >
        <ButtonGroup className="w-full">
          <Button
            type="button"
            variant="outline"
            size="icon"
            tabIndex={-1}
            aria-label="Kecilkan teks"
            disabled={index === 0}
            onClick={() => step(-1)}
          >
            <Minus />
          </Button>
          <ButtonGroupText className="flex-1 justify-center" aria-live="polite">
            {current.label}
          </ButtonGroupText>
          <Button
            type="button"
            variant="outline"
            size="icon"
            tabIndex={-1}
            aria-label="Besarkan teks"
            disabled={index === TEXT_SIZES.length - 1}
            onClick={() => step(1)}
          >
            <Plus />
          </Button>
        </ButtonGroup>
      </DropdownMenuItem>
      {textSizeError && (
        <p role="alert" className="px-2 pb-1.5 text-xs text-destructive">
          Gagal menyimpan saiz teks. Sila cuba lagi.
        </p>
      )}
    </DropdownMenuGroup>
  );
}

import React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogClose } from "@/components/ui/dialog";

/**
 * Top-right close button with a Malay label. Use with `<DialogContent showCloseButton={false}>` —
 * the built-in one in the generated dialog has an English sr-only label we cannot edit (§8.1.2).
 */
export function DialogCloseButton() {
  return (
    <DialogClose asChild>
      <Button variant="ghost" size="icon-sm" className="absolute top-4 right-4" aria-label="Tutup">
        <X />
      </Button>
    </DialogClose>
  );
}

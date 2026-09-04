import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export function SheetContent({
  className,
  children,
  side = "right",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { side?: "right" | "left" | "bottom" }) {
  const pos =
    side === "bottom"
      ? "inset-x-0 bottom-0 max-h-[88vh] rounded-t-xl"
      : side === "left"
        ? "inset-y-0 left-0 h-full w-[min(320px,100%)]"
        : "inset-y-0 right-0 h-full w-[min(420px,100%)]";
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-bg/70" />
      <DialogPrimitive.Content
        className={cn("fixed z-50 overflow-y-auto bg-surface p-5 hairline", pos, className)}
        {...props}
      >
        {children}
        <DialogPrimitive.Close asChild>
          <Button variant="ghost" size="icon" className="absolute top-3 right-3" aria-label="Close">
            <X />
          </Button>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function SheetTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("font-display text-2xl", className)} {...props} />;
}

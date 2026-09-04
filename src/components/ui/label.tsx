import * as React from "react";
import { cn } from "@/lib/utils";

const Label = React.forwardRef<HTMLLabelElement, React.ComponentProps<"label">>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn("text-xs font-medium uppercase tracking-wider text-muted", className)}
      {...props}
    />
  ),
);
Label.displayName = "Label";
export { Label };

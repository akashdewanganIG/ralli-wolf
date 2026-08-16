import * as React from "react";

import { cn } from "@repo/ui/lib/utils";
import {
  controlVariants,
  type ControlSize,
} from "@repo/ui/components/ui/form-control";

export interface InputProps
  extends Omit<React.ComponentProps<"input">, "size"> {
  /** Height/padding/type scale. Shared with Select, Textarea and Button. */
  size?: ControlSize;
}

function Input({ className, type, size, ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      suppressHydrationWarning={true}
      className={cn(
        controlVariants({ size }),
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground selection:bg-primary selection:text-primary-foreground",
        className
      )}
      {...props}
    />
  );
}

export { Input };

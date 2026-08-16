"use client";

import * as React from "react";
import { cn } from "@repo/ui/lib/utils";
import {
  controlAreaVariants,
  type ControlSize,
} from "@repo/ui/components/ui/form-control";

export interface TextareaProps extends React.ComponentProps<"textarea"> {
  /** Padding/type scale. Shared with Input and Select. */
  size?: ControlSize;
}

function Textarea({ className, size, ...props }: TextareaProps) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(controlAreaVariants({ size }), "flex min-h-24", className)}
      {...props}
    />
  );
}

export { Textarea };

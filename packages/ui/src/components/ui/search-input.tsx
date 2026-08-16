"use client";

import * as React from "react";
import { Search } from "lucide-react";

import { cn } from "@repo/ui/lib/utils";
import { Input } from "./input";

export type SearchInputProps = React.ComponentProps<typeof Input> & {
  /** Class for the wrapper, so the control can be sized by its container. */
  wrapperClassName?: string;
};

function SearchInput({
  className,
  wrapperClassName,
  ...props
}: SearchInputProps) {
  return (
    <div className={cn("relative", wrapperClassName)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input className={cn("pl-9", className)} {...props} />
    </div>
  );
}
SearchInput.displayName = "SearchInput";

export { SearchInput };

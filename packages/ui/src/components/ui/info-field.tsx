import * as React from "react";
import Link from "next/link";
import { cn } from "@repo/ui/lib/utils";
import { Input } from "./input";
import { Label } from "./label";

interface InfoFieldProps {
  label: string;
  value: string;
  className?: string;
  editable?: boolean;
  onChange?: (value: string) => void;
  onClick?: () => void;
  href?: string;
}

const InfoField = React.forwardRef<HTMLDivElement, InfoFieldProps>(
  (
    { label, value, className, editable = false, onChange, onClick, href },
    ref
  ) => (
    <div ref={ref} className={cn("space-y-1.5", className)}>
      <Label
        className={`text-xs font-medium uppercase tracking-wide text-muted-foreground ${editable ? "cursor-pointer hover:text-primary" : ""}`}
      >
        {label}
      </Label>
      {editable ? (
        <Input
          value={value}
          onChange={e => onChange?.(e.target.value)}
          className="bg-surface"
        />
      ) : (
        <div className="text-sm font-medium leading-6 text-foreground">
          {value && value.trim().length > 0 ? (
            href ? (
              <Link
                href={href}
                prefetch={true}
                className={cn(
                  "cursor-pointer font-medium text-primary outline-none hover:text-info focus-visible:ring-2 focus-visible:ring-ring/30"
                )}
              >
                {value}
              </Link>
            ) : onClick ? (
              <button
                type="button"
                className="cursor-pointer rounded-sm font-medium text-primary outline-none hover:text-info focus-visible:ring-2 focus-visible:ring-ring/30"
                onClick={onClick}
              >
                {value}
              </button>
            ) : (
              <span>{value}</span>
            )
          ) : (
            <span className="text-muted-foreground">N/A</span>
          )}
        </div>
      )}
    </div>
  )
);
InfoField.displayName = "InfoField";

interface InfoGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}

const InfoGrid = React.forwardRef<HTMLDivElement, InfoGridProps>(
  ({ children, columns = 2, className }, ref) => (
    <div
      ref={ref}
      className={cn(
        "grid gap-5",
        {
          "grid-cols-1": columns === 1,
          "grid-cols-1 sm:grid-cols-2": columns === 2,
          "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3": columns === 3,
          "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4": columns === 4,
        },
        className
      )}
    >
      {children}
    </div>
  )
);
InfoGrid.displayName = "InfoGrid";

export { InfoField, InfoGrid };

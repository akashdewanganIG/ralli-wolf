"use client";

import React from "react";
import Link from "next/link";
import { useWarehouses } from "@/hooks/use-supply-chain";
import { SelectField } from "./shared";
import { Alert } from "@repo/ui/components/ui/alert";

export function WarehouseFilter({
  value,
  onChange,
  allowAll = true,
  allLabel = "All warehouses",
  required = false,
  className = "w-full sm:w-52",
  ariaLabel = "Warehouse",
}: {
  value: number | undefined;
  onChange: (warehouseId: number | undefined) => void;
  allowAll?: boolean;
  allLabel?: string;
  required?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const { warehouses, isLoading } = useWarehouses({
    limit: 200,
    isActive: true,
  });

  if (!isLoading && warehouses.length === 0) {
    return (
      <Alert
        tone="warning"
        title="No active warehouse"
        className="px-3 py-2 text-xs"
      >
        Create one under{" "}
        <Link
          href="/warehouse"
          className="font-semibold text-primary outline-none transition-colors hover:text-info focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          Warehouse Management
        </Link>{" "}
        before selecting a location.
      </Alert>
    );
  }

  return (
    <SelectField
      className={className}
      value={value === undefined ? "" : String(value)}
      required={required}
      disabled={isLoading}
      aria-label={ariaLabel}
      aria-busy={isLoading}
      onChange={event =>
        onChange(
          event.target.value === "" ? undefined : Number(event.target.value)
        )
      }
    >
      {isLoading ? (
        <option value="">Loading warehouses…</option>
      ) : (
        <>
          {allowAll && <option value="">{allLabel}</option>}
          {!allowAll && <option value="">Select a warehouse…</option>}
          {warehouses.map(warehouse => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.code} — {warehouse.name}
            </option>
          ))}
        </>
      )}
    </SelectField>
  );
}

"use client";

import React, { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { FormDialog } from "@repo/ui/components/ui/form-dialog";
import { DialogFooter } from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { leadService } from "@/lib/api/services";
import { Download, FileSpreadsheet, TableProperties } from "@repo/ui/icons";
import { toast } from "@/lib/toast";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEntity: "leads" | "contacts" | "accounts";
};

export const ExportModal: React.FC<Props> = ({
  open,
  onOpenChange,
  defaultEntity,
}) => {
  const [entity, setEntity] = useState<"leads" | "contacts" | "accounts">(
    defaultEntity
  );
  const [format, setFormat] = useState<"xlsx" | "csv">("xlsx");
  const [startPage, setStartPage] = useState<number>(1);
  const [endPage, setEndPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(50);
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    try {
      setLoading(true);
      const blob = await leadService.downloadExport(entity, {
        startPage,
        endPage,
        limit,
        format,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const extension = format === "csv" ? ".csv" : ".xlsx";
      a.download = `ralli-wolf-${entity}-${new Date().toISOString().slice(0, 10)}${extension}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(
        `${entity[0]?.toUpperCase()}${entity.slice(1)} export is ready`
      );
      onOpenChange(false);
    } catch {
      toast.error("Export failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const maxRecords = Math.max(1, endPage - startPage + 1) * limit;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Export CRM data"
      description="Choose a format and the page range to include."
      footer={
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="cardAction"
            size="card"
            className="sm:w-auto sm:px-4"
            onClick={handleExport}
            disabled={loading || endPage < startPage}
          >
            <Download className="size-4" />
            {loading ? "Preparing…" : `Export ${format.toUpperCase()}`}
          </Button>
        </DialogFooter>
      }
    >
      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="sr-only">File format</legend>
        {[
          {
            value: "xlsx" as const,
            icon: FileSpreadsheet,
            label: "Excel workbook",
            hint: "Styled header, frozen row, filters, phone fields preserved.",
          },
          {
            value: "csv" as const,
            icon: TableProperties,
            label: "CSV data file",
            hint: "UTF-8, Excel-compatible, portable to other systems.",
          },
        ].map(option => {
          const selected = format === option.value;
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => setFormat(option.value)}
              className={`rounded-lg border p-3 text-left outline-none transition-[background-color,border-color] duration-150 focus-visible:ring-2 focus-visible:ring-ring/30 ${
                selected
                  ? "border-primary bg-primary-surface"
                  : "border-border bg-surface hover:border-border-strong hover:bg-surface-subtle"
              }`}
            >
              <Icon
                aria-hidden="true"
                className={`size-4 ${selected ? "text-primary" : "text-muted-foreground"}`}
              />
              <span className="mt-2 block text-[0.8125rem] font-semibold leading-5 text-foreground">
                {option.label}
              </span>
              <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">
                {option.hint}
              </span>
            </button>
          );
        })}
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="export-entity">Data set</Label>
          <Select
            value={entity}
            onValueChange={v => setEntity(v as typeof entity)}
          >
            <SelectTrigger id="export-entity" className="w-full">
              <SelectValue placeholder="Select data…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="leads">Leads</SelectItem>
              <SelectItem value="contacts">Contacts</SelectItem>
              <SelectItem value="accounts">Accounts</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="export-start">Start page</Label>
          <Input
            id="export-start"
            type="number"
            min={1}
            value={startPage}
            onChange={e => setStartPage(parseInt(e.target.value || "1"))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="export-end">End page</Label>
          <Input
            id="export-end"
            type="number"
            min={startPage}
            value={endPage}
            onChange={e =>
              setEndPage(parseInt(e.target.value || String(startPage)))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="export-limit">Page size</Label>
          <Input
            id="export-limit"
            type="number"
            min={1}
            max={100}
            value={limit}
            onChange={e => setLimit(parseInt(e.target.value || "50"))}
          />
        </div>
      </div>

      <p
        className="rounded-lg border border-border bg-surface-subtle px-3 py-2 text-xs leading-4 text-muted-foreground"
        role="status"
      >
        Pages {startPage}–{Math.max(startPage, endPage)} at up to {limit}{" "}
        records per page — {maxRecords.toLocaleString()} records maximum.
      </p>

      {endPage < startPage ? (
        <p className="text-xs leading-4 text-error-foreground" role="alert">
          End page must not be lower than the start page.
        </p>
      ) : null}
    </FormDialog>
  );
};

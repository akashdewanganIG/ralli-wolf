"use client";

import React, { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
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
import {
  Download,
  FileSpreadsheet,
  Loader2,
  TableProperties,
} from "lucide-react";
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-hidden p-0">
        <DialogHeader className="border-b bg-gradient-to-r from-primary/10 via-background to-amber-50 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary p-2.5 text-primary-foreground">
              <Download className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-xl">Export CRM data</DialogTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a polished, analysis-ready file with stable column
                formatting.
              </p>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-5 px-6 py-5">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFormat("xlsx")}
              className={`rounded-xl border p-4 text-left transition ${format === "xlsx" ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500" : "hover:bg-muted/40"}`}
            >
              <FileSpreadsheet className="size-6 text-emerald-600" />
              <div className="mt-3 font-semibold">Excel workbook</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Styled header, frozen row, filters, and preserved phone fields.
              </div>
            </button>
            <button
              type="button"
              onClick={() => setFormat("csv")}
              className={`rounded-xl border p-4 text-left transition ${format === "csv" ? "border-sky-500 bg-sky-50 ring-1 ring-sky-500" : "hover:bg-muted/40"}`}
            >
              <TableProperties className="size-6 text-sky-600" />
              <div className="mt-3 font-semibold">CSV data file</div>
              <div className="mt-1 text-xs text-muted-foreground">
                UTF-8, Excel-compatible and ideal for other systems.
              </div>
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Data set</Label>
              <Select
                value={entity}
                onValueChange={v => setEntity(v as typeof entity)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select data…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="leads">Leads</SelectItem>
                  <SelectItem value="contacts">Contacts</SelectItem>
                  <SelectItem value="accounts">Accounts</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Start page</Label>
              <Input
                type="number"
                min={1}
                value={startPage}
                onChange={e => setStartPage(parseInt(e.target.value || "1"))}
              />
            </div>
            <div className="space-y-2">
              <Label>End page</Label>
              <Input
                type="number"
                min={startPage}
                value={endPage}
                onChange={e =>
                  setEndPage(parseInt(e.target.value || String(startPage)))
                }
              />
            </div>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            Exporting pages {startPage}–{Math.max(startPage, endPage)} at up to{" "}
            {limit} records per page (
            {Math.max(1, endPage - startPage + 1) * limit} records maximum).
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Page size</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={limit}
                onChange={e => setLimit(parseInt(e.target.value || "50"))}
              />
            </div>
          </div>
        </div>
        <DialogFooter className="border-t bg-muted/20 px-6 py-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={loading || endPage < startPage}
          >
            {loading ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Download className="mr-2 size-4" />
            )}
            {loading ? "Preparing…" : `Export ${format.toUpperCase()}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

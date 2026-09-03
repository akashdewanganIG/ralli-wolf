"use client";

import * as React from "react";

import { Button } from "@repo/ui/components/ui/button";
import { DialogFooter } from "@repo/ui/components/ui/dialog";
import { FormDialog } from "@repo/ui/components/ui/form-dialog";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  Download,
  FileSpreadsheet,
  TableProperties,
  Upload,
  UploadCloud,
  CheckCircle2,
  TriangleAlert,
} from "@repo/ui/icons";

import {
  dataTransferService,
  saveBlob,
  type ExportFormat,
  type ImportOutcome,
  type TransferEntityInfo,
} from "@/lib/api/data-transfer-service";
import { toast } from "@/lib/toast";

type Props = {
  entity: string;

  label?: string;

  onImported?: () => void;

  allowImport?: boolean;

  size?: "sm" | "default";
  className?: string;
};

const FORMATS: Array<{
  value: ExportFormat;
  icon: typeof FileSpreadsheet;
  label: string;
  hint: string;
}> = [
  {
    value: "xlsx",
    icon: FileSpreadsheet,
    label: "Excel workbook",
    hint: "Styled header, frozen row, codes kept as text.",
  },
  {
    value: "csv",
    icon: TableProperties,
    label: "CSV data file",
    hint: "UTF-8, opens in Excel, portable to other systems.",
  },
];

export function DataTransfer({
  entity,
  label,
  onImported,
  allowImport = true,
  size = "sm",
  className,
}: Props) {
  const [info, setInfo] = React.useState<TransferEntityInfo | null>(null);
  const [exportOpen, setExportOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    loadCatalogue()
      .then(list => {
        if (alive) setInfo(list.find(e => e.key === entity) ?? null);
      })
      .catch(() => {
        if (alive) setInfo(null);
      });
    return () => {
      alive = false;
    };
  }, [entity]);

  if (!info) return null;
  const name = label ?? info.label;
  const showImport = info.importable && allowImport;

  return (
    <>
      <div className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}>
        {showImport && (
          <Button
            type="button"
            variant="outline"
            size={size}
            onClick={() => setImportOpen(true)}
          >
            <Upload aria-hidden="true" className="size-4" />
            Import
          </Button>
        )}
        {info.exportable && (
          <Button
            type="button"
            variant="outline"
            size={size}
            onClick={() => setExportOpen(true)}
          >
            <Download aria-hidden="true" className="size-4" />
            Export
          </Button>
        )}
      </div>

      {info.exportable && (
        <ExportDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          entity={info}
          name={name}
        />
      )}
      {showImport && (
        <ImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          entity={info}
          name={name}
          onImported={onImported}
        />
      )}
    </>
  );
}

let cataloguePromise: Promise<TransferEntityInfo[]> | null = null;
function loadCatalogue(): Promise<TransferEntityInfo[]> {
  if (!cataloguePromise) {
    cataloguePromise = dataTransferService
      .catalogue()
      .then(res => res.data)
      .catch(error => {
        cataloguePromise = null;
        throw error;
      });
  }
  return cataloguePromise;
}

function ExportDialog({
  open,
  onOpenChange,
  entity,
  name,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity: TransferEntityInfo;
  name: string;
}) {
  const [format, setFormat] = React.useState<ExportFormat>("xlsx");
  const [startPage, setStartPage] = React.useState(1);
  const [endPage, setEndPage] = React.useState(1);
  const [limit, setLimit] = React.useState(100);
  const [busy, setBusy] = React.useState(false);

  const pages = Math.max(1, endPage - startPage + 1);
  const maxRecords = pages * limit;

  const run = async () => {
    setBusy(true);
    try {
      const blob = await dataTransferService.exportEntity(entity.key, {
        format,
        startPage,
        endPage,
        limit,
      });
      saveBlob(
        blob,
        `ralli-wolf-${entity.key}-${new Date().toISOString().slice(0, 10)}.${format}`
      );
      toast.success(`${name} export is ready`);
      onOpenChange(false);
    } catch {
      toast.error(`Could not export ${name.toLowerCase()}. Please try again.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={`Export ${name.toLowerCase()}`}
      description="Choose a file format and how much of the list to include."
      footer={
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={run}
            disabled={busy || endPage < startPage}
          >
            <Download aria-hidden="true" className="size-4" />
            {busy ? "Preparing…" : `Export ${format.toUpperCase()}`}
          </Button>
        </DialogFooter>
      }
    >
      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="sr-only">File format</legend>
        {FORMATS.map(option => {
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

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="dt-start">From page</Label>
          <Input
            id="dt-start"
            type="number"
            min={1}
            value={startPage}
            onChange={e => {
              const next = Math.max(1, Number(e.target.value) || 1);
              setStartPage(next);
              if (next > endPage) setEndPage(next);
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dt-end">To page</Label>
          <Input
            id="dt-end"
            type="number"
            min={startPage}
            value={endPage}
            onChange={e =>
              setEndPage(
                Math.max(startPage, Number(e.target.value) || startPage)
              )
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dt-limit">Rows per page</Label>
          <Input
            id="dt-limit"
            type="number"
            min={1}
            max={500}
            value={limit}
            onChange={e =>
              setLimit(Math.min(500, Math.max(1, Number(e.target.value) || 1)))
            }
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Up to {maxRecords.toLocaleString()} row(s) across {pages} page(s). The
        file will have {entity.columns.length} columns:{" "}
        {entity.columns.slice(0, 6).join(", ")}
        {entity.columns.length > 6 ? "…" : ""}.
      </p>
    </FormDialog>
  );
}

function ImportDialog({
  open,
  onOpenChange,
  entity,
  name,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity: TransferEntityInfo;
  name: string;
  onImported?: () => void;
}) {
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<ImportOutcome | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const getTemplate = async () => {
    try {
      const blob = await dataTransferService.template(entity.key);
      saveBlob(blob, `ralli-wolf-${entity.key}-template.xlsx`);
    } catch {
      toast.error("Could not download the template.");
    }
  };

  const run = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const res = await dataTransferService.importEntity(entity.key, file);
      setResult(res.data);
      if (res.data.created + res.data.updated > 0) {
        toast.success(
          `${res.data.created} added, ${res.data.updated} updated in ${name.toLowerCase()}`
        );
        onImported?.();
      } else {
        toast.error("Nothing could be imported from that file.");
      }
    } catch (error) {
      const message =
        (
          error as {
            response?: { data?: { message?: string; error?: string } };
          }
        )?.response?.data?.message ??
        (error as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ??
        "The import failed.";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={next => {
        onOpenChange(next);
        if (!next) reset();
      }}
      size="lg"
      title={`Import ${name.toLowerCase()}`}
      description="Upload a spreadsheet. Rows that cannot be read are listed back to you; the rest still go in."
      footer={
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {result ? "Close" : "Cancel"}
          </Button>
          <Button type="button" onClick={run} disabled={!file || busy}>
            <UploadCloud aria-hidden="true" className="size-4" />
            {busy ? "Importing…" : "Import file"}
          </Button>
        </DialogFooter>
      }
    >
      <div className="rounded-lg border border-border bg-surface-secondary p-3">
        <p className="text-[0.8125rem] font-medium text-foreground">
          Start from the template
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          It has exactly the columns this importer reads.{" "}
          {entity.requiredColumns.length > 0 && (
            <>
              Every row needs{" "}
              <span className="font-medium text-foreground">
                {entity.requiredColumns.join(" and ")}
              </span>
              .
            </>
          )}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={getTemplate}
        >
          <Download aria-hidden="true" className="size-4" />
          Download template
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="dt-file">Spreadsheet</Label>
        <Input
          id="dt-file"
          ref={inputRef}
          type="file"
          accept=".xlsx,.csv"
          onChange={e => {
            setResult(null);
            setFile(e.target.files?.[0] ?? null);
          }}
        />
        <p className="text-xs text-muted-foreground">
          .xlsx or .csv, up to 10 MB. A row matching one already here updates it
          rather than making a duplicate.
        </p>
      </div>

      {result && (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2
                aria-hidden="true"
                className="size-4 text-success"
              />
              <span className="font-medium text-foreground">
                {result.created}
              </span>
              <span className="text-muted-foreground">added</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2
                aria-hidden="true"
                className="size-4 text-success"
              />
              <span className="font-medium text-foreground">
                {result.updated}
              </span>
              <span className="text-muted-foreground">updated</span>
            </span>
            {result.failed > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <TriangleAlert
                  aria-hidden="true"
                  className="size-4 text-primary"
                />
                <span className="font-medium text-foreground">
                  {result.failed}
                </span>
                <span className="text-muted-foreground">skipped</span>
              </span>
            )}
          </div>

          {result.errors.length > 0 && (
            <div className="max-h-48 overflow-y-auto rounded-md border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-surface-secondary">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                      Row
                    </th>
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                      Why it was skipped
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.errors.map(err => (
                    <tr key={err.row} className="border-t border-border">
                      <td className="px-2 py-1.5 tabular-nums text-muted-foreground">
                        {err.row}
                      </td>
                      <td className="px-2 py-1.5 text-foreground">
                        {err.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </FormDialog>
  );
}

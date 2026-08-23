"use client";

import React, { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Pencil,
  Upload,
} from "@repo/ui/icons";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { leadService } from "@/lib/api/services";
import { leadKeys } from "@/hooks/useLeads";
import { toast } from "@/lib/toast";
import { Skeleton, SkeletonText } from "@repo/ui/components/ui/skeleton";
import { Tag } from "@repo/ui/components/ui/tag";

type Props = { open: boolean; onOpenChange: (open: boolean) => void };
type PreviewRow = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  companyName: string;
  city: string;
  state: string;
  pincode: string;
  status: string;
};
type Step = "select" | "review" | "result";
const MAX_IMPORT_ROWS = 1000;
type ImportResult = {
  insertedCount: number;
  skippedDuplicates: number;
  skippedCount: number;
  errors?: Array<{ row: number; reason: string }>;
  report?: { filename: string; mimeType: string; base64: string };
};

const aliases: Record<keyof PreviewRow, string[]> = {
  firstName: ["firstname", "first", "givenname"],
  lastName: ["lastname", "surname", "familyname"],
  email: ["email", "emailaddress", "workemail"],
  phone: ["phone", "phonenumber", "mobile", "mobilenumber", "contactnumber"],
  companyName: [
    "companyname",
    "company",
    "organisation",
    "organization",
    "account",
  ],
  city: ["city", "town"],
  state: ["state", "province", "region"],
  pincode: ["pincode", "postalcode", "zipcode", "zip"],
  status: ["status", "leadstatus", "stage"],
};

const canonicalHeaders: Record<keyof PreviewRow, string> = {
  firstName: "First Name",
  lastName: "Last Name",
  email: "Email",
  phone: "Phone",
  companyName: "Company Name",
  city: "City",
  state: "State",
  pincode: "Pincode",
  status: "Status",
};

const normalizeHeader = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const clean = (value: unknown) => String(value ?? "").trim();

async function parseLeadFile(file: File): Promise<PreviewRow[]> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: "array",
    cellDates: true,
  });
  const sheet = workbook.Sheets[workbook.SheetNames[0] || ""];
  if (!sheet) throw new Error("The file does not contain a worksheet.");
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });
  if (matrix.length < 2)
    throw new Error("Add at least one lead below the header row.");
  const headers = (matrix[0] || []).map(normalizeHeader);
  const indexFor = (field: keyof PreviewRow) =>
    headers.findIndex(header => aliases[field].includes(header));
  const indexes = Object.fromEntries(
    (Object.keys(aliases) as Array<keyof PreviewRow>).map(field => [
      field,
      indexFor(field),
    ])
  ) as Record<keyof PreviewRow, number>;
  const fullNameIndex = headers.findIndex(header =>
    ["name", "fullname", "contactname"].includes(header)
  );

  const rows = matrix
    .slice(1)
    .map(cells => {
      const read = (field: keyof PreviewRow) =>
        indexes[field] >= 0 ? clean(cells[indexes[field]]) : "";
      let firstName = read("firstName");
      let lastName = read("lastName");
      if (!firstName && fullNameIndex >= 0) {
        const parts = clean(cells[fullNameIndex]).split(/\s+/).filter(Boolean);
        firstName = parts.shift() || "";
        lastName ||= parts.join(" ");
      }
      return {
        firstName,
        lastName,
        email: read("email").toLowerCase(),
        phone: read("phone")
          .replace(/^\+?91[\s-]?/, "")
          .replace(/[^0-9]/g, ""),
        companyName: read("companyName"),
        city: read("city"),
        state: read("state"),
        pincode: read("pincode").replace(/[^0-9]/g, ""),
        status: (read("status") || "OPEN").toUpperCase(),
      };
    })
    .filter(row => Object.values(row).some(Boolean));
  if (!rows.length) throw new Error("No lead rows were found in the file.");
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new Error(
      `This file has ${rows.length.toLocaleString()} rows. Split it into files of ${MAX_IMPORT_ROWS.toLocaleString()} rows or fewer.`
    );
  }
  return rows;
}

function rowIssue(row: PreviewRow) {
  if (!row.firstName) return "First name is required";
  if (!/[^0-9]/.test(row.firstName)) return "First name cannot be numeric";
  if (row.lastName && !/[^0-9]/.test(row.lastName))
    return "Last name cannot be numeric";
  if (!row.email && !row.phone) return "Email or phone is required";
  if (
    row.email &&
    !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(row.email)
  )
    return "Invalid email";
  if (row.phone && !/^\d{10}$/.test(row.phone))
    return "Phone must have 10 digits";
  if (row.pincode && !/^\d{6}$/.test(row.pincode))
    return "Pincode must have 6 digits";
  if (
    ![
      "OPEN",
      "WORKING",
      "QUALIFIED",
      "UNQUALIFIED",
      "NURTURING",
      "CONVERTED",
    ].includes(row.status)
  )
    return "Invalid status";
  return "";
}

function getRowIssues(rows: PreviewRow[]) {
  const seenEmails = new Set<string>();
  const seenPhones = new Set<string>();
  return rows.map(row => {
    const validationIssue = rowIssue(row);
    if (validationIssue) return validationIssue;
    const email = row.email.trim().toLowerCase();
    const phone = row.phone.trim();
    if (email && seenEmails.has(email)) return "Duplicate email in this file";
    if (phone && seenPhones.has(phone)) return "Duplicate phone in this file";
    if (email) seenEmails.add(email);
    if (phone) seenPhones.add(phone);
    return "";
  });
}

async function rowsToFile(rows: PreviewRow[]) {
  const XLSX = await import("xlsx");
  const records = rows.map(row =>
    Object.fromEntries(
      (Object.keys(canonicalHeaders) as Array<keyof PreviewRow>).map(key => [
        canonicalHeaders[key],
        row[key],
      ])
    )
  );
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(records);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");
  const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return new File([bytes], "reviewed-leads.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export const ImportLeadsModal: React.FC<Props> = ({ open, onOpenChange }) => {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [step, setStep] = useState<Step>("select");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Drag-over is tracked with a counter, not a boolean: dragenter/dragleave
  // fire for every child element, so a boolean flickers as the pointer crosses
  // the icon or the text inside the drop zone.
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const queryClient = useQueryClient();
  const issues = useMemo(() => getRowIssues(rows), [rows]);
  const validCount = useMemo(
    () => issues.filter(issue => !issue).length,
    [issues]
  );

  const reset = () => {
    setFileName("");
    setRows([]);
    setStep("select");
    setResult(null);
    setSelectedFile(null);
    setDragging(false);
    dragDepth.current = 0;
    if (inputRef.current) inputRef.current.value = "";
  };
  const selectFile = async (selected?: File) => {
    if (!selected) return;
    setLoading(true);
    setSelectedFile(selected);
    try {
      setRows(await parseLeadFile(selected));
      setFileName(selected.name);
      setStep("review");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not read this file"
      );
    } finally {
      setLoading(false);
    }
  };
  const updateRow = (index: number, key: keyof PreviewRow, value: string) =>
    setRows(current =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row
      )
    );

  const importRows = async () => {
    if (!rows.length || issues.some(Boolean)) return;
    setLoading(true);
    try {
      const response = await leadService.importLeads(await rowsToFile(rows));
      setResult(response);
      setStep("result");
      await queryClient.invalidateQueries({ queryKey: leadKeys.all });
      toast.success(`Imported ${response.insertedCount} leads`);
    } catch {
      toast.error("Import failed. Please review the file and try again.");
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = async (format: "xlsx" | "csv") => {
    const blob =
      format === "csv"
        ? await leadService.downloadImportTemplateCsv()
        : await leadService.downloadImportTemplate();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ralli-wolf-lead-import-template.${format}`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const downloadSkippedReport = () => {
    if (!result?.report) return;
    const bytes = Uint8Array.from(atob(result.report.base64), character =>
      character.charCodeAt(0)
    );
    const blob = new Blob([bytes], { type: result.report.mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = result.report.filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="max-h-[92svh] sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Import leads</DialogTitle>
          <DialogDescription>
            Upload a file, correct anything flagged, then import.
          </DialogDescription>
          {/* Step indicator: plain dots and labels rather than filled pills, so
              it reads as progress instead of three buttons. */}
          <ol className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            {["Select file", "Review data", "Import complete"].map(
              (label, index) => {
                const order: Step[] = ["select", "review", "result"];
                const currentIndex = order.indexOf(step);
                const state =
                  index < currentIndex
                    ? "done"
                    : index === currentIndex
                      ? "current"
                      : "todo";
                return (
                  <React.Fragment key={label}>
                    <li
                      aria-current={state === "current" ? "step" : undefined}
                      className={`flex items-center gap-1.5 ${
                        state === "current"
                          ? "font-semibold text-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`size-1.5 shrink-0 rounded-full ${
                          state === "todo" ? "bg-border-strong" : "bg-primary"
                        }`}
                      />
                      {label}
                    </li>
                    {index < 2 && (
                      <span aria-hidden="true" className="h-px w-5 bg-border" />
                    )}
                  </React.Fragment>
                );
              }
            )}
          </ol>
        </DialogHeader>

        <div className="max-h-[62svh] overflow-y-auto">
          {step === "select" && (
            <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
              {/* Drop zone. A labelled region rather than a button, so the file
                  input keeps its own accessible name and dropping works without
                  the click affordance disappearing. */}
              <div
                onDragEnter={event => {
                  event.preventDefault();
                  dragDepth.current += 1;
                  setDragging(true);
                }}
                onDragOver={event => event.preventDefault()}
                onDragLeave={event => {
                  event.preventDefault();
                  dragDepth.current -= 1;
                  if (dragDepth.current <= 0) setDragging(false);
                }}
                onDrop={event => {
                  event.preventDefault();
                  dragDepth.current = 0;
                  setDragging(false);
                  void selectFile(event.dataTransfer.files?.[0]);
                }}
                className={`flex flex-col items-center justify-center rounded-lg border border-dashed p-5 text-center transition-[background-color,border-color] duration-150 ${
                  dragging
                    ? "border-primary bg-primary-surface"
                    : "border-border bg-surface-subtle"
                }`}
              >
                {loading ? (
                  <div className="w-full max-w-xs space-y-2" aria-busy="true">
                    <SkeletonText className="mx-auto h-3 w-32" />
                    <Skeleton className="h-1.5 w-full rounded-full" />
                    <p className="text-xs text-muted-foreground">
                      Reading {selectedFile?.name ?? "file"}…
                    </p>
                  </div>
                ) : (
                  <>
                    <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                      <Upload aria-hidden="true" className="size-4" />
                    </span>
                    <p className="mt-2.5 text-[0.8125rem] font-semibold leading-5 text-foreground">
                      Drop a file here
                    </p>
                    <p className="mt-0.5 max-w-xs text-xs leading-4 text-muted-foreground">
                      Excel or CSV. Columns such as Mobile, Work Email,
                      Organisation, and Stage are matched automatically.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-3"
                      onClick={() => inputRef.current?.click()}
                    >
                      Browse files
                    </Button>
                    {selectedFile ? (
                      <p className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <FileSpreadsheet
                          aria-hidden="true"
                          className="size-3.5"
                        />
                        <span className="font-medium text-foreground">
                          {selectedFile.name}
                        </span>
                        <span>
                          ·{" "}
                          {(
                            selectedFile.name.split(".").pop() ?? ""
                          ).toUpperCase()}{" "}
                          · {(selectedFile.size / 1024).toFixed(0)} KB
                        </span>
                      </p>
                    ) : null}
                  </>
                )}
              </div>

              <div className="rounded-lg border border-border bg-surface p-3">
                <h3 className="text-[0.8125rem] font-semibold leading-5 text-foreground">
                  Before you import
                </h3>
                <ul className="mt-2 space-y-1.5 text-xs leading-4 text-muted-foreground">
                  <li className="flex gap-1.5">
                    <CheckCircle2
                      aria-hidden="true"
                      className="mt-px size-3.5 shrink-0 text-success-foreground"
                    />
                    First name, plus an email or a 10-digit phone
                  </li>
                  <li className="flex gap-1.5">
                    <CheckCircle2
                      aria-hidden="true"
                      className="mt-px size-3.5 shrink-0 text-success-foreground"
                    />
                    Status values are validated before anything is written
                  </li>
                  <li className="flex gap-1.5">
                    <CheckCircle2
                      aria-hidden="true"
                      className="mt-px size-3.5 shrink-0 text-success-foreground"
                    />
                    Duplicate emails and phones are skipped
                  </li>
                </ul>
                <div className="mt-3 grid gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => downloadTemplate("xlsx")}
                  >
                    <Download className="size-4" />
                    Excel template
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => downloadTemplate("csv")}
                  >
                    <Download className="size-4" />
                    CSV template
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === "review" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">
                    Review {rows.length.toLocaleString()} rows
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {fileName} · click any field to correct it
                  </p>
                </div>
                <div className="flex gap-2">
                  <Tag tone="active">{validCount} ready</Tag>
                  {rows.length - validCount > 0 && (
                    <Tag tone="danger">
                      {rows.length - validCount} need attention
                    </Tag>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[70rem] text-sm">
                  <thead className="sticky top-0 z-10 bg-foreground text-left text-xs uppercase tracking-wide text-background">
                    <tr>
                      <th className="p-3">#</th>
                      {Object.values(canonicalHeaders).map(header => (
                        <th className="p-3" key={header}>
                          {header}
                        </th>
                      ))}
                      <th className="p-3">Check</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={index} className="border-t odd:bg-muted/20">
                        <td className="p-3 tabular-nums text-muted-foreground">
                          {index + 2}
                        </td>
                        {(
                          Object.keys(canonicalHeaders) as Array<
                            keyof PreviewRow
                          >
                        ).map(key => (
                          <td className="p-1.5" key={key}>
                            <Input
                              value={row[key]}
                              onChange={event =>
                                updateRow(index, key, event.target.value)
                              }
                              className="min-w-28 border-transparent bg-transparent hover:border-border focus:bg-background"
                            />
                          </td>
                        ))}
                        <td className="p-3">
                          {issues[index] ? (
                            <span className="flex max-w-36 items-center gap-1 text-xs font-medium text-destructive">
                              <AlertCircle className="size-4 shrink-0" />
                              {issues[index]}
                            </span>
                          ) : (
                            <CheckCircle2 className="size-4 text-success-foreground" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === "result" && result && (
            <div className="mx-auto max-w-md py-4 text-center">
              <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-success-surface">
                <CheckCircle2 className="size-9 text-success-foreground" />
              </div>
              <h3 className="mt-5 text-2xl font-bold">Import complete</h3>
              <p className="mt-2 text-muted-foreground">
                Your lead workspace and dashboard have been refreshed.
              </p>
              <div className="mt-7 grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-border p-3">
                  <div className="text-2xl font-bold text-success-foreground">
                    {result.insertedCount}
                  </div>
                  <div className="text-xs text-muted-foreground">Imported</div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-2xl font-bold text-warning-foreground">
                    {result.skippedDuplicates}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Duplicates
                  </div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-2xl font-bold text-destructive">
                    {result.skippedCount}
                  </div>
                  <div className="text-xs text-muted-foreground">Invalid</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {step === "select" && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}
          {step === "review" && (
            <>
              <Button variant="outline" onClick={reset}>
                <ArrowLeft className="mr-2 size-4" />
                Choose another file
              </Button>
              <Button
                type="button"
                variant="cardAction"
                size="card"
                className="sm:w-auto sm:px-4"
                onClick={importRows}
                disabled={loading || issues.some(Boolean)}
              >
                <Upload className="size-4" />
                {loading ? "Importing…" : `Import ${validCount} leads`}
              </Button>
            </>
          )}
          {step === "result" && (
            <>
              {result?.report && (
                <Button variant="outline" onClick={downloadSkippedReport}>
                  <Download className="mr-2 size-4" />
                  Download skipped rows
                </Button>
              )}
              <Button variant="outline" onClick={reset}>
                <Pencil className="mr-2 size-4" />
                Import another file
              </Button>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </>
          )}
        </DialogFooter>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".xlsx,.xls,.csv"
          onChange={event => selectFile(event.target.files?.[0])}
        />
      </DialogContent>
    </Dialog>
  );
};

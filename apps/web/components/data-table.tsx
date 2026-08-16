"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
} from "@repo/ui/components/ui/dropdown-menu";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import {
  Filter,
  ChevronDown,
  Columns,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import {
  getColumnPreferences,
  setColumnPreferences,
} from "../lib/user-preferences";
import tableScrollbarStyles from "./table-scrollbar.module.css";
import { cn } from "@repo/ui/lib/utils";

export interface TableColumn<T> {
  key: keyof T | string;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Cell renderers intentionally accept heterogeneous API fields.
  render?: (value: any, item: T) => React.ReactNode;
  className?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  title: string;
  count: number;
  actionItems?: Array<{
    label: string;
    onClick: (item: T) => void;
    className?: string;
  }>;
  customActions?: (item: T) => React.ReactNode;
  onNameClick?: (item: T) => void;
  onRowClick?: (item: T) => void;
  getRowHref?: (item: T) => string | undefined;
  // Pagination props
  currentPage?: number;
  totalPages?: number;
  itemsPerPage?: number;
  onPageChange?: (page: number) => void;
  onItemsPerPageChange?: (itemsPerPage: number) => void;
  // Filter props
  showFilter?: boolean;
  customFilter?: React.ReactNode;
  filterBadges?: React.ReactNode;
  // Checkbox props
  showCheckboxes?: boolean;
  selectedItems?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  // Search props
  searchQuery?: string;
  isSearchMode?: boolean;
  columnPreferenceKey?: string;
  /** Rendered in the header row to the left of the Columns button */
  headerLeadingContent?: React.ReactNode;
  /** Rendered in the header row to the right of Columns (Columns will be to the left of this) */
  headerTrailingContent?: React.ReactNode;
  /** Rendered inline immediately after the title text */
  titleSuffix?: React.ReactNode;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- API-backed row shapes are intentionally generic.
export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  title,
  count,
  actionItems = [],
  customActions,
  onNameClick,
  onRowClick,
  getRowHref,
  currentPage = 1,
  totalPages = 1,
  itemsPerPage = 10,
  onPageChange,
  onItemsPerPageChange,
  showFilter = false,
  customFilter,
  filterBadges,
  showCheckboxes = false,
  selectedItems = [],
  onSelectionChange,
  searchQuery,
  isSearchMode = false,
  columnPreferenceKey,
  headerLeadingContent,
  headerTrailingContent,
  titleSuffix,
}: DataTableProps<T>) {
  const router = useRouter();
  const hasActionsColumn = actionItems.length > 0 || Boolean(customActions);

  // Column visibility state - initialize with all columns visible
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    const defaultColumns = new Set(columns.map(col => String(col.key)));
    if (typeof window === "undefined" || !columnPreferenceKey) {
      return defaultColumns;
    }
    const saved = getColumnPreferences(columnPreferenceKey);
    if (!saved?.visibleColumns?.length) {
      return defaultColumns;
    }
    const validSaved = saved.visibleColumns.filter(key =>
      columns.some(col => String(col.key) === key)
    );
    return validSaved.length > 0 ? new Set(validSaved) : defaultColumns;
  });

  // Update visible columns when columns prop changes
  useEffect(() => {
    const currentKeys = new Set(columns.map(col => String(col.key)));
    setVisibleColumns(prev => {
      // Keep existing selections if columns haven't changed
      const newSet = new Set(prev);
      // Add any new columns (default to visible)
      currentKeys.forEach(key => {
        if (!newSet.has(key)) {
          newSet.add(key);
        }
      });
      // Remove columns that no longer exist
      newSet.forEach(key => {
        if (!currentKeys.has(key)) {
          newSet.delete(key);
        }
      });
      if (newSet.size === 0 && currentKeys.size > 0) {
        const [firstKey] = Array.from(currentKeys);
        if (firstKey) {
          newSet.add(firstKey);
        }
      }
      return newSet;
    });
  }, [columns]);

  useEffect(() => {
    if (!columnPreferenceKey) return;
    const saved = getColumnPreferences(columnPreferenceKey);
    if (!saved?.visibleColumns?.length) return;

    const validSaved = saved.visibleColumns.filter(key =>
      columns.some(col => String(col.key) === key)
    );

    if (validSaved.length === 0) return;

    setVisibleColumns(prev => {
      const prevKeys = Array.from(prev);
      const isSame =
        prevKeys.length === validSaved.length &&
        prevKeys.every((key, index) => key === validSaved[index]);
      if (isSame) return prev;
      return new Set(validSaved);
    });
  }, [columnPreferenceKey, columns]);

  useEffect(() => {
    if (!columnPreferenceKey) return;
    setColumnPreferences(columnPreferenceKey, {
      visibleColumns: Array.from(visibleColumns),
    });
  }, [visibleColumns, columnPreferenceKey]);

  // Filter columns based on visibility
  const visibleColumnsList = useMemo(() => {
    return columns.filter(col => visibleColumns.has(String(col.key)));
  }, [columns, visibleColumns]);

  // Items per page state
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customValue, setCustomValue] = useState("");

  // Column dropdown open state
  const [columnsDropdownOpen, setColumnsDropdownOpen] = useState(false);

  // Items per page dropdown open state
  const [itemsPerPageDropdownOpen, setItemsPerPageDropdownOpen] =
    useState(false);

  // Calculate pagination values
  const startItem = count === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, count);

  // Handle items per page change
  const handleItemsPerPageChange = (value: number) => {
    onItemsPerPageChange?.(value);
    setShowCustomInput(false);
    setCustomValue("");
  };

  const handleCustomSubmit = () => {
    const value = parseInt(customValue);
    if (value >= 1 && value <= 100) {
      handleItemsPerPageChange(value);
    }
  };

  // Checkbox handlers
  const handleSelectAll = (checked: boolean) => {
    const pageIds = data.map(item => item.id?.toString() || "").filter(Boolean);
    if (checked) {
      onSelectionChange?.(Array.from(new Set([...selectedItems, ...pageIds])));
    } else {
      const pageIdSet = new Set(pageIds);
      onSelectionChange?.(selectedItems.filter(id => !pageIdSet.has(id)));
    }
  };

  const handleSelectItem = (itemId: string, checked: boolean) => {
    if (checked) {
      onSelectionChange?.(Array.from(new Set([...selectedItems, itemId])));
    } else {
      onSelectionChange?.(selectedItems.filter(id => id !== itemId));
    }
  };

  const isAllSelected =
    data.length > 0 &&
    data.every(item => selectedItems.includes(item.id?.toString() || ""));
  const isSomeSelected =
    !isAllSelected &&
    data.some(item => selectedItems.includes(item.id?.toString() || ""));

  // Column toggle handlers
  const handleToggleColumn = (columnKey: string, checked: boolean) => {
    setVisibleColumns(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(columnKey);
      } else {
        // Prevent hiding all columns - ensure at least one remains visible
        if (newSet.size > 1) {
          newSet.delete(columnKey);
        }
      }
      return newSet;
    });
  };

  const handleSelectAllColumns = () => {
    setVisibleColumns(new Set(columns.map(col => String(col.key))));
  };

  const handleDeselectAllColumns = () => {
    // Keep only the first column visible
    if (columns.length > 0 && columns[0]) {
      setVisibleColumns(new Set([String(columns[0].key)]));
    }
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 pt-2 md:flex-row md:items-center md:justify-between">
        {/* Left: title + items-per-page */}
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h3 className="text-base font-semibold text-foreground">
            {title}
            {titleSuffix}
          </h3>
          {onPageChange && onItemsPerPageChange && (
            <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
              <span>Show</span>
              <DropdownMenu
                open={itemsPerPageDropdownOpen}
                onOpenChange={setItemsPerPageDropdownOpen}
              >
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-1.5 px-2.5 whitespace-nowrap"
                  >
                    {itemsPerPage}
                    <ChevronDown
                      className={cn(
                        "size-3.5 text-muted-foreground transition-transform duration-150",
                        itemsPerPageDropdownOpen && "rotate-180"
                      )}
                    />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-32">
                  {[10, 20, 30, 40, 50].map(n => (
                    <DropdownMenuItem
                      key={n}
                      onClick={() => handleItemsPerPageChange(n)}
                      className="cursor-pointer"
                    >
                      {n}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem
                    onClick={() => setShowCustomInput(true)}
                    className="cursor-pointer"
                  >
                    Custom
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {showCustomInput && (
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    placeholder="1–100"
                    value={customValue}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setCustomValue(e.target.value)
                    }
                    className="w-20"
                    min="1"
                    max="100"
                  />
                  <Button type="button" onClick={handleCustomSubmit}>
                    Set
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowCustomInput(false);
                      setCustomValue("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
              <span>entries</span>
            </div>
          )}
          {isSearchMode && searchQuery && (
            <span className="truncate text-sm text-muted-foreground">
              — results for &quot;{searchQuery}&quot;
            </span>
          )}
        </div>

        {/* Right: columns toggle + filter + extras */}
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 md:flex-1 md:justify-end">
          {headerLeadingContent}
          {showFilter && customFilter}
          {/* Column Selection Dropdown */}
          <DropdownMenu
            open={columnsDropdownOpen}
            onOpenChange={setColumnsDropdownOpen}
          >
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className={cn("px-3", columnsDropdownOpen && "bg-secondary")}
              >
                <Columns className="size-4" />
                Columns
                <ChevronDown
                  className={cn(
                    "size-3.5 text-muted-foreground transition-transform duration-150",
                    columnsDropdownOpen && "rotate-180"
                  )}
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Toggle columns
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleSelectAllColumns}
                className="cursor-pointer"
              >
                Select all
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDeselectAllColumns}
                className="cursor-pointer"
              >
                Deselect all
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {columns.map(column => {
                const columnKey = String(column.key);
                const isVisible = visibleColumns.has(columnKey);
                return (
                  <DropdownMenuCheckboxItem
                    key={columnKey}
                    checked={isVisible}
                    onCheckedChange={checked =>
                      handleToggleColumn(columnKey, checked === true)
                    }
                    disabled={isVisible && visibleColumns.size === 1}
                    className="text-sm"
                  >
                    {column.label}
                  </DropdownMenuCheckboxItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {showFilter && !customFilter && (
            <Button
              type="button"
              variant="outline"
              className="whitespace-nowrap px-3"
            >
              <Filter className="size-4" />
              Filter
            </Button>
          )}
          {headerTrailingContent}
        </div>
      </div>

      {/* Filter Badges */}
      {filterBadges && (
        <div className="flex flex-wrap items-center gap-2">{filterBadges}</div>
      )}

      {/* Table card */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div
          className={cn(
            "max-h-[70svh] overflow-auto",
            tableScrollbarStyles.tableScrollContainer
          )}
        >
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="sticky top-0 z-10 border-b border-border bg-surface-subtle">
                {showCheckboxes && (
                  <th className="h-10 w-10 bg-surface-subtle px-4 text-left align-middle">
                    <Checkbox
                      checked={
                        isAllSelected
                          ? true
                          : isSomeSelected
                            ? "indeterminate"
                            : false
                      }
                      onCheckedChange={checked =>
                        handleSelectAll(checked === true)
                      }
                      aria-label="Select all rows on this page"
                    />
                  </th>
                )}
                {visibleColumnsList.map((column, index) => (
                  <th
                    key={index}
                    className="h-10 bg-surface-subtle px-4 text-left align-middle"
                  >
                    <span className="inline-flex select-none items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {column.label}
                    </span>
                  </th>
                ))}
                {hasActionsColumn && (
                  <th className="h-10 bg-surface-subtle px-4 text-left align-middle">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Actions
                    </span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td
                    colSpan={
                      visibleColumnsList.length +
                      (showCheckboxes ? 1 : 0) +
                      (hasActionsColumn ? 1 : 0)
                    }
                    className="h-32 text-center text-sm text-muted-foreground"
                  >
                    No results found.
                  </td>
                </tr>
              ) : (
                data.map((item, rowIndex) => {
                  const rowHref = getRowHref?.(item);
                  const hasHref = !!rowHref;

                  return (
                    <tr
                      key={item.id || rowIndex}
                      className={cn(
                        "border-b border-border/80 bg-card transition-colors last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/30",
                        (onRowClick || hasHref) &&
                          "cursor-pointer hover:bg-surface-subtle"
                      )}
                      tabIndex={onRowClick || hasHref ? 0 : undefined}
                      onKeyDown={event => {
                        if (event.target !== event.currentTarget) return;
                        if (
                          !(onRowClick || rowHref) ||
                          (event.key !== "Enter" && event.key !== " ")
                        )
                          return;
                        event.preventDefault();
                        if (onRowClick) onRowClick(item);
                        else if (rowHref) router.push(rowHref);
                      }}
                      onClick={() => {
                        if (onRowClick) {
                          onRowClick(item);
                        } else if (rowHref) {
                          router.push(rowHref);
                        }
                      }}
                    >
                      {showCheckboxes && (
                        <td className="w-10 px-4 py-3 align-middle">
                          <Checkbox
                            checked={selectedItems.includes(
                              item.id?.toString() || ""
                            )}
                            onCheckedChange={checked => {
                              handleSelectItem(
                                item.id?.toString() || "",
                                checked === true
                              );
                            }}
                            onClick={(e: React.MouseEvent) =>
                              e.stopPropagation()
                            }
                            aria-label={`Select row ${rowIndex + 1}`}
                          />
                        </td>
                      )}
                      {visibleColumnsList.map((column, colIndex) => (
                        <td
                          key={colIndex}
                          className={cn(
                            "px-4 py-3 align-middle text-sm text-foreground",
                            column.className
                          )}
                        >
                          {(() => {
                            const cellContent = column.render
                              ? column.render(item[column.key], item)
                              : item[column.key];

                            if (
                              hasHref &&
                              (column.key === "name" ||
                                column.label.toLowerCase() === "name")
                            ) {
                              return (
                                <Link
                                  href={rowHref}
                                  prefetch={true}
                                  className="font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/30"
                                  onClick={(e: React.MouseEvent) => {
                                    e.stopPropagation();
                                    onNameClick?.(item);
                                  }}
                                >
                                  {cellContent}
                                </Link>
                              );
                            }

                            if (
                              onNameClick &&
                              (column.key === "name" ||
                                column.label.toLowerCase() === "name") &&
                              !hasHref
                            ) {
                              return (
                                <button
                                  type="button"
                                  className="cursor-pointer font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/30"
                                  onClick={(
                                    e: React.MouseEvent<HTMLButtonElement>
                                  ) => {
                                    e.stopPropagation();
                                    onNameClick(item);
                                  }}
                                >
                                  {cellContent}
                                </button>
                              );
                            }
                            return cellContent;
                          })()}
                        </td>
                      ))}
                      {hasActionsColumn && (
                        <td className="px-4 py-3 align-middle">
                          <div
                            className="flex items-center gap-1"
                            onClick={(e: React.MouseEvent) =>
                              e.stopPropagation()
                            }
                          >
                            {customActions?.(item)}
                            {actionItems.length > 0 && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label="Open row actions"
                                  >
                                    <MoreHorizontal className="size-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {actionItems.map(action => (
                                    <DropdownMenuItem
                                      key={action.label}
                                      className={action.className}
                                      onSelect={() => action.onClick(item)}
                                    >
                                      {action.label}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination footer */}
      {onPageChange && (
        <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {startItem} to {endItem} of {count} entries
          </p>

          <div className="flex max-w-full items-center gap-1 overflow-x-auto pb-1">
            <Button
              type="button"
              variant="outline"
              disabled={currentPage === 1}
              onClick={() => onPageChange?.(currentPage - 1)}
              className="gap-1 px-3 whitespace-nowrap disabled:opacity-40"
            >
              <ChevronLeft className="size-4" />
              Previous
            </Button>

            {(() => {
              const pages: React.ReactNode[] = [];
              const showEllipsis = totalPages > 7;

              const pageBtn = (i: number) => (
                <Button
                  key={i}
                  type="button"
                  size="icon"
                  variant={currentPage === i ? "default" : "outline"}
                  onClick={() => onPageChange?.(i)}
                  aria-label={`Go to page ${i}`}
                  aria-current={currentPage === i ? "page" : undefined}
                  className="shrink-0"
                >
                  {i}
                </Button>
              );

              if (!showEllipsis) {
                for (let i = 1; i <= totalPages; i++) pages.push(pageBtn(i));
              } else {
                const startPage = Math.max(2, currentPage - 1);
                const endPage = Math.min(totalPages - 1, currentPage + 1);

                pages.push(pageBtn(1));
                if (startPage > 2) {
                  pages.push(
                    <span
                      key="l-ellipsis"
                      className="px-1 text-sm text-muted-foreground"
                    >
                      …
                    </span>
                  );
                }
                for (let i = startPage; i <= endPage; i++)
                  pages.push(pageBtn(i));
                if (endPage < totalPages - 1) {
                  pages.push(
                    <span
                      key="r-ellipsis"
                      className="px-1 text-sm text-muted-foreground"
                    >
                      …
                    </span>
                  );
                }
                if (totalPages > 1) pages.push(pageBtn(totalPages));
              }

              return pages;
            })()}

            <Button
              type="button"
              variant="outline"
              disabled={currentPage === totalPages}
              onClick={() => onPageChange?.(currentPage + 1)}
              className="gap-1 px-3 whitespace-nowrap disabled:opacity-40"
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* No-pagination count */}
      {!onPageChange && (
        <p className="text-sm text-muted-foreground">
          Showing {count} {count === 1 ? "record" : "records"}
        </p>
      )}
    </div>
  );
}

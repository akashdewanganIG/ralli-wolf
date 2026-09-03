"use client";

import { DataTable, TableColumn } from "@/components/data-table";
import { Input } from "@repo/ui/components/ui/input";
import { CreateTemplateModal } from "@/components/whatsapp/create-template-modal";
import { DeleteTemplateModal } from "@/components/whatsapp/delete-template-modal";
import { EditNumberModal } from "@/components/whatsapp/edit-number-modal";
import { whatsappService } from "@/lib/api/services";
import { toast } from "@/lib/toast";
import { Button, Label } from "@repo/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Check, Edit, Plus, RefreshCw, Search, Trash2 } from "@repo/ui/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Tag } from "@repo/ui/components/ui/tag";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { PageHeader } from "@repo/ui/components/ui/page-header";
import { CategorySwitcher } from "@repo/ui/components/ui/category-switcher";
import type { MessageTemplate, MessagingAccount } from "@/lib/api/types";

const ALLOW_UTILITY_TEMPLATES =
  process.env.NEXT_PUBLIC_ALLOW_UTILITY_TEMPLATES === "true";
const ALLOW_AUTH_TEMPLATES =
  process.env.NEXT_PUBLIC_ALLOW_AUTH_TEMPLATES === "true";

type Template = MessageTemplate;
type WhatsAppNumber = MessagingAccount;

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "Unexpected error";
}

function aggregateTemplateStatus(template: Template): string {
  if (!template.languages?.length) return template.status || "UNKNOWN";
  const statuses = template.languages.map(language => language.status);
  const hasApproved = statuses.includes("APPROVED");
  const hasPending = statuses.includes("PENDING");
  const hasRejected = statuses.some(
    status => status === "REJECTED" || status === "FAILED"
  );
  if (hasApproved && !hasPending && !hasRejected) return "APPROVED";
  if (hasApproved && (hasPending || hasRejected)) return "MIXED";
  if (hasPending) return "PENDING";
  if (hasRejected) return "REJECTED";
  return "UNKNOWN";
}

export default function WhatsAppManagementPage() {
  const [activeTab, setActiveTab] = useState<"templates" | "numbers">(
    "templates"
  );

  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateSearchQuery, setTemplateSearchQuery] = useState("");
  const [isTemplateSearchOpen, setIsTemplateSearchOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<number | null>(null);
  const [accounts, setAccounts] = useState<MessagingAccount[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null
  );
  const [deletingTemplate, setDeletingTemplate] = useState(false);

  const [selectedLanguageFilter, setSelectedLanguageFilter] =
    useState<string>("all");
  const [selectedStatusFilter, setSelectedStatusFilter] =
    useState<string>("all");
  const [selectedCategoryFilter, setSelectedCategoryFilter] =
    useState<string>("all");

  const [numbers, setNumbers] = useState<WhatsAppNumber[]>([]);
  const [numbersLoading, setNumbersLoading] = useState(false);
  const [showEditNumberModal, setShowEditNumberModal] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState<WhatsAppNumber | null>(
    null
  );

  const templateSearchRef = useRef<HTMLDivElement>(null);

  const allowedTemplates = useMemo(
    () =>
      templates.filter(template => {
        const category = template.category?.toLowerCase();
        if (category === "marketing") return true;
        if (category === "utility") return ALLOW_UTILITY_TEMPLATES;
        if (category === "authentication" || category === "auth") {
          return ALLOW_AUTH_TEMPLATES;
        }
        return false;
      }),
    [templates]
  );

  const uniqueLanguages = Array.from(
    new Set(
      allowedTemplates.flatMap(template => {
        if (template?.languages && Array.isArray(template.languages)) {
          return template.languages.map(lang => lang.code);
        }
        return template?.language ? [template.language] : [];
      })
    )
  ).sort();

  const uniqueStatuses = Array.from(
    new Set(allowedTemplates.map(aggregateTemplateStatus))
  ).sort();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        templateSearchRef.current &&
        !templateSearchRef.current.contains(event.target as Node)
      ) {
        setIsTemplateSearchOpen(false);
      }
    };

    if (isTemplateSearchOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isTemplateSearchOpen]);

  const loadAccounts = useCallback(async () => {
    try {
      const data = await whatsappService.listAccounts();

      const activeAccounts = data.filter(a => a.status === "ACTIVE");
      setAccounts(activeAccounts);
      setSelectedAccount(current => current ?? activeAccounts[0]?.id ?? null);
    } catch (error: unknown) {
      toast.error("Failed to load accounts: " + errorMessage(error));
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    if (!selectedAccount) return;

    setTemplatesLoading(true);
    try {
      const data = await whatsappService.listTemplates(selectedAccount);
      setTemplates(data);
    } catch (error: unknown) {
      toast.error("Failed to load templates: " + errorMessage(error));
    } finally {
      setTemplatesLoading(false);
    }
  }, [selectedAccount]);

  const loadNumbers = useCallback(async () => {
    setNumbersLoading(true);
    try {
      const data = await whatsappService.listAccounts();
      setNumbers(data);
    } catch (error: unknown) {
      toast.error("Failed to load numbers: " + errorMessage(error));
    } finally {
      setNumbersLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    if (selectedAccount) void loadTemplates();
  }, [loadTemplates, selectedAccount]);

  useEffect(() => {
    if (activeTab === "numbers") void loadNumbers();
  }, [activeTab, loadNumbers]);

  const handleSyncTemplates = async () => {
    if (!selectedAccount) {
      toast.error("Please select an account first");
      return;
    }

    setTemplatesLoading(true);
    try {
      await whatsappService.syncTemplates(selectedAccount);
      toast.success(`Synced templates successfully`);
      await loadTemplates();
    } catch (error: unknown) {
      toast.error("Failed to sync templates: " + errorMessage(error));
    } finally {
      setTemplatesLoading(false);
    }
  };

  const handleSyncNumbers = async () => {
    setNumbersLoading(true);
    try {
      const result = await whatsappService.syncNumbers();
      toast.success(
        `Synced ${result.synced} numbers successfully. ${result.errors} errors.`
      );
      await loadNumbers();
    } catch (error: unknown) {
      toast.error("Failed to sync numbers: " + errorMessage(error));
    } finally {
      setNumbersLoading(false);
    }
  };

  const handleDeleteTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setShowDeleteModal(true);
  };

  const confirmDeleteTemplate = async () => {
    if (!selectedAccount || !selectedTemplate) return;

    setDeletingTemplate(true);
    try {
      await whatsappService.deleteTemplate(
        selectedTemplate.name,
        selectedAccount
      );
      toast.success("Template deleted successfully");
      setShowDeleteModal(false);
      setSelectedTemplate(null);
      await loadTemplates();
    } catch (error: unknown) {
      toast.error("Failed to delete template: " + errorMessage(error));
    } finally {
      setDeletingTemplate(false);
    }
  };

  const handleTemplateCreated = () => {
    setShowCreateModal(false);
    void loadTemplates();
  };

  const handleEditNumber = (number: WhatsAppNumber) => {
    setSelectedNumber(number);
    setShowEditNumberModal(true);
  };

  const handleNumberUpdated = () => {
    setShowEditNumberModal(false);
    setSelectedNumber(null);
    void loadNumbers();
  };

  const uniqueCategories = Array.from(
    new Set(
      allowedTemplates
        .map(template => template.category)
        .filter((category): category is string => Boolean(category))
    )
  ).sort();

  const visibleTemplates = useMemo(() => {
    const search = templateSearchQuery.trim().toLowerCase();
    return allowedTemplates.filter(template => {
      if (search && !template.name.toLowerCase().includes(search)) return false;
      if (
        selectedLanguageFilter !== "all" &&
        !(
          template.languages?.some(
            language => language.code === selectedLanguageFilter
          ) ?? template.language === selectedLanguageFilter
        )
      ) {
        return false;
      }
      if (
        selectedStatusFilter !== "all" &&
        aggregateTemplateStatus(template) !== selectedStatusFilter
      ) {
        return false;
      }
      return (
        selectedCategoryFilter === "all" ||
        template.category === selectedCategoryFilter
      );
    });
  }, [
    allowedTemplates,
    selectedCategoryFilter,
    selectedLanguageFilter,
    selectedStatusFilter,
    templateSearchQuery,
  ]);

  const templateColumns: TableColumn<Template>[] = [
    {
      key: "name",
      label: "Template Name",
      render: (_value, template) => (
        <div className="font-medium">{template?.name || "N/A"}</div>
      ),
    },
    {
      key: "language",
      label: "Languages",
      render: (_value, template) => {
        if (template?.languages && Array.isArray(template.languages)) {
          return (
            <div className="flex flex-wrap gap-1">
              {template.languages.map(lang => (
                <span
                  key={`${lang.code}-${String(lang.id)}`}
                  className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${
                    lang.status === "APPROVED"
                      ? "bg-success-surface text-success-foreground"
                      : lang.status === "PENDING"
                        ? "bg-primary-surface text-warning-foreground"
                        : "bg-error-surface text-error-foreground"
                  }`}
                  title={`${lang.code} - ${lang.status}`}
                >
                  {lang.code}
                </span>
              ))}
            </div>
          );
        }

        return <div className="uppercase">{template?.language || "N/A"}</div>;
      },
    },
    {
      key: "category",
      label: "Category",
      render: (_value, template) => (
        <div className="capitalize">{template?.category || "N/A"}</div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (_value, template) => {
        if (template?.languages && Array.isArray(template.languages)) {
          const statuses = template.languages.map(language => language.status);
          const statusText = aggregateTemplateStatus(template);
          let tone: React.ComponentProps<typeof Tag>["tone"] = "neutral";
          if (statusText === "APPROVED") {
            tone = "active";
          } else if (statusText === "MIXED") {
            tone = "progress";
          } else if (statusText === "PENDING") {
            tone = "pending";
          } else if (statusText === "REJECTED") {
            tone = "danger";
          }

          return (
            <Tag tone={tone} title={`Statuses: ${statuses.join(", ")}`}>
              {statusText}
            </Tag>
          );
        }

        return (
          <Tag
            tone={
              template?.status === "APPROVED"
                ? "active"
                : template?.status === "PENDING"
                  ? "pending"
                  : "danger"
            }
          >
            {template?.status || "UNKNOWN"}
          </Tag>
        );
      },
    },
    {
      key: "actions",
      label: "Actions",
      render: (_value, template) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => handleDeleteTemplate(template)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const numberColumns: TableColumn<WhatsAppNumber>[] = [
    {
      key: "phoneNumber",
      label: "Phone Number",
      render: (_value, number) => (
        <div className="font-medium">{number?.phoneNumber || "N/A"}</div>
      ),
    },
    {
      key: "displayName",
      label: "Display Name",
      render: (_value, number) => <div>{number?.displayName || "N/A"}</div>,
    },
    {
      key: "status",
      label: "Status",
      render: (_value, number) => (
        <Tag tone={number?.status === "ACTIVE" ? "active" : "neutral"}>
          {number?.status || "INACTIVE"}
        </Tag>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (_value, number) => (
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => handleEditNumber(number)}>
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <PageShell>
      <PageHeader
        title="WhatsApp management"
        description="Your approved WhatsApp message layouts and the phone numbers you send from."
      />

      <CategorySwitcher
        items={[
          { value: "templates", label: "Templates" },
          { value: "numbers", label: "Numbers" },
        ]}
        value={activeTab}
        onValueChange={setActiveTab}
        label="WhatsApp management sections"
      />

      {activeTab === "templates" && (
        <div className="space-y-4">
          <div className="grid gap-2 max-w-[15rem]">
            <Label htmlFor="account-select">Account</Label>
            <Select
              value={selectedAccount ? String(selectedAccount) : ""}
              onValueChange={value =>
                setSelectedAccount(value ? Number(value) : null)
              }
            >
              <SelectTrigger
                id="account-select"
                className="text-left [&>span]:block [&>span]:min-w-0 [&>span]:flex-1 [&>span]:truncate [&>span]:text-left"
              >
                <SelectValue placeholder="Select an account..." />
              </SelectTrigger>
              <SelectContent>
                {accounts.map(account => (
                  <SelectItem key={account.id} value={String(account.id)}>
                    {account.displayName} ({account.phoneNumber})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <div className="relative" ref={templateSearchRef}>
                <Button
                  variant="outline"
                  onClick={() => setIsTemplateSearchOpen(!isTemplateSearchOpen)}
                  className="flex items-center gap-2"
                >
                  <Search className="h-4 w-4" />
                  {templateSearchQuery || "Search Templates"}
                </Button>

                {isTemplateSearchOpen && (
                  <div className="absolute z-50 mt-2 w-64 bg-surface border rounded-lg shadow-lg">
                    <div className="p-2">
                      <Input
                        type="text"
                        placeholder="Search templates..."
                        value={templateSearchQuery}
                        onChange={e => setTemplateSearchQuery(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div className="max-h-64 overflow-y-auto overflow-x-auto">
                      {visibleTemplates.length === 0 ? (
                        <div className="px-4 py-3 text-muted-foreground text-sm">
                          No templates found
                        </div>
                      ) : (
                        visibleTemplates.map(template => (
                          <button
                            type="button"
                            key={template.id}
                            className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left hover:bg-surface-secondary"
                            onClick={() => {
                              setTemplateSearchQuery(template.name);
                              setIsTemplateSearchOpen(false);
                            }}
                          >
                            <span className="whitespace-nowrap text-sm">
                              {template.name}
                            </span>
                            {templateSearchQuery === template.name && (
                              <Check className="h-4 w-4 shrink-0 text-info" />
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <Button
                variant="outline"
                onClick={() => {
                  setTemplateSearchQuery("");
                  setSelectedLanguageFilter("all");
                  setSelectedStatusFilter("all");
                  setSelectedCategoryFilter("all");
                  toast.info("Template filters cleared");
                }}
                disabled={
                  !templateSearchQuery &&
                  selectedLanguageFilter === "all" &&
                  selectedStatusFilter === "all" &&
                  selectedCategoryFilter === "all"
                }
              >
                Clear Filters
              </Button>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleSyncTemplates}
                disabled={templatesLoading || !selectedAccount}
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    templatesLoading ? "animate-spin" : ""
                  }`}
                />
                Sync Templates
              </Button>
              <Button
                onClick={() => setShowCreateModal(true)}
                disabled={!selectedAccount}
              >
                <Plus className="h-4 w-4" />
                Create Template
              </Button>
            </div>
          </div>

          {selectedAccount ? (
            <DataTable
              data={visibleTemplates}
              columns={templateColumns}
              title="Templates"
              count={visibleTemplates.length}
              showFilter={true}
              customFilter={
                <div className="flex gap-2 items-center">
                  <Select
                    value={selectedLanguageFilter}
                    onValueChange={setSelectedLanguageFilter}
                  >
                    <SelectTrigger className="w-full sm:w-[8.75rem]">
                      <SelectValue placeholder="All Languages" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Languages</SelectItem>
                      {uniqueLanguages.map(lang => (
                        <SelectItem key={lang} value={lang}>
                          {lang.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={selectedStatusFilter}
                    onValueChange={setSelectedStatusFilter}
                  >
                    <SelectTrigger className="w-full sm:w-[8.75rem]">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      {uniqueStatuses.map(status => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={selectedCategoryFilter}
                    onValueChange={setSelectedCategoryFilter}
                  >
                    <SelectTrigger className="w-full sm:w-[8.75rem]">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {uniqueCategories.map(category => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              }
              filterBadges={
                (selectedLanguageFilter !== "all" ||
                  selectedStatusFilter !== "all" ||
                  selectedCategoryFilter !== "all") && (
                  <div className="flex gap-2 flex-wrap">
                    {selectedLanguageFilter !== "all" && (
                      <Tag
                        tone="neutral"
                        onRemove={() => setSelectedLanguageFilter("all")}
                        removeLabel="Remove language filter"
                      >
                        Language: {selectedLanguageFilter.toUpperCase()}
                      </Tag>
                    )}
                    {selectedStatusFilter !== "all" && (
                      <Tag
                        tone="neutral"
                        onRemove={() => setSelectedStatusFilter("all")}
                        removeLabel="Remove status filter"
                      >
                        Status: {selectedStatusFilter}
                      </Tag>
                    )}
                    {selectedCategoryFilter !== "all" && (
                      <Tag
                        tone="neutral"
                        onRemove={() => setSelectedCategoryFilter("all")}
                        removeLabel="Remove category filter"
                      >
                        Category: {selectedCategoryFilter}
                      </Tag>
                    )}
                  </div>
                )
              }
            />
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Please select an account to view templates
            </div>
          )}
        </div>
      )}

      {activeTab === "numbers" && (
        <div className="space-y-4">
          <div className="flex justify-end items-center">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleSyncNumbers}
                disabled={numbersLoading}
              >
                <RefreshCw
                  className={`h-4 w-4 ${numbersLoading ? "animate-spin" : ""}`}
                />
                Sync Numbers
              </Button>
            </div>
          </div>

          <DataTable
            data={numbers}
            columns={numberColumns}
            title="WhatsApp Numbers"
            count={numbers.length}
            showFilter={false}
          />
        </div>
      )}

      {showCreateModal && selectedAccount && (
        <CreateTemplateModal
          accountId={selectedAccount}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleTemplateCreated}
        />
      )}

      {showEditNumberModal && selectedNumber && (
        <EditNumberModal
          number={selectedNumber}
          onClose={() => {
            setShowEditNumberModal(false);
            setSelectedNumber(null);
          }}
          onSuccess={handleNumberUpdated}
        />
      )}

      {showDeleteModal && selectedTemplate && (
        <DeleteTemplateModal
          templateName={selectedTemplate.name}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedTemplate(null);
          }}
          onConfirm={confirmDeleteTemplate}
          loading={deletingTemplate}
        />
      )}
    </PageShell>
  );
}

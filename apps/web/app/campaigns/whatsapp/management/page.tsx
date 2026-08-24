"use client";

import { DataTable, TableColumn } from "@/components/data-table";
import { Input } from "@repo/ui/components/ui/input";
import { CreateTemplateModal } from "@/components/whatsapp/create-template-modal";
import { DeleteTemplateModal } from "@/components/whatsapp/delete-template-modal";
import { EditNumberModal } from "@/components/whatsapp/edit-number-modal";
import { whatsappService } from "@/lib/api/services";
import { toast } from "@/lib/toast";
import { Button, Label } from "@repo/ui";
import { Badge } from "@repo/ui/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import {
  Check,
  ChevronDown,
  Edit,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "@repo/ui/icons";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Tag } from "@repo/ui/components/ui/tag";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { PageHeader } from "@repo/ui/components/ui/page-header";
import { CategorySwitcher } from "@repo/ui/components/ui/category-switcher";

const ALLOW_UTILITY_TEMPLATES =
  process.env.NEXT_PUBLIC_ALLOW_UTILITY_TEMPLATES === "true";
const ALLOW_AUTH_TEMPLATES =
  process.env.NEXT_PUBLIC_ALLOW_AUTH_TEMPLATES === "true";

type Template = {
  id: number;
  name: string;
  language: string;
  languages?: Array<{
    code: string;
    status: string;
    id: number;
    rejection_reason?: string;
  }>;
  category?: string | null;
  status: string;
  components?: any;
  createdAt: string;
  updatedAt?: string;
};

type WhatsAppNumber = {
  id: number;
  displayName: string;
  phoneNumber?: string;
  senderId?: string | null;
  businessId?: string | null;
  status?: string;
  provider: string;
  createdAt: string;
  updatedAt?: string;
};

export default function WhatsAppManagementPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"templates" | "numbers">(
    "templates"
  );

  // Templates state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateSearchQuery, setTemplateSearchQuery] = useState("");
  const [isTemplateSearchOpen, setIsTemplateSearchOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<number | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null
  );
  const [deletingTemplate, setDeletingTemplate] = useState(false);

  // Filter state
  const [selectedLanguageFilter, setSelectedLanguageFilter] =
    useState<string>("all");
  const [selectedStatusFilter, setSelectedStatusFilter] =
    useState<string>("all");
  const [selectedCategoryFilter, setSelectedCategoryFilter] =
    useState<string>("all");

  // Numbers state
  const [numbers, setNumbers] = useState<WhatsAppNumber[]>([]);
  const [numbersLoading, setNumbersLoading] = useState(false);
  const [showEditNumberModal, setShowEditNumberModal] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState<WhatsAppNumber | null>(
    null
  );

  // Refs
  const templateSearchRef = useRef<HTMLDivElement>(null);

  // Load accounts on mount
  useEffect(() => {
    loadAccounts();
  }, []);

  // Load templates when account is selected
  useEffect(() => {
    if (selectedAccount) {
      loadTemplates();
    }
  }, [selectedAccount]);

  // Load numbers on mount
  useEffect(() => {
    if (activeTab === "numbers") {
      loadNumbers();
    }
  }, [activeTab]);

  // Extract unique filter values from templates
  const uniqueLanguages = Array.from(
    new Set(
      templates.flatMap(template => {
        if (template?.languages && Array.isArray(template.languages)) {
          return template.languages.map(lang => lang.code);
        }
        return template?.language ? [template.language] : [];
      })
    )
  ).sort();

  const uniqueStatuses = Array.from(
    new Set(
      templates.flatMap(template => {
        if (template?.languages && Array.isArray(template.languages)) {
          const statuses = template.languages.map(l => l.status);
          const hasApproved = statuses.some(s => s === "APPROVED");
          const hasPending = statuses.some(s => s === "PENDING");
          const hasRejected = statuses.some(
            s => s === "REJECTED" || s === "FAILED"
          );
          if (hasApproved && !hasPending && !hasRejected) return ["APPROVED"];
          if (hasApproved && (hasPending || hasRejected)) return ["MIXED"];
          if (hasPending) return ["PENDING"];
          if (hasRejected) return ["REJECTED"];
          return ["UNKNOWN"];
        }
        return template?.status ? [template.status] : ["UNKNOWN"];
      })
    )
  ).sort();

  // Filter templates based on search and filters
  useEffect(() => {
    let filtered = templates;

    // Apply search filter
    if (templateSearchQuery.trim()) {
      filtered = filtered.filter(template =>
        template.name.toLowerCase().includes(templateSearchQuery.toLowerCase())
      );
    }

    // Apply language filter
    if (selectedLanguageFilter !== "all") {
      filtered = filtered.filter(template => {
        if (template?.languages && Array.isArray(template.languages)) {
          return template.languages.some(
            lang => lang.code === selectedLanguageFilter
          );
        }
        return template?.language === selectedLanguageFilter;
      });
    }

    // Apply status filter
    if (selectedStatusFilter !== "all") {
      filtered = filtered.filter(template => {
        if (template?.languages && Array.isArray(template.languages)) {
          const statuses = template.languages.map(l => l.status);
          const hasApproved = statuses.some(s => s === "APPROVED");
          const hasPending = statuses.some(s => s === "PENDING");
          const hasRejected = statuses.some(
            s => s === "REJECTED" || s === "FAILED"
          );

          let templateStatus = "UNKNOWN";
          if (hasApproved && !hasPending && !hasRejected) {
            templateStatus = "APPROVED";
          } else if (hasApproved && (hasPending || hasRejected)) {
            templateStatus = "MIXED";
          } else if (hasPending) {
            templateStatus = "PENDING";
          } else if (hasRejected) {
            templateStatus = "REJECTED";
          }

          return templateStatus === selectedStatusFilter;
        }
        return template?.status === selectedStatusFilter;
      });
    }

    // Apply category filter
    if (selectedCategoryFilter !== "all") {
      filtered = filtered.filter(
        template => template?.category === selectedCategoryFilter
      );
    }

    setFilteredTemplates(filtered);
  }, [
    templateSearchQuery,
    templates,
    selectedLanguageFilter,
    selectedStatusFilter,
    selectedCategoryFilter,
  ]);

  // Click outside handler for template search
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

  const loadAccounts = async () => {
    try {
      const data = await whatsappService.listAccounts();
      // Filter to show only active accounts in template dropdown
      const activeAccounts = data.filter(a => a.status === "ACTIVE");
      setAccounts(activeAccounts);
      if (activeAccounts.length > 0 && !selectedAccount && activeAccounts[0]) {
        setSelectedAccount(activeAccounts[0].id);
      }
    } catch (error: any) {
      toast.error("Failed to load accounts: " + error.message);
    }
  };

  const loadTemplates = async () => {
    if (!selectedAccount) return;

    setTemplatesLoading(true);
    try {
      const data = await whatsappService.listTemplates(selectedAccount);
      // Filter out any null or invalid entries
      const validTemplates = (data || []).filter(tpl => tpl && tpl.id);
      setTemplates(validTemplates);
      setFilteredTemplates(validTemplates);
    } catch (error: any) {
      toast.error("Failed to load templates: " + error.message);
    } finally {
      setTemplatesLoading(false);
    }
  };

  const loadNumbers = async () => {
    setNumbersLoading(true);
    try {
      const data = await whatsappService.listAccounts();
      console.log("Numbers received from API:", data);
      // Filter out any null or invalid entries
      const validNumbers = (data || []).filter(num => num && num.id);
      console.log("Valid numbers after filtering:", validNumbers);
      setNumbers(validNumbers);
    } catch (error: any) {
      toast.error("Failed to load numbers: " + error.message);
    } finally {
      setNumbersLoading(false);
    }
  };

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
    } catch (error: any) {
      toast.error("Failed to sync templates: " + error.message);
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
    } catch (error: any) {
      toast.error("Failed to sync numbers: " + error.message);
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
    } catch (error: any) {
      toast.error("Failed to delete template: " + error.message);
    } finally {
      setDeletingTemplate(false);
    }
  };

  const handleTemplateCreated = () => {
    setShowCreateModal(false);
    loadTemplates();
  };

  const handleEditNumber = (number: WhatsAppNumber) => {
    setSelectedNumber(number);
    setShowEditNumberModal(true);
  };

  const handleNumberUpdated = () => {
    setShowEditNumberModal(false);
    setSelectedNumber(null);
    loadNumbers();
  };

  const visibleTemplates = templates
    .filter(t => {
      const category = t.category?.toLowerCase();

      if (category === "utility" && !ALLOW_UTILITY_TEMPLATES) return false;
      if (category === "auth" && !ALLOW_AUTH_TEMPLATES) return false;

      // Only marketing remains visible
      return category === "marketing";
    })
    .reverse();
  // .sort((a, b) => {
  //   return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  // });

  console.log("visibleTemplates", visibleTemplates);
  const templateColumns: TableColumn<Template>[] = [
    {
      key: "name",
      label: "Template Name",
      render: (value: any, template: Template) => (
        <div className="font-medium">{template?.name || "N/A"}</div>
      ),
    },
    {
      key: "language",
      label: "Languages",
      render: (value: any, template: Template) => {
        // Check if template has multiple languages array
        if (template?.languages && Array.isArray(template.languages)) {
          return (
            <div className="flex flex-wrap gap-1">
              {template.languages.map((lang: any, index: number) => (
                <span
                  key={index}
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
        // Fallback for single language display
        return <div className="uppercase">{template?.language || "N/A"}</div>;
      },
    },
    {
      key: "category",
      label: "Category",
      render: (value: any, template: Template) => (
        <div className="capitalize">{template?.category || "N/A"}</div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (value: any, template: Template) => {
        // If template has multiple languages, show aggregate status
        if (template?.languages && Array.isArray(template.languages)) {
          const statuses = template.languages.map(l => l.status);
          const hasApproved = statuses.some(s => s === "APPROVED");
          const hasPending = statuses.some(s => s === "PENDING");
          const hasRejected = statuses.some(
            s => s === "REJECTED" || s === "FAILED"
          );

          let statusText = "UNKNOWN";
          let tone: React.ComponentProps<typeof Tag>["tone"] = "neutral";

          if (hasApproved && !hasPending && !hasRejected) {
            statusText = "APPROVED";
            tone = "active";
          } else if (hasApproved && (hasPending || hasRejected)) {
            statusText = "MIXED";
            tone = "progress";
          } else if (hasPending) {
            statusText = "PENDING";
            tone = "pending";
          } else if (hasRejected) {
            statusText = "REJECTED";
            tone = "danger";
          }

          return (
            <Tag tone={tone} title={`Statuses: ${statuses.join(", ")}`}>
              {statusText}
            </Tag>
          );
        }

        // Fallback for single status
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
      render: (value: any, template: Template) => (
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
      render: (value: any, number: WhatsAppNumber) => (
        <div className="font-medium">{number?.phoneNumber || "N/A"}</div>
      ),
    },
    {
      key: "displayName",
      label: "Display Name",
      render: (value: any, number: WhatsAppNumber) => (
        <div>{number?.displayName || "N/A"}</div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (value: any, number: WhatsAppNumber) => (
        <Tag tone={number?.status === "ACTIVE" ? "active" : "neutral"}>
          {number?.status || "INACTIVE"}
        </Tag>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (value: any, number: WhatsAppNumber) => (
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
      {/* The back button is gone: this is a listing the sidebar links to, so
          "back" navigated to history rather than up a hierarchy. */}
      <PageHeader
        title="WhatsApp management"
        description="Your approved WhatsApp message layouts and the phone numbers you send from."
      />

      {/* The shared tab bar, not a pair of hand-rolled buttons: it carries the
          tablist/tab roles, a roving tabindex and arrow-key navigation, none of
          which the local version had. */}
      <CategorySwitcher
        items={[
          { value: "templates", label: "Templates" },
          { value: "numbers", label: "Numbers" },
        ]}
        value={activeTab}
        onValueChange={setActiveTab}
        label="WhatsApp management sections"
      />

      {/* Templates Tab */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          {/* Account Selector */}
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

          {/* Toolbar */}
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              {/* Template Search Dropdown */}
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
                      {filteredTemplates.length === 0 ? (
                        <div className="px-4 py-3 text-muted-foreground text-sm">
                          No templates found
                        </div>
                      ) : (
                        filteredTemplates.map(template => (
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

          {/* Templates Table */}
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
                  {/* 
                  <Select
                    value={selectedCategoryFilter}
                    onValueChange={setSelectedCategoryFilter}
                  >
                    <SelectTrigger className="w-full sm:w-[8.75rem]">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {uniqueCategories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select> */}
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

      {/* Numbers Tab */}
      {activeTab === "numbers" && (
        <div className="space-y-4">
          {/* Toolbar */}
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

          {/* Numbers Table */}
          <DataTable
            data={numbers}
            columns={numberColumns}
            title="WhatsApp Numbers"
            count={numbers.length}
            showFilter={false}
          />
        </div>
      )}

      {/* Modals */}
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

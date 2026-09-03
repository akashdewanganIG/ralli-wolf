"use client";

import { config } from "@/lib/config";

import {
  Button,
  ConfirmationDialog,
  Input,
  Label,
  SearchInput,
} from "@repo/ui";
import { Alert } from "@repo/ui/components/ui/alert";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { PageHeader } from "@repo/ui/components/ui/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { isPermission, type Permission } from "@repo/db/permissions";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Edit,
  FileSpreadsheet,
  Filter,
  Mail,
  ShieldCheck,
  Trash2,
  Upload,
} from "@repo/ui/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DataTable, type TableColumn } from "../../../components/data-table";
import { RoleGuard } from "../../../components/guards/role-guard";
import { ProtectedRoute } from "../../../components/protected-route";
import {
  SkeletonLine,
  TableSkeleton,
  ToolbarSkeleton,
} from "../../../components/skeletons";
import { PermissionsDialog } from "../../../components/admin/permissions-dialog";
import { UserFilterBadges } from "../../../components/user-filter-badges";
import { useUsersWithPagination, userKeys } from "../../../hooks/use-users";
import { userService } from "../../../lib/api/services";
import { toast } from "../../../lib/toast";
import {
  validateEmail,
  validateName,
  validatePhoneOptional,
} from "../../../lib/validation";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { DEFAULT_PAGE_SIZE } from "@/components/data-table";
import { Tag } from "@repo/ui/components/ui/tag";
import { roleTone } from "@repo/ui/components/ui/status-badge";
import { DataTransfer } from "@/components/data-transfer/data-transfer";
import { getErrorMessage } from "@/lib/api/error-handler";

type User = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone?: string;
  role: string;
  region?: string;
  location?: string;
  permissions?: string[];
  createdAt: string;
};

const formatRegion = (region?: string): string => {
  if (!region) return "-";
  const regionMap: Record<string, string> = {
    SOUTH: "South",
    NORTH: "North",
    EAST: "East",
    WEST_1: "West 1",
    WEST_2: "West 2",
    APTOC: "APTOC",
  };
  return regionMap[region] || region;
};

function getApiErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return undefined;
  }
  return typeof error.code === "string" ? error.code : undefined;
}

export default function UserManagementPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [newUser, setNewUser] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    role: "SALES",
    region: "",
    location: "",
    permissions: [] as Permission[],
  });
  const [editingUser, setEditingUser] = useState<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    role: string;
    region: string;
    location: string;
    permissions: Permission[];
  } | null>(null);
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);
  const [isCreatePermissionsOpen, setIsCreatePermissionsOpen] = useState(false);
  const [isSingleDeleteOpen, setIsSingleDeleteOpen] = useState(false);
  const [resending, setResending] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    region?: string;
  }>({});
  const [touchedFields, setTouchedFields] = useState<
    Set<"firstName" | "lastName" | "email" | "phone" | "region">
  >(new Set());

  const [selectedRole, setSelectedRole] = useState<string | undefined>(
    undefined
  );
  const [selectedRegion, setSelectedRegion] = useState<string | undefined>(
    undefined
  );

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_PAGE_SIZE);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: number;
    errors: Array<{
      row: number;
      firstName: string;
      lastName: string;
      email: string;
      error: string;
    }>;
    report?: { filename: string; mimeType: string; base64: string };
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const computedErrors = useMemo(() => {
    const e: Partial<
      Record<"firstName" | "lastName" | "email" | "phone" | "region", string>
    > = {};

    const firstNameValidation = validateName(newUser.firstName);
    if (!firstNameValidation.isValid) e.firstName = firstNameValidation.error;

    const lastNameValidation = validateName(newUser.lastName);
    if (!lastNameValidation.isValid) e.lastName = lastNameValidation.error;

    const emailValidation = validateEmail(newUser.email);
    if (!emailValidation.isValid) e.email = emailValidation.error;

    if (newUser.phone.trim()) {
      const phoneValidation = validatePhoneOptional(newUser.phone);
      if (!phoneValidation.isValid) e.phone = phoneValidation.error;
    }

    return e;
  }, [newUser.firstName, newUser.lastName, newUser.email, newUser.phone]);

  const computedEditErrors = useMemo(() => {
    if (!editingUser) return {};
    const e: Partial<
      Record<"firstName" | "lastName" | "email" | "phone" | "region", string>
    > = {};

    const firstNameValidation = validateName(editingUser.firstName);
    if (!firstNameValidation.isValid) e.firstName = firstNameValidation.error;

    const lastNameValidation = validateName(editingUser.lastName);
    if (!lastNameValidation.isValid) e.lastName = lastNameValidation.error;

    const emailValidation = validateEmail(editingUser.email);
    if (!emailValidation.isValid) e.email = emailValidation.error;

    if (editingUser.phone.trim()) {
      const phoneValidation = validatePhoneOptional(editingUser.phone);
      if (!phoneValidation.isValid) e.phone = phoneValidation.error;
    }

    return e;
  }, [editingUser]);

  const displayErrors = useMemo(() => {
    const display: Partial<
      Record<"firstName" | "lastName" | "email" | "phone" | "region", string>
    > = {};
    for (const field of [
      "firstName",
      "lastName",
      "email",
      "phone",
      "region",
    ] as const) {
      if (touchedFields.has(field) && computedErrors[field]) {
        display[field] = computedErrors[field];
      }
    }
    return display;
  }, [computedErrors, touchedFields]);

  const displayEditErrors = useMemo(() => {
    const display: Partial<
      Record<"firstName" | "lastName" | "email" | "phone" | "region", string>
    > = {};
    for (const field of [
      "firstName",
      "lastName",
      "email",
      "phone",
      "region",
    ] as const) {
      if (touchedFields.has(field) && computedEditErrors[field]) {
        display[field] = computedEditErrors[field];
      }
    }
    return display;
  }, [computedEditErrors, touchedFields]);

  const hasErrors = Object.keys(computedErrors).length > 0;
  const hasEditErrors = Object.keys(computedEditErrors).length > 0;

  const userFilters = useMemo(
    () => ({
      page: currentPage,
      limit: itemsPerPage,
      role: selectedRole,
      region: selectedRegion,
    }),
    [currentPage, itemsPerPage, selectedRole, selectedRegion]
  );

  const {
    data: users = [],
    pagination,
    isLoading: loading,
    error: usersError,
  } = useUsersWithPagination(userFilters);

  const mappedUsers = useMemo(() => {
    return users.map(u => ({
      id: u.id.toString(),
      firstName: u.firstName || "",
      lastName: u.lastName || "",
      email: u.email,
      phone: u.phone || "",
      role: String(u.role || ""),
      region: u.region || "",
      location: u.location || "",
      createdAt: u.createdAt || "",
    }));
  }, [users]);

  const filtered = useMemo(() => {
    let filteredUsers = mappedUsers;

    const q = query.trim().toLowerCase();
    if (q) {
      filteredUsers = filteredUsers.filter(user => {
        const fullName = [user.firstName, user.lastName]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const nameMatch = fullName.includes(q);
        const emailMatch = user.email.toLowerCase().includes(q);
        const roleMatch = user.role.toLowerCase().includes(q);
        const phoneMatch = user.phone?.toLowerCase().includes(q) || false;
        const regionMatch = formatRegion(user.region).toLowerCase().includes(q);
        const createdAtMatch = new Date(user.createdAt)
          .toLocaleDateString()
          .toLowerCase()
          .includes(q);

        return (
          nameMatch ||
          emailMatch ||
          roleMatch ||
          phoneMatch ||
          regionMatch ||
          createdAtMatch
        );
      });
    }

    return filteredUsers.sort((a, b) => {
      if (a.role === "ADMIN" && b.role !== "ADMIN") return -1;
      if (a.role !== "ADMIN" && b.role === "ADMIN") return 1;
      return 0;
    });
  }, [query, mappedUsers]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedRole, selectedRegion]);

  const errorMessage = useMemo(() => {
    return usersError ? getErrorMessage(usersError) : null;
  }, [usersError]);

  const handleCreateUser = async () => {
    const firstNameValidation = validateName(newUser.firstName);
    const lastNameValidation = validateName(newUser.lastName);
    const emailValidation = validateEmail(newUser.email);
    const phoneValidation = validatePhoneOptional(newUser.phone);

    const errors: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      region?: string;
    } = {};
    if (!firstNameValidation.isValid)
      errors.firstName = firstNameValidation.error;
    if (!lastNameValidation.isValid) errors.lastName = lastNameValidation.error;
    if (!emailValidation.isValid) errors.email = emailValidation.error;
    if (!phoneValidation.isValid) errors.phone = phoneValidation.error;

    setValidationErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    if (newUser.role === "CUSTOM" && newUser.permissions.length === 0) {
      toast.error("A custom role needs at least one permission");
      setIsCreatePermissionsOpen(true);
      return;
    }

    const loadingToast = toast.loading("Creating new user...");
    try {
      setCreating(true);
      const createdUser = await userService.createUser(newUser);
      toast.dismiss(loadingToast);

      if (createdUser.invitationEmailSent) {
        toast.success("User created and ready to sign in", {
          description: `A password-setup invitation was sent to ${createdUser.email}.`,
        });
      } else {
        toast.warning("User created; invitation email was not delivered", {
          description:
            "The account is active. They can use Forgot password to establish access.",
          duration: 7000,
        });
      }

      setCurrentPage(1);
      setSelectedRole(undefined);
      setSelectedRegion(undefined);
      setQuery("");

      await queryClient.invalidateQueries({ queryKey: userKeys.lists() });

      setNewUser({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        role: "SALES",
        region: "",
        location: "",
        permissions: [] as Permission[],
      });
      setValidationErrors({});
      setTouchedFields(new Set());
      setIsCreateModalOpen(false);
    } catch (err) {
      toast.dismiss(loadingToast);
      toast.error(err, "Failed to create user");
    } finally {
      setCreating(false);
    }
  };

  const handleEditUser = useCallback((user: User) => {
    setEditingUser({
      id: user.id,
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email,
      phone: user.phone || "",
      role: user.role,
      region: user.region || "",
      location: user.location || "",
      permissions: (user.permissions ?? []).filter(isPermission),
    });
    setValidationErrors({});
    setTouchedFields(new Set());
    setIsEditModalOpen(true);
  }, []);

  const editingUserName = editingUser
    ? [editingUser.firstName, editingUser.lastName].filter(Boolean).join(" ") ||
      editingUser.email
    : "";

  const handleResendCredentials = async () => {
    if (!editingUser) return;
    try {
      setResending(true);
      const result = await userService.resendCredentials(
        parseInt(editingUser.id)
      );
      toast.success("Verification email sent", {
        description:
          result?.message ??
          `A password-setup invitation was sent to ${editingUser.email}.`,
      });
    } catch (err: unknown) {
      toast.error(err, "Could not send the verification email");
    } finally {
      setResending(false);
    }
  };

  const handleDeleteSingleUser = async () => {
    if (!editingUser) return;
    try {
      setDeletingUser(true);
      await userService.deleteUser(parseInt(editingUser.id));
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      toast.success("User deleted", {
        description: `${editingUserName} can no longer sign in.`,
      });
      setIsSingleDeleteOpen(false);
      setIsEditModalOpen(false);
      setEditingUser(null);
    } catch (err: unknown) {
      toast.error(err, "Could not delete the user");
    } finally {
      setDeletingUser(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    const firstNameValidation = validateName(editingUser.firstName);
    const lastNameValidation = validateName(editingUser.lastName);
    const emailValidation = validateEmail(editingUser.email);
    const phoneValidation = validatePhoneOptional(editingUser.phone);

    const errors: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      region?: string;
    } = {};
    if (!firstNameValidation.isValid)
      errors.firstName = firstNameValidation.error;
    if (!lastNameValidation.isValid) errors.lastName = lastNameValidation.error;
    if (!emailValidation.isValid) errors.email = emailValidation.error;
    if (!phoneValidation.isValid) errors.phone = phoneValidation.error;

    setValidationErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    if (editingUser.role === "CUSTOM" && editingUser.permissions.length === 0) {
      toast.error("A custom role needs at least one permission");
      setIsPermissionsOpen(true);
      return;
    }

    try {
      setUpdating(true);
      const { id, ...userData } = editingUser;
      const op = userService.updateUser(parseInt(id), userData);
      toast.promise(op, {
        loading: "Updating user...",
        success: "User updated successfully!",
        error: error => getErrorMessage(error),
      });

      await op;

      queryClient.invalidateQueries({ queryKey: userKeys.lists() });

      setEditingUser(null);
      setValidationErrors({});
      setTouchedFields(new Set());
      setIsEditModalOpen(false);
    } catch (_err) {
      return;
    } finally {
      setUpdating(false);
    }
  };

  const handleBulkDelete = async () => {
    try {
      const usersToDelete = selectedUsers.filter(userId => {
        const user = mappedUsers.find(u => u.id === userId);
        return user && user.role !== "ADMIN";
      });

      const count = usersToDelete.length;
      if (count === 0) {
        toast.error("System admin users cannot be deleted");
        setSelectedUsers([]);
        setIsDeleteModalOpen(false);
        return;
      }

      const op = Promise.all(
        usersToDelete.map(userId => userService.deleteUser(parseInt(userId)))
      );

      toast.promise(op, {
        loading: `Deleting ${count} user${count > 1 ? "s" : ""}...`,
        success: `Successfully deleted ${count} user${count > 1 ? "s" : ""}`,
        error: error => {
          if (getApiErrorCode(error) === "FOREIGN_KEY_CONSTRAINT") {
            return "Cannot delete user: reassign their owned records first.";
          }
          return getErrorMessage(error);
        },
      });

      await op;

      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      setSelectedUsers([]);
      setIsDeleteModalOpen(false);
    } catch (_err) {
      return;
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = [".csv", ".xlsx"];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (!validTypes.includes(ext)) {
      toast.error("Please upload a CSV or Excel (.xlsx) file");
      return;
    }

    setImportFile(file);
    setImportResult(null);
  };

  const handleImportUsers = async () => {
    if (!importFile) {
      toast.error("Please select a file to import");
      return;
    }

    setImporting(true);
    try {
      const result = await userService.importUsersFile(importFile);
      setImportResult({
        success: result.success.length,
        errors: result.errors,
        report: result.report,
      });

      if (result.success.length > 0) {
        toast.success(`Successfully imported ${result.success.length} user(s)`);

        queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      }

      if (result.errors.length > 0) {
        toast.error(`${result.errors.length} row(s) failed to import`);
      }
    } catch (err: unknown) {
      toast.error(err, "Failed to import users");
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadErrorReport = () => {
    if (!importResult?.report) return;

    const { filename, base64, mimeType } = importResult.report;
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadTemplate = async (format: "xlsx" | "csv") => {
    try {
      const endpoint =
        format === "csv"
          ? "/api/users/import/template/download/csv"
          : "/api/users/import/template/download";

      const response = await fetch(`${config.apiUrl}${endpoint}`, {
        credentials: "include",
      });

      if (!response.ok) throw new Error("Failed to download template");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `users-import-template.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download template");
    }
  };

  const resetImportModal = () => {
    setImportFile(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const columns: TableColumn<User>[] = useMemo(
    () => [
      {
        key: "name",
        label: "Name",
        render: (_v, item) => (
          <span className="text-muted-foreground py-4">
            {[item.firstName, item.lastName].filter(Boolean).join(" ") || "-"}
          </span>
        ),
      },
      {
        key: "email",
        label: "Email",
        render: (_v, item) => (
          <span className="text-muted-foreground py-4">{item.email}</span>
        ),
      },
      {
        key: "phone",
        label: "Phone",
        render: (_v, item) => (
          <span className="text-muted-foreground py-4">
            {item.phone || "-"}
          </span>
        ),
      },
      {
        key: "role",
        label: "Role",
        render: (_v, item) => <Tag tone={roleTone(item.role)}>{item.role}</Tag>,
      },
      {
        key: "region",
        label: "Region",
        render: (_v, item) => (
          <Tag tone="neutral">{formatRegion(item.region)}</Tag>
        ),
      },
      {
        key: "location",
        label: "Location",
        render: (_v, item) => (
          <span className="text-muted-foreground py-4">
            {item.location || "-"}
          </span>
        ),
      },
      {
        key: "createdAt",
        label: "Created At",
        render: (_v, item) => {
          const date = new Date(item.createdAt);
          const time = date.toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          });
          const dateStr = date.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "2-digit",
          });
          return (
            <span className="text-muted-foreground py-2">{`${time}, ${dateStr}`}</span>
          );
        },
      },
      {
        key: "actions",
        label: "Actions",
        render: (_v, item) => (
          <Button
            variant="ghost"
            onClick={() => handleEditUser(item)}
            className="h-8 w-8 p-0"
          >
            <Edit className="h-4 w-4" />
          </Button>
        ),
      },
    ],
    [handleEditUser]
  );

  const skeletonView = (
    <PageShell>
      <div className="space-y-2">
        <SkeletonLine className="h-8 w-72" />
        <SkeletonLine className="h-4 w-48" />
      </div>
      <div className="rounded-xl border bg-card/40 p-4 space-y-4">
        <ToolbarSkeleton />
        <TableSkeleton />
      </div>
    </PageShell>
  );

  if (loading) {
    return (
      <ProtectedRoute fallback={skeletonView}>
        <RoleGuard allowedRoles={["ADMIN"]}>{skeletonView}</RoleGuard>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute fallback={skeletonView}>
      <RoleGuard allowedRoles={["ADMIN"]}>
        <PageShell>
          {errorMessage && (
            <Alert tone="error" title="Unable to load users">
              {errorMessage}
            </Alert>
          )}

          <PageHeader
            title="User management"
            description={
              <>
                Manage users and their roles
                {query && (
                  <span className="ml-2 text-sm">
                    ({filtered.length} of {pagination?.totalItems || 0} users)
                  </span>
                )}
              </>
            }
            actions={
              <>
                {selectedUsers.length > 0 && (
                  <Button
                    variant="destructive"
                    onClick={() => setIsDeleteModalOpen(true)}
                  >
                    Delete selected ({selectedUsers.length})
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setIsImportModalOpen(true)}
                >
                  <Upload className="size-4" />
                  Import users
                </Button>
                <Button onClick={() => setIsCreateModalOpen(true)}>
                  Create user
                </Button>

                <DataTransfer entity="users" size="default" />
              </>
            }
          />

          {filtered.length === 0 &&
          (query || selectedRole || selectedRegion) ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No users found
                {query && ` matching "${query}"`}
                {selectedRole && ` with role "${selectedRole}"`}
                {selectedRegion &&
                  ` in region "${formatRegion(selectedRegion)}"`}
              </p>
              <div className="flex items-center justify-center gap-2 mt-4">
                {query && (
                  <Button variant="outline" onClick={() => setQuery("")}>
                    Clear Search
                  </Button>
                )}
                {(selectedRole || selectedRegion) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedRole(undefined);
                      setSelectedRegion(undefined);
                      toast.info("User filters cleared");
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <DataTable<User>
              data={filtered}
              columns={columns}
              title="Users"
              stackedToolbar
              count={pagination?.totalItems || 0}
              currentPage={currentPage}
              totalPages={pagination?.totalPages || 1}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setItemsPerPage}
              showCheckboxes={true}
              selectedItems={selectedUsers}
              onSelectionChange={ids => {
                const validIds = ids.filter(id => {
                  const user = filtered.find(u => u.id === id);
                  return user && user.role !== "ADMIN";
                });
                setSelectedUsers(validIds);
              }}
              search={
                <div className="relative min-w-0 flex-1">
                  <SearchInput
                    id="search"
                    placeholder="Search by name, email, or date..."
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    className="w-full"
                  />
                  {query && (
                    <Button
                      variant="ghost"
                      onClick={() => setQuery("")}
                      className="absolute right-2 inset-y-0 my-auto h-fit h-6 w-6 p-0"
                    >
                      ×
                    </Button>
                  )}
                </div>
              }
              isSearchMode={!!query}
              searchQuery={query}
              showFilter={true}
              customFilter={
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className={
                          selectedRole ? "bg-primary/10 border-primary" : ""
                        }
                      >
                        <Filter className="h-4 w-4" />
                        Role
                        {selectedRole && (
                          <span className="ml-1 h-2 w-2 bg-primary rounded-full" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedRole(undefined);
                          setCurrentPage(1);
                        }}
                      >
                        All Roles
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedRole("SALES");
                          setCurrentPage(1);
                        }}
                      >
                        SALES
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedRole("ADMIN");
                          setCurrentPage(1);
                        }}
                      >
                        ADMIN
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedRole("CUSTOM");
                          setCurrentPage(1);
                        }}
                      >
                        CUSTOM
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className={
                          selectedRegion ? "bg-primary/10 border-primary" : ""
                        }
                      >
                        <Filter className="h-4 w-4" />
                        Region
                        {selectedRegion && (
                          <span className="ml-1 h-2 w-2 bg-primary rounded-full" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedRegion(undefined);
                          setCurrentPage(1);
                        }}
                      >
                        All Regions
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedRegion("SOUTH");
                          setCurrentPage(1);
                        }}
                      >
                        South
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedRegion("NORTH");
                          setCurrentPage(1);
                        }}
                      >
                        North
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedRegion("EAST");
                          setCurrentPage(1);
                        }}
                      >
                        East
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedRegion("WEST_1");
                          setCurrentPage(1);
                        }}
                      >
                        West 1
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedRegion("WEST_2");
                          setCurrentPage(1);
                        }}
                      >
                        West 2
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedRegion("APTOC");
                          setCurrentPage(1);
                        }}
                      >
                        APTOC
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              }
              filterBadges={
                <UserFilterBadges
                  selectedRole={selectedRole}
                  selectedRegion={selectedRegion}
                  onRoleRemove={() => {
                    setSelectedRole(undefined);
                    setCurrentPage(1);
                  }}
                  onRegionRemove={() => {
                    setSelectedRegion(undefined);
                    setCurrentPage(1);
                  }}
                />
              }
            />
          )}

          <Dialog
            open={isCreateModalOpen}
            onOpenChange={open => {
              setIsCreateModalOpen(open);
              if (!open) {
                setNewUser({
                  firstName: "",
                  lastName: "",
                  email: "",
                  phone: "",
                  role: "SALES",
                  region: "",
                  location: "",
                  permissions: [] as Permission[],
                });
                setError(null);
                setValidationErrors({});
                setTouchedFields(new Set());
              }
            }}
          >
            <DialogContent className="max-w-md gap-0 overflow-hidden">
              <DialogHeader>
                <DialogTitle>Create User</DialogTitle>
                <DialogDescription>
                  Add a new user to the system
                </DialogDescription>
              </DialogHeader>

              <DialogBody className="space-y-3">
                {error && (
                  <div className="bg-error-surface border border-error-border text-error-foreground px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        value={newUser.firstName}
                        onChange={e => {
                          setNewUser(prev => ({
                            ...prev,
                            firstName: e.target.value,
                          }));
                          if (validationErrors.firstName) {
                            const validation = validateName(e.target.value);
                            setValidationErrors(prev => ({
                              ...prev,
                              firstName: validation.isValid
                                ? undefined
                                : validation.error,
                            }));
                          }
                        }}
                        onBlur={() =>
                          setTouchedFields(prev =>
                            new Set(prev).add("firstName")
                          )
                        }
                        placeholder="First name"
                        disabled={creating}
                        aria-invalid={!!displayErrors.firstName}
                        aria-describedby={
                          displayErrors.firstName
                            ? "firstName-error"
                            : undefined
                        }
                      />
                      {displayErrors.firstName && (
                        <p
                          id="firstName-error"
                          className="text-xs text-destructive mt-1"
                        >
                          {displayErrors.firstName}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name *</Label>
                      <Input
                        id="lastName"
                        value={newUser.lastName}
                        onChange={e => {
                          setNewUser(prev => ({
                            ...prev,
                            lastName: e.target.value,
                          }));
                          if (validationErrors.lastName) {
                            const validation = validateName(e.target.value);
                            setValidationErrors(prev => ({
                              ...prev,
                              lastName: validation.isValid
                                ? undefined
                                : validation.error,
                            }));
                          }
                        }}
                        onBlur={() =>
                          setTouchedFields(prev =>
                            new Set(prev).add("lastName")
                          )
                        }
                        placeholder="Last name"
                        disabled={creating}
                        aria-invalid={!!displayErrors.lastName}
                        aria-describedby={
                          displayErrors.lastName ? "lastName-error" : undefined
                        }
                      />
                      {displayErrors.lastName && (
                        <p
                          id="lastName-error"
                          className="text-xs text-destructive mt-1"
                        >
                          {displayErrors.lastName}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newUser.email}
                      onChange={e => {
                        setNewUser(prev => ({
                          ...prev,
                          email: e.target.value,
                        }));
                        if (validationErrors.email) {
                          const validation = validateEmail(e.target.value);
                          setValidationErrors(prev => ({
                            ...prev,
                            email: validation.isValid
                              ? undefined
                              : validation.error,
                          }));
                        }
                      }}
                      onBlur={() =>
                        setTouchedFields(prev => new Set(prev).add("email"))
                      }
                      placeholder="Enter user email"
                      disabled={creating}
                      aria-invalid={!!displayErrors.email}
                      aria-describedby={
                        displayErrors.email ? "email-error" : undefined
                      }
                    />
                    {displayErrors.email && (
                      <p
                        id="email-error"
                        className="text-xs text-destructive mt-1"
                      >
                        {displayErrors.email}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={newUser.phone}
                      onChange={e => {
                        setNewUser(prev => ({
                          ...prev,
                          phone: e.target.value,
                        }));
                        if (validationErrors.phone) {
                          const validation = validatePhoneOptional(
                            e.target.value
                          );
                          setValidationErrors(prev => ({
                            ...prev,
                            phone: validation.isValid
                              ? undefined
                              : validation.error,
                          }));
                        }
                      }}
                      onBlur={() =>
                        setTouchedFields(prev => new Set(prev).add("phone"))
                      }
                      placeholder="Enter phone number"
                      disabled={creating}
                      aria-invalid={!!displayErrors.phone}
                      aria-describedby={
                        displayErrors.phone ? "phone-error" : undefined
                      }
                    />
                    {displayErrors.phone && (
                      <p
                        id="phone-error"
                        className="text-xs text-destructive mt-1"
                      >
                        {displayErrors.phone}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      type="text"
                      value={newUser.location}
                      onChange={e => {
                        setNewUser(prev => ({
                          ...prev,
                          location: e.target.value,
                        }));
                      }}
                      placeholder="Enter location (optional)"
                      disabled={creating}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="region">Region</Label>
                    <Select
                      value={newUser.region || "none"}
                      onValueChange={v => {
                        setNewUser(prev => ({
                          ...prev,
                          region: v === "none" ? "" : v,
                        }));
                        setTouchedFields(prev => new Set(prev).add("region"));
                        if (validationErrors.region) {
                          setValidationErrors(prev => ({
                            ...prev,
                            region: undefined,
                          }));
                        }
                      }}
                      disabled={creating}
                    >
                      <SelectTrigger
                        id="region"
                        aria-invalid={!!displayErrors.region}
                        aria-describedby={
                          displayErrors.region ? "region-error" : undefined
                        }
                      >
                        <SelectValue placeholder="Select Region (Optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          No Region (Optional)
                        </SelectItem>
                        <SelectItem value="SOUTH">South</SelectItem>
                        <SelectItem value="NORTH">North</SelectItem>
                        <SelectItem value="EAST">East</SelectItem>
                        <SelectItem value="WEST_1">West 1</SelectItem>
                        <SelectItem value="WEST_2">West 2</SelectItem>
                        <SelectItem value="APTOC">APTOC</SelectItem>
                      </SelectContent>
                    </Select>
                    {displayErrors.region && (
                      <p
                        id="region-error"
                        className="text-xs text-destructive mt-1"
                      >
                        {displayErrors.region}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="role">Role *</Label>
                    <Select
                      value={newUser.role}
                      onValueChange={v => {
                        setNewUser(prev => ({ ...prev, role: v }));

                        if (v === "CUSTOM") setIsCreatePermissionsOpen(true);
                      }}
                      disabled={creating}
                    >
                      <SelectTrigger id="role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SALES">Sales</SelectItem>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                        <SelectItem value="CUSTOM">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                    {newUser.role === "CUSTOM" ? (
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-subtle px-3 py-2">
                        <p className="text-xs text-muted-foreground">
                          <span className="font-semibold tabular-nums text-foreground">
                            {newUser.permissions.length}
                          </span>{" "}
                          permission
                          {newUser.permissions.length === 1 ? "" : "s"} granted
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={creating}
                          onClick={() => setIsCreatePermissionsOpen(true)}
                        >
                          <ShieldCheck className="size-4" />
                          Edit permissions
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {newUser.role === "ADMIN"
                          ? "Admins hold every permission, including user management."
                          : "Sales holds the standard pipeline permissions."}
                      </p>
                    )}
                  </div>

                  <div className="rounded-lg border border-primary/20 bg-primary/[0.04] px-4 py-3 text-sm text-foreground">
                    <p className="font-semibold">Sign-in access</p>
                    <p>
                      Accounts are active as soon as they are created and appear
                      in the user list without approval. Every user receives an
                      invitation to prove control of their mailbox and set a
                      private password; no password is sent by email.
                    </p>
                  </div>
                </div>
              </DialogBody>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setNewUser({
                      firstName: "",
                      lastName: "",
                      email: "",
                      phone: "",
                      role: "SALES",
                      region: "",
                      location: "",
                      permissions: [] as Permission[],
                    });
                    setError(null);
                    setValidationErrors({});
                    setTouchedFields(new Set());
                  }}
                  disabled={creating}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateUser}
                  disabled={hasErrors || creating}
                >
                  {creating ? "Creating..." : "Create User"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={isEditModalOpen}
            onOpenChange={open => {
              setIsEditModalOpen(open);
              if (!open) {
                setEditingUser(null);
                setError(null);
                setValidationErrors({});
                setTouchedFields(new Set());
              }
            }}
          >
            <DialogContent className="max-w-md gap-0 overflow-hidden">
              <DialogHeader>
                <DialogTitle>Edit User</DialogTitle>
                <DialogDescription>Update user information</DialogDescription>
              </DialogHeader>

              <DialogBody className="space-y-3">
                {error && (
                  <div className="bg-error-surface border border-error-border text-error-foreground px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                {editingUser && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-firstName">First Name *</Label>
                        <Input
                          id="edit-firstName"
                          value={editingUser.firstName}
                          onChange={e => {
                            setEditingUser(prev =>
                              prev
                                ? { ...prev, firstName: e.target.value }
                                : null
                            );
                            if (validationErrors.firstName) {
                              const validation = validateName(e.target.value);
                              setValidationErrors(prev => ({
                                ...prev,
                                firstName: validation.isValid
                                  ? undefined
                                  : validation.error,
                              }));
                            }
                          }}
                          onBlur={() =>
                            setTouchedFields(prev =>
                              new Set(prev).add("firstName")
                            )
                          }
                          placeholder="First name"
                          disabled={updating}
                          aria-invalid={!!displayEditErrors.firstName}
                          aria-describedby={
                            displayEditErrors.firstName
                              ? "edit-firstName-error"
                              : undefined
                          }
                        />
                        {displayEditErrors.firstName && (
                          <p
                            id="edit-firstName-error"
                            className="text-xs text-destructive mt-1"
                          >
                            {displayEditErrors.firstName}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-lastName">Last Name *</Label>
                        <Input
                          id="edit-lastName"
                          value={editingUser.lastName}
                          onChange={e => {
                            setEditingUser(prev =>
                              prev
                                ? { ...prev, lastName: e.target.value }
                                : null
                            );
                            if (validationErrors.lastName) {
                              const validation = validateName(e.target.value);
                              setValidationErrors(prev => ({
                                ...prev,
                                lastName: validation.isValid
                                  ? undefined
                                  : validation.error,
                              }));
                            }
                          }}
                          onBlur={() =>
                            setTouchedFields(prev =>
                              new Set(prev).add("lastName")
                            )
                          }
                          placeholder="Last name"
                          disabled={updating}
                          aria-invalid={!!displayEditErrors.lastName}
                          aria-describedby={
                            displayEditErrors.lastName
                              ? "edit-lastName-error"
                              : undefined
                          }
                        />
                        {displayEditErrors.lastName && (
                          <p
                            id="edit-lastName-error"
                            className="text-xs text-destructive mt-1"
                          >
                            {displayEditErrors.lastName}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-email">Email *</Label>
                      <Input
                        id="edit-email"
                        type="email"
                        value={editingUser.email}
                        onChange={e => {
                          setEditingUser(prev =>
                            prev ? { ...prev, email: e.target.value } : null
                          );
                          if (validationErrors.email) {
                            const validation = validateEmail(e.target.value);
                            setValidationErrors(prev => ({
                              ...prev,
                              email: validation.isValid
                                ? undefined
                                : validation.error,
                            }));
                          }
                        }}
                        onBlur={() =>
                          setTouchedFields(prev => new Set(prev).add("email"))
                        }
                        placeholder="Enter user email"
                        disabled={updating}
                        aria-invalid={!!displayEditErrors.email}
                        aria-describedby={
                          displayEditErrors.email
                            ? "edit-email-error"
                            : undefined
                        }
                      />
                      {displayEditErrors.email && (
                        <p
                          id="edit-email-error"
                          className="text-xs text-destructive mt-1"
                        >
                          {displayEditErrors.email}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-phone">Phone Number</Label>
                      <Input
                        id="edit-phone"
                        type="tel"
                        value={editingUser.phone}
                        onChange={e => {
                          setEditingUser(prev =>
                            prev ? { ...prev, phone: e.target.value } : null
                          );
                          if (validationErrors.phone) {
                            const validation = validatePhoneOptional(
                              e.target.value
                            );
                            setValidationErrors(prev => ({
                              ...prev,
                              phone: validation.isValid
                                ? undefined
                                : validation.error,
                            }));
                          }
                        }}
                        onBlur={() =>
                          setTouchedFields(prev => new Set(prev).add("phone"))
                        }
                        placeholder="Enter phone number"
                        disabled={updating}
                        aria-invalid={!!displayEditErrors.phone}
                        aria-describedby={
                          displayEditErrors.phone
                            ? "edit-phone-error"
                            : undefined
                        }
                      />
                      {displayEditErrors.phone && (
                        <p
                          id="edit-phone-error"
                          className="text-xs text-destructive mt-1"
                        >
                          {displayEditErrors.phone}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-location">Location</Label>
                      <Input
                        id="edit-location"
                        type="text"
                        value={editingUser.location}
                        onChange={e => {
                          setEditingUser(prev =>
                            prev ? { ...prev, location: e.target.value } : null
                          );
                        }}
                        placeholder="Enter location (optional)"
                        disabled={updating}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-region">Region</Label>
                      <Select
                        value={editingUser.region || "none"}
                        onValueChange={v => {
                          setEditingUser(prev =>
                            prev
                              ? { ...prev, region: v === "none" ? "" : v }
                              : null
                          );
                          setTouchedFields(prev => new Set(prev).add("region"));
                          if (validationErrors.region) {
                            setValidationErrors(prev => ({
                              ...prev,
                              region: undefined,
                            }));
                          }
                        }}
                        disabled={updating}
                      >
                        <SelectTrigger
                          id="edit-region"
                          aria-invalid={!!displayEditErrors.region}
                          aria-describedby={
                            displayEditErrors.region
                              ? "edit-region-error"
                              : undefined
                          }
                        >
                          <SelectValue placeholder="Select Region (Optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            No Region (Optional)
                          </SelectItem>
                          <SelectItem value="SOUTH">South</SelectItem>
                          <SelectItem value="NORTH">North</SelectItem>
                          <SelectItem value="EAST">East</SelectItem>
                          <SelectItem value="WEST_1">West 1</SelectItem>
                          <SelectItem value="WEST_2">West 2</SelectItem>
                          <SelectItem value="APTOC">APTOC</SelectItem>
                        </SelectContent>
                      </Select>
                      {displayEditErrors.region && (
                        <p
                          id="edit-region-error"
                          className="text-xs text-destructive mt-1"
                        >
                          {displayEditErrors.region}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-role">Role *</Label>
                      <Select
                        value={editingUser.role}
                        onValueChange={v => {
                          setEditingUser(prev =>
                            prev ? { ...prev, role: v } : null
                          );

                          if (v === "CUSTOM") setIsPermissionsOpen(true);
                        }}
                      >
                        <SelectTrigger id="edit-role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SALES">Sales</SelectItem>
                          <SelectItem value="ADMIN">Admin</SelectItem>
                          <SelectItem value="CUSTOM">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                      {editingUser.role === "CUSTOM" ? (
                        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-subtle px-3 py-2">
                          <p className="text-xs text-muted-foreground">
                            <span className="font-semibold tabular-nums text-foreground">
                              {editingUser.permissions.length}
                            </span>{" "}
                            permission
                            {editingUser.permissions.length === 1
                              ? ""
                              : "s"}{" "}
                            granted
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsPermissionsOpen(true)}
                          >
                            <ShieldCheck className="size-4" />
                            Edit permissions
                          </Button>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {editingUser.role === "ADMIN"
                            ? "Admins hold every permission, including user management."
                            : "Sales holds the standard pipeline permissions."}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2 border-t pt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Account actions
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={resending || updating}
                          onClick={handleResendCredentials}
                        >
                          <Mail
                            className={`size-4 ${resending ? "animate-pulse" : ""}`}
                          />
                          {resending ? "Sending…" : "Resend verification email"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="text-error-foreground hover:bg-error-surface"
                          disabled={updating || deletingUser}
                          onClick={() => setIsSingleDeleteOpen(true)}
                        >
                          <Trash2 className="size-4" />
                          Delete user
                        </Button>
                      </div>
                      <p className="text-xs leading-4 text-muted-foreground">
                        Resending revokes the current password and sessions,
                        then sends password-setup instructions. No password is
                        emailed.
                      </p>
                    </div>
                  </div>
                )}
              </DialogBody>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingUser(null);
                    setError(null);
                    setValidationErrors({});
                    setTouchedFields(new Set());
                  }}
                  disabled={updating}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdateUser}
                  disabled={hasEditErrors || updating}
                >
                  {updating ? "Updating..." : "Update User"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <PermissionsDialog
            open={isCreatePermissionsOpen}
            onOpenChange={setIsCreatePermissionsOpen}
            subjectName={
              `${newUser.firstName} ${newUser.lastName}`.trim() || "New user"
            }
            value={newUser.permissions}
            onSave={permissions =>
              setNewUser(prev => ({ ...prev, permissions }))
            }
          />

          <PermissionsDialog
            open={isPermissionsOpen}
            onOpenChange={setIsPermissionsOpen}
            subjectName={editingUserName}
            value={editingUser?.permissions ?? []}
            onSave={permissions =>
              setEditingUser(prev => (prev ? { ...prev, permissions } : null))
            }
          />

          <ConfirmationDialog
            open={isSingleDeleteOpen}
            onOpenChange={setIsSingleDeleteOpen}
            onConfirm={handleDeleteSingleUser}
            title="Delete user"
            description={`Delete ${editingUserName || "this user"}? They lose access immediately and their record is removed from the user list. This cannot be undone.`}
            confirmText={deletingUser ? "Deleting…" : "Delete user"}
            variant="destructive"
          />

          <ConfirmationDialog
            open={isDeleteModalOpen}
            onOpenChange={setIsDeleteModalOpen}
            onConfirm={handleBulkDelete}
            title="Delete Users"
            description={`Are you sure you want to delete ${selectedUsers.length} selected user(s)? This action cannot be undone.`}
            confirmText="Delete"
            variant="destructive"
          />

          <Dialog
            open={isImportModalOpen}
            onOpenChange={open => {
              setIsImportModalOpen(open);
              if (!open) {
                resetImportModal();
              }
            }}
          >
            <DialogContent className="max-w-2xl gap-0 overflow-hidden">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5" />
                  Import Users
                </DialogTitle>
                <DialogDescription>
                  Upload a CSV or Excel file to bulk import users. Required
                  columns: First Name, Last Name, Email. Optional: Phone, Role,
                  Region.
                </DialogDescription>
              </DialogHeader>

              <DialogBody>
                <div className="space-y-4">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleDownloadTemplate("xlsx")}
                      className="text-success-foreground border-success-border hover:bg-success-surface"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      Excel Template
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleDownloadTemplate("csv")}
                      className="text-info-foreground border-info-border hover:bg-info-surface"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      CSV Template
                    </Button>
                  </div>

                  <div className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-input transition-colors">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx"
                      onChange={handleFileChange}
                      className="hidden"
                      id="file-upload"
                      disabled={importing}
                    />
                    <label
                      htmlFor="file-upload"
                      className="cursor-pointer flex flex-col items-center gap-2"
                    >
                      <Upload className="w-8 h-8 text-muted-foreground" />
                      <span className="text-sm text-text-secondary">
                        {importFile ? (
                          <span className="text-success-foreground font-medium">
                            {importFile.name}
                          </span>
                        ) : (
                          "Click to upload file"
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Supported formats: .csv, .xlsx
                      </span>
                    </label>
                  </div>

                  <div className="bg-info-surface border border-info-border rounded-lg p-4 text-sm">
                    <p className="font-semibold text-info-foreground mb-2">
                      File Format:
                    </p>
                    <code className="text-xs text-info-foreground block bg-info-surface p-2 rounded">
                      First Name, Last Name, Email, Phone, Role, Region
                    </code>
                    <p className="text-info-foreground mt-2 text-xs">
                      • Role options: SALES, ADMIN (default: SALES)
                      <br />
                      • Region options: SOUTH, NORTH, EAST, WEST_1, WEST_2,
                      APTOC
                      <br />• Download the template for a pre-formatted file
                      with dropdown lists
                    </p>
                  </div>

                  {importResult && (
                    <div className="space-y-3">
                      {importResult.success > 0 && (
                        <div className="flex items-center gap-2 text-success-foreground bg-success-surface p-3 rounded-lg">
                          <CheckCircle2 className="w-5 h-5" />
                          <span>
                            {importResult.success} user(s) imported successfully
                          </span>
                        </div>
                      )}
                      {importResult.errors.length > 0 && (
                        <div className="bg-error-surface border border-error-border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 text-error-foreground">
                              <AlertCircle className="w-5 h-5" />
                              <span className="font-medium">
                                {importResult.errors.length} error(s)
                              </span>
                            </div>
                            {importResult.report && (
                              <Button
                                variant="outline"
                                onClick={handleDownloadErrorReport}
                                className="text-destructive border-error-border hover:bg-error-surface"
                              >
                                <FileSpreadsheet className="w-4 h-4 mr-1" />
                                Download Error Report
                              </Button>
                            )}
                          </div>
                          <div className="max-h-32 overflow-auto text-sm">
                            {importResult.errors.slice(0, 5).map((err, idx) => (
                              <p key={idx} className="text-destructive">
                                Row {err.row} ({err.email || "N/A"}):{" "}
                                {err.error}
                              </p>
                            ))}
                            {importResult.errors.length > 5 && (
                              <p className="text-destructive mt-1 italic">
                                ... and {importResult.errors.length - 5} more
                                errors. Download the report for full details.
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </DialogBody>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsImportModalOpen(false);
                    resetImportModal();
                  }}
                  disabled={importing}
                >
                  {importResult ? "Close" : "Cancel"}
                </Button>
                {!importResult && (
                  <Button
                    onClick={handleImportUsers}
                    disabled={!importFile || importing}
                  >
                    {importing ? "Importing..." : "Import Users"}
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </PageShell>
      </RoleGuard>
    </ProtectedRoute>
  );
}

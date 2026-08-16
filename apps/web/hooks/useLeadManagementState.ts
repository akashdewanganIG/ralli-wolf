import {
  useQueryStates,
  parseAsString,
  parseAsInteger,
  parseAsIsoDateTime,
} from "nuqs";
import { usePathname } from "next/navigation";

/**
 * Custom hook to manage lead management dashboard state in URL
 * All state is synced to URL for shareability and persistence
 * Active tab is now derived from pathname instead of query params
 */
export function useLeadManagementState() {
  const pathname = usePathname();

  const [state, setState] = useQueryStates(
    {
      leadSearchQuery: parseAsString.withDefault(""),
      assignedLeadsSearchQuery: parseAsString.withDefault(""),
      unassignedLeadsSearchQuery: parseAsString.withDefault(""),
      accountsSearchQuery: parseAsString.withDefault(""),
      contactsSearchQuery: parseAsString.withDefault(""),
      status: parseAsString.withDefault(""),
      source: parseAsString.withDefault(""),
      contactType: parseAsString.withDefault(""),
      createdFrom: parseAsIsoDateTime,
      createdTo: parseAsIsoDateTime,
      keywordIds: parseAsString,
      page: parseAsInteger.withDefault(1),
      itemsPerPage: parseAsInteger.withDefault(10),
      assignedUserId: parseAsString,
      assignedRegion: parseAsString,
    },
    {
      // Use 'push' for history management
      history: "push",
      // Shallow routing for better performance
      shallow: true,
    }
  );

  // Derive active tab from pathname
  const getActiveTab = () => {
    if (pathname.endsWith("/lead-master")) return "lead-master";
    if (pathname.endsWith("/assigned")) return "assigned";
    if (pathname.endsWith("/unassigned-leads")) return "unassigned-leads";
    if (pathname.endsWith("/accounts")) return "accounts";
    if (pathname.endsWith("/contacts")) return "contacts";
    return "lead-master"; // default fallback
  };

  const activeTab = getActiveTab();

  return {
    // State values
    activeTab,
    leadSearchQuery: state.leadSearchQuery,
    assignedLeadsSearchQuery: state.assignedLeadsSearchQuery,
    unassignedLeadsSearchQuery: state.unassignedLeadsSearchQuery,
    accountsSearchQuery: state.accountsSearchQuery,
    contactsSearchQuery: state.contactsSearchQuery,
    statusFilter: state.status,
    sourceFilter: state.source,
    contactTypeFilter: state.contactType,
    createdFrom: state.createdFrom,
    createdTo: state.createdTo,
    keywordIds: state.keywordIds
      ? state.keywordIds
          .split(",")
          .map(id => parseInt(id.trim()))
          .filter(id => !isNaN(id))
      : [],
    currentPage: state.page,
    itemsPerPage: state.itemsPerPage,
    selectedSalesUserId: state.assignedUserId || "all",
    selectedSalesRegion: state.assignedRegion || "all",

    // Setters (removed setActiveTab as navigation is now handled by Next.js router)
    setLeadSearchQuery: (search: string) =>
      setState({ leadSearchQuery: search, page: 1 }), // Reset page when searching
    setAssignedLeadsSearchQuery: (search: string) =>
      setState({ assignedLeadsSearchQuery: search, page: 1 }), // Reset page when searching
    setUnassignedLeadsSearchQuery: (search: string) =>
      setState({ unassignedLeadsSearchQuery: search, page: 1 }), // Reset page when searching
    setAccountsSearchQuery: (search: string) =>
      setState({ accountsSearchQuery: search, page: 1 }), // Reset page when searching
    setContactsSearchQuery: (search: string) =>
      setState({ contactsSearchQuery: search, page: 1 }), // Reset page when searching
    setStatusFilter: (status: string) => setState({ status, page: 1 }), // Reset page when filtering
    setSourceFilter: (source: string) => setState({ source, page: 1 }), // Reset page when filtering
    setContactTypeFilter: (contactType: string) =>
      setState({ contactType, page: 1 }), // Reset page when filtering
    setCreatedFrom: (createdFrom: Date | null) =>
      setState({ createdFrom, page: 1 }), // Reset page when filtering
    setCreatedTo: (createdTo: Date | null) => setState({ createdTo, page: 1 }), // Reset page when filtering
    setKeywordIds: (keywordIds: number[]) =>
      setState({
        keywordIds: keywordIds.length > 0 ? keywordIds.join(",") : null,
        page: 1,
      }), // Reset page when filtering
    setCurrentPage: (page: number) => setState({ page }),
    setItemsPerPage: (itemsPerPage: number) =>
      setState({ itemsPerPage, page: 1 }), // Reset to page 1 when changing items per page
    setSelectedSalesUserId: (value: string) =>
      setState({ assignedUserId: value === "all" ? null : value, page: 1 }),
    setSelectedSalesRegion: (value: string) =>
      setState({ assignedRegion: value === "all" ? null : value, page: 1 }),

    // Bulk setter for updating multiple params at once
    updateState: setState,
  };
}

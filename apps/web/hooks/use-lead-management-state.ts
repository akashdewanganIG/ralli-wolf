import {
  useQueryStates,
  parseAsString,
  parseAsInteger,
  parseAsIsoDateTime,
} from "nuqs";
import { usePathname } from "next/navigation";

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
      history: "push",

      shallow: true,
    }
  );

  const getActiveTab = () => {
    if (pathname.endsWith("/lead-master")) return "lead-master";
    if (pathname.endsWith("/assigned")) return "assigned";
    if (pathname.endsWith("/unassigned-leads")) return "unassigned-leads";
    if (pathname.endsWith("/accounts")) return "accounts";
    if (pathname.endsWith("/contacts")) return "contacts";
    return "lead-master";
  };

  const activeTab = getActiveTab();

  return {
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

    setLeadSearchQuery: (search: string) =>
      setState({ leadSearchQuery: search, page: 1 }),
    setAssignedLeadsSearchQuery: (search: string) =>
      setState({ assignedLeadsSearchQuery: search, page: 1 }),
    setUnassignedLeadsSearchQuery: (search: string) =>
      setState({ unassignedLeadsSearchQuery: search, page: 1 }),
    setAccountsSearchQuery: (search: string) =>
      setState({ accountsSearchQuery: search, page: 1 }),
    setContactsSearchQuery: (search: string) =>
      setState({ contactsSearchQuery: search, page: 1 }),
    setStatusFilter: (status: string) => setState({ status, page: 1 }),
    setSourceFilter: (source: string) => setState({ source, page: 1 }),
    setContactTypeFilter: (contactType: string) =>
      setState({ contactType, page: 1 }),
    setCreatedFrom: (createdFrom: Date | null) =>
      setState({ createdFrom, page: 1 }),
    setCreatedTo: (createdTo: Date | null) => setState({ createdTo, page: 1 }),
    setKeywordIds: (keywordIds: number[]) =>
      setState({
        keywordIds: keywordIds.length > 0 ? keywordIds.join(",") : null,
        page: 1,
      }),
    setCurrentPage: (page: number) => setState({ page }),
    setItemsPerPage: (itemsPerPage: number) =>
      setState({ itemsPerPage, page: 1 }),
    setSelectedSalesUserId: (value: string) =>
      setState({ assignedUserId: value === "all" ? null : value, page: 1 }),
    setSelectedSalesRegion: (value: string) =>
      setState({ assignedRegion: value === "all" ? null : value, page: 1 }),

    updateState: setState,
  };
}

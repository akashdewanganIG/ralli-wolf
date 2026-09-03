"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { useLeadManagementState } from "../hooks/use-lead-management-state";

interface LeadManagementContextType {
  activeTab: string;
  leadSearchQuery: string;
  setLeadSearchQuery: (value: string) => void;
  assignedLeadsSearchQuery: string;
  setAssignedLeadsSearchQuery: (value: string) => void;
  unassignedLeadsSearchQuery: string;
  setUnassignedLeadsSearchQuery: (value: string) => void;
  accountsSearchQuery: string;
  setAccountsSearchQuery: (value: string) => void;
  contactsSearchQuery: string;
  setContactsSearchQuery: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  sourceFilter: string;
  setSourceFilter: (value: string) => void;
  contactTypeFilter: string;
  setContactTypeFilter: (value: string) => void;
  createdFrom: Date | null;
  setCreatedFrom: (value: Date | null) => void;
  createdTo: Date | null;
  setCreatedTo: (value: Date | null) => void;
  keywordIds: number[];
  setKeywordIds: (value: number[]) => void;
  currentPage: number;
  setCurrentPage: (value: number) => void;
  itemsPerPage: number;
  setItemsPerPage: (value: number) => void;
  selectedSalesUserId: string;
  setSelectedSalesUserId: (value: string) => void;
  selectedSalesRegion: string;
  setSelectedSalesRegion: (value: string) => void;
}

const LeadManagementContext = createContext<
  LeadManagementContextType | undefined
>(undefined);

interface LeadManagementProviderProps {
  children: ReactNode;
}

export function LeadManagementProvider({
  children,
}: LeadManagementProviderProps) {
  const leadManagementState = useLeadManagementState();

  return (
    <LeadManagementContext.Provider value={leadManagementState}>
      {children}
    </LeadManagementContext.Provider>
  );
}

export function useLeadManagementContext() {
  const context = useContext(LeadManagementContext);
  if (context === undefined) {
    throw new Error(
      "useLeadManagementContext must be used within a LeadManagementProvider"
    );
  }
  return context;
}

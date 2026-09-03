import { useQuery } from "@tanstack/react-query";
import { analyticsService } from "../lib/api/services";

export const analyticsKeys = {
  all: ["analytics", "events"] as const,
  lists: () => [...analyticsKeys.all, "list"] as const,
  list: (params?: any) => [...analyticsKeys.lists(), params || {}] as const,
  details: () => [...analyticsKeys.all, "detail"] as const,
  detail: (id: number) => [...analyticsKeys.details(), id] as const,
  byCampaign: (id: number) => [...analyticsKeys.all, "campaign", id] as const,
  byContact: (id: number) => [...analyticsKeys.all, "contact", id] as const,
  byLead: (id: number) => [...analyticsKeys.all, "lead", id] as const,
};

export function useAnalytics(params?: {
  campaignId?: number;
  contactId?: number;
  leadId?: number;
  eventType?: string;
}) {
  return useQuery({
    queryKey: analyticsKeys.list(params),
    queryFn: () => analyticsService.getAllEvents(params),
  });
}

export function useAnalyticsByCampaign(campaignId: number) {
  return useQuery({
    queryKey: analyticsKeys.byCampaign(campaignId),
    queryFn: () => analyticsService.getEventsByCampaign(campaignId),
    enabled: !!campaignId,
  });
}

export function useAnalyticsByContact(contactId: number) {
  return useQuery({
    queryKey: analyticsKeys.byContact(contactId),
    queryFn: () => analyticsService.getEventsByContact(contactId),
    enabled: !!contactId,
  });
}

export function useAnalyticsByLead(leadId: number) {
  return useQuery({
    queryKey: analyticsKeys.byLead(leadId),
    queryFn: () => analyticsService.getEventsByLead(leadId),
    enabled: !!leadId,
  });
}

export function useAnalyticsEvent(id: number) {
  return useQuery({
    queryKey: analyticsKeys.detail(id),
    queryFn: () => analyticsService.getEventById(id),
    enabled: !!id,
  });
}

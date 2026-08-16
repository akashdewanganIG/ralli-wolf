import { useQuery } from "@tanstack/react-query";
import { leadService } from "../lib/api/services";
import { FormSubmission } from "../lib/api/types";

export const formSubmissionKeys = {
  all: ["formSubmissions"] as const,
  byLead: (leadId: number) =>
    [...formSubmissionKeys.all, "lead", leadId] as const,
};

export function useFormSubmissionsByLead(leadId: number) {
  return useQuery<FormSubmission[]>({
    queryKey: formSubmissionKeys.byLead(leadId),
    queryFn: () => leadService.getLeadFormSubmissions(leadId),
    enabled: !!leadId,
  });
}

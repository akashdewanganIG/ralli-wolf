import { toast } from "@/lib/toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { keywordService } from "../lib/api/services";

export const keywordKeys = {
  all: ["keywords"] as const,
  lists: () => [...keywordKeys.all, "list"] as const,
  list: (search?: string) => [...keywordKeys.lists(), search] as const,
  details: () => [...keywordKeys.all, "detail"] as const,
  detail: (id: number) => [...keywordKeys.details(), id] as const,
};

export function useKeywords(search?: string) {
  return useQuery({
    queryKey: keywordKeys.list(search),
    queryFn: async () => {
      const response = await keywordService.getAllKeywords(search);
      return response.data;
    },
  });
}

export function useKeyword(id: number) {
  return useQuery({
    queryKey: keywordKeys.detail(id),
    queryFn: async () => {
      const response = await keywordService.getKeywordById(id);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useSearchKeywords(query: string) {
  return useQuery({
    queryKey: keywordKeys.list(query),
    queryFn: async () => {
      const response = await keywordService.searchKeywords(query);
      return response.data;
    },
    enabled: query.length > 0,
  });
}

export function useCreateKeyword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const response = await keywordService.createKeyword(name);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keywordKeys.all });
      toast.success("Keyword created successfully");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to create keyword");
    },
  });
}

export function useDeleteKeyword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await keywordService.deleteKeyword(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keywordKeys.all });
      toast.success("Keyword deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to delete keyword");
    },
  });
}

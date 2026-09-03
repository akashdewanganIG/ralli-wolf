"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { segmentService } from "../lib/api/services";
import { SegmentPayload, SegmentResolveResponse } from "../lib/api/types";

export const segmentKeys = {
  all: ["segments"] as const,
  lists: () => [...segmentKeys.all, "list"] as const,
  list: () => [...segmentKeys.lists()] as const,
  detail: (id: number) => [...segmentKeys.all, id] as const,
  resolve: (id: number) => [...segmentKeys.detail(id), "resolve"] as const,
};

export function useSegments() {
  return useQuery({
    queryKey: segmentKeys.list(),
    queryFn: () => segmentService.list(),
    staleTime: 60 * 1000,
  });
}

export function useSegment(id: number) {
  return useQuery({
    queryKey: segmentKeys.detail(id),
    queryFn: () => segmentService.getById(id),
    enabled: !!id,
  });
}

export function useCreateSegment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SegmentPayload) => segmentService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: segmentKeys.list() });
    },
  });
}

export function useUpdateSegment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: SegmentPayload }) =>
      segmentService.update(id, payload),
    onSuccess: segment => {
      queryClient.invalidateQueries({ queryKey: segmentKeys.list() });
      queryClient.setQueryData(segmentKeys.detail(segment.id), segment);
    },
  });
}

export function useDeleteSegment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => segmentService.delete(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: segmentKeys.list() });
      queryClient.removeQueries({ queryKey: segmentKeys.detail(id) });
    },
  });
}

export function useResolveSegment(id: number, options?: { enabled?: boolean }) {
  return useQuery<SegmentResolveResponse>({
    queryKey: segmentKeys.resolve(id),
    queryFn: () => segmentService.resolve(id),
    enabled: !!id && (options?.enabled ?? true),
    staleTime: 0,
  });
}

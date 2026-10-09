import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createDemoRepository } from "./workspace";
import { apiMode, apiRepository } from "./api";
import type { ReviewInput } from "../domain/models";

// This is the only browser storage adapter. Feature components depend on the repository contract.
export const repository = apiMode
  ? apiRepository
  : createDemoRepository({
      getItem: (key) => window.localStorage.getItem(key),
      setItem: (key, value) => window.localStorage.setItem(key, value),
      removeItem: (key) => window.localStorage.removeItem(key),
    });
export const workspaceKey = ["workspace"] as const;
export function useWorkspace() {
  return useQuery({
    queryKey: workspaceKey,
    queryFn: () => repository.getWorkspace(),
    refetchInterval: apiMode ? 10000 : false,
  });
}
export function useReview() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ReviewInput) => repository.review(input),
    onSuccess: () => client.invalidateQueries({ queryKey: workspaceKey }),
  });
}
export function useAdvance() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      repository.advance(id, version),
    onSuccess: () => client.invalidateQueries({ queryKey: workspaceKey }),
  });
}

import { useQuery } from "@tanstack/react-query";
import { api, apiMode } from "../../data/api";

export function usePlatformStatus() {
  return useQuery({
    queryKey: ["platform-status"],
    queryFn: () =>
      api<{
        processing: string;
        expiresAt?: string;
        catalogVersion?: string;
        sharedWorkspace: boolean;
        maxFiles?: number;
      }>("/platform/status"),
    refetchInterval: 15000,
    enabled: apiMode,
  });
}

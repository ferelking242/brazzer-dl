import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DownloadJob, DownloadStats, ServiceHealth } from "../../../src/shared/types";

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `La requête a échoué (${response.status}).`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const downloadKeys = {
  jobs: ["jobs"] as const,
  stats: ["stats"] as const,
  health: ["health"] as const,
};

export function useJobs() {
  return useQuery({
    queryKey: downloadKeys.jobs,
    queryFn: () => apiRequest<DownloadJob[]>("/api/jobs"),
    refetchInterval: 3000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useDownloadStats() {
  return useQuery({
    queryKey: downloadKeys.stats,
    queryFn: () => apiRequest<DownloadStats>("/api/stats"),
    refetchInterval: 8000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useServiceHealth() {
  return useQuery({
    queryKey: downloadKeys.health,
    queryFn: () => apiRequest<ServiceHealth>("/api/health"),
    refetchInterval: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useCreateDownload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (url: string) =>
      apiRequest<DownloadJob>("/api/jobs", {
        method: "POST",
        body: JSON.stringify({ url }),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: downloadKeys.jobs }),
        queryClient.invalidateQueries({ queryKey: downloadKeys.stats }),
      ]);
    },
  });
}

function useJobAction(action: "pause" | "resume" | "cancel") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<DownloadJob>(`/api/jobs/${id}/${action}`, { method: "POST" }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: downloadKeys.jobs }),
        queryClient.invalidateQueries({ queryKey: downloadKeys.stats }),
      ]);
    },
  });
}

export function usePauseDownload() {
  return useJobAction("pause");
}

export function useResumeDownload() {
  return useJobAction("resume");
}

export function useCancelDownload() {
  return useJobAction("cancel");
}

export function useRemoveDownload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<void>(`/api/jobs/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: downloadKeys.jobs }),
        queryClient.invalidateQueries({ queryKey: downloadKeys.stats }),
      ]);
    },
  });
}

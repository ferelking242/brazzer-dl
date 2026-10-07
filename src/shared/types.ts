export type JobStatus =
  | "queued"
  | "downloading"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export interface DownloadJob {
  id: string;
  url: string;
  fileName: string;
  sourceHost: string;
  status: JobStatus;
  downloadedBytes: number;
  totalBytes: number | null;
  speedBytesPerSecond: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  downloadUrl: string | null;
}

export interface DownloadStats {
  activeCount: number;
  queuedCount: number;
  completedCount: number;
  failedCount: number;
  totalJobs: number;
  totalSavedBytes: number;
}

export interface ServiceHealth {
  ok: boolean;
  service: string;
  siteIntegration: "not-connected";
  downloadMode: "public-links-and-hls";
}

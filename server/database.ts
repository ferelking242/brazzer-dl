import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { DownloadJob, DownloadStats, JobStatus } from "../src/shared/types";

const dataDir = path.resolve(process.env.DATA_DIR ?? "data");
mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "downloads.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    source_host TEXT NOT NULL,
    status TEXT NOT NULL,
    downloaded_bytes INTEGER NOT NULL DEFAULT 0,
    total_bytes INTEGER,
    speed_bytes_per_second INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT
  );
  CREATE INDEX IF NOT EXISTS jobs_status_created ON jobs(status, created_at);
`);

type JobRow = {
  id: string;
  url: string;
  file_name: string;
  source_host: string;
  status: JobStatus;
  downloaded_bytes: number;
  total_bytes: number | null;
  speed_bytes_per_second: number;
  error: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

function toJob(row: JobRow): DownloadJob {
  return {
    id: row.id,
    url: row.url,
    fileName: row.file_name,
    sourceHost: row.source_host,
    status: row.status,
    downloadedBytes: row.downloaded_bytes,
    totalBytes: row.total_bytes,
    speedBytesPerSecond: row.speed_bytes_per_second,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    downloadUrl: row.status === "completed" ? `/api/jobs/${row.id}/file` : null,
  };
}

const selectById = db.prepare("SELECT * FROM jobs WHERE id = ?");
const selectAll = db.prepare("SELECT * FROM jobs ORDER BY created_at DESC");
const selectNextQueued = db.prepare("SELECT * FROM jobs WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1");

export const jobsRepository = {
  create(job: {
    id: string;
    url: string;
    fileName: string;
    sourceHost: string;
  }): DownloadJob {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO jobs (id, url, file_name, source_host, status, created_at, updated_at)
      VALUES (@id, @url, @fileName, @sourceHost, 'queued', @now, @now)
    `).run({ ...job, now });
    return this.get(job.id)!;
  },

  get(id: string): DownloadJob | null {
    const row = selectById.get(id) as JobRow | undefined;
    return row ? toJob(row) : null;
  },

  list(): DownloadJob[] {
    return (selectAll.all() as JobRow[]).map(toJob);
  },

  nextQueued(): DownloadJob | null {
    const row = selectNextQueued.get() as JobRow | undefined;
    return row ? toJob(row) : null;
  },

  hasQueued(): boolean {
    return Boolean(selectNextQueued.get());
  },

  update(
    id: string,
    patch: Partial<{
      status: JobStatus;
      downloadedBytes: number;
      totalBytes: number | null;
      speedBytesPerSecond: number;
      error: string | null;
      completedAt: string | null;
    }>,
  ): DownloadJob | null {
    const current = this.get(id);
    if (!current) return null;
    const next = {
      status: patch.status ?? current.status,
      downloadedBytes: patch.downloadedBytes ?? current.downloadedBytes,
      totalBytes: patch.totalBytes === undefined ? current.totalBytes : patch.totalBytes,
      speedBytesPerSecond: patch.speedBytesPerSecond ?? current.speedBytesPerSecond,
      error: patch.error === undefined ? current.error : patch.error,
      completedAt: patch.completedAt === undefined ? current.completedAt : patch.completedAt,
      updatedAt: new Date().toISOString(),
    };
    db.prepare(`
      UPDATE jobs
      SET status = @status,
          downloaded_bytes = @downloadedBytes,
          total_bytes = @totalBytes,
          speed_bytes_per_second = @speedBytesPerSecond,
          error = @error,
          completed_at = @completedAt,
          updated_at = @updatedAt
      WHERE id = @id
    `).run({ ...next, id });
    return this.get(id);
  },

  recoverInterrupted(): void {
    db.prepare(`
      UPDATE jobs
      SET status = 'paused', speed_bytes_per_second = 0,
          error = 'Paused after the app restarted.', updated_at = ?
      WHERE status = 'downloading'
    `).run(new Date().toISOString());
  },

  stats(): DownloadStats {
    const rows = db.prepare(`
      SELECT status, COUNT(*) AS count, SUM(CASE WHEN status = 'completed' THEN downloaded_bytes ELSE 0 END) AS saved
      FROM jobs
      GROUP BY status
    `).all() as Array<{ status: JobStatus; count: number; saved: number | null }>;
    const byStatus = new Map(rows.map((row) => [row.status, row.count]));
    return {
      activeCount: byStatus.get("downloading") ?? 0,
      queuedCount: byStatus.get("queued") ?? 0,
      completedCount: byStatus.get("completed") ?? 0,
      failedCount: byStatus.get("failed") ?? 0,
      totalJobs: rows.reduce((sum, row) => sum + row.count, 0),
      totalSavedBytes: rows.reduce((sum, row) => sum + (row.saved ?? 0), 0),
    };
  },

  remove(id: string): DownloadJob | null {
    const job = this.get(id);
    if (job) db.prepare("DELETE FROM jobs WHERE id = ?").run(id);
    return job;
  },
};

export const storageDirectory = path.resolve(process.env.DOWNLOAD_DIR ?? path.join(dataDir, "media"));
mkdirSync(storageDirectory, { recursive: true });

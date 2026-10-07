import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowDownToLine,
  Check,
  CircleAlert,
  FileVideo2,
  HardDrive,
  LoaderCircle,
  LockKeyhole,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import {
  useCancelDownload,
  useCreateDownload,
  useDownloadStats,
  useJobs,
  usePauseDownload,
  useRemoveDownload,
  useResumeDownload,
} from "../lib/api";
import type { DownloadJob, JobStatus } from "../../../src/shared/types";

export type LibraryFilter = "all" | "queue" | "saved" | "attention";

const FILTERS: { id: LibraryFilter; label: string }[] = [
  { id: "all", label: "Tout" },
  { id: "queue", label: "En file" },
  { id: "saved", label: "Enregistrés" },
  { id: "attention", label: "À vérifier" },
];

const STATUS_LABEL: Record<JobStatus, string> = {
  queued: "En attente",
  downloading: "Téléchargement",
  paused: "En pause",
  completed: "Enregistré",
  failed: "Échec",
  cancelled: "Annulé",
};

const STATUS_CLASS: Record<JobStatus, string> = {
  queued: "status-queued",
  downloading: "status-downloading",
  paused: "status-paused",
  completed: "status-completed",
  failed: "status-failed",
  cancelled: "status-cancelled",
};

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unitIndex;
  return `${value.toFixed(unitIndex === 0 || value >= 100 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatSpeed(bytesPerSecond: number): string {
  return bytesPerSecond > 0 ? `${formatBytes(bytesPerSecond)}/s` : "En attente de données";
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date indisponible";
  return new Intl.DateTimeFormat("fr-FR", { month: "short", day: "numeric" }).format(date);
}

function getProgress(job: DownloadJob): number {
  if (job.status === "completed") return 100;
  if (!job.totalBytes || job.totalBytes <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((job.downloadedBytes / job.totalBytes) * 100)));
}

function getProgressText(job: DownloadJob): string {
  if (job.status === "queued") return "En attente dans la file";
  if (job.status === "completed") return formatBytes(job.totalBytes ?? job.downloadedBytes);
  if (job.totalBytes && job.totalBytes > 0) {
    return `${formatBytes(job.downloadedBytes)} / ${formatBytes(job.totalBytes)}`;
  }
  return formatBytes(job.downloadedBytes);
}

function isQueueStatus(status: JobStatus): boolean {
  return status === "queued" || status === "downloading" || status === "paused";
}

function StatBlock({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: ReactNode }) {
  return (
    <div className="stat-block">
      <div className="stat-head">
        <span>{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-detail">{detail}</div>
    </div>
  );
}

function JobRow({
  job,
  onPause,
  onResume,
  onCancel,
  onRemove,
  pendingAction,
}: {
  job: DownloadJob;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onRemove: (job: DownloadJob) => void;
  pendingAction: string | null;
}) {
  const progress = getProgress(job);
  const canPause = job.status === "downloading";
  const canResume = job.status === "paused";
  const canCancel = job.status === "queued" || job.status === "downloading" || job.status === "paused";
  const actionBusy = pendingAction === job.id;

  return (
    <article className="job-row">
      <div className="file-cell">
        <span className="file-mark" aria-hidden="true"><FileVideo2 size={17} strokeWidth={1.8} /></span>
        <div className="file-copy">
          <div className="file-name" title={job.fileName}>{job.fileName || "Fichier vidéo sans nom"}</div>
          <div className="file-meta">
            <span>{formatDate(job.createdAt)}</span><span className="meta-sep" />
            <span>{formatBytes(job.totalBytes ?? job.downloadedBytes)}</span>
          </div>
          {job.error && <div className="inline-error">{job.error}</div>}
        </div>
      </div>

      <div className="job-source" title={job.sourceHost || "Source indisponible"}>
        {job.sourceHost || "Source inconnue"}
      </div>

      <div className="progress-cell">
        <div className="progress-label">
          <span>{getProgressText(job)}</span>
          <span>{job.totalBytes ? `${progress}%` : job.status === "completed" ? "100%" : "—"}</span>
        </div>
        <div
          className="progress-track"
          role="progressbar"
          aria-label={`Progression du téléchargement de ${job.fileName}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <div className={`progress-fill ${job.status}`} style={{ width: `${progress}%` }} />
        </div>
        {job.status === "downloading" && <div className="speed-note">{formatSpeed(job.speedBytesPerSecond)}</div>}
      </div>

      <div className="status-cell">
        <span className={`status-badge ${STATUS_CLASS[job.status]}`}>{STATUS_LABEL[job.status]}</span>
      </div>
      <span className={`status-badge mobile-status ${STATUS_CLASS[job.status]}`}>{STATUS_LABEL[job.status]}</span>

      <div className="job-actions">
        {job.status === "completed" && job.downloadUrl && (
          <a
            className="icon-button"
            href={job.downloadUrl}
            download
            aria-label={`Télécharger le fichier enregistré ${job.fileName}`}
            title="Télécharger le fichier"
          >
            <ArrowDownToLine size={16} />
          </a>
        )}
        {canPause && (
          <button className="icon-button" type="button" aria-label={`Mettre en pause ${job.fileName}`} title="Mettre en pause" disabled={actionBusy} onClick={() => onPause(job.id)}>
            {actionBusy ? <LoaderCircle className="spin" size={16} /> : <Pause size={16} />}
          </button>
        )}
        {canResume && (
          <button className="icon-button" type="button" aria-label={`Reprendre ${job.fileName}`} title="Reprendre" disabled={actionBusy} onClick={() => onResume(job.id)}>
            {actionBusy ? <LoaderCircle className="spin" size={16} /> : <Play size={16} />}
          </button>
        )}
        {canCancel && (
          <button className="icon-button danger" type="button" aria-label={`Annuler ${job.fileName}`} title="Annuler le téléchargement" disabled={actionBusy} onClick={() => onCancel(job.id)}>
            <XCircle size={16} />
          </button>
        )}
        {!canCancel && (
          <button className="icon-button danger" type="button" aria-label={`Retirer ${job.fileName} de la bibliothèque`} title="Retirer de la bibliothèque" onClick={() => onRemove(job)}>
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </article>
  );
}

export function LibraryPage({
  filter,
  onFilterChange,
  onOpenSettings,
}: {
  filter: LibraryFilter;
  onFilterChange: (filter: LibraryFilter) => void;
  onOpenSettings: () => void;
}) {
  const jobsQuery = useJobs();
  const statsQuery = useDownloadStats();
  const createDownload = useCreateDownload();
  const pauseDownload = usePauseDownload();
  const resumeDownload = useResumeDownload();
  const cancelDownload = useCancelDownload();
  const removeDownload = useRemoveDownload();

  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [formError, setFormError] = useState("");

  const jobs = jobsQuery.data ?? [];
  const stats = statsQuery.data;
  const visibleJobs = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return jobs
      .filter((job) => {
        if (filter === "queue") return isQueueStatus(job.status);
        if (filter === "saved") return job.status === "completed";
        if (filter === "attention") return job.status === "failed" || job.status === "cancelled";
        return true;
      })
      .filter((job) => !normalizedSearch || `${job.fileName} ${job.sourceHost}`.toLocaleLowerCase().includes(normalizedSearch))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [jobs, filter, search]);

  const countFor = (key: LibraryFilter) => {
    if (key === "all") return jobs.length;
    if (key === "queue") return jobs.filter((job) => isQueueStatus(job.status)).length;
    if (key === "saved") return jobs.filter((job) => job.status === "completed").length;
    return jobs.filter((job) => job.status === "failed" || job.status === "cancelled").length;
  };

  const activeMutationError =
    pauseDownload.error?.message ??
    resumeDownload.error?.message ??
    cancelDownload.error?.message ??
    removeDownload.error?.message ??
    null;

  const pendingJobId =
    (pauseDownload.isPending ? pauseDownload.variables : undefined) ??
    (resumeDownload.isPending ? resumeDownload.variables : undefined) ??
    (cancelDownload.isPending ? cancelDownload.variables : undefined) ??
    null;

  async function handleAddSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url.trim());
    } catch {
      setFormError("Saisissez l’adresse HTTPS complète d’un fichier vidéo public.");
      return;
    }
    if (parsedUrl.protocol !== "https:") {
      setFormError("Seuls les liens HTTPS directs sont acceptés.");
      return;
    }
    try {
      await createDownload.mutateAsync(url.trim());
      setUrl("");
      setAddOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Impossible d’ajouter le téléchargement.");
    }
  }

  function handleRemove(job: DownloadJob) {
    if (window.confirm(`Retirer « ${job.fileName || "ce fichier"} » de la bibliothèque ?`)) {
      removeDownload.mutate(job.id);
    }
  }

  const apiLoading = jobsQuery.isLoading && !jobsQuery.data;

  return (
    <>
      <section className="page-intro">
        <div>
          <div className="eyebrow">Votre espace privé</div>
          <h1 className="page-title">Bibliothèque vidéo</h1>
          <p className="page-subtitle">Tous vos médias rassemblés dans un espace calme et privé.</p>
        </div>
        <Dialog.Root open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) setFormError(""); }}>
          <Dialog.Trigger asChild>
            <button className="button button-primary" type="button"><Plus size={16} />Ajouter</button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay" />
            <Dialog.Content className="dialog-content" aria-describedby="add-download-description">
              <div className="dialog-top">
                <div>
                  <Dialog.Title className="dialog-title">Ajouter un média</Dialog.Title>
                  <Dialog.Description id="add-download-description" className="dialog-description">
                    Collez le lien HTTPS public d’un fichier vidéo ou d’un flux HLS que vous êtes autorisé à enregistrer.
                  </Dialog.Description>
                </div>
                <Dialog.Close asChild>
                  <button className="dialog-close" type="button" aria-label="Fermer la fenêtre"><X size={17} /></button>
                </Dialog.Close>
              </div>
              <form onSubmit={handleAddSubmit}>
                <label className="form-label" htmlFor="download-url">Lien direct ou flux HLS</label>
                <input
                  autoFocus
                  id="download-url"
                  className="url-input"
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  placeholder="https://files.example.org/video.mp4 ou .../master.m3u8"
                  value={url}
                  onChange={(event) => { setUrl(event.target.value); setFormError(""); }}
                  disabled={createDownload.isPending}
                  required
                />
                <div className="form-hint"><LockKeyhole size={13} />Fichier vidéo public ou playlist HLS (.m3u8), sans authentification.</div>
                <div className="dialog-note">
                  <CircleAlert size={14} />
                  <span>Les flux HLS sont téléchargés segment par segment puis assemblés en MP4. Les liens protégés par DRM ou exigeant une authentification ne sont pas pris en charge.</span>
                </div>
                {formError && <p className="form-error" role="alert">{formError}</p>}
                <div className="dialog-actions">
                  <Dialog.Close asChild>
                    <button className="button button-quiet" type="button" disabled={createDownload.isPending}>Annuler</button>
                  </Dialog.Close>
                  <button className="button button-primary" type="submit" disabled={createDownload.isPending || !url.trim()}>
                    {createDownload.isPending ? <><LoaderCircle className="spin" size={15} />Ajout…</> : <><Plus size={15} />Ajouter à la file</>}
                  </button>
                </div>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </section>

      <section className="stats-grid" aria-label="Résumé de la bibliothèque">
        <StatBlock label="En cours" value={stats ? String(stats.activeCount) : "—"} detail={stats ? `${stats.queuedCount} en attente` : statsQuery.isError ? "Statistiques indisponibles" : "Chargement des totaux"} icon={<Zap size={14} />} />
        <StatBlock label="Médias enregistrés" value={stats ? String(stats.completedCount) : "—"} detail={stats ? `${stats.failedCount} à vérifier` : statsQuery.isError ? "Statistiques indisponibles" : "Chargement des totaux"} icon={<Check size={14} />} />
        <StatBlock label="Espace utilisé" value={stats ? formatBytes(stats.totalSavedBytes) : "—"} detail="Total des médias terminés" icon={<HardDrive size={14} />} />
        <StatBlock label="Éléments" value={stats ? String(stats.totalJobs) : "—"} detail="Dans cette bibliothèque" icon={<FileVideo2 size={14} />} />
      </section>

      <section className="access-notice" aria-label="Sources connectées">
        <ShieldCheck className="notice-icon" size={18} />
        <div className="notice-copy">
          <div className="notice-title">Bibliothèque locale, comptes centralisés</div>
          <p className="notice-text">
            Vos médias restent sur cet appareil. Connectez vos comptes de fournisseurs dans Réglages pour préparer l’intégration ; le moteur accepte les liens vidéo HTTPS publics et les flux HLS publics.
          </p>
        </div>
        <button className="notice-link" type="button" onClick={onOpenSettings}>
          Gérer les fournisseurs
        </button>
      </section>

      <section aria-labelledby="library-heading">
        <div className="section-head">
          <div>
            <h2 className="section-title" id="library-heading">Votre bibliothèque</h2>
            <p className="section-subtitle">{jobsQuery.isError ? "Impossible d’actualiser la bibliothèque." : `${visibleJobs.length} élément${visibleJobs.length === 1 ? "" : "s"} affiché${visibleJobs.length === 1 ? "" : "s"}`}</p>
          </div>
          <div className="library-tools">
            <label className="search-box">
              <Search size={15} />
              <input type="search" aria-label="Rechercher dans la bibliothèque" placeholder="Rechercher un média ou une source" value={search} onChange={(event) => setSearch(event.target.value)} />
            </label>
          </div>
        </div>

        <div className="filter-tabs" role="tablist" aria-label="Filtrer la bibliothèque">
          {FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={filter === option.id}
              className={`filter-tab ${filter === option.id ? "selected" : ""}`}
              onClick={() => onFilterChange(option.id)}
            >
              {option.label}<span className="filter-count">{apiLoading ? "—" : countFor(option.id)}</span>
            </button>
          ))}
        </div>

        {activeMutationError && <div className="mutation-alert" role="alert">{activeMutationError}</div>}

        {apiLoading ? (
          <div className="loading-state" aria-label="Chargement de la bibliothèque">
            <div className="skeleton-row" />
            <div className="skeleton-row" />
            <div className="skeleton-row" />
          </div>
        ) : jobsQuery.isError && !jobsQuery.data ? (
          <div className="error-state">
            <div className="empty-icon"><CircleAlert size={20} /></div>
            <h3 className="empty-title">La bibliothèque est indisponible</h3>
            <p className="empty-copy">{jobsQuery.error instanceof Error ? jobsQuery.error.message : "Un problème est survenu au chargement des téléchargements."}</p>
            <button className="button button-quiet" type="button" onClick={() => { void jobsQuery.refetch(); void statsQuery.refetch(); }}>
              <RefreshCw size={14} />Réessayer
            </button>
          </div>
        ) : visibleJobs.length > 0 ? (
          <div className="job-list">
            <div className="list-heading"><span>Média</span><span>Source</span><span>Progression</span><span>État</span><span /></div>
            {visibleJobs.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                onPause={(id) => pauseDownload.mutate(id)}
                onResume={(id) => resumeDownload.mutate(id)}
                onCancel={(id) => cancelDownload.mutate(id)}
                onRemove={handleRemove}
                pendingAction={pendingJobId ?? null}
              />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><FileVideo2 size={21} /></div>
            <h3 className="empty-title">Votre bibliothèque est vide</h3>
            <p className="empty-copy">Ajoutez le lien direct d’un média public pour commencer votre collection.</p>
            <button className="button button-primary" type="button" onClick={() => setAddOpen(true)}><Plus size={15} />Ajouter un média</button>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon"><Search size={20} /></div>
            <h3 className="empty-title">Aucun résultat</h3>
            <p className="empty-copy">Essayez un autre filtre ou un terme de recherche plus court. Vos médias restent dans la bibliothèque.</p>
            <button className="button button-quiet" type="button" onClick={() => { setSearch(""); onFilterChange("all"); }}>Effacer les filtres</button>
          </div>
        )}
      </section>

      <div className="sidebar-foot mobile-footer">Espace vidéo privé · bibliothèque locale</div>
    </>
  );
}

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowDownToLine,
  Check,
  CircleAlert,
  FileVideo2,
  HardDrive,
  Library,
  LoaderCircle,
  LockKeyhole,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  Trash2,
  UserRound,
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
  useServiceHealth,
} from "./lib/api";
import type { DownloadJob, JobStatus } from "../../src/shared/types";

type View = "library" | "settings";
type FilterKey = "all" | "queue" | "saved" | "attention";

const FILTERS: { id: FilterKey; label: string }[] = [
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
  return bytesPerSecond > 0 ? `${formatBytes(bytesPerSecond)}/s` : "";
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
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

function StatBlock({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
}) {
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
          aria-label={`Progression de ${job.fileName}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <div className={`progress-fill ${job.status}`} style={{ width: `${progress}%` }} />
        </div>
        <div className={`speed-note ${job.status === "downloading" ? "" : "empty"}`}>
          {formatSpeed(job.speedBytesPerSecond) || "\u00A0"}
        </div>
      </div>

      <div className="status-cell">
        <span className={`status-badge ${STATUS_CLASS[job.status]}`}>{STATUS_LABEL[job.status]}</span>
      </div>

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

export default function App() {
  const jobsQuery = useJobs();
  const statsQuery = useDownloadStats();
  const healthQuery = useServiceHealth();
  const createDownload = useCreateDownload();
  const pauseDownload = usePauseDownload();
  const resumeDownload = useResumeDownload();
  const cancelDownload = useCancelDownload();
  const removeDownload = useRemoveDownload();

  const [view, setView] = useState<View>("library");
  const [filter, setFilter] = useState<FilterKey>("all");
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

  const countFor = (key: FilterKey) => {
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
    try {
      await createDownload.mutateAsync(url.trim());
      setUrl("");
      setAddOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Impossible d’ajouter ce téléchargement.");
    }
  }

  function handleRemove(job: DownloadJob) {
    if (window.confirm(`Retirer « ${job.fileName || "ce fichier"} » de la bibliothèque ?`)) {
      removeDownload.mutate(job.id);
    }
  }

  const serviceOnline = !healthQuery.isLoading && !healthQuery.isError && !!healthQuery.data?.ok;
  const healthLabel = healthQuery.isLoading
    ? "Vérification…"
    : serviceOnline
      ? "Service prêt"
      : "Service indisponible";
  const apiLoading = jobsQuery.isLoading && !jobsQuery.data;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-symbol"><Library size={17} strokeWidth={1.8} /></div>
          <div className="brand-copy">
            <div className="brand-name">Stillroom</div>
            <div className="brand-caption">Espace vidéo privé</div>
          </div>
        </div>
        <div className="topbar-right">
          <span className="health-pill" title="État du service">
            <span className={`health-dot ${serviceOnline ? "" : "offline"}`} />
            {healthLabel}
          </span>
          <button
            type="button"
            className={`top-icon-button ${view === "settings" ? "active" : ""}`}
            aria-label="Ouvrir les paramètres"
            title="Paramètres"
            onClick={() => setView(view === "settings" ? "library" : "settings")}
          >
            <SettingsIcon size={16} />
          </button>
          <button type="button" className="top-icon-button" aria-label="Compte local" title="Compte local (aucun compte requis)">
            <UserRound size={16} />
          </button>
        </div>
      </header>

      <main className="main-area">
        {view === "library" ? (
          <>
            <section className="page-intro">
              <div>
                <div className="eyebrow">Votre espace privé</div>
                <h1 className="page-title">Bibliothèque vidéo</h1>
                <p className="page-subtitle">Vos fichiers vidéo directs, téléchargés avec autorisation.</p>
              </div>
            </section>

            <section className="stats-grid" aria-label="Résumé de la bibliothèque">
              <StatBlock label="En cours" value={stats ? String(stats.activeCount) : "—"} detail={stats ? `${stats.queuedCount} en attente` : statsQuery.isError ? "Statistiques indisponibles" : "Chargement…"} icon={<Zap size={14} />} />
              <StatBlock label="Fichiers enregistrés" value={stats ? String(stats.completedCount) : "—"} detail={stats ? `${stats.failedCount} à vérifier` : statsQuery.isError ? "Statistiques indisponibles" : "Chargement…"} icon={<Check size={14} />} />
              <StatBlock label="Espace utilisé" value={stats ? formatBytes(stats.totalSavedBytes) : "—"} detail="Total des fichiers terminés" icon={<HardDrive size={14} />} />
              <StatBlock label="Téléchargements" value={stats ? String(stats.totalJobs) : "—"} detail="Dans cette bibliothèque" icon={<FileVideo2 size={14} />} />
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
                    <input type="search" aria-label="Rechercher dans la bibliothèque" placeholder="Rechercher un fichier ou une source" value={search} onChange={(event) => setSearch(event.target.value)} />
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
                    onClick={() => setFilter(option.id)}
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
                  <button className="button button-quiet" type="button" onClick={() => { void jobsQuery.refetch(); void statsQuery.refetch(); void healthQuery.refetch(); }}>
                    <RefreshCw size={14} />Réessayer
                  </button>
                </div>
              ) : visibleJobs.length > 0 ? (
                <div className="job-list">
                  <div className="list-heading"><span>Fichier</span><span>Source</span><span>Progression</span><span>État</span><span /></div>
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
                  <p className="empty-copy">Ajoutez le lien direct d’un fichier vidéo public. Ce gestionnaire ne se connecte pas aux sites et ne traite pas les flux protégés.</p>
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon"><Search size={20} /></div>
                  <h3 className="empty-title">Aucun résultat</h3>
                  <p className="empty-copy">Essayez un autre filtre ou un terme de recherche plus court.</p>
                  <button className="button button-quiet" type="button" onClick={() => { setSearch(""); setFilter("all"); }}>Effacer les filtres</button>
                </div>
              )}
            </section>
          </>
        ) : (
          <section className="settings-view" aria-labelledby="settings-heading">
            <div className="eyebrow">Étobre</div>
            <h1 className="page-title" id="settings-heading">Paramètres</h1>
            <p className="page-subtitle">Stockage, règles de téléchargement et confidentialité.</p>

            <div className="settings-grid">
              <div className="settings-card">
                <div className="settings-head"><HardDrive size={16} />Stockage local</div>
                <div className="settings-row"><span>Emplacement des fichiers</span><span className="settings-value mono">data/media</span></div>
                <div className="settings-row"><span>Base de données</span><span className="settings-value mono">data/downloads.sqlite</span></div>
                <div className="settings-row"><span>Espace utilisé</span><span className="settings-value">{stats ? formatBytes(stats.totalSavedBytes) : "—"}</span></div>
              </div>

              <div className="settings-card">
                <div className="settings-head"><FileVideo2 size={16} />Règles de téléchargement</div>
                <div className="settings-row"><span>Concurrence</span><span className="settings-value">1 téléchargement à la fois</span></div>
                <div className="settings-row"><span>Taille maximale</span><span className="settings-value">5 Go par fichier</span></div>
                <div className="settings-row"><span>Reprise partielle</span><span className="settings-value">Activée (requêtes Range)</span></div>
              </div>

              <div className="settings-card">
                <div className="settings-head"><ShieldCheck size={16} />Confidentialité</div>
                <div className="settings-row"><span>Compte</span><span className="settings-value">Local, aucun compte requis</span></div>
                <div className="settings-row"><span>Connexion aux sites</span><span className="settings-value">Aucune, pas de cookies ni d’identifiants</span></div>
                <div className="settings-row"><span>Sources acceptées</span><span className="settings-value">Liens HTTPS directs publics</span></div>
              </div>

              <div className="settings-card">
                <div className="settings-head"><LockKeyhole size={16} />État du service</div>
                <div className="settings-row"><span>API locale</span><span className={`settings-value ${serviceOnline ? "ok" : "ko"}`}>{healthLabel}</span></div>
                <div className="settings-row"><span>Mode de téléchargement</span><span className="settings-value">Liens directs uniquement</span></div>
                <div className="settings-row"><span>File d’attente</span><span className="settings-value">{stats ? `${stats.activeCount} en cours, ${stats.queuedCount} en attente` : "—"}</span></div>
              </div>
            </div>
          </section>
        )}
      </main>

      <Dialog.Root open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) setFormError(""); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog-content" aria-describedby="add-download-description">
            <div className="dialog-top">
              <div>
                <Dialog.Title className="dialog-title">Ajouter un fichier direct</Dialog.Title>
                <Dialog.Description id="add-download-description" className="dialog-description">
                  Collez le lien HTTPS public d’un fichier vidéo que vous êtes autorisé à télécharger.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button className="dialog-close" type="button" aria-label="Fermer la fenêtre"><X size={17} /></button>
              </Dialog.Close>
            </div>
            <form onSubmit={handleAddSubmit}>
              <label className="form-label" htmlFor="download-url">Lien direct vers la vidéo</label>
              <input
                autoFocus
                id="download-url"
                className="url-input"
                type="url"
                inputMode="url"
                autoComplete="url"
                placeholder="https://files.example.org/video.mp4"
                value={url}
                onChange={(event) => { setUrl(event.target.value); setFormError(""); }}
                disabled={createDownload.isPending}
                required
              />
              <div className="form-hint"><LockKeyhole size={13} />Le lien doit viser directement un fichier vidéo public, sans authentification.</div>
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

      <nav className="dock" aria-label="Barre d’actions flottante">
        <button
          type="button"
          className={`dock-item ${view === "library" && filter === "all" ? "active" : ""}`}
          aria-label="Bibliothèque complète"
          onClick={() => { setView("library"); setFilter("all"); }}
        >
          <Library size={19} /><span>Bibliothèque</span>
        </button>
        <button
          type="button"
          className={`dock-item ${view === "library" && filter === "queue" ? "active" : ""}`}
          aria-label="Téléchargements en cours"
          onClick={() => { setView("library"); setFilter("queue"); }}
        >
          <Zap size={19} /><span>File</span>
        </button>
        <button
          type="button"
          className="dock-item dock-add"
          aria-label="Ajouter un téléchargement"
          onClick={() => setAddOpen(true)}
        >
          <Plus size={21} />
        </button>
        <button
          type="button"
          className={`dock-item ${view === "library" && filter === "saved" ? "active" : ""}`}
          aria-label="Fichiers enregistrés"
          onClick={() => { setView("library"); setFilter("saved"); }}
        >
          <HardDrive size={19} /><span>Enregistrés</span>
        </button>
        <button
          type="button"
          className={`dock-item ${view === "settings" ? "active" : ""}`}
          aria-label="Paramètres"
          onClick={() => setView("settings")}
        >
          <SettingsIcon size={19} /><span>Paramètres</span>
        </button>
      </nav>
    </div>
  );
}

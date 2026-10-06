import { useState } from "react";
import { CircleAlert, Library, UserRound } from "lucide-react";
import { Dock, type ViewKey } from "./components/Dock";
import { LibraryPage, type LibraryFilter } from "./pages/LibraryPage";
import { SettingsPage } from "./pages/SettingsPage";
import { AccountPage } from "./pages/AccountPage";
import { SessionProvider, useSession } from "./lib/session";
import { useJobs, useServiceHealth } from "./lib/api";

const VIEW_LABEL: Record<ViewKey, string> = {
  library: "Bibliothèque",
  settings: "Réglages",
  account: "Compte",
};

function AppShell() {
  const [view, setView] = useState<ViewKey>("library");
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const jobsQuery = useJobs();
  const healthQuery = useServiceHealth();
  const { account, connectedCount } = useSession();

  const healthLabel = healthQuery.isLoading
    ? "Vérification du service"
    : healthQuery.isError || !healthQuery.data?.ok
      ? "Service indisponible"
      : "Service prêt";
  const serviceOnline = !healthQuery.isLoading && !healthQuery.isError && !!healthQuery.data?.ok;
  const totalJobs = jobsQuery.data?.length;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <button className="brand-lockup" type="button" onClick={() => setView("library")} aria-label="Retour à la bibliothèque">
            <span className="brand-symbol"><Library size={19} strokeWidth={1.7} /></span>
            <span className="brand-copy">
              <span className="brand-name">brazzer-dl</span>
              <span className="brand-caption">Bibliothèque privée</span>
            </span>
          </button>
          <div className="breadcrumb"><span>Espace de travail</span><span>/</span><strong>{VIEW_LABEL[view]}</strong></div>
        </div>
        <div className="topbar-right">
          <span className="top-date">
            {new Intl.DateTimeFormat("fr-FR", { weekday: "short", month: "short", day: "numeric" }).format(new Date())}
          </span>
          <span className="health-pill" title={healthQuery.error instanceof Error ? healthQuery.error.message : "État du service"}>
            <span className={`health-dot ${serviceOnline ? "" : "offline"}`} />
            {healthLabel}
          </span>
          <button
            className={`account-button ${account ? "signed-in" : ""}`}
            type="button"
            onClick={() => setView("account")}
            aria-label={account ? `Compte de ${account.displayName}` : "Ouvrir mon compte"}
            title={account ? account.displayName : "Se connecter"}
          >
            <UserRound size={17} strokeWidth={1.9} />
            {account && <span className="account-button-name">{account.displayName}</span>}
            {account && connectedCount > 0 && <span className="account-button-dot" aria-hidden="true" />}
          </button>
        </div>
      </header>

      <main className="main-area">
        {healthQuery.isError && (
          <div className="mutation-alert top-alert" role="alert">
            <CircleAlert size={14} />Le service local ne répond pas. Vérifiez que le serveur est lancé.
          </div>
        )}

        {view === "library" && (
          <LibraryPage filter={filter} onFilterChange={setFilter} onOpenSettings={() => setView("settings")} />
        )}
        {view === "settings" && <SettingsPage onOpenAccount={() => setView("account")} />}
        {view === "account" && <AccountPage onOpenSettings={() => setView("settings")} />}
      </main>

      <Dock
        active={view}
        onChange={setView}
        badge={{ library: totalJobs ?? 0, account: connectedCount }}
      />
    </div>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <AppShell />
    </SessionProvider>
  );
}

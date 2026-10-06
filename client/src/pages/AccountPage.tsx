import { useState, type FormEvent } from "react";
import { Check, HardDrive, KeyRound, LogOut, ShieldCheck, UserRound, X } from "lucide-react";
import { PROVIDERS, providerInitials } from "../lib/providers";
import { useSession } from "../lib/session";
import { useDownloadStats } from "../lib/api";

function accountInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.slice(0, 2).map((word) => word[0]?.toUpperCase() ?? "").join("");
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unitIndex;
  return `${value.toFixed(unitIndex === 0 || value >= 100 ? 0 : 1)} ${units[unitIndex]}`;
}

export function AccountPage({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { account, signIn, signOut, providerSessions, disconnectProvider, connectedCount } = useSession();
  const statsQuery = useDownloadStats();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const connectedProviders = PROVIDERS.filter((provider) => providerSessions[provider.id]);

  function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Indiquez un nom pour votre espace.");
      return;
    }
    signIn({ displayName: name.trim(), email: email.trim() });
  }

  if (!account) {
    return (
      <>
        <section className="page-intro">
          <div>
            <div className="eyebrow">Identité</div>
            <h1 className="page-title">Mon compte</h1>
            <p className="page-subtitle">Créez votre espace local pour rassembler vos bibliothèques.</p>
          </div>
        </section>

        <section className="account-gate">
          <div className="account-gate-card">
            <div className="account-gate-icon"><UserRound size={22} /></div>
            <h2 className="account-gate-title">Ouvrir votre espace</h2>
            <p className="account-gate-copy">
              Aucune inscription en ligne : ce profil reste sur cet appareil et sert à personnaliser la bibliothèque et les comptes de fournisseurs.
            </p>
            <form onSubmit={handleSignIn}>
              <label className="form-label" htmlFor="account-name">Nom affiché</label>
              <input
                id="account-name"
                className="url-input"
                type="text"
                autoComplete="name"
                placeholder="Votre nom"
                value={name}
                onChange={(event) => { setName(event.target.value); setError(""); }}
              />
              <label className="form-label" htmlFor="account-email">E-mail (facultatif)</label>
              <input
                id="account-email"
                className="url-input"
                type="email"
                autoComplete="email"
                placeholder="vous@exemple.org"
                value={email}
                onChange={(event) => { setEmail(event.target.value); setError(""); }}
              />
              {error && <p className="form-error" role="alert">{error}</p>}
              <div className="dialog-actions">
                <button className="button button-primary" type="submit"><KeyRound size={15} />Créer l’espace</button>
              </div>
            </form>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <section className="page-intro">
        <div>
          <div className="eyebrow">Identité</div>
          <h1 className="page-title">Mon compte</h1>
          <p className="page-subtitle">Votre profil local et les fournisseurs liés à cet appareil.</p>
        </div>
        <button className="button button-quiet" type="button" onClick={signOut}>
          <LogOut size={15} />Se déconnecter
        </button>
      </section>

      <section className="account-header" aria-label="Profil">
        <div className="account-avatar">{accountInitials(account.displayName)}</div>
        <div className="account-identity">
          <div className="account-name">{account.displayName}</div>
          <div className="account-email">{account.email || "Aucun e-mail renseigné"}</div>
        </div>
        <div className="account-metrics">
          <div className="account-metric">
            <span className="account-metric-value">{connectedCount}</span>
            <span className="account-metric-label">Fournisseurs liés</span>
          </div>
          <div className="account-metric">
            <span className="account-metric-value">{statsQuery.data ? String(statsQuery.data.completedCount) : "—"}</span>
            <span className="account-metric-label">Médias enregistrés</span>
          </div>
          <div className="account-metric">
            <span className="account-metric-value">{statsQuery.data ? formatBytes(statsQuery.data.totalSavedBytes) : "—"}</span>
            <span className="account-metric-label">Espace utilisé</span>
          </div>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="linked-heading">
        <div className="section-head">
          <div>
            <h2 className="section-title" id="linked-heading">Fournisseurs connectés</h2>
            <p className="section-subtitle">{connectedCount > 0 ? `${connectedCount} compte${connectedCount === 1 ? "" : "s"} lié${connectedCount === 1 ? "" : "s"}` : "Aucun fournisseur connecté pour l’instant"}</p>
          </div>
          <button className="button button-quiet" type="button" onClick={onOpenSettings}>
            <ShieldCheck size={15} />Gérer dans Réglages
          </button>
        </div>

        {connectedProviders.length > 0 ? (
          <div className="linked-list">
            {connectedProviders.map((provider) => (
              <div className="linked-row" key={provider.id}>
                <span
                  className="provider-mark"
                  style={{ background: `${provider.accent}1f`, color: provider.accent, borderColor: `${provider.accent}3d` }}
                  aria-hidden="true"
                >
                  {providerInitials(provider.name)}
                </span>
                <div className="linked-copy">
                  <div className="linked-name">{provider.name}</div>
                  <div className="linked-account">{providerSessions[provider.id]?.account}</div>
                </div>
                <span className="linked-badge"><Check size={13} />Connecté</span>
                <button className="icon-button danger" type="button" aria-label={`Déconnecter ${provider.name}`} title="Déconnecter" onClick={() => disconnectProvider(provider.id)}>
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon"><HardDrive size={20} /></div>
            <h3 className="empty-title">Aucun fournisseur lié</h3>
            <p className="empty-copy">Rendez-vous dans Réglages pour connecter Brazzers, BangBros et les autres plateformes.</p>
            <button className="button button-primary" type="button" onClick={onOpenSettings}>Ouvrir les Réglages</button>
          </div>
        )}
      </section>
    </>
  );
}

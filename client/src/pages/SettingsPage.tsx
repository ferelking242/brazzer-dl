import { useMemo, useState, type FormEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, KeyRound, Link2, LoaderCircle, LogOut, Plug, Search, ShieldCheck, X } from "lucide-react";
import { PROVIDERS, PROVIDER_CATEGORIES, providerInitials, type Provider, type ProviderCategory } from "../lib/providers";
import { useSession } from "../lib/session";
import { clearBackendBaseUrl, getBackendBaseUrl, setBackendBaseUrl } from "../lib/config";
import { useServiceHealth } from "../lib/api";

type CategoryFilter = "all" | ProviderCategory;

function ProviderMark({ provider, size = 40 }: { provider: Provider; size?: number }) {
  return (
    <span
      className="provider-mark"
      style={{ width: size, height: size, background: `${provider.accent}1f`, color: provider.accent, borderColor: `${provider.accent}3d` }}
      aria-hidden="true"
    >
      {providerInitials(provider.name)}
    </span>
  );
}

function ProviderLoginDialog({ provider }: { provider: Provider }) {
  const { isConnected, connectProvider, disconnectProvider, getProviderSession } = useSession();
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const connected = isConnected(provider.id);
  const session = getProviderSession(provider.id);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!account.trim() || !password) {
      setError("Renseignez votre identifiant et votre mot de passe.");
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 450));
    connectProvider(provider.id, account.trim());
    setPassword("");
    setOpen(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { setOpen(next); if (!next) { setError(""); setPassword(""); } }}>
      <Dialog.Trigger asChild>
        <button className={`provider-action ${connected ? "connected" : ""}`} type="button">
          {connected ? <><Check size={14} />Connecté</> : "Se connecter"}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content" aria-describedby={`provider-${provider.id}-description`}>
          <div className="dialog-top">
            <div className="provider-dialog-head">
              <ProviderMark provider={provider} />
              <div>
                <Dialog.Title className="dialog-title">{provider.name}</Dialog.Title>
                <Dialog.Description id={`provider-${provider.id}-description`} className="dialog-description">
                  {connected ? `Compte lié : ${session?.account ?? "—"}` : `Connectez-vous à ${provider.domain}.`}
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button className="dialog-close" type="button" aria-label="Fermer la fenêtre"><X size={17} /></button>
            </Dialog.Close>
          </div>

          {connected ? (
            <div className="provider-connected-panel">
              <p className="provider-connected-text">
                Ce compte est enregistré localement sur cet appareil. La connexion réelle au fournisseur sera branchée avec le backend.
              </p>
              <button
                className="button button-quiet"
                type="button"
                onClick={() => { disconnectProvider(provider.id); setOpen(false); }}
              >
                <LogOut size={14} />Déconnecter
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <label className="form-label" htmlFor={`provider-${provider.id}-account`}>Identifiant ou e-mail</label>
              <input
                autoFocus
                id={`provider-${provider.id}-account`}
                className="url-input"
                type="text"
                autoComplete="username"
                placeholder={`votre-compte@${provider.domain}`}
                value={account}
                onChange={(event) => { setAccount(event.target.value); setError(""); }}
              />
              <label className="form-label" htmlFor={`provider-${provider.id}-password`}>Mot de passe</label>
              <input
                id={`provider-${provider.id}-password`}
                className="url-input"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(event) => { setPassword(event.target.value); setError(""); }}
              />
              <div className="dialog-note">
                <ShieldCheck size={14} />
                <span>Démonstration locale : aucune donnée n’est envoyée. Le mot de passe n’est jamais conservé.</span>
              </div>
              {error && <p className="form-error" role="alert">{error}</p>}
              <div className="dialog-actions">
                <Dialog.Close asChild>
                  <button className="button button-quiet" type="button">Annuler</button>
                </Dialog.Close>
                <button className="button button-primary" type="submit">
                  <KeyRound size={15} />Se connecter
                </button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function BackendConnection() {
  const healthQuery = useServiceHealth();
  const [value, setValue] = useState(() => getBackendBaseUrl());
  const [saved, setSaved] = useState(false);

  const connected = !healthQuery.isLoading && !healthQuery.isError && !!healthQuery.data?.ok;
  const statusLabel = healthQuery.isLoading
    ? "Vérification…"
    : connected
      ? `Connecté · ${healthQuery.data?.service ?? "service"}`
      : "Aucun backend joignable";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBackendBaseUrl(value);
    setValue(getBackendBaseUrl());
    setSaved(true);
    void healthQuery.refetch();
    window.setTimeout(() => setSaved(false), 2500);
  }

  function handleReset() {
    clearBackendBaseUrl();
    setValue(getBackendBaseUrl());
    setSaved(false);
    void healthQuery.refetch();
  }

  return (
    <section className="settings-section" aria-labelledby="backend-heading">
      <div className="section-head">
        <div>
          <h2 className="section-title" id="backend-heading">Connexion au backend</h2>
          <p className="section-subtitle">Reliez ce frontend à votre serveur brazzer-dl</p>
        </div>
        <span className={`health-pill ${connected ? "" : "offline"}`}>
          <span className={`health-dot ${connected ? "" : "offline"}`} />
          {statusLabel}
        </span>
      </div>

      <form className="backend-form" onSubmit={handleSubmit}>
        <label className="form-label" htmlFor="backend-url">Adresse du backend</label>
        <div className="backend-input-row">
          <span className="backend-input-icon"><Plug size={15} /></span>
          <input
            id="backend-url"
            className="url-input backend-input"
            type="url"
            inputMode="url"
            placeholder="https://votre-backend.example.org"
            value={value}
            onChange={(event) => { setValue(event.target.value); setSaved(false); }}
          />
          <button className="button button-primary" type="submit"><Link2 size={15} />Enregistrer</button>
          {value.trim() && (
            <button className="button button-quiet" type="button" onClick={handleReset}>Réinitialiser</button>
          )}
        </div>
        <div className="form-hint">
          <ShieldCheck size={13} />
          {saved ? "Adresse enregistrée sur cet appareil." : "Laissez vide pour utiliser un backend local via le proxy de développement."}
        </div>
      </form>
    </section>
  );
}

export function SettingsPage({ onOpenAccount }: { onOpenAccount: () => void }) {
  const { connectedCount } = useSession();
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [search, setSearch] = useState("");

  const visibleProviders = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase();
    return PROVIDERS.filter((provider) => category === "all" || provider.category === category).filter(
      (provider) => !normalized || `${provider.name} ${provider.domain}`.toLocaleLowerCase().includes(normalized),
    );
  }, [category, search]);

  const filters: { id: CategoryFilter; label: string }[] = [
    { id: "all", label: "Tous" },
    ...PROVIDER_CATEGORIES.map((entry) => ({ id: entry.id as CategoryFilter, label: entry.label })),
  ];

  return (
    <>
      <section className="page-intro">
        <div>
          <div className="eyebrow">Configuration</div>
          <h1 className="page-title">Réglages</h1>
          <p className="page-subtitle">Connectez vos comptes de fournisseurs et gardez le contrôle de vos sources.</p>
        </div>
        <button className="button button-quiet" type="button" onClick={onOpenAccount}>
          <ShieldCheck size={15} />{connectedCount} compte{connectedCount === 1 ? "" : "s"} lié{connectedCount === 1 ? "" : "s"}
        </button>
      </section>

      <BackendConnection />

      <section className="settings-section" aria-labelledby="providers-heading">
        <div className="section-head">
          <div>
            <h2 className="section-title" id="providers-heading">Fournisseurs</h2>
            <p className="section-subtitle">{PROVIDERS.length} plateformes disponibles · {connectedCount} connectée{connectedCount === 1 ? "" : "s"}</p>
          </div>
          <div className="library-tools">
            <label className="search-box">
              <Search size={15} />
              <input type="search" aria-label="Rechercher un fournisseur" placeholder="Rechercher un site" value={search} onChange={(event) => setSearch(event.target.value)} />
            </label>
          </div>
        </div>

        <div className="filter-tabs" role="tablist" aria-label="Filtrer les fournisseurs">
          {filters.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={category === option.id}
              className={`filter-tab ${category === option.id ? "selected" : ""}`}
              onClick={() => setCategory(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="provider-grid">
          {visibleProviders.map((provider) => (
            <article className="provider-card" key={provider.id}>
              <div className="provider-card-head">
                <ProviderMark provider={provider} />
                <div className="provider-card-title">
                  <div className="provider-name">{provider.name}</div>
                  <div className="provider-domain">{provider.domain}</div>
                </div>
              </div>
              <p className="provider-tagline">{provider.tagline}</p>
              <ProviderLoginDialog provider={provider} />
            </article>
          ))}
        </div>

        {visibleProviders.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon"><Search size={20} /></div>
            <h3 className="empty-title">Aucun fournisseur</h3>
            <p className="empty-copy">Aucun site ne correspond à cette recherche.</p>
          </div>
        )}
      </section>

      <section className="settings-section" aria-labelledby="engine-heading">
        <div className="section-head">
          <div>
            <h2 className="section-title" id="engine-heading">Moteur de téléchargement</h2>
            <p className="section-subtitle">État actuel de l’intégration</p>
          </div>
        </div>
        <div className="access-notice" aria-label="Limites du moteur">
          <ShieldCheck className="notice-icon" size={18} />
          <div className="notice-copy">
            <div className="notice-title">Liens directs uniquement</div>
            <p className="notice-text">
              Le moteur accepte aujourd’hui les liens vidéo HTTPS publics. La connexion authentifiée aux fournisseurs, la reprise de session et le téléchargement protégé arrivent avec le backend.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

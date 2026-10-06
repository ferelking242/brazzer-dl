export type ProviderCategory = "premium" | "network" | "community";

export interface Provider {
  id: string;
  name: string;
  domain: string;
  category: ProviderCategory;
  accent: string;
  tagline: string;
}

export const PROVIDER_CATEGORIES: { id: ProviderCategory; label: string }[] = [
  { id: "premium", label: "Studios premium" },
  { id: "network", label: "Réseaux" },
  { id: "community", label: "Communautés" },
];

export const PROVIDERS: Provider[] = [
  { id: "brazzers", name: "Brazzers", domain: "brazzers.com", category: "premium", accent: "#f0a63d", tagline: "Le catalogue premium de référence." },
  { id: "bangbros", name: "BangBros", domain: "bangbros.com", category: "premium", accent: "#e2574c", tagline: "Des séries originales en exclusivité." },
  { id: "realitykings", name: "Reality Kings", domain: "realitykings.com", category: "premium", accent: "#4aa3c7", tagline: "Des tournages réels, sans scénario." },
  { id: "mofos", name: "MOFOS", domain: "mofos.com", category: "premium", accent: "#e08a3c", tagline: "Des séries courtes et variées." },
  { id: "digitalplayground", name: "Digital Playground", domain: "digitalplayground.com", category: "premium", accent: "#7a6ff0", tagline: "Des productions cinématographiques." },
  { id: "vixen", name: "Vixen", domain: "vixen.com", category: "premium", accent: "#c9a227", tagline: "Une image soignée et haut de gamme." },
  { id: "blacked", name: "Blacked", domain: "blacked.com", category: "premium", accent: "#3f3f46", tagline: "Productions premium primées." },
  { id: "tushy", name: "Tushy", domain: "tushy.com", category: "premium", accent: "#d76a8c", tagline: "La signature du studio Vixen." },
  { id: "pornhub", name: "Pornhub", domain: "pornhub.com", category: "community", accent: "#f0932b", tagline: "La plus grande plateforme communautaire." },
  { id: "xvideos", name: "XVideos", domain: "xvideos.com", category: "community", accent: "#e0b13c", tagline: "Un catalogue ouvert et gigantesque." },
  { id: "xnxx", name: "XNXX", domain: "xnxx.com", category: "community", accent: "#c0562f", tagline: "Une bibliothèque communautaire massive." },
  { id: "redtube", name: "RedTube", domain: "redtube.com", category: "community", accent: "#d94f4f", tagline: "Une plateforme de partage grand public." },
  { id: "youporn", name: "YouPorn", domain: "youporn.com", category: "community", accent: "#3ba55d", tagline: "Contenu communautaire en streaming." },
  { id: "spankbang", name: "SpankBang", domain: "spankbang.com", category: "community", accent: "#e2892f", tagline: "Des milliers de vidéos en libre accès." },
  { id: "eporner", name: "Eporner", domain: "eporner.com", category: "community", accent: "#4f8fd0", tagline: "Une large collection sans compte." },
];

export function getProvider(id: string): Provider | undefined {
  return PROVIDERS.find((provider) => provider.id === id);
}

export function providerInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import path from "node:path";

const ALLOWED_EXTENSIONS = new Set([".mp4", ".webm", ".mov", ".m4v", ".mkv"]);
const MAX_FILE_BYTES = 5 * 1024 * 1024 * 1024;

function isPublicIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [a, b, c] = parts;
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113)
  );
}

function isPublicIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized.startsWith("::ffff:")) return false;
  // Public unicast IPv6 addresses are in 2000::/3. Reject local, link-local,
  // multicast, loopback, and unspecified ranges.
  return /^[23][0-9a-f]{0,3}:/i.test(normalized);
}

function isPublicAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isPublicIpv4(address);
  if (version === 6) return isPublicIpv6(address);
  return false;
}

export function validateMediaUrlShape(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Saisissez une adresse directe valide vers un fichier vidéo.");
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (url.protocol !== "https:") throw new Error("Seuls les liens HTTPS sont acceptés.");
  if (url.username || url.password) throw new Error("Les liens contenant des identifiants ne sont pas acceptés.");
  if (url.search || url.hash) throw new Error("Les liens signés ou contenant des paramètres ne sont pas acceptés.");
  if (url.port && url.port !== "443") throw new Error("Seul le port HTTPS standard est accepté.");
  if (hostname === "brazzers.com" || hostname.endsWith(".brazzers.com")) {
    throw new Error("Les liens Brazzers ne sont pas pris en charge. Utilisez uniquement une méthode officielle de téléchargement.");
  }
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    isIP(hostname)
  ) {
    throw new Error("Les liens locaux et les adresses IP ne sont pas acceptés.");
  }

  const extension = path.extname(url.pathname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error("Utilisez un lien HTTPS direct vers un fichier MP4, WebM, MOV, M4V ou MKV.");
  }

  return url;
}

export async function validateMediaUrl(rawUrl: string): Promise<URL> {
  const url = validateMediaUrlShape(rawUrl);
  const addresses = await resolvePublicAddresses(url.hostname);
  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error("L’hôte doit pointer uniquement vers des adresses Internet publiques.");
  }
  return url;
}

export async function resolveMediaUrl(rawUrl: string): Promise<{
  url: URL;
  addresses: Array<{ address: string; family: number }>;
}> {
  const url = validateMediaUrlShape(rawUrl);
  const addresses = await resolvePublicAddresses(url.hostname);
  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error("L’hôte doit pointer uniquement vers des adresses Internet publiques.");
  }
  return { url, addresses };
}

async function resolvePublicAddresses(hostname: string) {
  let addresses;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error("Impossible de trouver l’adresse du serveur vidéo.");
  }
  return addresses;
}

export function assertSafeRedirect(originalHost: string, redirectUrl: URL): URL {
  const checked = validateMediaUrlShape(redirectUrl.toString());
  if (checked.hostname.toLowerCase() !== originalHost.toLowerCase()) {
    throw new Error("Les redirections vers un autre hôte ne sont pas prises en charge.");
  }
  return checked;
}

export { MAX_FILE_BYTES };

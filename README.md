# Stillroom — Gestionnaire vidéo local

Gestionnaire local privé pour organiser et télécharger des **fichiers vidéo vers lesquels vous avez le droit de pointer un lien HTTPS direct** (par exemple vos propres exports, des contenus sous licence ouverte, ou un fichier déposé par défaut dans un CDN public).

L’interface est une bibliothèque locale, sans compte à créer, et un moteur de téléchargement de **liens directs publics uniquement**.

## Ce que l’application fait (et ne fait pas)

Fait :

- Bibliothèque locale de fichiers vidéo, Fil d’attente avec concurrence limitée, Liste des fichiers enregistrés.
- Vue **Paramètres** : stockage, règles de téléchargement (concurrence, taille max, reprise partielle), confidentialité, état du service.
- Connexion, cookies, identifiants, contournement de DRM ou de paywall : **jamais**.
- Liens directs HTTPS vers des fichiers MP4, WebM, MOV ou MKV, sans paramètres signés.
- Vérification de sécurité : refus des hostnames locaux, adresses IP, redirections cross-origin, fichiers de plus de 5 Go.

Ne fait pas (et ne fera pas) :

- Se connecter à Brazzers, BangBros, ou tout autre site protégé par identification.
- Télécharger des vidéos d’abonnement VIP ou un fichier protégé par un paywall.
- Extraire des cookies, sniffer des sessions, contourner un DRM.
- Utiliser `yt-dlp` ou un extracteur de flux.

L’application reste volontairement neutre : un abonnement payant à un site ne vous donne pas le droit de copier ou de redistribuer les vidéos de ce site. Si vous cherchez à télécharger les contenus d’un abonnement (Brazzers, BangBros, etc.), cette application n’est pas faite pour ça, et ce projet n’ajoutera pas cette fonctionnalité.

## Stack

- **Node.js 24 + TypeScript**
- **React + Vite** (vignettes, file, paramètres, dock flottant)
- **Radix UI + Tailwind CSS + Lucide** (libres et open source)
- **Fastify** (API locale sur `/api`)
- **SQLite** (`better-sqlite3`) pour la file et l’état persistant

En développement, `npm run dev` lance Vite (port 5000) et le serveur API (port 3001, ou `PORT` fourni par l'hébergeur). Les téléchargements sont enregistrés dans `data/media/` et l'état dans `data/downloads.sqlite`.

## Vérifications

```bash
npm run typecheck
npm test
npm run build
```

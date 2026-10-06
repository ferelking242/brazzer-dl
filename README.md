# brazzer-dl

Gestionnaire vidéo local : file d'attente de **liens HTTPS directs** vers des fichiers vidéo publics (vos propres exports, contenus sous licence ouverte, CDN public), avec reprise et bibliothèque.

L'interface est une bibliothèque locale, sans compte à créer.

## Ce que l'application fait (et ne fait pas)

Fait :

- Bibliothèque locale de fichiers vidéo, file d'attente avec concurrence limitée, liste des fichiers enregistrés.
- Vue **Paramètres** : stockage, règles de téléchargement (concurrence, taille max, reprise partielle), confidentialité, état du service.
- Liens directs HTTPS vers des fichiers MP4, WebM, MOV ou MKV, sans paramètres signés.
- Vérification de sécurité : refus des hostnames locaux, adresses IP, redirections cross-origin, fichiers de plus de 5 Go.

Ne fait pas (et ne fera pas) :

- Se connecter à Brazzers, BangBros ou tout autre site protégé par identification, ni télécharger leurs vidéos d'abonnement VIP.
- Extraire des cookies, sniffer des sessions, contourner un DRM ou un paywall.
- Utiliser `yt-dlp` ou tout extracteur de flux.

Un abonnement payant ne donne pas le droit de copier ou redistribuer les vidéos d'un site. Cette application reste volontairement limitée aux liens directs publics.

## Stack

- **Node.js 24 + TypeScript**, **React + Vite**, **Radix UI + Tailwind CSS + Lucide**, **Fastify**, **SQLite** (better-sqlite3).

En développement, `npm run dev` construit l'interface et lance un unique process Fastify qui sert à la fois l'UI (`dist/`) et l'API sur le port `5000` (ou le `PORT` injecté par l'hébergeur). Les téléchargements sont dans `data/media/`, l'état dans `data/downloads.sqlite`.

## Vérifications

```bash
npm run typecheck
npm test
npm run build
```

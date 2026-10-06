# Brazzers Library Manager

Gestionnaire local privé pour organiser et télécharger des vidéos uniquement lorsque le site autorise explicitement leur téléchargement.

## État du projet

L’application fournit une interface de file d’attente et un moteur de téléchargement pour des liens directs compatibles. La connexion à un compte Brazzers et l’accès aux vidéos VIP ne sont pas implémentés.

Site à évaluer : `https://site-ma.brazzers.com/scenes?addon=162`

Un abonnement VIP ne confirme pas, à lui seul, le droit de copier les vidéos. Avant toute intégration, il faut vérifier les conditions du site et l’existence d’une fonction de téléchargement ou d’une API officielle autorisée. L’accès aux vidéos et la possibilité de les télécharger sont deux choses distinctes.

## Stack retenue

- **Node.js 24 + TypeScript** : même langage côté interface et serveur, types partagés et runtime déjà disponible dans l’environnement.
- **React + Vite** : interface locale pour la bibliothèque, la file d’attente et l’avancement des tâches.
- **Tailwind CSS + primitives Radix UI + Lucide React** : composants gratuits et open source.
- **Fastify** : API locale légère entre l’interface et le gestionnaire de téléchargements.
- **SQLite** : persistance locale des métadonnées, de l’état des tâches et de leur reprise après redémarrage.
- **File d’attente persistante avec concurrence limitée** : démarrer avec un seul téléchargement à la fois; permettre pause, reprise, annulation, reprise sur erreur et déduplication.
- **Système de fichiers local** : destination choisie par l’utilisateur, avec vérification de l’espace disponible et noms de fichiers sûrs.

En développement, l’interface écoute sur le port `5000` et transmet les appels `/api` au serveur local sur `127.0.0.1:3001`. Redis, PostgreSQL et une architecture cloud ne sont pas nécessaires pour ce premier périmètre.

La file accepte une URL à la fois, démarre avec une seule tâche concurrente, conserve son état dans SQLite et reprend les fichiers partiels lorsque le serveur supporte les requêtes `Range`.

## Intégration au site

L’application ne se connecte pas à Brazzers. Le bouton du site ouvre une page externe; il ne partage pas la session du navigateur avec l’application.

- Les liens Brazzers et sous-domaines sont bloqués.
- Seuls les liens HTTPS directs vers des fichiers vidéo MP4, WebM, MOV, M4V ou MKV sont acceptés; pas de cookies, de paramètres signés ou de lien qui exige une authentification.
- Les adresses IP/locales, réponses qui ne sont pas des vidéos, redirections vers un autre hôte et fichiers de plus de 5 Go sont refusés.
- Il n’y a ni formulaire de mot de passe, ni extraction de cookies, ni contournement DRM/paywall.
- `yt-dlp` n’est pas une dépendance de l’application.

Un abonnement VIP ne confirme pas, à lui seul, le droit de copier les vidéos. Une intégration au site ne pourra être ajoutée qu’après confirmation d’un mécanisme officiel et autorisé.

## Lancer en développement

```bash
npm run dev
```

Les téléchargements sont enregistrés dans `data/media/` et leur état dans `data/downloads.sqlite`. `npm run typecheck`, `npm test` et `npm run build` vérifient le projet.


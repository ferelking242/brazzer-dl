# Brazzers Library Manager

Gestionnaire local privé pour organiser et télécharger des vidéos uniquement lorsque le site autorise explicitement leur téléchargement.

## État du projet

Le dépôt contient pour l’instant la décision de stack et le périmètre. Aucun téléchargement ni accès au compte n’est encore implémenté.

Site à évaluer : `https://site-ma.brazzers.com/scenes?addon=162`

Un abonnement VIP ne confirme pas, à lui seul, le droit de copier les vidéos. Avant toute intégration, il faut vérifier les conditions du site et l’existence d’une fonction de téléchargement ou d’une API officielle autorisée. L’accès aux vidéos et la possibilité de les télécharger sont deux choses distinctes.

## Stack retenue

- **Node.js 24 + TypeScript** : même langage côté interface et serveur, types partagés et runtime déjà disponible dans l’environnement.
- **React + Vite** : interface locale pour la bibliothèque, la file d’attente et l’avancement des tâches.
- **Fastify** : API locale légère entre l’interface et le gestionnaire de téléchargements.
- **SQLite** : persistance locale des métadonnées, de l’état des tâches et de leur reprise après redémarrage.
- **File d’attente persistante avec concurrence limitée** : démarrer avec un seul téléchargement à la fois; permettre pause, reprise, annulation, reprise sur erreur et déduplication.
- **Système de fichiers local** : destination choisie par l’utilisateur, avec vérification de l’espace disponible et noms de fichiers sûrs.

Le serveur devra écouter uniquement sur `127.0.0.1`, puisque l’application est conçue pour un seul utilisateur sur sa machine. Redis, PostgreSQL et une architecture cloud ne sont pas nécessaires pour ce premier périmètre.

## Intégration au site

L’intégration Brazzers reste **à confirmer**. Elle ne pourra utiliser que les mécanismes officiellement documentés et les vidéos explicitement téléchargeables avec l’autorisation requise.

- Ne pas collecter ni stocker le mot de passe du compte.
- Ne pas importer ou extraire les cookies de session.
- Ne pas contourner DRM, paywall, restrictions d’accès ou limites du site.
- Ne pas lancer une extraction massive du catalogue sans autorisation explicite.
- `yt-dlp` n’est pas retenu comme dépendance par défaut. Il ne pourra être évalué que pour une source et un usage autorisés, sans contournement de protection.

Si le site ne propose aucun moyen officiel de télécharger ces vidéos, l’intégration ne devra pas être développée. L’interface pourra rester un gestionnaire de fichiers vidéo déjà détenus par l’utilisateur.

## Étapes proposées

1. Confirmer les droits de téléchargement et les mécanismes officiels disponibles.
2. Créer l’application locale et la file persistante avec des vidéos de test fournies par l’utilisateur.
3. Ajouter un adaptateur de source uniquement si l’étape 1 confirme une méthode autorisée.
4. Tester pause/reprise, erreurs réseau, espace disque, limites de débit et déduplication.

## Lancement

Le code de l’application n’a pas encore été créé. Les commandes de lancement seront ajoutées avec le premier prototype.

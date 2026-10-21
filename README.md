# Relais

Hébergement et partage de fichiers par lien : envoi sans compte, mot de passe, expiration, et analyse de chaque fichier avant téléchargement (type réel, archives ZIP, empreinte SHA-256).

## Démarrer

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # tests unitaires (détection, archives, formats)
```

Sans configuration, les fichiers sont stockés sur disque dans `.data/` (dossier modifiable via `RELAIS_DATA_DIR`). Ce mode convient au développement et à l'auto-hébergement sur un VPS : pas de limite de taille par requête, et l'envoi par morceaux reprend après une coupure.

## Déployer sur Vercel

1. Créez un magasin **Vercel Blob privé** et liez-le au projet. `BLOB_READ_WRITE_TOKEN` est alors injecté et Relais bascule automatiquement sur Blob : envoi direct navigateur → stockage en multipart, téléchargements par URL pré-signée de 10 minutes.
2. Définissez `RELAIS_SECRET` (chaîne aléatoire longue) et `NEXT_PUBLIC_SITE_URL`.
3. Facultatif : `CRON_SECRET` pour protéger la purge quotidienne (`vercel.json`), et `RELAIS_MAX_FILE` / `RELAIS_MAX_FOLDER` (en octets).

## Architecture

- `src/lib/server/store*.ts` : deux pilotes de stockage (disque, Vercel Blob) derrière une même interface, avec écritures conditionnelles (ETag) pour les métadonnées.
- `src/lib/server/folders.ts` : dépôts, droits (clé de gestion hachée, mot de passe scrypt, cookie d'accès HMAC), analyse des fichiers.
- `src/lib/sniff.ts`, `zipinspect.ts`, `filetypes.ts` : détection du type réel, lecture de l'index ZIP sans extraction, noms piégés.
- `src/lib/client/uploader.ts` : file d'envoi (3 en parallèle), morceaux reprenables, SHA-256 incrémental, débit et temps restant.
- API documentée sur `/developpeurs`.

import type { Metadata } from "next";
import { CodeBlock } from "@/components/code-block";
import { Callout, DocLayout } from "@/components/doc-layout";
import { site } from "@/lib/config";
import { formatBytes } from "@/lib/format";
import { publicConfig } from "@/lib/server/folders";

export const metadata: Metadata = {
  title: "API & développeurs",
  description: "Envoyer, protéger et supprimer des fichiers depuis un script : l'API REST de Relais, avec exemples curl, Python et JavaScript.",
  alternates: { canonical: "/developpeurs" },
};

const B = site.url;

const ENDPOINTS: [string, string, string, string][] = [
  ["PUT", "/api/v1/upload/{nom}", "—", "Envoie un fichier en une requête (crée un dépôt si besoin)."],
  ["POST", "/api/v1/folders", "—", "Crée un dépôt vide. Renvoie la clé de gestion."],
  ["GET", "/api/v1/folders/{id}", "Facultative", "Décrit un dépôt et ses fichiers (analyse incluse)."],
  ["PATCH", "/api/v1/folders/{id}", "Clé", "Modifie titre, message, mot de passe, expiration."],
  ["DELETE", "/api/v1/folders/{id}", "Clé", "Supprime le dépôt et tous ses fichiers."],
  ["POST", "/api/v1/folders/{id}/files", "Clé", "Réserve un fichier pour un envoi par morceaux."],
  ["PUT", "/api/v1/folders/{id}/files/{fid}/chunk", "Clé", "Envoie un morceau à la position ?offset=."],
  ["POST", "/api/v1/folders/{id}/files/{fid}/complete", "Clé", "Finalise et lance l'analyse du fichier."],
  ["GET", "/api/v1/folders/{id}/files/{fid}", "Mot de passe si protégé", "Télécharge le fichier (Range supporté)."],
  ["DELETE", "/api/v1/folders/{id}/files/{fid}", "Clé", "Retire un fichier du dépôt."],
  ["POST", "/api/v1/folders/{id}/unlock", "—", "Vérifie un mot de passe (cookie d'accès 12 h)."],
  ["POST", "/api/v1/folders/{id}/report", "—", "Signale un dépôt."],
  ["GET", "/api/v1/config", "—", "Limites de l'instance."],
];

const ERRORS: [number, string, string][] = [
  [400, "bad_json, bad_size, bad_expiry…", "Requête mal formée."],
  [401, "locked, wrong_password", "Mot de passe requis ou incorrect."],
  [403, "forbidden", "Clé de gestion absente ou invalide."],
  [404, "not_found", "Dépôt ou fichier inexistant ou expiré."],
  [409, "offset_mismatch", "Le champ received indique où reprendre."],
  [413, "file_too_large, folder_full", "Limite de taille atteinte."],
  [429, "rate_limited", "Trop de requêtes, voir retryAfter."],
  [451, "suspended", "Dépôt suspendu après signalements."],
];

const METHOD: Record<string, string> = {
  GET: "bg-ok-soft text-ok",
  POST: "bg-accent-soft text-accent",
  PUT: "bg-sun-soft text-warn",
  PATCH: "bg-sun-soft text-warn",
  DELETE: "bg-danger-soft text-danger",
};

export default function Page() {
  const cfg = publicConfig();
  return (
    <DocLayout
      eyebrow="API v1"
      title="L'API Relais"
      lead={
        <>
          Une API REST en JSON, sans inscription ni clé à demander. Chaque dépôt créé renvoie sa propre <strong>clé de gestion</strong>, qui sert de jeton
          pour le modifier ensuite.
        </>
      }
      toc={[
        ["demarrage", "Démarrage rapide"],
        ["authentification", "Authentification"],
        ["reponse", "Réponse type"],
        ["gros-fichiers", "Gros fichiers"],
        ["exemples", "Exemples"],
        ["reference", "Référence"],
        ["erreurs", "Erreurs"],
        ["limites", "Limites"],
      ]}
    >
      <section id="demarrage">
        <h2>Démarrage rapide</h2>
        <p>Envoyez un fichier en une commande. La réponse contient le lien public et la clé de gestion.</p>
        <CodeBlock lang="bash" code={`curl -T rapport.pdf ${B}/api/v1/upload/rapport.pdf`} />
        <p className="mt-4">Options par en-têtes HTTP&nbsp;:</p>
        <ul>
          <li>
            <code>X-Relais-Expires</code>&nbsp;: <code>1h</code>, <code>1d</code>, <code>7d</code> (défaut) ou <code>30d</code>
          </li>
          <li>
            <code>X-Relais-Title</code>&nbsp;: titre affiché sur la page de téléchargement
          </li>
          <li>
            <code>X-Relais-New-Password</code>&nbsp;: protège le nouveau dépôt par un mot de passe
          </li>
          <li>
            <code>X-Relais-Folder</code> + <code>Authorization</code>&nbsp;: ajoute le fichier à un dépôt existant
          </li>
        </ul>
      </section>

      <section id="authentification">
        <h2>Authentification</h2>
        <p>
          Les opérations de gestion exigent la clé du dépôt dans l&apos;en-tête <code>Authorization: Bearer &lt;clé&gt;</code>. Elle n&apos;est renvoyée
          qu&apos;une seule fois, à la création&nbsp;: conservez-la. Le serveur n&apos;en garde qu&apos;une empreinte SHA-256.
        </p>
        <p>
          Pour télécharger depuis un dépôt protégé, passez le mot de passe dans <code>X-Relais-Password</code>. Les tentatives sont limitées à dix par minute.
        </p>
        <CodeBlock lang="bash" code={`curl -H "X-Relais-Password: s3cret" -OJ ${B}/api/v1/folders/AbC123xY/files/Fx8kQ2mN7p`} />
      </section>

      <section id="reponse">
        <h2>Réponse type</h2>
        <p>Chaque fichier reçu est analysé&nbsp;: type réel, risque estimé, empreinte, contenu des archives ZIP.</p>
        <CodeBlock
          lang="json"
          code={`{
  "folder": {
    "id": "AbC123xY",
    "url": "${B}/d/AbC123xY",
    "ownerToken": "q3Jz…",
    "manageUrl": "${B}/d/AbC123xY#cle=q3Jz…"
  },
  "file": {
    "id": "Fx8kQ2mN7p",
    "name": "rapport.pdf",
    "size": 482113,
    "sha256": "9f2c…e41a",
    "detected": { "format": "pdf", "label": "PDF" },
    "risk": "none",
    "warnings": [],
    "archive": null,
    "downloadUrl": "${B}/api/v1/folders/AbC123xY/files/Fx8kQ2mN7p"
  }
}`}
        />
        <p className="mt-4">
          <code>risk</code> vaut <code>none</code>, <code>caution</code> ou <code>high</code>. <code>none</code> signifie qu&apos;aucun signal n&apos;a été
          détecté, jamais qu&apos;un fichier est garanti sans danger.
        </p>
      </section>

      <section id="gros-fichiers">
        <h2>Gros fichiers&nbsp;: envoi par morceaux</h2>
        <p>
          Au-delà de quelques mégaoctets, préférez l&apos;envoi en trois étapes. Il est <strong>reprenable</strong>&nbsp;: en cas de coupure, demandez au serveur
          combien d&apos;octets il a reçus et repartez de là.
        </p>
        <CodeBlock
          lang="bash"
          code={`# 1. Créer le dépôt
curl -X POST ${B}/api/v1/folders \\
  -H "Content-Type: application/json" -d '{"expiresIn":"7d"}'

# 2. Réserver le fichier
curl -X POST ${B}/api/v1/folders/$ID/files \\
  -H "Authorization: Bearer $CLE" -H "Content-Type: application/json" \\
  -d '{"name":"video.mp4","size":52428800}'

# 3. Envoyer les morceaux (8 Mo conseillés), puis finaliser
curl -X PUT "${B}/api/v1/folders/$ID/files/$FID/chunk?name=video.mp4&offset=0" \\
  -H "Authorization: Bearer $CLE" --data-binary @morceau-0
curl -X POST ${B}/api/v1/folders/$ID/files/$FID/complete \\
  -H "Authorization: Bearer $CLE" -H "Content-Type: application/json" \\
  -d '{"name":"video.mp4"}'`}
        />
        <Callout title="Reprise après coupure">
          <p>
            Un <code>GET</code> sur l&apos;URL <code>…/chunk?name=…</code> renvoie <code>{`{ "received": 41943040 }`}</code>. Un morceau envoyé à une mauvaise
            position est refusé avec <code>409</code> et la position attendue.
          </p>
        </Callout>
      </section>

      <section id="exemples">
        <h2>Exemples</h2>
        <h3>Python</h3>
        <CodeBlock
          lang="python"
          code={`import os, requests

BASE = "${B}"
CHUNK = 8 * 1024 * 1024

def envoyer(chemin, expiration="7d"):
    nom, taille = os.path.basename(chemin), os.path.getsize(chemin)
    depot = requests.post(f"{BASE}/api/v1/folders", json={"expiresIn": expiration}).json()
    cle = {"Authorization": f"Bearer {depot['ownerToken']}"}
    fid = depot["folder"]["id"]

    f = requests.post(f"{BASE}/api/v1/folders/{fid}/files", headers=cle,
                      json={"name": nom, "size": taille}).json()
    with open(chemin, "rb") as src:
        offset = 0
        while chunk := src.read(CHUNK):
            r = requests.put(f"{BASE}{f['chunkUrl']}&offset={offset}", headers=cle, data=chunk)
            r.raise_for_status()
            offset = r.json()["received"]

    requests.post(f"{BASE}{f['completeUrl']}", headers=cle, json={"name": nom}).raise_for_status()
    return depot["url"], depot["manageUrl"]

print(envoyer("sauvegarde.zip"))`}
        />
        <h3>JavaScript (Node 20+)</h3>
        <CodeBlock
          lang="javascript"
          code={`import { readFile } from "node:fs/promises";

const res = await fetch("${B}/api/v1/upload/capture.png", {
  method: "PUT",
  headers: { "X-Relais-Expires": "1d" },
  body: await readFile("capture.png"),
});
const { folder, file } = await res.json();
console.log(folder.url, file.risk);`}
        />
        <h3>Supprimer un dépôt</h3>
        <CodeBlock lang="bash" code={`curl -X DELETE ${B}/api/v1/folders/$ID -H "Authorization: Bearer $CLE"`} />
      </section>

      <section id="reference">
        <h2>Référence</h2>
        <div className="not-prose -mx-1 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-muted">
                <th scope="col" className="py-3 pr-4 font-medium">
                  Méthode
                </th>
                <th scope="col" className="py-3 pr-4 font-medium">
                  Chemin
                </th>
                <th scope="col" className="py-3 pr-4 font-medium">
                  Accès
                </th>
                <th scope="col" className="py-3 font-medium">
                  Rôle
                </th>
              </tr>
            </thead>
            <tbody>
              {ENDPOINTS.map(([m, p, a, d]) => (
                <tr key={m + p} className="border-b border-line align-top last:border-0">
                  <td className="py-3 pr-4">
                    <span className={`rounded-md px-1.5 py-0.5 font-mono text-[0.7rem] font-semibold ${METHOD[m]}`}>{m}</span>
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs text-ink">{p}</td>
                  <td className="py-3 pr-4 text-xs text-muted">{a}</td>
                  <td className="py-3 text-ink-2">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="erreurs">
        <h2>Erreurs</h2>
        <p>
          Toute erreur renvoie un JSON <code>{`{ "error": "message lisible", "code": "identifiant" }`}</code> avec le statut HTTP approprié.
        </p>
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <tbody>
              {ERRORS.map(([s, c, d]) => (
                <tr key={s} className="border-b border-line last:border-0">
                  <td className="py-3 pr-4 font-mono font-semibold">{s}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-muted">{c}</td>
                  <td className="py-3 text-ink-2">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="limites">
        <h2>Limites de cette instance</h2>
        <ul>
          <li>
            Taille maximale par fichier&nbsp;: <strong>{formatBytes(cfg.maxFileSize, 0)}</strong>
          </li>
          <li>
            Taille maximale par dépôt&nbsp;: <strong>{formatBytes(cfg.maxFolderSize, 0)}</strong>, jusqu&apos;à 500 fichiers
          </li>
          <li>
            Envoi en une requête (<code>/upload</code>, <code>/chunk</code>)&nbsp;: <strong>{formatBytes(cfg.maxDirectUpload, 0)}</strong>
            {cfg.driver === "blob" && " par requête ; au-delà, l'interface web envoie directement vers le stockage en multipart"}
          </li>
          <li>Création de dépôts&nbsp;: 40 par tranche de 10 minutes et par adresse IP</li>
        </ul>
        <p>
          Ces valeurs sont aussi disponibles en JSON sur <a href="/api/v1/config">/api/v1/config</a>.
        </p>
      </section>
    </DocLayout>
  );
}

#!/usr/bin/env node
/**
 * Déploie les fichiers du portfolio sur Neocities via leur API.
 *
 * Prérequis :
 *   1. Obtenir ta clé API : https://neocities.org/settings (section API Key)
 *   2. Créer un fichier .env à la racine du dossier portfolio :
 *        NEOCITIES_API_KEY=ta_clé_ici
 *
 * Usage :
 *   node scripts/deploy-neocities.js
 *
 * Ce script envoie :
 *   - index.html  (mis à jour avec les projets dynamiques)
 *   - data/projects.json
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

// Charge .env manuellement (pas de dépendance dotenv)
function loadEnv() {
  const envPath = path.join(__dirname, "../.env");
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, "utf-8")
    .split("\n")
    .forEach((line) => {
      const [key, ...rest] = line.split("=");
      if (key && rest.length) {
        process.env[key.trim()] = rest.join("=").trim();
      }
    });
}

function buildFormData(files) {
  const boundary = "----NeocitiesBoundary" + Date.now();
  const parts = [];

  for (const [fieldName, { filename, content, mimeType }] of Object.entries(files)) {
    const header = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"`,
      `Content-Type: ${mimeType}`,
      "",
      "",
    ].join("\r\n");
    parts.push(Buffer.from(header, "utf-8"));
    parts.push(content);
    parts.push(Buffer.from("\r\n", "utf-8"));
  }

  parts.push(Buffer.from(`--${boundary}--\r\n`, "utf-8"));

  return {
    boundary,
    body: Buffer.concat(parts),
  };
}

function uploadToNeocities(apiKey, files) {
  return new Promise((resolve, reject) => {
    const { boundary, body } = buildFormData(files);

    const options = {
      hostname: "neocities.org",
      path: "/api/upload",
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": body.length,
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (json.result === "success") {
            resolve(json);
          } else {
            reject(new Error(json.message || "Erreur Neocities"));
          }
        } catch {
          reject(new Error("Réponse invalide : " + data));
        }
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  loadEnv();

  const apiKey = process.env.NEOCITIES_API_KEY;
  if (!apiKey) {
    console.error(
      "NEOCITIES_API_KEY manquant.\n" +
      "Crée un fichier .env dans portfolio/ avec :\n" +
      "NEOCITIES_API_KEY=ta_clé_ici\n\n" +
      "Clé disponible ici : https://neocities.org/settings"
    );
    process.exit(1);
  }

  const publicDir = path.join(__dirname, "../public");

  const indexPath = path.join(publicDir, "index.html");
  const dataPath  = path.join(publicDir, "data", "projects.json");

  if (!fs.existsSync(indexPath)) {
    console.error("index.html introuvable. Lance d'abord : node scripts/build.js");
    process.exit(1);
  }
  if (!fs.existsSync(dataPath)) {
    console.error("data/projects.json introuvable. Lance d'abord : node scripts/build.js");
    process.exit(1);
  }

  const files = {
    "index.html": {
      filename: "index.html",
      content: fs.readFileSync(indexPath),
      mimeType: "text/html",
    },
    "data/projects.json": {
      filename: "data/projects.json",
      content: fs.readFileSync(dataPath),
      mimeType: "application/json",
    },
  };

  console.log("Envoi vers Neocities...");
  await uploadToNeocities(apiKey, files);
  console.log("Déploiement réussi → https://portfolio-gourbal.neocities.org/");
}

main().catch((err) => {
  console.error("Erreur :", err.message);
  process.exit(1);
});

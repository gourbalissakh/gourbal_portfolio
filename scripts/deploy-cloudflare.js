#!/usr/bin/env node
/**
 * Déploie le portfolio sur Cloudflare Pages via Wrangler.
 *
 * Prérequis :
 *   1. npm install -g wrangler
 *   2. wrangler login     (ouvre le navigateur, connecte ton compte Cloudflare)
 *   3. Créer le projet Cloudflare Pages une première fois :
 *      wrangler pages project create portfolio-gourbal
 *
 * Usage :
 *   node scripts/deploy-cloudflare.js
 *   — ou —
 *   npm run deploy
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const PUBLIC_DIR = path.join(__dirname, "../public");
const PROJECT_NAME = "portfolio-gourbal"; // même nom que ton projet Cloudflare Pages

function run(program, args, cwd) {
  const result = spawnSync(program, args, { stdio: "inherit", cwd, shell: true });
  if (result.status !== 0) {
    console.error(`Commande échouée : ${[program, ...args].join(" ")}`);
    process.exit(result.status ?? 1);
  }
}

if (!fs.existsSync(path.join(PUBLIC_DIR, "data", "projects.json"))) {
  console.log("Build manquant, lancement de scripts/build.js...");
  run(process.execPath, [path.join(__dirname, "build.js")]);
}

console.log(`\nDéploiement vers Cloudflare Pages (${PROJECT_NAME})...\n`);
run("wrangler", ["pages", "deploy", PUBLIC_DIR, `--project-name=${PROJECT_NAME}`]);
console.log("\nDéploiement terminé.");
console.log("Ton portfolio est en ligne sur : https://gourbal.me");

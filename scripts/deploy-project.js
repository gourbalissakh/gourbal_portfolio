#!/usr/bin/env node
/**
 * Lance le déploiement d'un projet selon sa plateforme configurée dans projects.json.
 *
 * Usage :
 *   node scripts/deploy-project.js --id my-app
 *
 * Prérequis par plateforme :
 *   cloudflare-pages : wrangler installé, CLOUDFLARE_API_TOKEN en env
 *   vercel            : vercel CLI installé, connecté
 *   netlify           : netlify CLI installé, connecté
 *   github-pages      : gh-pages installé
 *   railway/render    : déploiement via git push (aucune action ici)
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "../src/data/projects.json");

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--") && args[i + 1]) {
      result[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }
  return result;
}

function run(program, args, cwd) {
  const label = [program, ...args].join(" ");
  console.log(`> ${label}`);
  const result = spawnSync(program, args, { stdio: "inherit", cwd });
  if (result.status !== 0) {
    console.error(`Commande échouée : ${label}`);
    process.exit(result.status ?? 1);
  }
}

function main() {
  const { id } = parseArgs();
  if (!id) {
    console.error("Usage : node scripts/deploy-project.js --id <project-id>");
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  const project = data.projects.find((p) => p.id === id);

  if (!project) {
    console.error(`Projet non trouvé : ${id}`);
    process.exit(1);
  }

  const projectDir = path.resolve(__dirname, "..", "..", id);
  if (!fs.existsSync(projectDir)) {
    console.error(`Dossier du projet introuvable : ${projectDir}`);
    process.exit(1);
  }

  console.log(`\nDéploiement de "${project.name}" sur ${project.platform}...\n`);

  switch (project.platform) {
    case "cloudflare-pages":
      run("npx", ["wrangler", "pages", "deploy", "dist", `--project-name=${id}`], projectDir);
      break;

    case "vercel":
      run("npx", ["vercel", "--prod", "--yes"], projectDir);
      break;

    case "netlify":
      run("npx", ["netlify", "deploy", "--prod", "--dir=dist"], projectDir);
      break;

    case "github-pages":
      run("npx", ["gh-pages", "-d", "dist"], projectDir);
      break;

    case "railway":
    case "render":
    case "other":
      console.log(`Plateforme "${project.platform}" : déploiement via git push.`);
      console.log(`Faites : cd ${projectDir} && git push`);
      break;

    default:
      console.error(`Plateforme non gérée : ${project.platform}`);
      process.exit(1);
  }

  console.log(`\nDéploiement terminé. URL : ${project.hostedUrl}`);
}

main();

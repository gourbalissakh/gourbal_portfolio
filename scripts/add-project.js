#!/usr/bin/env node
/**
 * Ajoute ou met à jour un projet dans projects.json.
 *
 * Usage minimal :
 *   node scripts/add-project.js \
 *     --id          "mon-projet" \
 *     --name        "Mon Projet" \
 *     --description "Ce que fait le projet." \
 *     --stack       "PHP,MySQL,Bootstrap" \
 *     --imageUrl    "nom-image.png" \
 *     --icon        "bi-globe" \
 *     --badgeColor  "primary" \
 *     --titleColor  "primary"
 *
 * Options supplémentaires :
 *   --github      "https://github.com/..."
 *   --hosted      "https://..."
 *   --platform    "cloudflare-pages|vercel|netlify|github-pages|other"
 *   --domain      "monprojet.com"
 *   --featured
 *   --badgeTextDark   (si fond clair : warning, light...)
 */

const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "../src/data/projects.json");

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      if (args[i + 1] && !args[i + 1].startsWith("--")) {
        result[key] = args[i + 1];
        i++;
      } else {
        result[key] = true;
      }
    }
  }
  return result;
}

function main() {
  const args = parseArgs();

  const required = ["id", "name", "description", "stack"];
  for (const field of required) {
    if (!args[field]) {
      console.error(`Champ requis manquant : --${field}`);
      process.exit(1);
    }
  }

  const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  const existingIndex = data.projects.findIndex((p) => p.id === args.id);

  const project = {
    id: args.id,
    name: args.name,
    description: args.description,
    stack: args.stack.split(",").map((s) => s.trim()),
    githubUrl: args.github || null,
    hostedUrl: args.hosted || null,
    platform: args.platform || "other",
    customDomain: args.domain || null,
    imageUrl: args.imageUrl || null,
    badgeColor: args.badgeColor || "primary",
    badgeTextDark: args.badgeTextDark === true,
    icon: args.icon || "bi-folder-fill",
    titleColor: args.titleColor || args.badgeColor || "primary",
    featured: args.featured === true,
    updatedAt: new Date().toISOString().split("T")[0],
  };

  if (existingIndex !== -1) {
    data.projects[existingIndex] = project;
    console.log(`Projet mis à jour : ${args.id}`);
  } else {
    data.projects.push(project);
    console.log(`Projet ajouté : ${args.id}`);
  }

  // Featured en premier, puis par date décroissante
  data.projects.sort((a, b) => {
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  console.log(`Fichier mis à jour : ${DATA_FILE}`);
}

main();

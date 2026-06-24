# Portfolio Gourbal — Documentation complète

> **Auteur :** Mahamat Issakh GOURBAL  
> **Site :** https://gourbal.me  
> **Admin :** https://gourbal-portfolio.onrender.com/admin  
> **Repo :** https://github.com/gourbalissakh/gourbal_portfolio

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture](#2-architecture)
3. [Structure du projet](#3-structure-du-projet)
4. [Le Portfolio (frontend)](#4-le-portfolio-frontend)
5. [Le Panel Admin](#5-le-panel-admin)
6. [Pipeline CI/CD](#6-pipeline-cicd)
7. [Enregistrement vidéo automatique](#7-enregistrement-vidéo-automatique)
8. [Variables d'environnement](#8-variables-denvironnement)
9. [Workflows GitHub Actions](#9-workflows-github-actions)
10. [Sécurité](#10-sécurité)
11. [Déploiement Render.com](#11-déploiement-rendercom)
12. [Problèmes rencontrés et solutions](#12-problèmes-rencontrés-et-solutions)

---

## 1. Vue d'ensemble

Ce projet est composé de deux applications liées :

| Application | Technologie | Hébergement |
|---|---|---|
| Portfolio public | HTML/CSS/JS vanilla | Cloudflare Pages |
| Panel d'administration | Node.js Express | Render.com |

**Principe fondamental :** GitHub est la seule source de vérité. Pas de base de données. Les données (projets, compétences, galerie) sont stockées dans des fichiers JSON dans `src/data/`. Toute modification dans l'admin commit directement sur GitHub via l'API, ce qui déclenche un déploiement automatique.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    ADMIN (Render.com)                    │
│         https://gourbal-portfolio.onrender.com/admin     │
└─────────────────────┬───────────────────────────────────┘
                      │ GitHub API (PUT /contents)
                      ▼
┌─────────────────────────────────────────────────────────┐
│              GitHub (gourbalissakh/gourbal_portfolio)    │
│  src/data/projects.json                                  │
│  src/data/skills.json                                    │
│  src/data/gallery.json                                   │
│  public/assets/gallery/   ← photos événements           │
│  public/assets/demos/     ← vidéos démo projets         │
└─────────────────────┬───────────────────────────────────┘
                      │ Push → GitHub Actions se déclenche
                      ▼
┌─────────────────────────────────────────────────────────┐
│           GitHub Actions (deploy-portfolio.yml)          │
│  1. node scripts/build.js  (copie data → public/data/)  │
│  2. wrangler pages deploy --no-bundle                    │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│           Cloudflare Pages — https://gourbal.me          │
└─────────────────────────────────────────────────────────┘
```

**Durée totale entre une modification admin et la mise en ligne : ~60 secondes.**

---

## 3. Structure du projet

```
portfolio/
├── public/                    # Fichiers servis par Cloudflare Pages
│   ├── index.html             # Portfolio complet (SPA vanilla)
│   ├── data/                  # Généré par build.js (ignoré par git)
│   ├── assets/
│   │   ├── banners/           # Bannières SVG des projets
│   │   ├── gallery/           # Photos des événements (uploadées via admin)
│   │   └── demos/             # Vidéos .webm enregistrées automatiquement
│
├── src/
│   └── data/                  # Source de vérité — modifiée par l'admin
│       ├── projects.json
│       ├── skills.json
│       └── gallery.json
│
├── admin/
│   ├── server.js              # Serveur Express — mode local ou GitHub API
│   └── panel.html             # Interface admin (SPA vanilla)
│
├── scripts/
│   ├── build.js               # Copie src/data/ → public/data/
│   ├── record-demo.js         # Playwright — enregistre une démo projet
│   └── record-showcase.js     # Playwright — enregistre portfolio + admin
│
├── .github/workflows/
│   ├── deploy-portfolio.yml   # Auto-deploy sur push src/data/** ou public/**
│   ├── record-demo.yml        # Enregistre vidéo d'un projet (workflow_dispatch)
│   └── record-showcase.yml    # Enregistre portfolio + admin (LinkedIn)
│
├── render.yaml                # Config déclarative Render.com
└── DOCUMENTATION.md           # Ce fichier
```

---

## 4. Le Portfolio (frontend)

**Fichier :** `public/index.html` — application complète en un seul fichier HTML.

### Sections

| ID | Contenu |
|---|---|
| `#apropos` | Présentation personnelle |
| `#competences` | Grille de compétences avec filtres par catégorie |
| `#projets` | Cards projets chargées dynamiquement |
| `#galerie` | Événements avec photos et lightbox |
| `#contact` | Liens de contact |

### Chargement des données

Les données sont chargées via `fetch()` au démarrage :

```javascript
fetch('data/projects.json')  // → src/data/projects.json copié par build.js
fetch('data/skills.json')
fetch('data/gallery.json')
```

### Cards projets

Chaque card peut afficher :
- Une bannière SVG ou image
- **Une vidéo `.webm` en lecture automatique** (muette, en boucle) si `videoUrl` pointe vers un fichier local
- Un bouton "Démo" si `videoUrl` est un lien YouTube/Vimeo
- Un bouton "Live" si `hostedUrl` ou `customDomain` est renseigné
- Un bouton "GitHub"

### Modale vidéo

Clic sur la vidéo en bannière → modale plein écran.
Supporte : YouTube, Vimeo, fichiers `.webm` et `.mp4` locaux.
Fermeture : bouton ✕, clic dehors, ou touche Escape.

### Lightbox galerie

Navigation entre photos avec touches ← →, compteur, légende.

### Contrainte de sécurité absolue

**Zéro `innerHTML`** dans tout le JavaScript du portfolio.
Tout le DOM est construit via `createElement` / `textContent` / `appendChild`.

---

## 5. Le Panel Admin

**Fichier :** `admin/panel.html` + `admin/server.js`

### Pages

| Page | Fonctionnalités |
|---|---|
| Dashboard | Stats (projets, compétences, photos), bouton déployer |
| Projets | CRUD complet, bouton 🎬 enregistrement vidéo |
| Compétences | CRUD complet avec catégories et niveaux |
| Galerie | Gestion événements, upload photos multiples |
| Paramètres | Changement mot de passe, infos GitHub |

### Deux modes de fonctionnement

**Mode local** (pas de `GITHUB_TOKEN`) :
- Lit/écrit les fichiers JSON directement sur le disque
- Upload photos dans `public/assets/gallery/`
- Lancer le build et le déploiement via des scripts locaux

**Mode en ligne** (avec `GITHUB_TOKEN`) :
- Lit/écrit via l'API GitHub (`PUT /repos/.../contents/src/data/fichier`)
- Upload photos via l'API GitHub (`PUT /repos/.../contents/public/assets/gallery/...`)
- Déploiement automatique déclenché par le commit GitHub
- `/api/deploy` et `/api/build` retournent immédiatement (GitHub Actions s'en charge)

### Authentification

SHA256 du mot de passe stocké dans `ADMIN_PWD_HASH` (en ligne) ou `admin/.adminpwd` (local).
Sessions de 8h avec token aléatoire.

### Champ `videoUrl` projet

- Lien YouTube/Vimeo → bouton "Démo" dans la card
- Chemin local `assets/demos/slug.webm` → vidéo en bannière
- Rempli automatiquement après enregistrement via 🎬

---

## 6. Pipeline CI/CD

### deploy-portfolio.yml

Se déclenche sur tout push vers `main` touchant :
- `src/data/**`
- `public/**`
- `scripts/build.js`

Étapes :
1. Checkout du repo
2. `node scripts/build.js` — copie `src/data/` vers `public/data/`
3. `wrangler pages deploy public --project-name=portfolio-gourbal --no-bundle`

**Note importante :** Le flag `--no-bundle` est obligatoire. Sans lui, Cloudflare Pages retourne une erreur interne liée aux Functions.

**Note importante 2 :** Les commits faits par `github-actions[bot]` ne déclenchent pas d'autres workflows (protection anti-boucle de GitHub). C'est pourquoi le workflow `record-demo.yml` inclut lui-même l'étape de déploiement Cloudflare.

---

## 7. Enregistrement vidéo automatique

### Principe

Un workflow GitHub Actions lance Chrome en mode headless via Playwright, visite l'URL du projet, scrolle la page, enregistre une vidéo `.webm`, la commit dans le repo et met à jour `projects.json`.

### Déclenchement

Depuis l'admin : bouton 🎬 à côté d'un projet → appel `POST /api/record-demo` → dispatch `workflow_dispatch` sur `record-demo.yml`.

### Notification

L'admin poll `GET /api/record-status` toutes les 15 secondes.
Quand `status === 'completed'` → toast de notification.

### record-demo.yml

```
workflow_dispatch (project_id, project_url, project_name)
  → Install Playwright + Chromium
  → node scripts/record-demo.js
  → git commit public/assets/demos/ + src/data/projects.json
  → node scripts/build.js
  → wrangler pages deploy
```

### record-showcase.yml

Workflow manuel pour générer des vidéos LinkedIn :
- `portfolio.webm` (~90s) — scroll complet du portfolio
- `admin.webm` (~60s) — navigation complète dans l'admin

Vidéos disponibles en téléchargement dans les **Artifacts** GitHub Actions pendant 7 jours.

---

## 8. Variables d'environnement

### Render.com (admin)

| Variable | Description | Obligatoire |
|---|---|---|
| `PORT` | Port du serveur (10000) | Oui |
| `GITHUB_TOKEN` | Personal Access Token (scope: repo) | Oui (mode en ligne) |
| `GITHUB_OWNER` | `gourbalissakh` | Oui |
| `GITHUB_REPO` | `gourbal_portfolio` | Oui |
| `GITHUB_BRANCH` | `main` | Oui |
| `ADMIN_PWD_HASH` | SHA256 du mot de passe admin | Oui |

### GitHub Secrets (Actions)

| Secret | Description |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Token API Cloudflare Pages |
| `CLOUDFLARE_ACCOUNT_ID` | ID du compte Cloudflare |
| `ADMIN_PASSWORD` | Mot de passe admin en clair (pour Playwright) |

---

## 9. Workflows GitHub Actions

### Générer le hash d'un mot de passe

```bash
node -e "const c=require('crypto'); console.log(c.createHash('sha256').update('tonmotdepasse').digest('hex'))"
```

### Déclencher manuellement un enregistrement

```
GitHub → Actions → Record Demo Video → Run workflow
  project_id:   slug-du-projet
  project_url:  https://url-du-projet.com
  project_name: Nom du Projet
```

### Déclencher le déploiement sans modifier les données

Faire un push quelconque sur `src/data/**` ou `public/**`.

---

## 10. Sécurité

### Contraintes appliquées partout

- **Zéro `innerHTML`** dans tout le JavaScript frontend et admin
- `spawnSync` (jamais `execSync`) pour les sous-processus
- Validation des URLs : doit commencer par `https://`
- Validation des icônes : regex `/^bi-[a-z0-9-]+$/`
- Validation des couleurs : Set allowlist
- `admin/.adminpwd` dans `.gitignore` — jamais committé

### Ce qui ne doit jamais être committé

```
node_modules/
.env
admin/.adminpwd
public/data/        ← généré à la volée par build.js
```

---

## 11. Déploiement Render.com

### Configuration (render.yaml)

```yaml
services:
  - type: web
    name: admin-gourbal
    runtime: node
    rootDir: .
    buildCommand: npm install
    startCommand: node admin/server.js
    plan: free
```

### Limitations du plan gratuit

- Le service **s'endort après 15 minutes** d'inactivité
- **Cold start ~50 secondes** au premier accès
- Le workflow `record-showcase.yml` fait un `curl` préalable pour réveiller le service avant l'enregistrement

---

## 12. Problèmes rencontrés et solutions

| Problème | Cause | Solution |
|---|---|---|
| `wrangler pages deploy` — Unknown internal error | Cloudflare Pages détecte des Functions | Ajouter `--no-bundle` |
| `git push` rejeté | Admin avait commité en ligne pendant le dev local | `git pull --rebase origin main` |
| Conflit sur `gallery.json` | Admin online + local modifiaient le même fichier | `git checkout --theirs src/data/gallery.json` |
| Workflow `record-demo` — exit code 128 | Pas de permission `contents: write` | Ajouter `permissions: contents: write` + `token: ${{ secrets.GITHUB_TOKEN }}` dans checkout |
| Vidéo non visible après enregistrement | Commit `github-actions[bot]` ne déclenche pas d'autres workflows | Inclure le déploiement Cloudflare directement dans `record-demo.yml` |
| Admin Render timeout | Cold start 50s non géré par Playwright | Étape `curl` pour réveiller avant enregistrement |
| Photo upload bloqué en mode en ligne | Server.js refusait les uploads online | Implémenter upload via GitHub API avec base64 |

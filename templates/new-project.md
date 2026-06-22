# Checklist nouveau projet

Quand tu crées un nouveau projet, exécute ces étapes dans l'ordre.

---

## 1. Créer le projet

```bash
mkdir ~/projets/mon-projet && cd ~/projets/mon-projet
# Initialiser selon la stack (vite, next, etc.)
```

## 2. Ajouter au portfolio

Depuis le dossier `portfolio/` :

```bash
node scripts/add-project.js \
  --id         "mon-projet" \
  --name       "Mon Projet" \
  --description "Ce que fait le projet en une phrase." \
  --stack      "React,TypeScript,Vite" \
  --github     "https://github.com/yourname/mon-projet" \
  --hosted     "https://mon-projet.pages.dev" \
  --platform   "cloudflare-pages" \
  --featured
  # --preview  "https://..." (optionnel)
  # --domain   "monprojet.com"  (optionnel)
```

## 3. Déployer le projet

```bash
node scripts/deploy-project.js --id mon-projet
```

## 4. Construire et pousser le portfolio

```bash
node scripts/build.js
git add src/data/projects.json public/data/projects.json
git commit -m "feat: add mon-projet"
git push
```

→ GitHub Actions déploie automatiquement le portfolio.

---

## Plateformes disponibles

| Valeur            | Usage recommandé                    |
|-------------------|-------------------------------------|
| cloudflare-pages  | Sites statiques, frontends          |
| vercel            | Next.js, SvelteKit, SSR             |
| netlify           | Sites statiques, fonctions edge     |
| github-pages      | Pages simples, docs                 |
| railway           | Backends Node/Python/Docker         |
| render            | Backends, workers, bases de données |
| other             | Autre (déploiement manuel)          |

---

## Convention de nommage des IDs

- Kebab-case uniquement : `mon-super-projet`
- Pas d'espaces ni de majuscules
- Correspond au nom du dossier et au nom du projet Cloudflare Pages

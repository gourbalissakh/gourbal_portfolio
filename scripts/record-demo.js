#!/usr/bin/env node
/**
 * Enregistre une vidéo démo d'un projet via Playwright (Chrome headless).
 * Utilisé par GitHub Actions (workflow record-demo.yml).
 *
 * Variables d'env :
 *   PROJECT_ID   — slug du projet (ex: qcm-ia)
 *   PROJECT_URL  — URL à visiter (ex: https://mon-app.vercel.app)
 *   PROJECT_NAME — nom affiché dans le portfolio
 */

const { chromium } = require('@playwright/test');
const fs   = require('fs');
const path = require('path');

const PROJECT_ID   = process.env.PROJECT_ID;
const PROJECT_URL  = process.env.PROJECT_URL;
const PROJECT_NAME = process.env.PROJECT_NAME || PROJECT_ID;

if (!PROJECT_ID || !PROJECT_URL) {
  console.error('PROJECT_ID et PROJECT_URL sont requis.');
  process.exit(1);
}

const DEMOS_DIR   = path.join(__dirname, '..', 'public', 'assets', 'demos');
const DATA_FILE   = path.join(__dirname, '..', 'src', 'data', 'projects.json');
const VIDEO_NAME  = PROJECT_ID + '.webm';
const VIDEO_PATH  = path.join(DEMOS_DIR, VIDEO_NAME);

if (!fs.existsSync(DEMOS_DIR)) fs.mkdirSync(DEMOS_DIR, { recursive: true });

(async () => {
  console.log('Lancement de Chrome headless...');
  const browser = await chromium.launch({ headless: true });

  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: DEMOS_DIR, size: { width: 1280, height: 720 } },
  });

  const page = await ctx.newPage();

  console.log('Visite de : ' + PROJECT_URL);
  try {
    await page.goto(PROJECT_URL, { waitUntil: 'networkidle', timeout: 30000 });
  } catch (_) {
    await page.goto(PROJECT_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  }

  // Attendre que la page soit visuellement stable
  await page.waitForTimeout(1500);

  // Scroll progressif pour montrer le contenu
  await page.evaluate(async () => {
    const total = document.body.scrollHeight;
    const step  = Math.max(200, Math.floor(total / 10));
    for (let y = 0; y < total; y += step) {
      window.scrollTo({ top: y, behavior: 'smooth' });
      await new Promise(r => setTimeout(r, 400));
    }
    await new Promise(r => setTimeout(r, 800));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    await new Promise(r => setTimeout(r, 600));
  });

  // Pause finale pour bien terminer la vidéo
  await page.waitForTimeout(1000);

  await ctx.close();
  await browser.close();

  // Playwright génère un nom aléatoire — on le renomme
  const files = fs.readdirSync(DEMOS_DIR).filter(f => f.endsWith('.webm') && f !== VIDEO_NAME);
  if (files.length === 0) {
    console.error('Aucun fichier vidéo généré.');
    process.exit(1);
  }
  const generated = path.join(DEMOS_DIR, files[0]);
  if (fs.existsSync(VIDEO_PATH)) fs.unlinkSync(VIDEO_PATH);
  fs.renameSync(generated, VIDEO_PATH);
  console.log('Vidéo enregistrée : ' + VIDEO_PATH);

  // Mettre à jour projects.json avec videoUrl
  const data   = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const idx    = data.projects.findIndex(p => p.id === PROJECT_ID);
  const vidUrl = 'assets/demos/' + VIDEO_NAME;

  if (idx >= 0) {
    data.projects[idx].videoUrl   = vidUrl;
    data.projects[idx].updatedAt  = new Date().toISOString().split('T')[0];
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log('projects.json mis à jour : videoUrl = ' + vidUrl);
  } else {
    console.warn('Projet non trouvé dans projects.json : ' + PROJECT_ID);
  }

  console.log('Terminé.');
})();

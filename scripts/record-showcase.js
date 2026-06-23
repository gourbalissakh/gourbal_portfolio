#!/usr/bin/env node
/**
 * Enregistre deux vidéos showcase :
 *   1. portfolio.webm — visite complète de gourbal.me (~90s)
 *   2. admin.webm    — visite du panel admin avec navigation (~60s)
 */

const { chromium } = require('@playwright/test');
const fs   = require('fs');
const path = require('path');

const PORTFOLIO_URL  = process.env.PORTFOLIO_URL  || 'https://gourbal.me';
const ADMIN_URL      = process.env.ADMIN_URL      || 'https://gourbal-portfolio.onrender.com/admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const OUT_DIR        = path.join(__dirname, '..', 'showcase-videos');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const wait = ms => new Promise(r => setTimeout(r, ms));

async function safeClick(page, selector) {
  try {
    await page.waitForSelector(selector, { timeout: 8000, state: 'visible' });
    await page.click(selector);
    return true;
  } catch (e) {
    console.warn('safeClick échoué sur ' + selector + ' : ' + e.message);
    return false;
  }
}

async function scrollTo(page, y) {
  await page.evaluate(yy => window.scrollTo({ top: yy, behavior: 'smooth' }), y);
}

async function scrollToSection(page, selector) {
  await page.evaluate(sel => {
    const el = document.querySelector(sel);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, selector);
}

async function recordPage(browser, url, filename, actions) {
  console.log('\n▶ Enregistrement : ' + filename + ' (' + url + ')');
  const tmpDir = path.join(OUT_DIR, 'tmp_' + filename.replace('.webm', ''));
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: tmpDir, size: { width: 1440, height: 900 } },
  });
  const page = await ctx.newPage();

  console.log('Chargement de ' + url + '...');
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  } catch (_) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    } catch (e2) {
      console.error('Impossible de charger ' + url + ' : ' + e2.message);
      await ctx.close();
      return;
    }
  }
  console.log('Page chargée.');
  await wait(3000);

  try {
    await actions(page);
  } catch (e) {
    console.error('Erreur pendant actions : ' + e.message);
  }

  await wait(2000);
  await ctx.close();

  const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.webm'));
  if (!files.length) { console.error('Pas de vidéo générée pour ' + filename); return; }
  const dest = path.join(OUT_DIR, filename);
  if (fs.existsSync(dest)) fs.unlinkSync(dest);
  fs.renameSync(path.join(tmpDir, files[0]), dest);
  try { fs.rmdirSync(tmpDir); } catch (_) {}
  console.log('✅ Vidéo sauvegardée : ' + dest);
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  // ══════════════════════════════════════════════════════════════════════════
  // 1. PORTFOLIO — ~90 secondes
  // ══════════════════════════════════════════════════════════════════════════
  await recordPage(browser, PORTFOLIO_URL, 'portfolio.webm', async (page) => {
    // Hero — animations d'entrée
    await wait(4000);

    // À propos
    await scrollToSection(page, '#apropos');
    await wait(4000);

    // Compétences
    await scrollToSection(page, '#competences');
    await wait(5000);
    await scrollTo(page, await page.evaluate(() => {
      const el = document.querySelector('#competences');
      return el ? el.offsetTop + 400 : 800;
    }));
    await wait(3000);

    // Projets
    await scrollToSection(page, '#projets');
    await wait(4000);

    // Scroll dans la grille projets
    for (const offset of [400, 900, 1400, 1900]) {
      await scrollTo(page, await page.evaluate(off => {
        const el = document.querySelector('#projets');
        return el ? el.offsetTop + off : off;
      }, offset));
      await wait(3000);
    }

    // Galerie
    await scrollToSection(page, '#galerie');
    await wait(5000);
    await scrollTo(page, await page.evaluate(() => {
      const el = document.querySelector('#galerie');
      return el ? el.offsetTop + 400 : 2000;
    }));
    await wait(3000);

    // Contact
    await scrollToSection(page, '#contact');
    await wait(4000);

    // Retour en haut
    await scrollTo(page, 0);
    await wait(3000);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 2. ADMIN — ~60 secondes
  // Render.com free tier peut prendre 50s à démarrer
  // ══════════════════════════════════════════════════════════════════════════
  await recordPage(browser, ADMIN_URL, 'admin.webm', async (page) => {

    // Login
    if (ADMIN_PASSWORD) {
      try {
        await page.waitForSelector('input[type="password"]', { timeout: 15000, state: 'visible' });
        await wait(1000);
        await page.fill('input[type="password"]', ADMIN_PASSWORD);
        await wait(800);
        await page.keyboard.press('Enter');
        await wait(4000);
      } catch (_) {
        console.log('Pas de page de login — déjà connecté ou timeout.');
      }
    }

    // Dashboard
    await wait(4000);
    await scrollTo(page, 400);
    await wait(2500);
    await scrollTo(page, 0);
    await wait(2000);

    // Projets
    if (await safeClick(page, '.sb-item[data-page="projects"]')) {
      await wait(4000);
      await scrollTo(page, 500);
      await wait(2500);
      await scrollTo(page, 1000);
      await wait(2000);
      await scrollTo(page, 0);
      await wait(1500);
    }

    // Compétences
    if (await safeClick(page, '.sb-item[data-page="skills"]')) {
      await wait(4000);
      await scrollTo(page, 400);
      await wait(2500);
      await scrollTo(page, 0);
      await wait(1500);
    }

    // Galerie
    if (await safeClick(page, '.sb-item[data-page="gallery"]')) {
      await wait(4000);
      await scrollTo(page, 400);
      await wait(2500);
    }

    // Retour Dashboard
    if (await safeClick(page, '.sb-item[data-page="dashboard"]')) {
      await wait(3000);
    }
  });

  await browser.close();
  console.log('\n🎬 Terminé. Vidéos dans showcase-videos/');
})();

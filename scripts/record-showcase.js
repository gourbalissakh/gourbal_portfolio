#!/usr/bin/env node
/**
 * Enregistre deux vidéos showcase :
 *   1. portfolio.webm — visite de gourbal.me
 *   2. admin.webm    — visite du panel admin avec login automatique
 *
 * Variables d'env :
 *   PORTFOLIO_URL  — ex: https://gourbal.me
 *   ADMIN_URL      — ex: https://gourbal-portfolio.onrender.com/admin
 *   ADMIN_PASSWORD — mot de passe admin (GitHub secret)
 */

const { chromium } = require('@playwright/test');
const fs   = require('fs');
const path = require('path');

const PORTFOLIO_URL  = process.env.PORTFOLIO_URL  || 'https://gourbal.me';
const ADMIN_URL      = process.env.ADMIN_URL      || 'https://gourbal-portfolio.onrender.com/admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const OUT_DIR        = path.join(__dirname, '..', 'showcase-videos');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function recordPage(browser, url, filename, actions) {
  console.log('\n▶ Enregistrement : ' + filename + ' (' + url + ')');
  const tmpDir = path.join(OUT_DIR, 'tmp_' + filename);
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: tmpDir, size: { width: 1440, height: 900 } },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  } catch (_) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  }
  await page.waitForTimeout(2000);

  if (actions) await actions(page);

  await page.waitForTimeout(1500);
  await ctx.close();

  // Renommer le fichier généré
  const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.webm'));
  if (!files.length) { console.error('Pas de vidéo générée pour ' + filename); process.exit(1); }
  const dest = path.join(OUT_DIR, filename);
  if (fs.existsSync(dest)) fs.unlinkSync(dest);
  fs.renameSync(path.join(tmpDir, files[0]), dest);
  fs.rmdirSync(tmpDir);
  console.log('✅ Sauvegardé : ' + dest);
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ── 1. Portfolio ──────────────────────────────────────────────────────────
  await recordPage(browser, PORTFOLIO_URL, 'portfolio.webm', async (page) => {
    // Scroll progressif sur toute la page
    await page.evaluate(async () => {
      const sections = ['#apropos', '#competences', '#projets', '#galerie', '#contact'];
      for (const sel of sections) {
        const el = document.querySelector(sel);
        if (el) { el.scrollIntoView({ behavior: 'smooth' }); }
        await new Promise(r => setTimeout(r, 2200));
      }
      await new Promise(r => setTimeout(r, 800));
      window.scrollTo({ top: 0, behavior: 'smooth' });
      await new Promise(r => setTimeout(r, 1000));
    });
  });

  // ── 2. Admin panel ────────────────────────────────────────────────────────
  await recordPage(browser, ADMIN_URL, 'admin.webm', async (page) => {
    // Login
    if (ADMIN_PASSWORD) {
      try {
        await page.waitForSelector('input[type="password"]', { timeout: 10000 });
        await page.fill('input[type="password"]', ADMIN_PASSWORD);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000);
      } catch (_) {
        console.log('Pas de page de login détectée, déjà connecté.');
      }
    }

    // Dashboard
    await page.waitForTimeout(1500);

    // Aller sur Projets
    const nav = await page.$('[data-page="projects"], #nav-projects, .nav-item');
    if (nav) { await nav.click(); await page.waitForTimeout(1800); }

    // Scroll dans la liste projets
    await page.evaluate(async () => {
      window.scrollTo({ top: 300, behavior: 'smooth' });
      await new Promise(r => setTimeout(r, 1000));
      window.scrollTo({ top: 0, behavior: 'smooth' });
      await new Promise(r => setTimeout(r, 800));
    });

    // Aller sur Compétences
    const navSk = await page.$('[data-page="skills"]');
    if (navSk) { await navSk.click(); await page.waitForTimeout(1800); }

    // Aller sur Galerie
    const navGal = await page.$('[data-page="gallery"]');
    if (navGal) { await navGal.click(); await page.waitForTimeout(1800); }

    // Retour Dashboard
    const navDash = await page.$('[data-page="dashboard"]');
    if (navDash) { await navDash.click(); await page.waitForTimeout(1500); }
  });

  await browser.close();
  console.log('\n🎬 Les deux vidéos sont prêtes dans showcase-videos/');
})();

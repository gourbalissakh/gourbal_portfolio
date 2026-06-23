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

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function recordPage(browser, url, filename, actions) {
  console.log('\n▶ Enregistrement : ' + filename);
  const tmpDir = path.join(OUT_DIR, 'tmp_' + filename.replace('.webm',''));
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: tmpDir, size: { width: 1440, height: 900 } },
  });
  const page = await ctx.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  } catch (_) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  }
  await wait(3000);

  await actions(page);

  await wait(2000);
  await ctx.close();

  const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.webm'));
  if (!files.length) { console.error('Pas de vidéo pour ' + filename); process.exit(1); }
  const dest = path.join(OUT_DIR, filename);
  if (fs.existsSync(dest)) fs.unlinkSync(dest);
  fs.renameSync(path.join(tmpDir, files[0]), dest);
  fs.rmdirSync(tmpDir);
  console.log('✅ ' + dest);
}

// ── Scroll smooth sur Y ──
async function scrollTo(page, y) {
  await page.evaluate(yy => window.scrollTo({ top: yy, behavior: 'smooth' }), y);
}
async function scrollToEl(page, selector) {
  await page.evaluate(sel => {
    const el = document.querySelector(sel);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, selector);
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ══════════════════════════════════════════════════════════════════════════
  // 1. PORTFOLIO — ~90 secondes
  // ══════════════════════════════════════════════════════════════════════════
  await recordPage(browser, PORTFOLIO_URL, 'portfolio.webm', async (page) => {

    // Hero — laisser les animations se faire
    await wait(4000);

    // Scroll lent vers À propos
    await scrollToEl(page, '#apropos');
    await wait(4000);

    // Scroll vers Compétences — pause longue pour lire
    await scrollToEl(page, '#competences');
    await wait(5000);

    // Scroll progressif dans les compétences
    const compHeight = await page.evaluate(() => {
      const el = document.querySelector('#competences');
      return el ? el.offsetHeight : 0;
    });
    await scrollTo(page, await page.evaluate(() => document.querySelector('#competences').offsetTop + 300));
    await wait(3000);

    // Scroll vers Projets
    await scrollToEl(page, '#projets');
    await wait(4000);

    // Scroll dans la grille projets
    await scrollTo(page, await page.evaluate(() => {
      const el = document.querySelector('#projets');
      return el ? el.offsetTop + 400 : 1200;
    }));
    await wait(3000);

    await scrollTo(page, await page.evaluate(() => {
      const el = document.querySelector('#projets');
      return el ? el.offsetTop + 900 : 1800;
    }));
    await wait(3000);

    await scrollTo(page, await page.evaluate(() => {
      const el = document.querySelector('#projets');
      return el ? el.offsetTop + 1400 : 2400;
    }));
    await wait(3000);

    // Scroll vers Galerie
    await scrollToEl(page, '#galerie');
    await wait(5000);

    // Scroll vers Contact
    await scrollToEl(page, '#contact');
    await wait(4000);

    // Retour en haut
    await scrollTo(page, 0);
    await wait(3000);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 2. ADMIN — ~60 secondes
  // ══════════════════════════════════════════════════════════════════════════
  await recordPage(browser, ADMIN_URL, 'admin.webm', async (page) => {

    // Login si page de connexion présente
    if (ADMIN_PASSWORD) {
      try {
        await page.waitForSelector('input[type="password"]', { timeout: 8000 });
        await wait(1000);
        await page.fill('input[type="password"]', ADMIN_PASSWORD);
        await wait(800);
        await page.keyboard.press('Enter');
        await wait(3000);
      } catch (_) {}
    }

    // Dashboard — lire les stats
    await wait(4000);
    await scrollTo(page, 300);
    await wait(2000);
    await scrollTo(page, 0);
    await wait(1500);

    // Aller sur Projets
    await page.click('.sb-item[data-page="projects"]');
    await wait(4000);
    await scrollTo(page, 400);
    await wait(2500);
    await scrollTo(page, 800);
    await wait(2000);
    await scrollTo(page, 0);
    await wait(1500);

    // Aller sur Compétences
    await page.click('.sb-item[data-page="skills"]');
    await wait(4000);
    await scrollTo(page, 300);
    await wait(2000);
    await scrollTo(page, 0);
    await wait(1500);

    // Aller sur Galerie
    await page.click('.sb-item[data-page="gallery"]');
    await wait(4000);
    await scrollTo(page, 300);
    await wait(2000);

    // Retour Dashboard
    await page.click('.sb-item[data-page="dashboard"]');
    await wait(3000);
  });

  await browser.close();
  console.log('\n🎬 Les deux vidéos sont prêtes dans showcase-videos/');
})();

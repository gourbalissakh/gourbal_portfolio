#!/usr/bin/env node
/**
 * Serveur admin — http://localhost:4001/admin  (local)
 *                 https://admin-gourbal.onrender.com/admin  (en ligne)
 *
 * En local  : lit/écrit les fichiers JSON sur le disque (src/data/)
 * En ligne  : lit/écrit via l'API GitHub (GITHUB_TOKEN requis)
 *
 * Variables d'environnement (Render.com) :
 *   ADMIN_PWD_HASH   — SHA256 du mot de passe admin
 *   GITHUB_TOKEN     — Personal Access Token avec scope "repo"
 *   GITHUB_OWNER     — ex: gourbalissakh
 *   GITHUB_REPO      — ex: gourbal_portfolio
 *   GITHUB_BRANCH    — ex: main
 *   PORT             — (optionnel, défaut 4001)
 */

const http      = require('http');
const https     = require('https');
const fs        = require('fs');
const path      = require('path');
const crypto    = require('crypto');

const PORT      = parseInt(process.env.PORT || '4001', 10);
const ROOT      = path.join(__dirname, '..');
const DATA_SRC  = path.join(ROOT, 'src', 'data');
const PWD_FILE  = path.join(__dirname, '.adminpwd');
const SESS_TTL  = 8 * 60 * 60 * 1000; // 8h

// ── Mode : local ou GitHub API ─────────────────────────────────────────────
const GH_TOKEN  = process.env.GITHUB_TOKEN  || '';
const GH_OWNER  = process.env.GITHUB_OWNER  || '';
const GH_REPO   = process.env.GITHUB_REPO   || '';
const GH_BRANCH = process.env.GITHUB_BRANCH || 'main';
const ONLINE    = !!(GH_TOKEN && GH_OWNER && GH_REPO);

// ── Mot de passe ──────────────────────────────────────────────────────────
function hash(s) { return crypto.createHash('sha256').update(s).digest('hex'); }
function token() { return crypto.randomBytes(24).toString('hex'); }

function getStoredHash() {
  if (process.env.ADMIN_PWD_HASH) return process.env.ADMIN_PWD_HASH.trim();
  if (fs.existsSync(PWD_FILE)) return fs.readFileSync(PWD_FILE, 'utf8').trim();
  const def = hash('admin2026');
  if (!ONLINE) fs.writeFileSync(PWD_FILE, def, 'utf8');
  console.log('\n⚠️  Mot de passe par défaut : admin2026  — changez-le dans le panel.\n');
  return def;
}

// ── Sessions ──────────────────────────────────────────────────────────────
const sessions = new Map();
function authed(req) {
  const t = readCookie(req, 'asid');
  if (!t || !sessions.has(t)) return false;
  if (Date.now() > sessions.get(t)) { sessions.delete(t); return false; }
  return true;
}
function readCookie(req, name) {
  const h = req.headers.cookie || '';
  const m = h.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? m[1] : null;
}

// ── API GitHub (HTTPS natif) ───────────────────────────────────────────────
function ghRequest(method, ghPath, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'api.github.com',
      path: ghPath,
      method,
      headers: {
        'Authorization': 'token ' + GH_TOKEN,
        'User-Agent':    'admin-gourbal/1.0',
        'Accept':        'application/vnd.github+json',
        'Content-Type':  'application/json',
      },
    };
    if (payload) opts.headers['Content-Length'] = Buffer.byteLength(payload);
    const req = https.request(opts, r => {
      const chunks = [];
      r.on('data', c => chunks.push(c));
      r.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if (r.statusCode >= 400) return reject(new Error('GitHub API ' + r.statusCode + ': ' + text));
        try { resolve(JSON.parse(text)); } catch { resolve(text); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function ghReadFile(file) {
  const p = '/repos/' + GH_OWNER + '/' + GH_REPO + '/contents/src/data/' + file + '?ref=' + GH_BRANCH;
  const r = await ghRequest('GET', p, null);
  const content = Buffer.from(r.content, 'base64').toString('utf8');
  return { data: JSON.parse(content), sha: r.sha };
}

async function ghWriteFile(file, data, sha) {
  const content = Buffer.from(JSON.stringify(data, null, 2), 'utf8').toString('base64');
  const p = '/repos/' + GH_OWNER + '/' + GH_REPO + '/contents/src/data/' + file;
  await ghRequest('PUT', p, {
    message: 'admin: update ' + file,
    content,
    sha,
    branch: GH_BRANCH,
  });
}

// ── Helpers JSON local/GitHub ─────────────────────────────────────────────
async function readJSON(file) {
  if (ONLINE) {
    const r = await ghReadFile(file);
    return { data: r.data, sha: r.sha };
  }
  const data = JSON.parse(fs.readFileSync(path.join(DATA_SRC, file), 'utf8'));
  return { data, sha: null };
}

async function writeJSON(file, data, sha) {
  if (ONLINE) {
    await ghWriteFile(file, data, sha);
  } else {
    fs.writeFileSync(path.join(DATA_SRC, file), JSON.stringify(data, null, 2), 'utf8');
    // aussi copier dans public/data/ pour le dev local
    const pub = path.join(ROOT, 'public', 'data', file);
    if (fs.existsSync(path.dirname(pub))) {
      fs.writeFileSync(pub, JSON.stringify(data, null, 2), 'utf8');
    }
  }
}

// ── Validation helpers ────────────────────────────────────────────────────
const SAFE_ICON = /^bi-[a-z0-9-]+$/;
const SAFE_CAT  = new Set(['web','mobile','security','devops','iot']);
const SKILL_CAT = new Set(['langages','frameworks','mobile','devops','network','database']);
const BADGE_CLR = new Set(['primary','secondary','success','danger','warning','info','dark']);
const LEVELS    = new Set(['Avancé','Interméd.','Débutant']);

function safeStr(v, max = 200) {
  if (typeof v !== 'string') return '';
  return v.replace(/[<>"'`]/g, '').trim().slice(0, max);
}
function safeUrl(v) {
  if (!v) return null;
  const s = String(v).trim();
  return s.startsWith('https://') ? s.slice(0, 300) : null;
}

// ── Multipart parser minimal ──────────────────────────────────────────────
function parseMultipart(body, boundary) {
  const parts = [];
  const sep = Buffer.from('--' + boundary);
  let pos = 0;
  while (pos < body.length) {
    const s = body.indexOf(sep, pos);
    if (s < 0) break;
    pos = s + sep.length;
    if (body.slice(pos, pos + 2).equals(Buffer.from('--'))) break;
    pos += 2;
    const headerEnd = body.indexOf(Buffer.from('\r\n\r\n'), pos);
    if (headerEnd < 0) break;
    const rawHeaders = body.slice(pos, headerEnd).toString();
    pos = headerEnd + 4;
    const nextSep = body.indexOf(sep, pos);
    const data = nextSep > 0 ? body.slice(pos, nextSep - 2) : body.slice(pos);
    pos = nextSep;
    const nameMatch = rawHeaders.match(/name="([^"]+)"/);
    const fileMatch = rawHeaders.match(/filename="([^"]+)"/);
    parts.push({ name: nameMatch ? nameMatch[1] : '', filename: fileMatch ? fileMatch[1] : '', data });
  }
  return parts;
}

function readBody(req) {
  return new Promise(res => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => res(Buffer.concat(chunks)));
  });
}

// ── Réponses ──────────────────────────────────────────────────────────────
function jsonRes(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}
function redirect(res, loc) { res.writeHead(302, { Location: loc }); res.end(); }
function send(res, status, ct, body) { res.writeHead(status, { 'Content-Type': ct }); res.end(body); }

// ── HTML ──────────────────────────────────────────────────────────────────
const ADMIN_HTML = fs.readFileSync(path.join(__dirname, 'panel.html'), 'utf8');
const LOGIN_HTML = `<!DOCTYPE html><html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Admin — Connexion</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Space Grotesk',system-ui,sans-serif;background:#04070f;color:#e8eaf0;
  display:flex;align-items:center;justify-content:center;min-height:100vh;}
.box{background:rgba(255,255,255,.04);border:1px solid rgba(126,255,245,.15);border-radius:20px;
  padding:2.5rem;width:340px;}
h1{font-size:1.4rem;font-weight:700;margin-bottom:.4rem}
.sub{color:#6b7280;font-size:.85rem;margin-bottom:2rem}
label{display:block;font-size:.8rem;color:#94a3b8;margin-bottom:.35rem}
input{width:100%;padding:.75rem 1rem;background:rgba(255,255,255,.05);border:1px solid rgba(126,255,245,.18);
  border-radius:10px;color:#e8eaf0;font-size:.95rem;outline:none;margin-bottom:1.2rem}
input:focus{border-color:rgba(126,255,245,.5)}
button{width:100%;padding:.85rem;background:#7efff5;color:#04070f;border:none;border-radius:10px;
  font-weight:700;font-size:.95rem;cursor:pointer}
.err{color:#ff6b6b;font-size:.83rem;margin-top:1rem;text-align:center}
.logo{font-size:.8rem;color:#6b7280;margin-bottom:1.5rem;font-family:monospace}
</style></head>
<body><div class="box">
<div class="logo">M.GOURBAL / ADMIN</div>
<h1>Connexion</h1>
<div class="sub">Panel d'administration</div>
<form method="POST" action="/admin/login">
<label>Mot de passe</label>
<input type="password" name="pwd" autofocus placeholder="••••••••">
<button type="submit">Se connecter</button>
</form>
{{ERR}}
</div></body></html>`;

// ── Routeur ───────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  // CORS pour Render (appels depuis le browser vers l'API)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ── Login ──
  if (url === '/admin/login' && req.method === 'POST') {
    const buf    = await readBody(req);
    const params = new URLSearchParams(buf.toString());
    const pwd    = params.get('pwd') || '';
    if (hash(pwd) === getStoredHash()) {
      const tok = token();
      sessions.set(tok, Date.now() + SESS_TTL);
      res.writeHead(302, { 'Set-Cookie': `asid=${tok};Path=/;HttpOnly;SameSite=Strict`, Location: '/admin' });
      res.end();
    } else {
      send(res, 401, 'text/html', LOGIN_HTML.replace('{{ERR}}', '<p class="err">Mot de passe incorrect.</p>'));
    }
    return;
  }

  if (url === '/admin/logout') {
    const t = readCookie(req, 'asid'); if (t) sessions.delete(t);
    res.writeHead(302, { 'Set-Cookie': 'asid=;Path=/;Max-Age=0', Location: '/admin/login' });
    res.end(); return;
  }

  if (url === '/admin/login') {
    send(res, 200, 'text/html', LOGIN_HTML.replace('{{ERR}}', '')); return;
  }

  if (!authed(req)) { redirect(res, '/admin/login'); return; }

  if (url === '/admin' || url === '/admin/') {
    send(res, 200, 'text/html', ADMIN_HTML); return;
  }

  // ── API : mode info ──
  if (url === '/api/mode' && req.method === 'GET') {
    jsonRes(res, 200, { online: ONLINE, owner: GH_OWNER, repo: GH_REPO, branch: GH_BRANCH }); return;
  }

  // ── API : GET données ──
  if (url === '/api/projects' && req.method === 'GET') {
    try { const r = await readJSON('projects.json'); jsonRes(res, 200, r.data); }
    catch (e) { jsonRes(res, 500, { error: e.message }); }
    return;
  }
  if (url === '/api/skills' && req.method === 'GET') {
    try { const r = await readJSON('skills.json'); jsonRes(res, 200, r.data); }
    catch (e) { jsonRes(res, 500, { error: e.message }); }
    return;
  }
  if (url === '/api/gallery' && req.method === 'GET') {
    try { const r = await readJSON('gallery.json'); jsonRes(res, 200, r.data); }
    catch (e) { jsonRes(res, 500, { error: e.message }); }
    return;
  }

  // ── API : Créer/modifier un événement ──
  if (url === '/api/events' && req.method === 'POST') {
    const buf = await readBody(req);
    let ev; try { ev = JSON.parse(buf.toString('utf8')); } catch { jsonRes(res, 400, { error: 'JSON invalide' }); return; }
    try {
      const r    = await readJSON('gallery.json');
      const data = r.data;
      const clean = {
        id:          safeStr(ev.id, 60).replace(/\s+/g, '-').toLowerCase() || ('event-' + Date.now()),
        title:       safeStr(ev.title, 120),
        description: safeStr(ev.description, 600),
        date:        safeStr(ev.date, 20),
      };
      const idx = data.events.findIndex(e => e.id === clean.id);
      if (idx >= 0) {
        data.events[idx] = { ...data.events[idx], ...clean };
      } else {
        clean.photos = [];
        data.events.unshift(clean);
      }
      await writeJSON('gallery.json', data, r.sha);
      jsonRes(res, 200, { ok: true });
    } catch (e) { jsonRes(res, 500, { error: e.message }); }
    return;
  }

  // ── API : Supprimer un événement ──
  if (url.startsWith('/api/events/') && !url.includes('/photos') && req.method === 'DELETE') {
    const id = safeStr(url.replace('/api/events/', ''), 80);
    try {
      const r    = await readJSON('gallery.json');
      const data = r.data;
      if (!ONLINE) {
        const ev = data.events.find(e => e.id === id);
        if (ev) {
          (ev.photos || []).forEach(p => {
            const fp = path.join(ROOT, 'public', p.src);
            if (fs.existsSync(fp)) fs.unlinkSync(fp);
          });
        }
      }
      data.events = data.events.filter(e => e.id !== id);
      await writeJSON('gallery.json', data, r.sha);
      jsonRes(res, 200, { ok: true });
    } catch (e) { jsonRes(res, 500, { error: e.message }); }
    return;
  }

  // ── API : Ajouter des photos ──────────────────────────────────────────────
  if (url.match(/^\/api\/events\/[^/]+\/photos$/) && req.method === 'POST') {
    const evId = safeStr(url.split('/')[3], 80);
    const ct   = req.headers['content-type'] || '';
    const bm   = ct.match(/boundary=(.+)$/);
    if (!bm) { jsonRes(res, 400, { error: 'boundary manquant' }); return; }
    const buf   = await readBody(req);
    const parts = parseMultipart(buf, bm[1]);
    const files = parts.filter(p => p.filename);
    if (!files.length) { jsonRes(res, 400, { error: 'aucun fichier' }); return; }
    const safe = ['.jpg','.jpeg','.png','.webp','.gif','.svg'];
    try {
      const r    = await readJSON('gallery.json');
      const data = r.data;
      const ev   = data.events.find(e => e.id === evId);
      if (!ev) { jsonRes(res, 404, { error: 'événement introuvable' }); return; }
      if (!ev.photos) ev.photos = [];
      const added = [];
      for (const file of files) {
        const ext = path.extname(file.filename).toLowerCase();
        if (!safe.includes(ext)) continue;
        const name = 'img-' + Date.now() + '-' + Math.floor(Math.random()*9999) + ext;
        const captionPart = parts.find(p => p.name === 'caption_' + file.name) || parts.find(p => p.name === 'caption');
        const caption = safeStr((captionPart || {}).data?.toString() || '', 120);
        if (ONLINE) {
          // Upload image sur GitHub directement
          const ghImgPath = '/repos/' + GH_OWNER + '/' + GH_REPO + '/contents/public/assets/gallery/' + name;
          await ghRequest('PUT', ghImgPath, {
            message: 'admin: upload photo ' + name,
            content: file.data.toString('base64'),
            branch: GH_BRANCH,
          });
        } else {
          const galDir = path.join(ROOT, 'public', 'assets', 'gallery');
          if (!fs.existsSync(galDir)) fs.mkdirSync(galDir, { recursive: true });
          fs.writeFileSync(path.join(galDir, name), file.data);
        }
        const photo = { id: name.replace(/\./g, '-'), src: 'assets/gallery/' + name, caption };
        ev.photos.push(photo);
        added.push(photo);
      }
      await writeJSON('gallery.json', data, r.sha);
      jsonRes(res, 200, { ok: true, added });
    } catch (e) { jsonRes(res, 500, { error: e.message }); }
    return;
  }

  // ── API : Supprimer une photo ──
  if (url.match(/^\/api\/events\/[^/]+\/photos\/[^/]+$/) && req.method === 'DELETE') {
    const parts2  = url.split('/');
    const evId    = safeStr(parts2[3], 80);
    const photoId = safeStr(parts2[5], 80);
    try {
      const r    = await readJSON('gallery.json');
      const data = r.data;
      const ev   = data.events.find(e => e.id === evId);
      if (!ev) { jsonRes(res, 404, { error: 'événement introuvable' }); return; }
      if (!ONLINE) {
        const photo = (ev.photos || []).find(p => p.id === photoId);
        if (photo) {
          const fp = path.join(ROOT, 'public', photo.src);
          if (fs.existsSync(fp)) fs.unlinkSync(fp);
        }
      }
      ev.photos = (ev.photos || []).filter(p => p.id !== photoId);
      await writeJSON('gallery.json', data, r.sha);
      jsonRes(res, 200, { ok: true });
    } catch (e) { jsonRes(res, 500, { error: e.message }); }
    return;
  }

  // ── API : Sauvegarder projet ──
  if (url === '/api/projects' && req.method === 'POST') {
    const buf = await readBody(req);
    let p; try { p = JSON.parse(buf.toString('utf8')); } catch { jsonRes(res, 400, { error: 'JSON invalide' }); return; }
    try {
      const r     = await readJSON('projects.json');
      const data  = r.data;
      const clean = {
        id:           safeStr(p.id, 60).replace(/\s+/g, '-').toLowerCase() || ('proj-' + Date.now()),
        name:         safeStr(p.name, 80),
        description:  safeStr(p.description, 400),
        stack:        (Array.isArray(p.stack) ? p.stack : []).map(s => safeStr(s, 30)).filter(Boolean).slice(0, 8),
        githubUrl:    safeUrl(p.githubUrl),
        hostedUrl:    safeUrl(p.hostedUrl),
        platform:     'other',
        customDomain: safeStr(p.customDomain, 100) || null,
        imageUrl:     safeStr(p.imageUrl, 200) || '',
        badgeColor:   BADGE_CLR.has(p.badgeColor) ? p.badgeColor : 'primary',
        badgeTextDark: !!p.badgeTextDark,
        icon:         SAFE_ICON.test(p.icon) ? p.icon : 'bi-folder-fill',
        titleColor:   safeStr(p.titleColor, 30) || 'primary',
        category:     SAFE_CAT.has(p.category) ? p.category : 'web',
        featured:     !!p.featured,
        updatedAt:    new Date().toISOString().split('T')[0],
      };
      const idx = data.projects.findIndex(x => x.id === clean.id);
      if (idx >= 0) data.projects[idx] = clean; else data.projects.unshift(clean);
      await writeJSON('projects.json', data, r.sha);
      jsonRes(res, 200, { ok: true, project: clean });
    } catch (e) { jsonRes(res, 500, { error: e.message }); }
    return;
  }

  // ── API : Supprimer projet ──
  if (url.startsWith('/api/projects/') && req.method === 'DELETE') {
    const id = safeStr(url.replace('/api/projects/', ''), 60);
    try {
      const r    = await readJSON('projects.json');
      const data = r.data;
      data.projects = data.projects.filter(p => p.id !== id);
      await writeJSON('projects.json', data, r.sha);
      jsonRes(res, 200, { ok: true });
    } catch (e) { jsonRes(res, 500, { error: e.message }); }
    return;
  }

  // ── API : Sauvegarder compétence ──
  if (url === '/api/skills' && req.method === 'POST') {
    const buf = await readBody(req);
    let s; try { s = JSON.parse(buf.toString('utf8')); } catch { jsonRes(res, 400, { error: 'JSON invalide' }); return; }
    try {
      const r     = await readJSON('skills.json');
      const data  = r.data;
      const clean = {
        id:       safeStr(s.id, 40).replace(/\s+/g, '-').toLowerCase() || ('sk-' + Date.now()),
        name:     safeStr(s.name, 40),
        category: SKILL_CAT.has(s.category) ? s.category : 'langages',
        level:    LEVELS.has(s.level) ? s.level : 'Interméd.',
        icon:     safeUrl(s.icon) || '',
      };
      const idx = data.skills.findIndex(x => x.id === clean.id);
      if (idx >= 0) data.skills[idx] = clean; else data.skills.push(clean);
      await writeJSON('skills.json', data, r.sha);
      jsonRes(res, 200, { ok: true, skill: clean });
    } catch (e) { jsonRes(res, 500, { error: e.message }); }
    return;
  }

  // ── API : Supprimer compétence ──
  if (url.startsWith('/api/skills/') && req.method === 'DELETE') {
    const id = safeStr(url.replace('/api/skills/', ''), 60);
    try {
      const r    = await readJSON('skills.json');
      const data = r.data;
      data.skills = data.skills.filter(s => s.id !== id);
      await writeJSON('skills.json', data, r.sha);
      jsonRes(res, 200, { ok: true });
    } catch (e) { jsonRes(res, 500, { error: e.message }); }
    return;
  }

  // ── API : Changer mot de passe (local seulement) ──
  if (url === '/api/password' && req.method === 'POST') {
    if (ONLINE) {
      jsonRes(res, 400, { error: 'Changez ADMIN_PWD_HASH dans les variables Render.com.' }); return;
    }
    const buf = await readBody(req);
    let body; try { body = JSON.parse(buf.toString('utf8')); } catch { jsonRes(res, 400, { error: 'JSON invalide' }); return; }
    if (hash(body.current || '') !== getStoredHash()) { jsonRes(res, 401, { error: 'Mot de passe actuel incorrect' }); return; }
    const np = safeStr(body.next || '', 100);
    if (np.length < 6) { jsonRes(res, 400, { error: 'Minimum 6 caractères' }); return; }
    fs.writeFileSync(PWD_FILE, hash(np), 'utf8');
    jsonRes(res, 200, { ok: true }); return;
  }

  // ── API : Build (local seulement) ──
  if (url === '/api/build' && req.method === 'POST') {
    if (ONLINE) { jsonRes(res, 200, { ok: true, out: 'Build automatique via GitHub Actions.' }); return; }
    const { spawnSync } = require('child_process');
    const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'build.js')], { cwd: ROOT, encoding: 'utf8' });
    jsonRes(res, r.status === 0 ? 200 : 500, { ok: r.status === 0, out: (r.stdout||'')+(r.stderr||'') }); return;
  }

  // ── API : Deploy (local seulement) ──
  if (url === '/api/deploy' && req.method === 'POST') {
    if (ONLINE) { jsonRes(res, 200, { ok: true, out: 'Déploiement automatique via GitHub Actions dès que tu sauvegardes.' }); return; }
    const { spawnSync } = require('child_process');
    const r = spawnSync('npm', ['run', 'deploy'], { cwd: ROOT, encoding: 'utf8', shell: true });
    jsonRes(res, r.status === 0 ? 200 : 500, { ok: r.status === 0, out: (r.stdout||'')+(r.stderr||'') }); return;
  }

  jsonRes(res, 404, { error: 'Route introuvable' });
});

const host = ONLINE ? '0.0.0.0' : '127.0.0.1';
server.listen(PORT, host, () => {
  const mode = ONLINE ? '🌐 EN LIGNE (GitHub API)' : '💻 LOCAL (disque)';
  console.log(`\n✅  Panel admin : http://localhost:${PORT}/admin`);
  console.log(`   Mode : ${mode}\n`);
});

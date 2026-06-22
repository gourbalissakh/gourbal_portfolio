#!/usr/bin/env node
/**
 * Serveur admin local — http://localhost:4001/admin
 * Lance avec : npm run admin
 * Mot de passe stocké dans admin/.adminpwd (créé au premier lancement)
 */

const http      = require('http');
const fs        = require('fs');
const path      = require('path');
const crypto    = require('crypto');
const { spawnSync } = require('child_process');

const PORT     = 4001;
const ROOT     = path.join(__dirname, '..');
const DATA_SRC = path.join(ROOT, 'src', 'data');
const PWD_FILE = path.join(__dirname, '.adminpwd');
const SESS_TTL = 8 * 60 * 60 * 1000; // 8h

// ── Mot de passe par défaut au premier lancement ──────────────────────────
if (!fs.existsSync(PWD_FILE)) {
  const defaultPwd = 'admin2026';
  fs.writeFileSync(PWD_FILE, hash(defaultPwd), 'utf8');
  console.log('\n⚠️  Mot de passe par défaut : admin2026');
  console.log('   Changez-le dans le panel après connexion.\n');
}

const sessions = new Map(); // token → expires

function hash(s) { return crypto.createHash('sha256').update(s).digest('hex'); }
function token()  { return crypto.randomBytes(24).toString('hex'); }
function authed(req) {
  const t = cookie(req, 'asid');
  if (!t || !sessions.has(t)) return false;
  if (Date.now() > sessions.get(t)) { sessions.delete(t); return false; }
  return true;
}
function cookie(req, name) {
  const h = req.headers.cookie || '';
  const m = h.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? m[1] : null;
}

// ── Helpers JSON ─────────────────────────────────────────────────────────
function readJSON(file) {
  return JSON.parse(fs.readFileSync(path.join(DATA_SRC, file), 'utf8'));
}
function writeJSON(file, data) {
  fs.writeFileSync(path.join(DATA_SRC, file), JSON.stringify(data, null, 2), 'utf8');
}

// ── Run build / deploy ────────────────────────────────────────────────────
function runBuild() {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'build.js')], { cwd: ROOT, encoding: 'utf8' });
  return { ok: r.status === 0, out: (r.stdout || '') + (r.stderr || '') };
}
function runDeploy() {
  const r = spawnSync('npm', ['run', 'deploy'], { cwd: ROOT, encoding: 'utf8', shell: true });
  return { ok: r.status === 0, out: (r.stdout || '') + (r.stderr || '') };
}

// ── Multipart parser minimal (upload images) ──────────────────────────────
function parseMultipart(body, boundary) {
  const parts = [];
  const sep   = Buffer.from('--' + boundary);
  const end   = Buffer.from('--' + boundary + '--');
  let pos = 0;
  while (pos < body.length) {
    const s = body.indexOf(sep, pos);
    if (s < 0) break;
    pos = s + sep.length;
    if (body.slice(pos, pos + 2).equals(Buffer.from('--'))) break;
    pos += 2; // skip \r\n
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

// ── Lecture body ──────────────────────────────────────────────────────────
function readBody(req) {
  return new Promise(res => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => res(Buffer.concat(chunks)));
  });
}

// ── Validation helpers ─────────────────────────────────────────────────────
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

// ── Réponses ──────────────────────────────────────────────────────────────
function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}
function redirect(res, loc) {
  res.writeHead(302, { Location: loc }); res.end();
}
function send(res, status, ct, body) {
  res.writeHead(status, { 'Content-Type': ct }); res.end(body);
}

// ── HTML du panel ─────────────────────────────────────────────────────────
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
<div class="sub">Accès local uniquement</div>
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

  // ── Login ──
  if (url === '/admin/login' && req.method === 'POST') {
    const buf  = await readBody(req);
    const params = new URLSearchParams(buf.toString());
    const pwd  = params.get('pwd') || '';
    const stored = fs.readFileSync(PWD_FILE, 'utf8').trim();
    if (hash(pwd) === stored) {
      const tok = token();
      sessions.set(tok, Date.now() + SESS_TTL);
      res.writeHead(302, { 'Set-Cookie': `asid=${tok};Path=/;HttpOnly;SameSite=Strict`, Location: '/admin' });
      res.end();
    } else {
      send(res, 401, 'text/html', LOGIN_HTML.replace('{{ERR}}', '<p class="err">Mot de passe incorrect.</p>'));
    }
    return;
  }

  // ── Logout ──
  if (url === '/admin/logout') {
    const t = cookie(req, 'asid'); if (t) sessions.delete(t);
    res.writeHead(302, { 'Set-Cookie': 'asid=;Path=/;Max-Age=0', Location: '/admin/login' });
    res.end(); return;
  }

  // ── Page login ──
  if (url === '/admin/login') {
    send(res, 200, 'text/html', LOGIN_HTML.replace('{{ERR}}', '')); return;
  }

  // ── Auth guard ──
  if (!authed(req)) { redirect(res, '/admin/login'); return; }

  // ── Panel principal ──
  if (url === '/admin' || url === '/admin/') {
    send(res, 200, 'text/html', ADMIN_HTML); return;
  }

  // ── API : GET données ──
  if (url === '/api/projects' && req.method === 'GET') {
    json(res, 200, readJSON('projects.json')); return;
  }
  if (url === '/api/skills' && req.method === 'GET') {
    json(res, 200, readJSON('skills.json')); return;
  }
  if (url === '/api/gallery' && req.method === 'GET') {
    json(res, 200, readJSON('gallery.json')); return;
  }

  // ── API : Créer/modifier un événement ──
  if (url === '/api/events' && req.method === 'POST') {
    const buf = await readBody(req);
    let ev; try { ev = JSON.parse(buf.toString('utf8')); } catch { json(res, 400, { error: 'JSON invalide' }); return; }
    const data = readJSON('gallery.json');
    const clean = {
      id:          safeStr(ev.id, 60).replace(/\s+/g, '-').toLowerCase() || ('event-' + Date.now()),
      title:       safeStr(ev.title, 120),
      description: safeStr(ev.description, 600),
      date:        safeStr(ev.date, 20),
    };
    const idx = data.events.findIndex(e => e.id === clean.id);
    if (idx >= 0) {
      // Mise à jour : préserver les photos existantes
      data.events[idx] = { ...data.events[idx], ...clean };
    } else {
      clean.photos = [];
      data.events.unshift(clean);
    }
    writeJSON('gallery.json', data);
    json(res, 200, { ok: true }); return;
  }

  // ── API : Supprimer un événement ──
  if (url.startsWith('/api/events/') && !url.includes('/photos') && req.method === 'DELETE') {
    const id   = safeStr(url.replace('/api/events/', ''), 80);
    const data = readJSON('gallery.json');
    const ev   = data.events.find(e => e.id === id);
    if (ev) {
      (ev.photos || []).forEach(p => {
        const fp = path.join(ROOT, 'public', p.src);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      });
    }
    data.events = data.events.filter(e => e.id !== id);
    writeJSON('gallery.json', data);
    json(res, 200, { ok: true }); return;
  }

  // ── API : Ajouter des photos à un événement ──
  if (url.match(/^\/api\/events\/[^/]+\/photos$/) && req.method === 'POST') {
    const evId = safeStr(url.split('/')[3], 80);
    const ct   = req.headers['content-type'] || '';
    const bm   = ct.match(/boundary=(.+)$/);
    if (!bm) { json(res, 400, { error: 'boundary manquant' }); return; }
    const buf   = await readBody(req);
    const parts = parseMultipart(buf, bm[1]);
    const files = parts.filter(p => p.filename);
    if (!files.length) { json(res, 400, { error: 'aucun fichier' }); return; }
    const safe  = ['.jpg','.jpeg','.png','.webp','.gif','.svg'];
    const data  = readJSON('gallery.json');
    const ev    = data.events.find(e => e.id === evId);
    if (!ev) { json(res, 404, { error: 'événement introuvable' }); return; }
    if (!ev.photos) ev.photos = [];
    const galDir = path.join(ROOT, 'public', 'assets', 'gallery');
    if (!fs.existsSync(galDir)) fs.mkdirSync(galDir, { recursive: true });
    const added = [];
    for (const file of files) {
      const ext = path.extname(file.filename).toLowerCase();
      if (!safe.includes(ext)) continue;
      const name    = 'img-' + Date.now() + '-' + Math.floor(Math.random()*9999) + ext;
      const dest    = path.join(galDir, name);
      fs.writeFileSync(dest, file.data);
      const captionPart = parts.find(p => p.name === 'caption_' + file.name) || parts.find(p => p.name === 'caption');
      const caption = safeStr((captionPart || {}).data?.toString() || '', 120);
      const photo   = { id: name.replace(/\./g, '-'), src: 'assets/gallery/' + name, caption };
      ev.photos.push(photo);
      added.push(photo);
    }
    writeJSON('gallery.json', data);
    json(res, 200, { ok: true, added }); return;
  }

  // ── API : Supprimer une photo d'un événement ──
  if (url.match(/^\/api\/events\/[^/]+\/photos\/[^/]+$/) && req.method === 'DELETE') {
    const parts2 = url.split('/');
    const evId   = safeStr(parts2[3], 80);
    const photoId= safeStr(parts2[5], 80);
    const data   = readJSON('gallery.json');
    const ev     = data.events.find(e => e.id === evId);
    if (!ev) { json(res, 404, { error: 'événement introuvable' }); return; }
    const photo  = (ev.photos || []).find(p => p.id === photoId);
    if (photo) {
      const fp = path.join(ROOT, 'public', photo.src);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    ev.photos = (ev.photos || []).filter(p => p.id !== photoId);
    writeJSON('gallery.json', data);
    json(res, 200, { ok: true }); return;
  }

  // ── API : Sauvegarder projet ──
  if (url === '/api/projects' && req.method === 'POST') {
    const buf = await readBody(req);
    let p; try { p = JSON.parse(buf.toString('utf8')); } catch { json(res, 400, { error: 'JSON invalide' }); return; }
    const data  = readJSON('projects.json');
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
    writeJSON('projects.json', data);
    json(res, 200, { ok: true, project: clean }); return;
  }

  // ── API : Supprimer projet ──
  if (url.startsWith('/api/projects/') && req.method === 'DELETE') {
    const id   = safeStr(url.replace('/api/projects/', ''), 60);
    const data = readJSON('projects.json');
    data.projects = data.projects.filter(p => p.id !== id);
    writeJSON('projects.json', data);
    json(res, 200, { ok: true }); return;
  }

  // ── API : Sauvegarder compétence ──
  if (url === '/api/skills' && req.method === 'POST') {
    const buf = await readBody(req);
    let s; try { s = JSON.parse(buf.toString('utf8')); } catch { json(res, 400, { error: 'JSON invalide' }); return; }
    const data  = readJSON('skills.json');
    const clean = {
      id:       safeStr(s.id, 40).replace(/\s+/g, '-').toLowerCase() || ('sk-' + Date.now()),
      name:     safeStr(s.name, 40),
      category: SKILL_CAT.has(s.category) ? s.category : 'langages',
      level:    LEVELS.has(s.level) ? s.level : 'Interméd.',
      icon:     safeUrl(s.icon) || '',
    };
    const idx = data.skills.findIndex(x => x.id === clean.id);
    if (idx >= 0) data.skills[idx] = clean; else data.skills.push(clean);
    writeJSON('skills.json', data);
    json(res, 200, { ok: true, skill: clean }); return;
  }

  // ── API : Supprimer compétence ──
  if (url.startsWith('/api/skills/') && req.method === 'DELETE') {
    const id   = safeStr(url.replace('/api/skills/', ''), 60);
    const data = readJSON('skills.json');
    data.skills = data.skills.filter(s => s.id !== id);
    writeJSON('skills.json', data);
    json(res, 200, { ok: true }); return;
  }


  // ── API : Changer mot de passe ──
  if (url === '/api/password' && req.method === 'POST') {
    const buf = await readBody(req);
    let body; try { body = JSON.parse(buf.toString('utf8')); } catch { json(res, 400, { error: 'JSON invalide' }); return; }
    const stored = fs.readFileSync(PWD_FILE, 'utf8').trim();
    if (hash(body.current || '') !== stored) { json(res, 401, { error: 'Mot de passe actuel incorrect' }); return; }
    const np = safeStr(body.next || '', 100);
    if (np.length < 6) { json(res, 400, { error: 'Minimum 6 caractères' }); return; }
    fs.writeFileSync(PWD_FILE, hash(np), 'utf8');
    json(res, 200, { ok: true }); return;
  }

  // ── API : Build ──
  if (url === '/api/build' && req.method === 'POST') {
    const r = runBuild();
    json(res, r.ok ? 200 : 500, { ok: r.ok, out: r.out }); return;
  }

  // ── API : Deploy ──
  if (url === '/api/deploy' && req.method === 'POST') {
    const r = runDeploy();
    json(res, r.ok ? 200 : 500, { ok: r.ok, out: r.out }); return;
  }

  json(res, 404, { error: 'Route introuvable' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n✅  Panel admin : http://localhost:${PORT}/admin\n`);
});

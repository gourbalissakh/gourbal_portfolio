#!/usr/bin/env node
const fs   = require('fs');
const path = require('path');

const SRC      = path.join(__dirname, '../src/data');
const DEST_DIR = path.join(__dirname, '../public/data');

if (!fs.existsSync(DEST_DIR)) fs.mkdirSync(DEST_DIR, { recursive: true });

['projects.json', 'skills.json', 'gallery.json'].forEach(file => {
  const src  = path.join(SRC, file);
  const dest = path.join(DEST_DIR, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log('Copié : ' + dest);
  }
});

/* ============================================================================
 *  build.js — assemble src/*.js dans un index.html autonome.
 *  Les sources sont decoupees pour l'edition ; le livrable est index.html.
 *  Usage : node build.js
 * ========================================================================== */
const fs = require('fs');
const path = require('path');

const PARTS = [
  '01-core.js',
  '02-type.js',
  '03-figures.js',
  '04-objects.js',
  '05-transitions.js',
  '06-scenes-123.js',
  '07-scenes-456.js',
  '08-seek.js'
];

const root = __dirname;
const code = PARTS.map(function (f) {
  const p = path.join(root, 'src', f);
  if (!fs.existsSync(p)) throw new Error('source manquante : src/' + f);
  return '\n/* ======================= src/' + f + ' ======================= */\n' +
         fs.readFileSync(p, 'utf8');
}).join('\n');

const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>JDE — Jeudi de l'Entrepreneur · Maison de l'Entreprise du Niger</title>
<link rel="stylesheet" href="assets/fonts.css">
<style>
  html,body{margin:0;padding:0;background:#000;overflow:hidden;}
  #stage{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#000;}
  canvas{display:block;background:#061629;}
  /* Mode rendu : le canvas occupe exactement 1920x1080, sans mise a l'echelle. */
  body.render #stage{position:static;display:block;}
  body.render canvas{width:1920px;height:1080px;}
  #hud{position:fixed;left:12px;bottom:10px;z-index:10;
       font:12px/1.5 Inter,system-ui,sans-serif;color:#9fb6cf;
       background:rgba(6,22,41,.74);padding:6px 11px;border-radius:6px;letter-spacing:.04em;}
  body.render #hud{display:none;}
</style>
</head>
<body>
<div id="stage"><canvas id="cv" width="1920" height="1080"></canvas></div>
<div id="hud">JDE · <span id="tt">0.000</span> s / 30.000 s — espace : lecture/pause · ←/→ : ±1 frame · Home/End</div>

<!-- Courbes d'inertie : fichier de configuration reutilisable -->
<script src="EASING_FUNCTIONS.js"></script>

<script>
'use strict';
${code}
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(root, 'index.html'), html, 'utf8');
const lines = html.split('\n').length;
console.log('index.html ecrit — ' + lines + ' lignes, ' +
            (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1) + ' Ko');

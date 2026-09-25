/*
 * Génère dist/_redirects (Netlify) après le build : redirections 301 des anciennes
 * adresses du site Drupal vers les nouvelles pages, pour conserver le référencement.
 * Les fiches installateurs sont redirigées automatiquement grâce à leur champ « legacyId ».
 * Pour ajouter une redirection : complétez la liste STATIC ci-dessous.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dist = path.join(root, 'dist');

const STATIC = [
  // pages
  ['/node/1880', '/rejoindre-le-reseau-dinstallateurs-bdf'],
  ['/node/25', '/news-focus/localisation-strategique-bdf'],
  ['/node/1', '/news-focus'],
  ['/node', '/'],
  ['/contact', '/nous-contacter'],
  ['/devis', '/devis-porte-blindee'],
  ['/installateurs', '/installateurs-portes-blindees'],
  ['/certification-porte-blindee/anti-effraction-a2p', '/certifications/anti-effraction'],
  ['/certification-porte-blindee/anti-effraction', '/certifications/anti-effraction'],
  ['/certification-porte-blindee/anti-ef', '/certifications/anti-effraction'],
  ['/mentions-legales', '/liens/mentions-legales'],
  ['/conditions-generales-de-vente', '/liens/conditions-generales-de-vente'],
  // actualités (anciennes adresses)
  ['/eighteenth-post', '/news-focus/porte-blindee-2-vantaux-essai-resistance-au-feu'],
  ['/seventeenth-post', '/news-focus/test-anti-effraction-cnpp'],
  ['/second-post', '/news-focus/bloc-porte-pare-balles-menuiserie-generale-du-perche'],
  ['/twelfth-post', '/news-focus'],
  ['/portes-certifiees/installation-porte-blindee-hostis', '/news-focus/installation-porte-blindee-hostis'],
  ['/taxonomy/term/*', '/news-focus'],
  // espace utilisateur
  ['/user', '/espace-pro'],
  ['/user/*', '/espace-pro'],
  // filtres de l'ancien catalogue
  ['/catalogue/vantaux/1-vantail-88', '/catalogue?vantaux=1+vantail'],
  ['/catalogue/vantaux/2-vantaux-89', '/catalogue?vantaux=2+vantaux'],
  ['/catalogue/certification/sans-certification-320', '/catalogue?certification=Sans+certification'],
  ['/catalogue/certification/a2p-bp1-306', '/catalogue?certification=A2P+BP1'],
  ['/catalogue/certification/a2p-bp2-307', '/catalogue?certification=A2P+BP2'],
  ['/catalogue/certification/a2p-bp3-308', '/catalogue?certification=A2P+BP3'],
  ['/catalogue/certification/coupe-feu-30-min-309', '/catalogue?certification=Coupe-feu+30+min'],
  ['/catalogue/certification/coupe-feu-60-min-310', '/catalogue?certification=Coupe-feu+60+min'],
  ['/catalogue/certification/pare-balles-319', '/catalogue?certification=Pare-balles'],
  ['/catalogue/fermeture/312', '/catalogue?fermeture=Serrure+encastr%C3%A9e+multipoints'],
  ['/catalogue/fermeture/329', '/catalogue?fermeture=Serrures+multi-points+en+applique'],
  ['/catalogue/fermeture/322', '/catalogue?fermeture=Sans+serrure'],
  ['/catalogue/fermeture/332', '/catalogue?fermeture=Serrure+encastr%C3%A9e+1+point'],
  ['/catalogue/fermeture/321', "/catalogue?fermeture=Contr%C3%B4le+d%27acc%C3%A8s"],
  ['/catalogue/fermeture/325', '/catalogue?fermeture=Anti-panique+en+applique'],
  ['/catalogue/fermeture/330', '/catalogue?fermeture=Serrure+motoris%C3%A9e'],
  ['/catalogue/fermeture/324', '/catalogue?fermeture=Anti-panique+encastr%C3%A9e'],
  ['/catalogue/fermeture/331', '/catalogue?fermeture=Serrure+%C3%A0+verrouillage+contr%C3%B4l%C3%A9'],
  ['/catalogue/fermeture/326', '/catalogue?fermeture=Verrous'],
  ['/catalogue/fermeture/328', '/catalogue?fermeture=Fermeture+provisoire'],
  // combinaisons de catégories / filtres : retour à la catégorie principale
  ['/catalogue/categorie/:cat/*', '/catalogue/categorie/:cat'],
  // ancienne version anglaise et ancien dossier Drupal
  ['/en/catalogue/categorie/:cat', '/catalogue/categorie/:cat'],
  ['/en/*', '/'],
  ['/bdf-d10/*', '/'],
];

const lines = ['# Fichier généré par scripts/redirects.mjs — ne pas modifier à la main', ''];
for (const [from, to] of STATIC) lines.push(`${from}  ${to}  301`);

// fiches installateurs : /node/<ancien identifiant> → nouvelle fiche
const instDir = path.join(root, 'src/content/installers');
let n = 0;
for (const f of fs.readdirSync(instDir)) {
  if (!f.endsWith('.json')) continue;
  const d = JSON.parse(fs.readFileSync(path.join(instDir, f), 'utf8'));
  if (d.legacyId && d.published !== false) {
    lines.push(`/node/${d.legacyId}  /installateurs-portes-blindees/${d.slug || f.replace(/\.json$/, '')}  301`);
    n++;
  }
}

// anciens fichiers Drupal (/sites/default/files/…) → /media/… (noms normalisés)
const media = path.join(root, 'public/media');
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const known = new Set(walk(media).map((p) => '/' + path.relative(path.join(root, 'public'), p).split(path.sep).join('/')));
const oldPdf = fs.existsSync(path.join(root, 'scripts/legacy-files.txt')) ? fs.readFileSync(path.join(root, 'scripts/legacy-files.txt'), 'utf8').split('\n').filter(Boolean) : [];
for (const old of oldPdf) {
  const rel = old.replace(/^\/sites\/default\/files\//, '');
  const norm = rel
    .toLowerCase()
    .replace(/\.pdf\.pdf$/, '-pdf.pdf')
    .replace(/_/g, '-');
  const target = `/media/${norm}`;
  if (known.has(target)) lines.push(`${old}  ${target}  301`);
}
lines.push('/sites/default/files/*  /media/:splat  301');

fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, '_redirects'), lines.join('\n') + '\n');
console.log(`_redirects : ${lines.length - 2} règles (${n} fiches installateurs)`);

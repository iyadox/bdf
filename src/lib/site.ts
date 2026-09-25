import settings from '@/data/settings.json';

export { settings };

export const SITE_NAME = settings.company.name;

export type NavLink = { label: string; href: string; icon?: string; desc?: string };
export type NavItem = NavLink & { children?: NavLink[]; mega?: 'catalogue' };

export const NAV: NavItem[] = [
  { label: 'Catalogue', href: '/catalogue', mega: 'catalogue' },
  {
    label: 'Certifications',
    href: '/certification-porte-blindee',
    children: [
      { label: 'Savoir-faire certifié', href: '/certification-porte-blindee', icon: 'badge-check', desc: 'Nos 3 certifications officielles' },
      { label: 'Anti-effraction A2P', href: '/certifications/anti-effraction', icon: 'shield', desc: 'CNPP · BP1 à BP3' },
      { label: 'Coupe-feu', href: '/certification-porte-blindee/coupe-feu', icon: 'flame', desc: 'EFECTIS · EI 30 à EI 120' },
      { label: 'Pare-balles', href: '/certification-porte-blindee/pare-balles', icon: 'crosshair', desc: "Banc National d'Épreuves · FB4 à FB7" },
    ],
  },
  {
    label: 'Réseau',
    href: '/installateurs-portes-blindees',
    children: [
      { label: 'Trouver un installateur', href: '/installateurs-portes-blindees', icon: 'map-pin', desc: 'Plus de 500 pros agréés en France' },
      { label: 'Devenir installateur agréé', href: '/rejoindre-le-reseau-dinstallateurs-bdf', icon: 'users', desc: 'Rejoindre le réseau BDF' },
      { label: 'Espace Pro', href: '/espace-pro', icon: 'log-in', desc: 'Tarifs, fiches techniques, devis' },
    ],
  },
  { label: "L'entreprise", href: '/fabricant-de-portes-blindees-sur-mesure' },
  { label: 'Actualités', href: '/news-focus' },
  { label: 'Contact', href: '/nous-contacter' },
];

export const FOOTER_COLUMNS: { title: string; links: NavLink[] }[] = [
  {
    title: 'Produits',
    links: [
      { label: 'Blindages de porte', href: '/catalogue/categorie/blindages-de-porte-67' },
      { label: 'Portes blindées', href: '/catalogue/categorie/blocs-portes-dappartement-65' },
      { label: 'Blocs-portes certifiés', href: '/catalogue/categorie/blocs-portes-certifies-59' },
      { label: 'Menuiseries métalliques', href: '/catalogue/categorie/tolerie-pliage-et-profils-71' },
      { label: 'Travaux spéciaux', href: '/catalogue/categorie/travaux-speciaux-75' },
      { label: 'Configurateur 3D', href: '/configurateur' },
    ],
  },
  {
    title: 'Services',
    links: [
      { label: 'Savoir-faire certifié', href: '/certification-porte-blindee' },
      { label: 'Certification anti-effraction A2P', href: '/certifications/anti-effraction' },
      { label: 'Certification coupe-feu', href: '/certification-porte-blindee/coupe-feu' },
      { label: 'Certification pare-balles', href: '/certification-porte-blindee/pare-balles' },
      { label: 'Devis en ligne', href: '/devis-porte-blindee' },
      { label: 'Questions fréquentes', href: '/faq' },
    ],
  },
  {
    title: 'La société',
    links: [
      { label: "L'entreprise", href: '/fabricant-de-portes-blindees-sur-mesure' },
      { label: 'Processus de fabrication et savoir-faire', href: '/fabricant-de-portes-blindees-sur-mesure#savoir-faire' },
      { label: 'Nos partenaires', href: '/installateurs-portes-blindees' },
      { label: 'Actualités et infos', href: '/news-focus' },
      { label: 'Espace Pro', href: '/espace-pro' },
      { label: 'Contact', href: '/nous-contacter' },
    ],
  },
];

export const LEGAL_LINKS: NavLink[] = [
  { label: 'Conditions générales de vente', href: '/liens/conditions-generales-de-vente' },
  { label: 'Mentions légales', href: '/liens/mentions-legales' },
  { label: 'Confidentialité & cookies', href: '/liens/confidentialite' },
  { label: 'Plan du site', href: '/plan-du-site' },
];

export function telHref(phone = settings.contact.phoneIntl) {
  return `tel:${phone.replace(/\s+/g, '')}`;
}

export function fullAddress() {
  const a = settings.contact.address;
  return `${a.street}, ${a.postalCode} ${a.city}`;
}

/** Type de badge (couleur) selon le libellé de certification. */
export function badgeKind(label: string): string {
  const l = label.toLowerCase();
  if (l.includes('feu') || l.startsWith('ei')) return 'feu';
  if (l.includes('balle') || l.startsWith('fb')) return 'balles';
  if (l.includes('a2p') || l.includes('bp')) return 'a2p';
  return '';
}

export function formatDate(d: Date) {
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function stripHtml(html = '') {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncate(s = '', n = 160) {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…';
}

export function youtubeThumb(id: string) {
  return `/media/video-thumbnails/${id}.jpg`;
}

export const fold = (s = '') =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Mini-markdown (gras + liens) pour les textes courts édités dans l'admin. */
export function miniMd(s = '') {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
}

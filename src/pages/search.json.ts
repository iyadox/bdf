import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getProducts, getCategories, getInstallers, productUrl, categoryUrl, installerUrl } from '@/lib/catalog';
import { fold, stripHtml } from '@/lib/site';

/** Index de recherche (généré au build) utilisé par la palette Ctrl+K. */
const PAGES: { title: string; url: string; sub: string; kw?: string }[] = [
  { title: 'Catalogue produits', url: '/catalogue', sub: 'Toutes nos portes blindées, blindages, grilles et accessoires', kw: 'produits gamme' },
  { title: 'Configurateur 3D', url: '/configurateur', sub: 'Composez votre porte blindée en 3D', kw: 'couleur ral finition personnaliser' },
  { title: 'Comparateur de produits', url: '/comparateur', sub: 'Comparer jusqu’à 3 produits', kw: 'comparer' },
  { title: 'Trouver un installateur', url: '/installateurs-portes-blindees', sub: 'Plus de 500 installateurs agréés en France', kw: 'pose poseur serrurier annuaire carte' },
  { title: 'Demande de devis', url: '/devis-porte-blindee', sub: 'Devis gratuit en ligne', kw: 'prix tarif estimation' },
  { title: 'Savoir-faire certifié', url: '/certification-porte-blindee', sub: 'Nos 3 certifications officielles', kw: 'certification cnpp efectis banc' },
  { title: 'Certification anti-effraction A2P', url: '/certifications/anti-effraction', sub: 'CNPP · BP1, BP2, BP3', kw: 'a2p cnpp effraction bp1 bp2 bp3 cambriolage' },
  { title: 'Certification coupe-feu', url: '/certification-porte-blindee/coupe-feu', sub: 'EFECTIS · EI 30 à EI 120', kw: 'feu incendie efectis ei30 ei60 ei90 ei120' },
  { title: 'Certification pare-balles', url: '/certification-porte-blindee/pare-balles', sub: "Banc National d'Épreuves · FB4 à FB7", kw: 'balistique balles fb6 fb7 blindage' },
  { title: "L'entreprise", url: '/fabricant-de-portes-blindees-sur-mesure', sub: 'Fabricant français depuis 1989', kw: 'histoire usine atelier aulnay equipe' },
  { title: 'Nous contacter', url: '/nous-contacter', sub: '01 48 65 32 78 · Aulnay-sous-Bois', kw: 'contact adresse telephone horaires' },
  { title: 'Devenir installateur agréé', url: '/rejoindre-le-reseau-dinstallateurs-bdf', sub: 'Rejoindre le réseau BDF', kw: 'partenaire professionnel' },
  { title: 'Espace Pro', url: '/espace-pro', sub: 'Accès installateurs', kw: 'connexion login professionnel tarifs' },
  { title: 'Actualités', url: '/news-focus', sub: "L'actualité de BDF et de son réseau", kw: 'news blog' },
  { title: 'Questions fréquentes', url: '/faq', sub: 'Tout savoir sur la porte blindée', kw: 'faq aide question' },
  { title: 'Ma sélection', url: '/selection', sub: 'Vos produits favoris', kw: 'favoris' },
  { title: 'Conditions générales de vente', url: '/liens/conditions-generales-de-vente', sub: 'CGV' },
  { title: 'Mentions légales', url: '/liens/mentions-legales', sub: 'Informations légales' },
];

export const GET: APIRoute = async () => {
  const [products, categories, installers, news] = await Promise.all([getProducts(), getCategories(), getInstallers(), getCollection('news')]);
  const out: any[] = [];
  for (const p of PAGES) out.push({ t: 'page', title: p.title, sub: p.sub, url: p.url, kw: fold(`${p.title} ${p.sub} ${p.kw || ''}`) });
  for (const c of categories)
    out.push({ t: 'categorie', title: c.title, sub: c.description, url: categoryUrl(c), kw: fold(`${c.title} ${c.description} ${c.highlights.join(' ')}`) });
  for (const p of products) {
    const cats = categories.filter((c) => p.categories.includes(c.slug)).map((c) => c.title);
    out.push({
      t: 'produit',
      title: p.title,
      sub: [p.specs?.certification || p.badges.join(' · '), cats[0]].filter(Boolean).join(' · '),
      url: productUrl(p),
      img: p.image,
      kw: fold(
        [p.title, p.family, cats.join(' '), p.badges.join(' '), p.filters.vantaux.join(' '), p.filters.certifications.join(' '), p.filters.fermetures.join(' '), stripHtml(p.composition || '').slice(0, 300)].join(' '),
      ),
    });
  }
  for (const n of news.filter((n) => n.data.published !== false))
    out.push({ t: 'actu', title: n.data.title, sub: n.data.category, url: `/news-focus/${n.id}`, kw: fold(`${n.data.title} ${n.data.excerpt || ''} ${n.data.category}`) });
  for (const i of installers)
    out.push({ t: 'installateur', title: i.name, sub: `${i.postalCode} ${i.city}${i.phone ? ' · ' + i.phone : ''}`, url: installerUrl(i), cp: i.postalCode, kw: fold(`${i.name} ${i.city} ${i.postalCode} ${i.address}`) });
  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};

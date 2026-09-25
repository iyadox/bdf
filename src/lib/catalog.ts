import { getCollection, type CollectionEntry } from 'astro:content';

export type Product = CollectionEntry<'products'>['data'];
export type Category = CollectionEntry<'categories'>['data'];
export type Installer = CollectionEntry<'installers'>['data'];

export const productUrl = (p: Pick<Product, 'segment' | 'slug'>) => `/catalogue/${p.segment}/${p.slug}`;
export const categoryUrl = (c: Pick<Category, 'slug'>) => `/catalogue/categorie/${c.slug}`;
export const installerUrl = (i: Pick<Installer, 'slug'>) => `/installateurs-portes-blindees/${i.slug}`;
export const quoteUrl = (p?: Pick<Product, 'quoteLabel' | 'title'>) =>
  p ? `/devis-porte-blindee?produit=${encodeURIComponent(p.quoteLabel || p.title)}` : '/devis-porte-blindee';

let _products: Product[] | null = null;
let _categories: Category[] | null = null;
let _installers: Installer[] | null = null;

export async function getProducts(): Promise<Product[]> {
  if (!_products) {
    _products = (await getCollection('products'))
      .map((e) => e.data)
      .filter((p) => p.published !== false)
      .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'fr'));
  }
  return _products;
}

export async function getCategories(): Promise<Category[]> {
  if (!_categories) {
    _categories = (await getCollection('categories')).map((e) => e.data).sort((a, b) => a.order - b.order);
  }
  return _categories;
}

export async function getInstallers(): Promise<Installer[]> {
  if (!_installers) {
    _installers = (await getCollection('installers'))
      .map((e) => e.data)
      .filter((i) => i.published !== false)
      .sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }));
  }
  return _installers;
}

export async function productsOf(cat: Category) {
  return (await getProducts()).filter((p) => p.categories.includes(cat.slug));
}

export async function categoryOfSegment(segment: string) {
  return (await getCategories()).find((c) => c.segment === segment);
}

/** Variantes d'une même gamme (ex. 1 vantail / 2 vantaux). */
export async function variantsOf(p: Product) {
  const base = familyKey(p);
  return (await getProducts()).filter((x) => x.slug !== p.slug && familyKey(x) === base);
}

export function familyKey(p: Product) {
  return (p.family || p.title)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export async function relatedTo(p: Product, n = 4) {
  const all = await getProducts();
  const fam = familyKey(p);
  const scored = all
    .filter((x) => x.slug !== p.slug && familyKey(x) !== fam)
    .map((x) => {
      let s = 0;
      for (const c of x.categories) if (p.categories.includes(c)) s += 2;
      for (const c of x.filters.certifications) if (p.filters.certifications.includes(c) && c !== 'Sans certification') s += 3;
      if (x.segment === p.segment) s += 2;
      if (x.featured) s += 1;
      return { x, s };
    })
    .sort((a, b) => b.s - a.s || a.x.order - b.x.order);
  // un seul représentant par gamme
  const seen = new Set<string>();
  const out: Product[] = [];
  for (const { x } of scored) {
    const k = familyKey(x);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
    if (out.length >= n) break;
  }
  return out;
}

/** Valeurs de filtres (ordre d'affichage) */
export const FILTER_ORDER = {
  vantaux: ['1 vantail', '2 vantaux'],
  certifications: ['A2P BP1', 'A2P BP2', 'A2P BP3', 'Coupe-feu 30 min', 'Coupe-feu 60 min', 'Pare-balles', 'Sans certification'],
  fermetures: [
    'Serrure encastrée multipoints',
    'Serrures multi-points en applique',
    'Serrure encastrée 1 point',
    'Serrure motorisée',
    'Serrure à verrouillage contrôlé',
    "Contrôle d'accès",
    'Anti-panique encastrée',
    'Anti-panique en applique',
    'Verrous',
    'Fermeture provisoire',
    'Sans serrure',
  ],
};

export function isCertified(p: Product) {
  return p.filters.certifications.some((c) => c !== 'Sans certification');
}

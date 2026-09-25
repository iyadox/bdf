import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/*
 * Schémas des contenus éditables (via l'interface /admin ou directement dans les fichiers).
 * Les champs sont volontairement souples : une fiche incomplète ne casse jamais le site.
 */

const card = z.object({
  icon: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
});

const products = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/products' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    segment: z.string(),
    categories: z.array(z.string()).default([]),
    family: z.string().optional(),
    order: z.number().default(999),
    featured: z.boolean().default(false),
    published: z.boolean().default(true),
    image: z.string().optional(),
    gallery: z.array(z.string()).optional(),
    situationImage: z.string().optional(),
    teaser: z.string().optional(),
    badges: z.array(z.string()).default([]),
    seo: z.object({ title: z.string().optional(), description: z.string().optional() }).optional(),
    summary: z.string().optional(),
    specs: z
      .object({
        vantaux: z.string().optional(),
        dimensions: z.string().optional(),
        fermeture: z.string().optional(),
        certification: z.string().optional(),
      })
      .optional(),
    filters: z
      .object({
        vantaux: z.array(z.string()).default([]),
        certifications: z.array(z.string()).default([]),
        fermetures: z.array(z.string()).default([]),
      })
      .default({ vantaux: [], certifications: [], fermetures: [] }),
    composition: z.string().optional(),
    downloads: z.array(z.object({ label: z.string().optional(), file: z.string() })).default([]),
    quoteLabel: z.string().optional(),
    locks: z
      .object({
        intro: z.string().optional(),
        table: z
          .array(
            z.object({
              brand: z.string().optional(),
              model: z.string().optional(),
              points: z.string().optional(),
              certification: z.string().optional(),
              level: z.string().optional(),
            }),
          )
          .optional(),
        tableHeads: z.array(z.string()).optional(),
        extras: z.array(z.object({ title: z.string(), icon: z.string().optional().nullable(), html: z.string() })).optional(),
        html: z.string().optional(),
        more: z.array(z.object({ title: z.string().optional(), html: z.string() })).optional(),
      })
      .optional(),
    frame: z.object({ intro: z.string().optional(), html: z.string().optional(), cards: z.array(card).optional() }).optional(),
    options: z
      .object({
        intro: z.string().optional(),
        html: z.string().optional(),
        note: z.string().optional(),
        groups: z
          .array(
            z.object({
              title: z.string(),
              icon: z.string().optional().nullable(),
              items: z.array(z.object({ label: z.string(), picto: z.string().optional() })),
            }),
          )
          .optional(),
      })
      .optional(),
    finishes: z
      .object({ standard: z.array(z.string()).optional(), options: z.array(card).optional(), html: z.string().optional() })
      .optional(),
    certification: z
      .object({
        badges: z.array(z.object({ type: z.string(), label: z.string() })).default([]),
        labs: z.string().optional(),
        logos: z.array(z.object({ image: z.string(), caption: z.string().optional(), alt: z.string().optional() })).default([]),
        description: z.string().optional(),
        norms: z.string().optional(),
        video: z.string().optional(),
        videoTitle: z.string().optional(),
        links: z.array(z.string()).optional(),
      })
      .optional(),
    closing: z.object({ intro: z.string().optional(), html: z.string().optional(), cards: z.array(card).optional() }).optional(),
    usages: z
      .object({
        intro: z.string().optional(),
        html: z.string().optional(),
        items: z.array(z.object({ icon: z.string().optional(), title: z.string() })).default([]),
      })
      .optional(),
    characteristics: z.object({ html: z.string() }).optional(),
  }),
});

const categories = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/categories' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    segment: z.string(),
    order: z.number().default(99),
    description: z.string(),
    highlights: z.array(z.string()).default([]),
    icon: z.string().optional(),
    badge: z.string().optional(),
    image: z.string().optional(),
  }),
});

const installers = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/installers' }),
  schema: z.object({
    name: z.string(),
    slug: z.string(),
    address: z.string().default(''),
    postalCode: z.string().default(''),
    city: z.string().default(''),
    phone: z.string().optional().default(''),
    phone2: z.string().optional(),
    email: z.string().optional(),
    website: z.string().optional(),
    lat: z.number().nullable().optional(),
    lng: z.number().nullable().optional(),
    legacyId: z.number().optional(),
    published: z.boolean().default(true),
    premium: z.boolean().default(false),
    colors: z.record(z.string(), z.string()).optional(),
    logo: z.string().optional(),
    heroImages: z.array(z.string()).optional(),
    tagline: z.string().optional(),
    partnerSince: z.number().optional(),
    certifications: z.array(z.string()).optional(),
    socials: z.record(z.string(), z.string()).optional(),
    stats: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
    presentation: z.string().optional(),
    services: z.array(card).optional(),
    servicesText: z.string().optional(),
    gallery: z.array(z.string()).optional(),
    realisationsText: z.string().optional(),
    videos: z.array(z.string()).optional(),
    zone: z.string().optional(),
    contactText: z.string().optional(),
  }),
});

const news = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/news' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    category: z.string().default("Actualité de l'entreprise"),
    excerpt: z.string().optional(),
    cover: z.string().optional(),
    video: z.string().optional(),
    installer: z.string().optional(),
    published: z.boolean().default(true),
    featured: z.boolean().default(false),
  }),
});

export const collections = { products, categories, installers, news };

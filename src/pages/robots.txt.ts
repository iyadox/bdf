import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const base = site?.href.replace(/\/$/, '') || '';
  const body = ['User-agent: *', 'Allow: /', 'Disallow: /admin/', 'Disallow: /merci', 'Disallow: /selection', '', `Sitemap: ${base}/sitemap-index.xml`, ''].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};

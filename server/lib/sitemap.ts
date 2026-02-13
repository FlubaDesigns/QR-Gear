import { storage } from "../storage";

interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
}

const BASE_URL = process.env.SITE_URL || "https://qrgear.com";

const staticPages: SitemapUrl[] = [
  { loc: "/", changefreq: "daily", priority: 1.0 },
  { loc: "/build", changefreq: "weekly", priority: 0.9 },
  { loc: "/shop", changefreq: "daily", priority: 0.9 },
  { loc: "/qr-static", changefreq: "monthly", priority: 0.8 },
  { loc: "/qr-static-plus", changefreq: "monthly", priority: 0.8 },
  { loc: "/qr-url", changefreq: "monthly", priority: 0.8 },
  { loc: "/qr-video", changefreq: "monthly", priority: 0.8 },
  { loc: "/qr-dynamics", changefreq: "monthly", priority: 0.8 },
  { loc: "/login", changefreq: "yearly", priority: 0.3 },
  { loc: "/register", changefreq: "yearly", priority: 0.3 },
];

const auxiliaryFiles: SitemapUrl[] = [
  { loc: "/llms.txt", changefreq: "weekly", priority: 0.5 },
  { loc: "/ai.txt", changefreq: "weekly", priority: 0.5 },
  { loc: "/robots.txt", changefreq: "monthly", priority: 0.2 },
];

export async function generateSitemap(): Promise<string> {
  const today = new Date().toISOString().split("T")[0];
  const urls: SitemapUrl[] = [];

  urls.push(...staticPages.map(page => ({ ...page, lastmod: today })));
  urls.push(...auxiliaryFiles.map(file => ({ ...file, lastmod: today })));

  try {
    const products = await storage.getProducts();
    const enabledProducts = products.filter(p => p.isEnabled);
    for (const product of enabledProducts) {
      urls.push({
        loc: `/shop/product/${product.id}`,
        lastmod: today,
        changefreq: "weekly",
        priority: 0.7,
      });
    }
  } catch (error) {
    console.error("[Sitemap] Error fetching products:", error);
  }

  try {
    const categories = await storage.getProductCategories();
    for (const category of categories) {
      urls.push({
        loc: `/shop/category/${category.slug}`,
        lastmod: today,
        changefreq: "weekly",
        priority: 0.6,
      });
    }
  } catch (error) {
    console.error("[Sitemap] Error fetching categories:", error);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url>
    <loc>${BASE_URL}${url.loc}</loc>
    ${url.lastmod ? `<lastmod>${url.lastmod}</lastmod>` : ""}
    ${url.changefreq ? `<changefreq>${url.changefreq}</changefreq>` : ""}
    ${url.priority !== undefined ? `<priority>${url.priority}</priority>` : ""}
  </url>`).join("\n")}
</urlset>`;

  return xml;
}

export function addStaticPage(path: string, priority: number = 0.5, changefreq: SitemapUrl["changefreq"] = "weekly") {
  if (!staticPages.find(p => p.loc === path)) {
    staticPages.push({ loc: path, priority, changefreq });
  }
}

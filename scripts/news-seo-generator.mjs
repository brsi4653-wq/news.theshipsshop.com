import { writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../assets/config.js";

const SITE_URL = "https://news.theshipsshop.com";

const escapeXml = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

const escapeHtml = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const publishedArticles = (articles = []) => articles
  .filter((article) => article?.slug && article?.published_at && article?.is_published !== false)
  .sort((a, b) => new Date(b.published_at) - new Date(a.published_at));

const articlePath = (slug) => `article.html?slug=${encodeURIComponent(slug)}`;

export function renderSitemap(articles = []) {
  const entries = publishedArticles(articles).map((article) => {
    const modified = article.updated_at || article.published_at;
    return `  <url>
    <loc>${escapeXml(`${SITE_URL}/${articlePath(article.slug)}`)}</loc>
    <lastmod>${new Date(modified).toISOString().slice(0, 10)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
${entries.join("\n")}
</urlset>
`;
}

export function renderArticleIndex(articles = []) {
  const links = publishedArticles(articles).map((article) => `<article>
          <span>${escapeHtml(article.category || "News")}</span>
          <h2><a href="${articlePath(article.slug)}">${escapeHtml(article.title || article.slug)}</a></h2>
          ${article.dek ? `<p>${escapeHtml(article.dek)}</p>` : ""}
          <time datetime="${escapeHtml(article.published_at)}">${new Date(article.published_at).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })}</time>
        </article>`).join("\n");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Browse every published story from SHIPS News." />
    <link rel="canonical" href="${SITE_URL}/articles.html" />
    <title>All Stories | SHIPS News</title>
    <link rel="icon" type="image/png" href="favicon.png" />
    <style>body{margin:0;background:#f4f1e8;color:#10161a;font-family:Arial,sans-serif}header,main,footer{padding:32px clamp(20px,6vw,88px)}header,footer{background:#071b2c;color:#fff}header{display:flex;justify-content:space-between;align-items:center}header img{width:180px;max-width:45vw}a{color:inherit}main{max-width:1100px;margin:auto}h1,h2{font-family:Georgia,serif;font-weight:500}h1{font-size:clamp(3rem,8vw,7rem)}article{padding:28px 0;border-top:1px solid #9caab0}article span,time{font-size:.75rem;text-transform:uppercase;letter-spacing:.12em}h2{font-size:clamp(1.8rem,4vw,3.5rem);margin:12px 0}p{max-width:700px;line-height:1.6}</style>
  </head>
  <body>
    <header><a href="index.html"><img src="images/ships-logo-white.png" alt="SHIPS" /></a><a href="https://theshipsshop.com">Shop SHIPS</a></header>
    <main>
      <p>SHIPS News</p>
      <h1>All stories</h1>
      <section aria-label="Published stories">
        ${links || "<p>No stories are published yet.</p>"}
      </section>
    </main>
    <footer><a href="index.html">SHIPS News home</a></footer>
  </body>
</html>
`;
}

export async function fetchPublishedArticles() {
  const fields = "slug,title,dek,category,published_at,updated_at";
  const response = await fetch(`${SUPABASE_URL}/rest/v1/public_news_articles?select=${fields}&order=published_at.desc`, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    },
  });
  if (!response.ok) throw new Error(`Supabase article request failed (${response.status}): ${await response.text()}`);
  return (await response.json()).map((article) => ({ ...article, is_published: true }));
}

export async function generateNewsSeoFiles() {
  const articles = await fetchPublishedArticles();
  await Promise.all([
    writeFile(fileURLToPath(new URL("../sitemap.xml", import.meta.url)), renderSitemap(articles), "utf8"),
    writeFile(fileURLToPath(new URL("../articles.html", import.meta.url)), renderArticleIndex(articles), "utf8"),
  ]);
  return articles.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const count = await generateNewsSeoFiles();
  console.log(`Generated sitemap.xml and articles.html for ${count} published article(s).`);
}

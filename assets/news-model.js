export const DEFAULT_SETTINGS = Object.freeze({
  site_title: "SHIPS News",
  tagline: "Independent stories, clearly told.",
  description: "News, culture, design, and stories worth following.",
  shop_url: "https://theshipsshop.com",
  accent_color: "#e63b2e",
});

export function createSlug(value = "") {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "untitled-story";
}

function normalizeGallery(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => typeof entry === "string" ? { url: entry, alt: "", caption: "" } : entry)
    .filter((entry) => entry?.url)
    .map((entry) => ({ url: String(entry.url), alt: String(entry.alt || ""), caption: String(entry.caption || "") }));
}

export function normalizeArticle(article = {}) {
  const title = String(article.title || "Untitled story").trim();
  return {
    id: article.id || null,
    slug: createSlug(article.slug || title),
    title,
    dek: String(article.dek || "").trim(),
    body: String(article.body || "").trim(),
    category: String(article.category || "Dispatch").trim() || "Dispatch",
    author: String(article.author || "SHIPS Newsroom").trim() || "SHIPS Newsroom",
    hero_image_url: String(article.hero_image_url || "").trim(),
    hero_image_alt: String(article.hero_image_alt || "").trim(),
    gallery: normalizeGallery(article.gallery),
    is_published: article.is_published === true,
    is_featured: article.is_featured === true,
    published_at: article.published_at || null,
    seo_title: String(article.seo_title || "").trim(),
    seo_description: String(article.seo_description || "").trim(),
    created_at: article.created_at || null,
    updated_at: article.updated_at || null,
  };
}

export function normalizeArticles(articles) {
  return Array.isArray(articles) ? articles.map(normalizeArticle) : [];
}

export function publicArticles(articles) {
  return normalizeArticles(articles)
    .filter((article) => article.is_published)
    .sort((a, b) => new Date(b.published_at || b.created_at || 0) - new Date(a.published_at || a.created_at || 0));
}

export function uniqueCategories(articles) {
  const categories = new Map();
  normalizeArticles(articles).forEach(({ category }) => {
    const key = category.toLowerCase();
    if (!categories.has(key)) categories.set(key, category);
  });
  return ["All", ...[...categories.values()].sort((a, b) => a.localeCompare(b))];
}

export function normalizeSettings(settings = {}) {
  return {
    ...DEFAULT_SETTINGS,
    ...Object.fromEntries(Object.entries(settings || {}).filter(([, value]) => value !== null && value !== "")),
  };
}

export function formatDate(value) {
  if (!value) return "Unscheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unscheduled";
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "long", day: "numeric" }).format(date);
}

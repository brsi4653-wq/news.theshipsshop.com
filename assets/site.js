import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SHOP_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config.js";
import { formatDate, normalizeArticles, normalizeSettings, publicArticles, uniqueCategories } from "./news-model.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
let articles = [];
let activeCategory = "All";
let settings = normalizeSettings();

const escapeHtml = (value = "") => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const articleUrl = (article) => `article.html?slug=${encodeURIComponent(article.slug)}`;

function imageMarkup(article, className = "story-image") {
  if (!article.hero_image_url) return `<div class="${className} image-empty"><span>Image pending</span></div>`;
  return `<div class="${className}"><img src="${escapeHtml(article.hero_image_url)}" alt="${escapeHtml(article.hero_image_alt || article.title)}" /></div>`;
}

function articleCard(article, index) {
  return `<article class="article-card">
    <a href="${articleUrl(article)}">${imageMarkup(article, "card-image")}</a>
    <div class="card-copy">
      <span class="story-number">${String(index + 1).padStart(2, "0")}</span>
      <span class="overline">${escapeHtml(article.category)}</span>
      <h2><a href="${articleUrl(article)}">${escapeHtml(article.title)}</a></h2>
      <p>${escapeHtml(article.dek || "Read the full story from SHIPS News.")}</p>
      <div class="story-meta"><span>${escapeHtml(article.author)}</span><time>${formatDate(article.published_at)}</time></div>
    </div>
  </article>`;
}

function renderCategories() {
  document.getElementById("category-nav").innerHTML = uniqueCategories(articles).map((category) =>
    `<button class="${category === activeCategory ? "active" : ""}" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`
  ).join("");
}

function renderFeatured() {
  const featured = articles.find((article) => article.is_featured) || articles[0];
  const section = document.getElementById("featured-story");
  if (!featured) {
    section.innerHTML = `<div class="empty-news"><span class="overline">The newsroom is preparing its first issue</span><h1>No stories are published yet.</h1><p>Return soon for reporting from SHIPS News.</p></div>`;
    return;
  }
  section.innerHTML = `${imageMarkup(featured, "featured-image")}
    <div class="featured-copy">
      <span class="overline">Featured story / ${escapeHtml(featured.category)}</span>
      <h1><a href="${articleUrl(featured)}">${escapeHtml(featured.title)}</a></h1>
      <p>${escapeHtml(featured.dek)}</p>
      <div class="story-meta"><span>By ${escapeHtml(featured.author)}</span><time>${formatDate(featured.published_at)}</time></div>
      <a class="read-link" href="${articleUrl(featured)}">Read the story <span>→</span></a>
    </div>`;
}

function renderGrid() {
  const featured = articles.find((article) => article.is_featured) || articles[0];
  const filtered = articles.filter((article) => article.id !== featured?.id && (activeCategory === "All" || article.category.toLowerCase() === activeCategory.toLowerCase()));
  document.getElementById("article-grid").innerHTML = filtered.length
    ? filtered.map(articleCard).join("")
    : `<div class="empty-news compact"><h2>No additional stories in this section.</h2><p>Choose another category or return for the next story.</p></div>`;
}

function applySettings() {
  document.getElementById("site-tagline").textContent = settings.tagline;
  document.getElementById("site-description").textContent = settings.description;
  document.documentElement.style.setProperty("--signal", settings.accent_color);
  ["header-shop-link", "footer-shop-link"].forEach((id) => document.getElementById(id).href = settings.shop_url || SHOP_URL);
}

async function load() {
  const [{ data: articleData, error: articleError }, { data: settingsData }] = await Promise.all([
    supabase.from("public_news_articles").select("*").order("published_at", { ascending: false }),
    supabase.from("public_news_settings").select("*").limit(1).maybeSingle(),
  ]);
  if (articleError) console.warn("News data is not configured yet.", articleError.message);
  articles = publicArticles(normalizeArticles(articleData || []));
  settings = normalizeSettings(settingsData || {});
  applySettings();
  renderCategories();
  renderFeatured();
  renderGrid();
}

document.getElementById("category-nav").addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  activeCategory = button.dataset.category;
  renderCategories();
  renderGrid();
});

load();

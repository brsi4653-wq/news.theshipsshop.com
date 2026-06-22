import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SHOP_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config.js";
import { formatDate, normalizeArticle } from "./news-model.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const escapeHtml = (value = "") => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

function renderBody(body) {
  return String(body || "").split(/\n{2,}/).map((block) => {
    const text = block.trim();
    if (!text) return "";
    if (text.startsWith("## ")) return `<h2>${escapeHtml(text.slice(3))}</h2>`;
    if (text.startsWith("> ")) return `<blockquote>${escapeHtml(text.slice(2))}</blockquote>`;
    return `<p>${escapeHtml(text).replaceAll("\n", "<br />")}</p>`;
  }).join("");
}

function galleryMarkup(gallery) {
  if (!gallery.length) return "";
  return `<section class="story-gallery">${gallery.map((image) => `<figure><img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.alt)}" />${image.caption ? `<figcaption>${escapeHtml(image.caption)}</figcaption>` : ""}</figure>`).join("")}</section>`;
}

function updateMetadata(article) {
  const title = article.seo_title || `${article.title} | SHIPS News`;
  const description = article.seo_description || article.dek;
  const url = `https://news.theshipsshop.com/article.html?slug=${encodeURIComponent(article.slug)}`;
  document.title = title;
  document.getElementById("meta-description").content = description;
  document.getElementById("canonical-link").href = url;
  document.getElementById("og-title").content = title;
  document.getElementById("og-description").content = description;
  document.getElementById("og-image").content = article.hero_image_url;
  const schema = document.createElement("script");
  schema.type = "application/ld+json";
  schema.textContent = JSON.stringify({ "@context": "https://schema.org", "@type": "NewsArticle", headline: article.title, description, image: article.hero_image_url ? [article.hero_image_url] : [], datePublished: article.published_at, dateModified: article.updated_at || article.published_at, author: { "@type": "Organization", name: article.author }, publisher: { "@type": "Organization", name: "SHIPS News" }, mainEntityOfPage: url });
  document.head.appendChild(schema);
}

async function loadArticle() {
  const slug = new URLSearchParams(location.search).get("slug");
  const page = document.getElementById("article-page");
  if (!slug) {
    page.innerHTML = `<div class="empty-news"><h1>Story not found.</h1><a class="read-link" href="index.html">Return to the newsroom</a></div>`;
    return;
  }
  const { data, error } = await supabase.from("public_news_articles").select("*").eq("slug", slug).maybeSingle();
  if (error || !data) {
    page.innerHTML = `<div class="empty-news"><span class="overline">Story unavailable</span><h1>This story is not published.</h1><a class="read-link" href="index.html">Return to the newsroom</a></div>`;
    return;
  }
  const article = normalizeArticle(data);
  updateMetadata(article);
  page.innerHTML = `<article>
    <header class="story-header">
      <span class="overline">${escapeHtml(article.category)} / SHIPS News</span>
      <h1>${escapeHtml(article.title)}</h1>
      <p class="dek">${escapeHtml(article.dek)}</p>
      <div class="story-meta"><span>By ${escapeHtml(article.author)}</span><time>${formatDate(article.published_at)}</time></div>
    </header>
    ${article.hero_image_url ? `<figure class="article-hero"><img src="${escapeHtml(article.hero_image_url)}" alt="${escapeHtml(article.hero_image_alt || article.title)}" /></figure>` : ""}
    <div class="story-layout">
      <aside><span>Published by SHIPS News</span><a href="https://theshipsshop.com">Shop SHIPS ↗</a></aside>
      <div class="story-body">${renderBody(article.body)}</div>
    </div>
    ${galleryMarkup(article.gallery)}
    <section class="shop-callout"><span class="overline">More from SHIPS</span><h2>Visit the clothing shop.</h2><p>Explore the latest garments from SHIPS.</p><a href="${SHOP_URL}">Visit the shop ↗</a></section>
  </article>`;
}

loadArticle();

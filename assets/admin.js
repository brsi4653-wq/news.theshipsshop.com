import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { ADMIN_EMAIL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config.js";
import { createSlug, DEFAULT_SETTINGS, normalizeArticle, normalizeArticles, normalizeSettings } from "./news-model.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const form = document.getElementById("article-form");
const list = document.getElementById("article-list");
const message = document.getElementById("editor-message");
let articles = [];
let currentId = null;
let savedAdminUser = null;

const isAdmin = (user) => user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
const setMessage = (text = "", error = false) => { message.textContent = text; message.classList.toggle("error", error); };
const field = (name) => form.elements.namedItem(name);

function galleryToLines(gallery) {
  return gallery.map((image) => [image.url, image.alt, image.caption].join(" | ")).join("\n");
}

function linesToGallery(value) {
  return String(value || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const [url = "", alt = "", caption = ""] = line.split("|").map((part) => part.trim());
    return { url, alt, caption };
  }).filter((image) => image.url);
}

function articleFromForm() {
  return normalizeArticle({
    id: field("id").value || null,
    title: field("title").value,
    slug: field("slug").value,
    category: field("category").value,
    author: field("author").value,
    dek: field("dek").value,
    body: field("body").value,
    hero_image_url: field("hero_image_url").value,
    hero_image_alt: field("hero_image_alt").value,
    gallery: linesToGallery(field("gallery_lines").value),
    seo_title: field("seo_title").value,
    seo_description: field("seo_description").value,
    is_published: field("is_published").checked,
    is_featured: field("is_featured").checked,
  });
}

function fillForm(article = normalizeArticle()) {
  currentId = article.id;
  field("id").value = article.id || "";
  ["title","slug","category","author","dek","body","hero_image_url","hero_image_alt","seo_title","seo_description"].forEach((name) => field(name).value = article[name] || "");
  field("gallery_lines").value = galleryToLines(article.gallery);
  field("is_published").checked = article.is_published;
  field("is_featured").checked = article.is_featured;
  document.getElementById("editor-title").textContent = article.id ? article.title : "New article";
  renderList();
  setMessage();
}

function renderList() {
  list.innerHTML = articles.length ? articles.map((article) => `<button type="button" data-id="${article.id}" class="${article.id === currentId ? "active" : ""}"><strong>${article.title}</strong><small>${article.is_published ? "Published" : "Draft"} / ${article.category}${article.is_featured ? " / Featured" : ""}</small></button>`).join("") : `<p>No stories yet.</p>`;
}

async function uploadFile(file, folder) {
  if (!file.type.match(/^image\/(jpeg|png|webp)$/)) throw new Error("Only JPEG, PNG, and WebP images are supported.");
  if (file.size > 12 * 1024 * 1024) throw new Error("Images must be smaller than 12 MB.");
  const extension = file.name.split(".").pop().toLowerCase();
  const path = `${folder}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("news-images").upload(path, file, { contentType: file.type });
  if (error) throw error;
  return supabase.storage.from("news-images").getPublicUrl(path).data.publicUrl;
}

async function attachUploads(article) {
  const hero = document.getElementById("hero-image-file").files[0];
  if (hero) article.hero_image_url = await uploadFile(hero, article.slug);
  const files = [...document.getElementById("gallery-image-files").files];
  for (const file of files) article.gallery.push({ url: await uploadFile(file, `${article.slug}/gallery`), alt: "", caption: "" });
  return article;
}

async function saveArticle(forcePublished = null) {
  try {
    setMessage("Saving…");
    let article = articleFromForm();
    if (!article.title.trim()) throw new Error("Add a headline before saving.");
    article.slug = createSlug(article.slug || article.title);
    if (forcePublished !== null) article.is_published = forcePublished;
    article = await attachUploads(article);
    if (article.is_featured) await supabase.from("news_articles").update({ is_featured: false }).neq("id", article.id || "00000000-0000-0000-0000-000000000000");
    const payload = { ...article, published_at: article.is_published ? (articles.find((item) => item.id === article.id)?.published_at || new Date().toISOString()) : null };
    delete payload.created_at; delete payload.updated_at;
    if (!payload.id) delete payload.id;
    const { data, error } = await supabase.from("news_articles").upsert(payload).select().single();
    if (error) throw error;
    await loadArticles(data.id);
    setMessage(article.is_published ? "Article published." : "Draft saved.");
  } catch (error) { setMessage(error.message, true); }
}

async function loadArticles(selectId = currentId) {
  const { data, error } = await supabase.from("news_articles").select("*").order("updated_at", { ascending: false });
  if (error) throw error;
  articles = normalizeArticles(data || []);
  const selected = articles.find((article) => article.id === selectId);
  if (selected) fillForm(selected); else { renderList(); if (!currentId) fillForm(normalizeArticle()); }
}

async function loadSettings() {
  const { data } = await supabase.from("news_settings").select("*").eq("id", true).maybeSingle();
  const settings = normalizeSettings(data || DEFAULT_SETTINGS);
  Object.entries(settings).forEach(([name, value]) => { const input = document.getElementById("settings-form").elements.namedItem(name); if (input) input.value = value; });
}

async function enterAdmin(user) {
  if (!isAdmin(user)) { await supabase.auth.signOut(); document.getElementById("login-message").textContent = "This Google account is not authorized."; return; }
  document.getElementById("login-panel").hidden = true;
  document.getElementById("admin-app").hidden = false;
  document.getElementById("sign-out").hidden = false;
  document.getElementById("account-label").textContent = user.email;
  await Promise.all([loadArticles(), loadSettings()]);
}

document.getElementById("google-login").addEventListener("click", () => savedAdminUser ? enterAdmin(savedAdminUser) : supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.href, queryParams: { prompt: "select_account" } } }));
document.getElementById("sign-out").addEventListener("click", async () => { await supabase.auth.signOut(); location.reload(); });
document.getElementById("new-article").addEventListener("click", () => fillForm(normalizeArticle()));
list.addEventListener("click", (event) => { const button = event.target.closest("[data-id]"); if (button) fillForm(articles.find((article) => article.id === button.dataset.id)); });
field("title").addEventListener("input", () => { if (!currentId || !field("slug").value) field("slug").value = createSlug(field("title").value); });
document.getElementById("save-draft").addEventListener("click", () => saveArticle(false));
document.getElementById("publish-article").addEventListener("click", () => saveArticle(true));
document.getElementById("duplicate-article").addEventListener("click", () => { const article = articleFromForm(); article.id = null; article.title += " Copy"; article.slug = createSlug(article.title); article.is_published = false; article.is_featured = false; fillForm(article); });
document.getElementById("delete-article").addEventListener("click", async () => { if (!currentId || !confirm("Delete this article permanently?")) return; const { error } = await supabase.from("news_articles").delete().eq("id", currentId); if (error) return setMessage(error.message, true); currentId = null; await loadArticles(); fillForm(normalizeArticle()); });
document.getElementById("settings-form").addEventListener("submit", async (event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget)); const { error } = await supabase.from("news_settings").upsert({ id: true, ...values }); setMessage(error ? error.message : "Publication settings saved.", Boolean(error)); });

const { data: { session } } = await supabase.auth.getSession();
if (session?.user) { savedAdminUser = session.user; document.getElementById("login-message").textContent = `Signed in as ${session.user.email}. Continue to open the newsroom.`; }
supabase.auth.onAuthStateChange((event, nextSession) => {
  if (event === "SIGNED_IN" && nextSession?.user) {
    savedAdminUser = nextSession.user;
    enterAdmin(nextSession.user);
  }
});

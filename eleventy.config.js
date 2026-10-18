// Eleventy build for a static Arabic real-estate information site on Cloudflare Pages.
// Content is edited through Pages CMS (see .pages.yml); every save rebuilds the site.
import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";

const AR_DATE = new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Cairo" });
const EN_DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Cairo" });
// Arabic lives at the site root, English under /en/. One helper turns a root path into the path for a language.
const L_PATH = (path, lang) => (lang === "en" ? "/en" + (path || "/") : path || "/");
const SUFFIX = (lang) => (lang === "en" ? "_en" : "");
const toDate = (d) => (d instanceof Date ? d : new Date(d));
const isLive = (item) => !item.data.draft;
const strip = (html) => String(html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/assets/fonts": "assets/fonts", "src/assets/css": "assets/css", "src/assets/js": "assets/js", "src/assets/img": "assets/img" });
  eleventyConfig.addPassthroughCopy({ "src/_headers": "_headers", "src/_redirects": "_redirects" });
  eleventyConfig.addPassthroughCopy("src/media/**/*.{jpg,jpeg,png,webp,avif,gif,svg}");
  eleventyConfig.addWatchTarget("src/assets/");

  // Images: real width/height (no layout shift), WebP + original, lazy loading. Runs on every <img> in the output.
  eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
    formats: ["webp", "auto"],
    widths: [480, 960, 1440, "auto"],
    htmlOptions: { imgAttributes: { loading: "lazy", decoding: "async" } },
    failOnError: false,
  });

  // Markdown: tables scroll sideways on phones instead of breaking the layout.
  eleventyConfig.amendLibrary("md", (md) => {
    md.set({ html: true, breaks: false, linkify: true });
    md.renderer.rules.table_open = () => '<div class="table-wrap"><table>\n';
    md.renderer.rules.table_close = () => "</table></div>\n";
  });

  // ---------- Collections ----------
  // Arabic (root) and English (/en/) are separate collections with the same shape: posts / posts_en ...
  const byDate = (a, b) => toDate(b.data.date) - toDate(a.data.date);
  const postsGlob = { ar: "src/posts/*.md", en: "src/en/posts/*.md" };
  const pagesGlob = { ar: "src/pages/*.md", en: "src/en/pages/*.md" };
  const sectionPages = (api, lang) => {
    const sections = api.getAll()[0]?.data?.["sections" + SUFFIX(lang)]?.items || [];
    const posts = api.getFilteredByGlob(postsGlob[lang]).filter(isLive).sort(byDate);
    const known = new Set(sections.map((s) => s.slug));
    const out = [];
    for (const s of sections) {
      const list = posts.filter((p) => (known.has(p.data.section) ? p.data.section : "articles") === s.slug);
      const size = 12, total = Math.max(1, Math.ceil(list.length / size));
      const at = (n) => L_PATH(n === 1 ? `/${s.slug}/` : `/${s.slug}/page/${n}/`, lang);
      for (let i = 0; i < total; i++) {
        out.push({ section: s, posts: list.slice(i * size, (i + 1) * size), count: list.length, page: i + 1, total, url: at(i + 1),
          prev: i === 0 ? null : at(i), next: i + 1 < total ? at(i + 2) : null });
      }
    }
    return out;
  };
  for (const lang of ["ar", "en"]) {
    const sfx = SUFFIX(lang);
    eleventyConfig.addCollection("posts" + sfx, (api) => api.getFilteredByGlob(postsGlob[lang]).filter(isLive).sort(byDate));
    eleventyConfig.addCollection("pagesLive" + sfx, (api) => api.getFilteredByGlob(pagesGlob[lang]).filter(isLive));
    // One paginated listing per section, 12 cards per page: /buying/, /buying/page/2/ (English: /en/buying/ ...)
    eleventyConfig.addCollection("sectionPages" + sfx, (api) => sectionPages(api, lang));
  }
  // Every published URL, so a page links to its other-language twin only when that twin really exists.
  eleventyConfig.addCollection("urlSet", (api) => {
    // Paginated listings are counted here directly, because only their first page appears in getAll().
    const set = new Set(api.getAll().filter((i) => i.url && !i.data.draft).map((i) => i.url));
    for (const lang of ["ar", "en"]) {
      for (const sp of sectionPages(api, lang)) set.add(sp.url);
      const n = Math.max(1, Math.ceil(api.getFilteredByGlob(postsGlob[lang]).filter(isLive).length / 12));
      for (let i = 1; i <= n; i++) set.add(L_PATH(i === 1 ? "/blog/" : `/blog/page/${i}/`, lang));
    }
    return [set];
  });

  // ---------- Filters ----------
  eleventyConfig.addFilter("arDate", (d) => (d ? AR_DATE.format(toDate(d)) : ""));
  eleventyConfig.addFilter("ldate", (d, lang) => (d ? (lang === "en" ? EN_DATE : AR_DATE).format(toDate(d)) : ""));
  // Social profiles filled in the settings; empty ones are skipped. Email becomes a mailto: link.
  eleventyConfig.addFilter("socialLinks", (social) => {
    const keys = ["facebook", "instagram", "x", "youtube", "tiktok", "linkedin", "telegram"];
    const out = keys.filter((k) => /^https?:\/\//.test(String(social?.[k] || ""))).map((k) => ({ key: k, href: social[k] }));
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(social?.email || ""))) out.push({ key: "email", href: "mailto:" + social.email });
    return out;
  });
  eleventyConfig.addFilter("setKey", (obj, k, v) => { obj[k] = v; return obj; });
  eleventyConfig.addFilter("lpath", (path, lang) => L_PATH(path, lang));
  eleventyConfig.addFilter("coll", (collections, name, lang) => collections?.[name + SUFFIX(lang)] || []);
  // The same page in the other language, or null when it is not published.
  eleventyConfig.addFilter("altUrl", (url, lang, collections) => {
    if (!url || url.endsWith(".html") || url.endsWith(".xml") || url.endsWith(".txt")) return null;
    const twin = lang === "en" ? url.replace(/^\/en(?=\/)/, "") : "/en" + url;
    const set = collections?.urlSet?.[0];
    return set && set.has(twin) ? twin : null;
  });
  eleventyConfig.addFilter("anyDate", (d, lang) => (d instanceof Date ? (lang === "en" ? EN_DATE : AR_DATE).format(d) : String(d ?? "")));
  eleventyConfig.addFilter("isoDate", (d) => (d ? toDate(d).toISOString().slice(0, 10) : ""));
  eleventyConfig.addFilter("isoFull", (d) => (d ? toDate(d).toISOString() : ""));
  eleventyConfig.addFilter("encode", (s) => encodeURIComponent(String(s ?? "")));
  eleventyConfig.addFilter("json", (v) => JSON.stringify(v).replace(/</g, "\\u003c"));
  eleventyConfig.addFilter("plain", strip);
  eleventyConfig.addFilter("abs", (path, base) => new URL(path || "/", String(base).replace(/\/?$/, "/")).href);
  eleventyConfig.addFilter("sectionOf", (slug, sections) => {
    const items = sections?.items || [];
    return items.find((s) => s.slug === slug) || items.find((s) => s.slug === "articles") || { name: "", slug: "articles" };
  });
  eleventyConfig.addFilter("inSection", (posts, slug, sections) => {
    const known = new Set((sections?.items || []).map((s) => s.slug));
    return (posts || []).filter((p) => (known.has(p.data.section) ? p.data.section : "articles") === slug);
  });
  eleventyConfig.addFilter("except", (posts, url) => (posts || []).filter((p) => p.url !== url));
  eleventyConfig.addFilter("take", (arr, n) => (arr || []).slice(0, n));
  eleventyConfig.addFilter("pageByFile", (pages, stem) => (pages || []).find((p) => p.page.fileSlug === stem));

  // Adds ids to every <h2> in the article body and returns the table of contents entries.
  eleventyConfig.addFilter("withToc", (html) => {
    const items = []; let n = 0;
    const out = String(html || "").replace(/<h2(\s[^>]*)?>([\s\S]*?)<\/h2>/g, (m, attrs = "", inner) => {
      const idm = /\sid="([^"]+)"/.exec(attrs);
      const id = idm ? idm[1] : `s-${++n}`;
      items.push({ id, text: strip(inner) });
      return idm ? m : `<h2 id="${id}"${attrs}>${inner}</h2>`;
    });
    return { html: out, items };
  });

  // JSON-LD per page type. The phone number appears only here and inside button links, never as visible text.
  eleventyConfig.addFilter("jsonld", function (pageType) {
    const c = this.ctx || {}, site = c.site || {}, lang = c.lang === "en" ? "en" : "ar", L = (c.i18n || {})[lang] || {};
    const base = String(site.url || "").replace(/\/?$/, "/");
    const abs = (p) => new URL(p || "/", base).href, home = abs(L_PATH("/", lang)), root = abs("/");
    const url = abs(c.page?.url), tel = "+" + site.phone;
    const social = Object.values(site.social || {}).filter((v) => /^https?:\/\//.test(String(v || "")));
    const org = { "@type": "Organization", "@id": root + "#org", name: site.name, url: home, logo: abs("/assets/img/icon-512.png"),
      telephone: tel, contactPoint: { "@type": "ContactPoint", telephone: tel, contactType: "customer service", availableLanguage: ["ar", "en"] } };
    if (social.length) org.sameAs = social;
    const web = { "@type": "WebSite", "@id": home + "#website", name: site.name, url: home, inLanguage: lang, publisher: { "@id": root + "#org" } };
    const crumbs = (items) => ({ "@type": "BreadcrumbList", itemListElement: items.map(([name, item], i) => ({ "@type": "ListItem", position: i + 1, name, item })) });
    const H = [L.home || "Home", home], B = [L.blog || "Blog", abs(L_PATH("/blog/", lang))];
    let graph = null;
    if (pageType === "home") graph = [web, org];
    else if (pageType === "post") {
      const items = c.sections?.items || [];
      const sec = items.find((s) => s.slug === c.section) || items.find((s) => s.slug === "articles") || { name: "", slug: "articles" };
      const art = { "@type": "Article", headline: c.title, description: c.description, inLanguage: lang,
        datePublished: toDate(c.date).toISOString(), dateModified: toDate(c.updated || c.date).toISOString(),
        mainEntityOfPage: url, url, articleSection: sec.name,
        author: { "@type": "Person", name: c.author || site.default_author },
        publisher: { "@id": root + "#org" }, isPartOf: { "@id": home + "#website" } };
      if (c.image) art.image = abs(c.image);
      if (c.translation_of) art.translationOfWork = { "@id": abs(c.translation_of) };
      graph = [art, crumbs([H, B, [sec.name, abs(L_PATH(`/${sec.slug}/`, lang))], [c.title, url]]), org, web];
    } else if (pageType === "section" && c.sp) {
      graph = [{ "@type": "CollectionPage", name: c.sp.section.name, description: c.sp.section.description, url, inLanguage: lang, isPartOf: { "@id": home + "#website" } },
        crumbs([H, B, [c.sp.section.name, abs(L_PATH(`/${c.sp.section.slug}/`, lang))]])];
    } else if (pageType === "list") {
      graph = [{ "@type": "CollectionPage", name: c.h1 || L.blog, url, inLanguage: lang, isPartOf: { "@id": home + "#website" } }, crumbs([H, B])];
    } else if (pageType === "page") {
      graph = [{ "@type": "WebPage", name: c.title, url, inLanguage: lang, isPartOf: { "@id": home + "#website" } }, crumbs([H, [c.title, url]])];
    }
    return graph ? JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c") : "";
  });
  eleventyConfig.addFilter("xml", esc);

  return {
    dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
    markdownTemplateEngine: false,
    htmlTemplateEngine: "njk",
    templateFormats: ["md", "njk"],
  };
}

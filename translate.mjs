// Translates the Arabic site into English and writes the English files the site builds from.
//
//   src/posts/*.md   -> src/en/posts/*.md      (articles)
//   src/pages/*.md   -> src/en/pages/*.md      (about, contact, editorial policy, privacy)
//   src/_data/{site,home,sections,tools}.json -> src/_data/*_en.json
//
// It runs from GitHub Actions after every change to the Arabic content (see .github/workflows/translate.yml).
// Translation uses Cloudflare Workers AI on the free daily allowance of the same Cloudflare account.
// Only files whose Arabic text changed since the last run are translated; i18n-state.json remembers them.
// If the daily allowance runs out, the script stops cleanly and the next run continues.
//
// Needs two secrets: CF_ACCOUNT_ID and CF_API_TOKEN (a token with the "Workers AI: Read" permission).

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import yaml from "js-yaml";

const ACCOUNT = process.env.CF_ACCOUNT_ID || "";
const TOKEN = process.env.CF_API_TOKEN || "";
const MODEL = process.env.CF_AI_MODEL || "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const STATE_FILE = "i18n-state.json";
const ARABIC = /[؀-ۿ]/;

if (!ACCOUNT || !TOKEN) {
  console.log("CF_ACCOUNT_ID or CF_API_TOKEN is not set; nothing was translated.");
  process.exit(0);
}

const state = fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) : {};
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
class OutOfAllowance extends Error {}

const SYSTEM = [
  "You are a professional Arabic to English translator for an Egyptian real estate information website.",
  "Translate the user's text from Modern Standard Arabic into clear, natural, professional English.",
  "Keep every HTML tag, HTML attribute, Markdown symbol, URL, number, and line break exactly as given; translate only the human-readable text.",
  "Do not add, remove, summarise, or explain anything. Do not add notes, titles, or quotation marks. Output only the translation.",
  "Use these terms: توكيل = power of attorney; الشهر العقاري = the Real Estate Registry (Al-Shahr Al-Aqari); مقدم = down payment;",
  "قسط = installment; وحدة = unit; كمبوند = compound; الاستلام / التسليم = handover; إعادة البيع = resale; شاليه = chalet; المصريون بالخارج = Egyptians abroad;",
  "الساحل الشمالي = the North Coast; التجمع الخامس = Fifth Settlement; العاصمة الإدارية = the New Administrative Capital; جنيه = EGP.",
].join(" ");

async function ai(text) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/ai/run/${MODEL}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "system", content: SYSTEM }, { role: "user", content: text }], max_tokens: 4096, temperature: 0.2 }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    const msg = JSON.stringify(body.errors || body).slice(0, 400);
    if (res.status === 429 || /allocation|neurons|quota|limit/i.test(msg)) throw new OutOfAllowance(msg);
    throw new Error(`Workers AI error ${res.status}: ${msg}`);
  }
  let out = String(body.result?.response ?? "").trim();
  out = out.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "").trim();
  out = out.replace(/^(here is|here's) the translation[^\n]*\n+/i, "");
  return out;
}

// Short strings go in one call; long article bodies are split at blank lines into pieces of about 2,500 characters.
async function tr(text) {
  if (text == null) return text;
  const s = String(text);
  if (!ARABIC.test(s)) return s;
  if (s.length <= 2500) return ai(s);
  const blocks = s.split(/\n{2,}/);
  const chunks = [];
  let cur = "";
  for (const b of blocks) {
    if (cur && cur.length + b.length > 2500) { chunks.push(cur); cur = ""; }
    cur = cur ? cur + "\n\n" + b : b;
  }
  if (cur) chunks.push(cur);
  const out = [];
  for (const c of chunks) out.push(ARABIC.test(c) ? await ai(c) : c);
  return out.join("\n\n");
}

const trList = async (list) => (Array.isArray(list) ? Promise.all(list.map((x) => tr(x))) : list);

// Links inside the site point to the English twin: /buying/ -> /en/buying/. Media and assets stay as they are.
function knownPaths() {
  const slugs = new Set(["blog", "tools", "search", "about", "contact", "editorial-policy", "privacy"]);
  for (const f of fs.readdirSync("src/posts")) if (f.endsWith(".md")) {
    const fm = readMd(path.join("src/posts", f)).data;
    slugs.add(String(fm.slug || f.replace(/\.md$/, "")));
  }
  for (const s of JSON.parse(fs.readFileSync("src/_data/sections.json", "utf8")).items || []) slugs.add(s.slug);
  return slugs;
}
function localiseLinks(text, slugs) {
  if (typeof text !== "string") return text;
  return text.replace(/(href="|\]\()\/(?!en\/|media\/|assets\/)([a-z0-9-]+)(\/[^"\)\s]*)?/g, (m, pre, first, rest = "") =>
    slugs.has(first) ? `${pre}/en/${first}${rest}` : m);
}

function readMd(file) {
  const raw = fs.readFileSync(file, "utf8");
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  return m ? { raw, data: yaml.load(m[1], { schema: yaml.CORE_SCHEMA }) || {}, body: m[2] } : { raw, data: {}, body: raw };
}
function writeMd(file, data, body) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const fm = yaml.dump(data, { lineWidth: -1, noRefs: true, quotingType: '"', schema: yaml.CORE_SCHEMA });
  fs.writeFileSync(file, `---\n${fm}---\n${body.endsWith("\n") ? body : body + "\n"}`);
}

async function translatePost(src, dest, slugs, kind) {
  const { raw, data, body } = readMd(src);
  const key = src;
  if (data.draft) {
    // The Arabic article went back to draft: unpublish the English one too.
    if (fs.existsSync(dest)) { const e = readMd(dest); if (!e.data.draft) { e.data.draft = true; writeMd(dest, e.data, e.body); console.log("draft  ", dest); } }
    return;
  }
  const h = sha(raw);
  if (state[key] === h && fs.existsSync(dest)) return;
  const en = { ...data };
  for (const f of ["title", "description", "answer", "image_alt", "image_caption", "next_title", "author", "reviewer"]) if (en[f]) en[f] = await tr(en[f]);
  for (const f of ["pros", "cons", "actions"]) if (en[f]) en[f] = await trList(en[f]);
  if (Array.isArray(en.faq)) en.faq = await Promise.all(en.faq.map(async (x) => ({ ...x, q: await tr(x.q), a: await tr(x.a) })));
  if (Array.isArray(en.sources)) en.sources = await Promise.all(en.sources.map(async (x) => ({ ...x, name: await tr(x.name) })));
  if (en.next_url) en.next_url = localiseLinks(`href="${en.next_url}"`, slugs).slice(6, -1);
  const slug = data.slug || path.basename(src, ".md");
  en.translation_of = kind === "post" ? `/${slug}/` : `/${path.basename(src, ".md")}/`;
  en.machine_translated = true;
  en.draft = false;
  const enBody = localiseLinks(await tr(body), slugs);
  writeMd(dest, en, enBody);
  state[key] = h;
  console.log("wrote  ", dest);
}

async function translateData(name, fields, listKey) {
  const src = `src/_data/${name}.json`, dest = `src/_data/${name}_en.json`;
  const raw = fs.readFileSync(src, "utf8");
  const h = sha(raw);
  if (state[src] === h && fs.existsSync(dest)) return;
  const ar = JSON.parse(raw);
  const prev = fs.existsSync(dest) ? JSON.parse(fs.readFileSync(dest, "utf8")) : {};
  let en;
  if (listKey) {
    en = { ...ar, [listKey]: [] };
    for (const item of ar[listKey] || []) {
      const x = { ...item };
      for (const f of fields) if (x[f]) x[f] = await tr(x[f]);
      en[listKey].push(x);
    }
  } else {
    en = { ...prev };
    for (const f of fields) en[f] = ar[f] ? await tr(ar[f]) : prev[f] || "";
  }
  fs.writeFileSync(dest, JSON.stringify(en, null, 2) + "\n");
  state[src] = h;
  console.log("wrote  ", dest);
}

async function main() {
  const slugs = knownPaths();
  const jobs = [];
  const seen = { "src/en/posts": new Set(), "src/en/pages": new Set() };
  for (const [srcDir, destDir, kind] of [["src/posts", "src/en/posts", "post"], ["src/pages", "src/en/pages", "page"]]) {
    for (const f of fs.readdirSync(srcDir).filter((f) => f.endsWith(".md")).sort()) {
      seen[destDir].add(f);
      jobs.push(() => translatePost(path.join(srcDir, f), path.join(destDir, f), slugs, kind));
    }
  }
  jobs.push(() => translateData("home", ["kicker", "h1", "lead", "search_placeholder", "sections_h2", "sections_p", "latest_h2", "latest_p", "tools_h2", "tools_p"]));
  jobs.push(() => translateData("sections", ["name", "nav", "description", "intro", "cta"], "items"));
  jobs.push(() => translateData("tools", ["name", "desc"], "items"));
  jobs.push(() => translateData("site", ["tagline", "description", "about", "wa_intro", "default_author", "author_note"]));

  let stopped = false;
  for (const job of jobs) {
    try { await job(); }
    catch (e) {
      if (e instanceof OutOfAllowance) { console.log("The free Workers AI allowance for today is used up; the next run will continue.", e.message); stopped = true; break; }
      console.error(e.message); process.exitCode = 1;
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n");
  }
  // An Arabic file that was deleted: delete its English copy too.
  if (!stopped) for (const dir of Object.keys(seen)) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) if (f.endsWith(".md") && !seen[dir].has(f)) { fs.rmSync(path.join(dir, f)); console.log("removed", path.join(dir, f)); }
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n");
}

main();

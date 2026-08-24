// dsh-harmonyos-market compat preflight.
// Zero-dependency: parses data/plugins/*.yml entries, fetches each plugin package.json
// (GitHub raw), walks the npm dependency tree, checks the native-module blacklist,
// and compares the result against the entry declared harmonyos.level.
// Usage: node check-compat.mjs [--entry owner__name.yml]
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DATA = new URL("../data/plugins/", import.meta.url).pathname;
const BLACKLIST = new Set([
  "lightningcss", "node-pty", "koffi", "ssh2", "ref-napi", "ffi-napi",
  "sharp", "canvas", "bcrypt", "sqlite3", "better-sqlite3", "serialport",
  "robotjs", "node-gyp-build", "bindings", "node-addon-api",
]);
const TIMEOUT = 15000;
const MAX_DEPTH = 4;

function die(msg) { console.error(msg); process.exit(1); }

// --- minimal YAML-subset parser for our entry schema ---
function parseEntry(text) {
  const lines = text.split("\n");
  const out = {};
  let cur = null;
  for (const raw of lines) {
    const line = raw.replace(/\r$/, "");
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const m = /^([a-zA-Z_-]+):\s*(.*)$/.exec(line.trim());
    if (!m) continue;
    const key = m[1];
    const val = m[2];
    if (val !== "") {
      if (cur === "harmonyos") {
        out[cur] = out[cur] || {};
        out[cur][key] = val;
      } else if (cur === "description" && (key === "en" || key === "zh")) {
        out[cur][key] = val;
      } else {
        out[key] = val.replace(/^[\x22\x27]|[\x22\x27]$/g, "");
        cur = null;
      }
    } else {
      if (key === "harmonyos" || key === "description") {
        cur = key;
        out[key] = {};
      } else {
        cur = null;
      }
    }
  }
  return out;
}

async function fetchJson(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { "user-agent": "dsh-market-check" } });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; } finally { clearTimeout(t); }
}
async function fetchText(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { "user-agent": "dsh-market-check" } });
    if (!r.ok) return null;
    return await r.text();
  } catch { return null; } finally { clearTimeout(t); }
}

const seen = new Set();
async function scanDeps(name, depth) {
  if (depth > MAX_DEPTH || seen.has(name)) return [];
  seen.add(name);
  const hits = [];
  const base = name.split("/").slice(-1)[0];
  if (BLACKLIST.has(base)) hits.push(base);
  if (base.includes(".node")) hits.push(base + " (.node)");
  const enc = name.replace("/", "%2f");
  const man = await fetchJson("https://registry.npmjs.org/" + enc);
  if (!man) return hits;
  const latest = man["dist-tags"] && man["dist-tags"].latest;
  const v = latest ? man.versions[latest] : null;
  if (!v) return hits;
  for (const dep of Object.keys(v.dependencies || {})) {
    hits.push(...(await scanDeps(dep, depth + 1)));
  }
  return hits;
}

async function checkEntry(file) {
  const text = readFileSync(join(DATA, file), "utf8");
  const e = parseEntry(text);
  const missing = ["name", "owner", "url", "category", "install", "added"].filter((k) => !e[k]);
  const level = e.harmonyos && e.harmonyos.level;
  if (!level) missing.push("harmonyos.level");
  if (missing.length) return { file, ok: false, level, errors: ["missing: " + missing.join(",")] };
  const g = /github\.com\/([^/]+)\/([^/]+)/.exec(e.url || "");
  let hits = [];
  let scanned = false;
  if (g) {
    const pkg = await fetchText("https://raw.githubusercontent.com/" + g[1] + "/" + g[2] + "/HEAD/package.json");
    if (pkg) {
      try {
        const p = JSON.parse(pkg);
        for (const dep of Object.keys(p.dependencies || {})) {
          hits.push(...(await scanDeps(dep, 1)));
        }
      } catch {}
    }
    scanned = true;
  }
  const unique = [...new Set(hits)];
  const errors = [];
  if (!scanned) errors.push("could not fetch package.json, preflight skipped");
  if (unique.length) {
    if (level === "native-free") errors.push("declared native-free but found native deps: " + unique.join(", "));
    if (level !== "incompatible") errors.push("found native deps: " + unique.join(", "));
  } else if (level === "incompatible") {
    errors.push("declared incompatible but no native deps detected");
  }
  return { file, ok: errors.length === 0, level, nativeHits: unique, errors };
}

const files = process.argv.includes("--entry")
  ? [process.argv[process.argv.indexOf("--entry") + 1]]
  : readdirSync(DATA).filter((f) => f.endsWith(".yml")).sort();

let bad = 0;
for (const f of files) {
  const r = await checkEntry(f);
  if (!r.ok) bad++;
  console.log(
    "[" + (r.ok ? "PASS" : "FAIL") + "] " + f +
    "  level=" + (r.level || "?") +
    (r.nativeHits && r.nativeHits.length ? "  native=" + r.nativeHits.join(",") : "") +
    (r.errors.length ? "  " + r.errors.join("; ") : "")
  );
}
if (bad) die("\n" + bad + " entry/entries failed");
console.log("\nall " + files.length + " entries passed");

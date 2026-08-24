// dsh-harmonyos-market catalog generator.
// Zero-dependency: reads data/plugins/*.yml entries and writes plugins.json
// in the dsh-market registry format consumed by the dshmarket UI
// ({ updated, count, categories, plugins }). Run by CI on every push.
// Usage: node scripts/build-plugins-json.mjs
import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const ROOT = new URL("..", import.meta.url).pathname
const DATA = join(ROOT, "data", "plugins")
const OUT = join(ROOT, "plugins.json")

const CATEGORIES = {
  notification: { en: "Notification", zh: "通知" },
  market: { en: "Market", zh: "市场" },
  tool: { en: "Tool", zh: "工具" },
  ui: { en: "UI", zh: "界面" },
  theme: { en: "Theme", zh: "皮肤" },
  model: { en: "Model", zh: "模型" },
  memory: { en: "Memory", zh: "记忆" },
  session: { en: "Session", zh: "会话" },
  usage: { en: "Usage", zh: "用量" },
  misc: { en: "Misc", zh: "其他" },
}

// Minimal YAML-subset parser matching the entry schema (kept in sync with
// scripts/check-compat.mjs).
function parseEntry(text) {
  const lines = text.split("\n")
  const out = {}
  let cur = null
  for (const raw of lines) {
    const line = raw.replace(/\r$/, "")
    if (!line.trim() || line.trim().startsWith("#")) continue
    const m = /^([a-zA-Z_-]+):\s*(.*)$/.exec(line.trim())
    if (!m) continue
    const key = m[1]
    const val = m[2]
    if (val !== "") {
      if (cur === "harmonyos") {
        out[cur] = out[cur] || {}
        out[cur][key] = val
      } else if (cur === "description" && (key === "en" || key === "zh")) {
        out[cur] = out[cur] || {}
        out[cur][key] = val
      } else {
        out[key] = val.replace(/^["\x27]|["\x27]$/g, "")
        cur = null
      }
    } else {
      if (key === "harmonyos" || key === "description") {
        cur = key
        out[key] = {}
      } else {
        cur = null
      }
    }
  }
  return out
}

const files = readdirSync(DATA).filter((f) => f.endsWith(".yml")).sort()
const plugins = []
const usedCategories = new Set()

for (const file of files) {
  const text = readFileSync(join(DATA, file), "utf8")
  const e = parseEntry(text)
  if (!e.name || !e.owner || !e.url) {
    console.error("skip invalid entry: " + file)
    continue
  }
  const category = e.category && e.category in CATEGORIES ? e.category : "misc"
  usedCategories.add(category)
  plugins.push({
    name: e.name,
    owner: e.owner,
    url: e.url,
    category,
    description: {
      en: e.description && e.description.en ? e.description.en : "",
      zh: e.description && e.description.zh ? e.description.zh : "",
    },
    install: e.install || ("dsh plugin --profile web add " + e.url),
    added: e.added || "",
    harmonyos: e.harmonyos && e.harmonyos.level ? {
      level: e.harmonyos.level,
      notes: e.harmonyos.notes || "",
    } : undefined,
  })
  if (plugins[plugins.length - 1].harmonyos === undefined) delete plugins[plugins.length - 1].harmonyos
}

plugins.sort((a, b) => a.name.localeCompare(b.name))

const categories = {}
for (const key of [...usedCategories].sort()) categories[key] = CATEGORIES[key]

const registry = {
  name: "dsh-harmonyos-market",
  url: "https://github.com/Entity-Him/dsh-harmonyos-market",
  source: "https://raw.githubusercontent.com/Entity-Him/dsh-harmonyos-market/main/plugins.json",
  updated: new Date().toISOString().slice(0, 10),
  count: plugins.length,
  categories,
  plugins,
}

writeFileSync(OUT, JSON.stringify(registry, null, 2) + "\n", "utf8")
console.log("plugins.json written: " + plugins.length + " plugins")

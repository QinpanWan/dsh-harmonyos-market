// dsh-harmonyos-market host half.
// Serves the HarmonyOS plugin catalog to the browser settings panel and runs
// one-click install/uninstall. Installs prefer the official `dsh plugin add`
// path (same CLI re-invocation strategy as the dsh-market plugin); when the
// host git is the HarmonyOS isogit shim (no ls-remote, so pnpm cannot resolve
// `github:` specs), it falls back to downloading the repo tarball and mounting
// the plugin into the profile directly (plugins-src + node_modules link +
// bundles entry — the same layout dsh plugin add produces for link deps).
import { spawn, spawnSync } from "node:child_process"
import {
  cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync,
  rmSync, statSync, symlinkSync, writeFileSync,
} from "node:fs"
import { homedir, tmpdir } from "node:os"
import { dirname, isAbsolute, join, resolve } from "node:path"
import { installSettingsSection, settingsNamespace } from "@deepseek-ai/dsh-settings"
import z from "@deepseek-ai/schemastery"

export const name = "harmonyos-market"

export const MARKET_NS = settingsNamespace("dsh-harmonyos-market")
export const DEFAULT_REGISTRY_URL = "https://raw.githubusercontent.com/Entity-Him/dsh-harmonyos-market/main/plugins.json"
const CACHE_TTL_MS = 60_000
const COMMAND_TIMEOUT_MS = 10 * 60_000
const OUTPUT_LIMIT = 4000
const GIT_SHIM_MARKERS = ["ls-remote", "垫片", "isogit", "不支持的命令"]

export const MarketConfigSchema = z.object({
  allowRestart: z.boolean().default(true),
  registryUrl: z.string().default(DEFAULT_REGISTRY_URL),
  profile: z.string().default("web"),
})

function argvProfile() {
  const argv = process.argv
  const flag = argv.indexOf("--profile")
  if (flag !== -1 && flag + 1 < argv.length && !argv[flag + 1].startsWith("-")) return argv[flag + 1]
  return undefined
}

function nodeExecutable() {
  if (process.argv0 !== undefined && process.argv0 !== "" && isAbsolute(process.argv0) && existsSync(process.argv0)) {
    return process.argv0
  }
  return process.execPath
}

function dshArgv() {
  const entry = process.argv[1]
  if (entry !== undefined && /[\\/](?:bin\.(?:js|ts)|dsh)$/.test(entry)) {
    const abs = resolve(entry)
    return { file: nodeExecutable(), args: [...process.execArgv, abs], cwd: dirname(abs) }
  }
  return { file: "dsh", args: [], cwd: undefined }
}

function spawnEnv() {
  const separator = process.platform === "win32" ? ";" : ":"
  const parts = (process.env.PATH ?? "").split(separator).filter((part) => part !== "")
  const nodeDir = dirname(nodeExecutable())
  for (const bin of [nodeDir, join(homedir(), ".local", "bin")]) {
    if (!parts.includes(bin)) parts.push(bin)
  }
  return { ...process.env, CI: "true", PATH: parts.join(separator) }
}

function tail(text, max) {
  return text.length > max ? "…" + text.slice(-max) : text
}

function profileDir(profile) {
  const home = process.env.DSH_HOME ?? join(homedir(), ".dsh")
  return join(home, "profiles", profile)
}

function readProfileBundles(profile) {
  try {
    const manifest = JSON.parse(readFileSync(join(profileDir(profile), "package.json"), "utf8"))
    const bundles = manifest?.dsh?.profile?.bundles
    return Array.isArray(bundles) ? bundles.filter((item) => typeof item === "string") : []
  } catch {
    return []
  }
}

let registryCache = { at: 0, value: null }

async function loadRegistry(url) {
  const now = Date.now()
  if (registryCache.value !== null && now - registryCache.at < CACHE_TTL_MS) return registryCache.value
  const response = await fetch(url, { headers: { "user-agent": "dsh-harmonyos-market" } })
  if (!response.ok) throw new Error(`catalog fetch failed: HTTP ${response.status}`)
  const value = await response.json()
  registryCache = { at: now, value }
  return value
}

function specOf(entry) {
  const m = /(?:^|\s)add\s+(\S+)/.exec(entry.install ?? "")
  if (m !== null) return m[1]
  const repo = /github\.com\/([^/]+\/[^/]+?)(?:\/|$)/.exec(entry.url ?? "")
  return repo === null ? null : `github:${repo[1]}`
}

function allowedSpecs(registry) {
  const specs = new Set()
  for (const entry of registry?.plugins ?? []) {
    const spec = specOf(entry)
    if (spec !== null) specs.add(spec)
  }
  return specs
}

function runPluginCommand(profile, pluginArgs) {
  const { file, args, cwd } = dshArgv()
  return new Promise((resolvePromise) => {
    let child
    try {
      child = spawn(file, [...args, "plugin", "--profile", profile, ...pluginArgs], {
        cwd,
        env: spawnEnv(),
        stdio: ["ignore", "pipe", "pipe"],
      })
    } catch (error) {
      resolvePromise({ ok: false, code: -1, stdout: "", stderr: String(error?.message ?? error) })
      return
    }
    let stdout = ""
    let stderr = ""
    child.stdout?.on("data", (chunk) => { stdout += chunk })
    child.stderr?.on("data", (chunk) => { stderr += chunk })
    const timer = setTimeout(() => { child.kill("SIGKILL") }, COMMAND_TIMEOUT_MS)
    child.on("close", (code) => {
      clearTimeout(timer)
      resolvePromise({
        ok: code === 0,
        code: code ?? -1,
        stdout: stdout,
        stderr: stderr,
      })
    })
    child.on("error", (error) => {
      clearTimeout(timer)
      resolvePromise({ ok: false, code: -1, stdout: "", stderr: String(error?.message ?? error) })
    })
  })
}

function isGitShimFailure(result) {
  const text = (result.stderr ?? "") + "\n" + (result.stdout ?? "")
  return GIT_SHIM_MARKERS.some((marker) => text.includes(marker))
}

function gitIsShim() {
  try {
    const probe = spawnSync("git", ["--version"], { stdio: ["ignore", "pipe", "pipe"], timeout: 5000 })
    const text = (probe.stdout ? probe.stdout.toString() : "") + (probe.stderr ? probe.stderr.toString() : "")
    return /isogit|垫片/i.test(text)
  } catch {
    return false
  }
}

function repoPartsOf(url) {
  const m = /github\.com\/([^/]+)\/([^/]+?)(?:[/#?]|$)/.exec(url ?? "")
  return m === null ? null : { owner: m[1], repo: m[2].replace(/\.git$/, "") }
}

function subpathOf(url) {
  const m = /#path:\/([^#]+)/.exec(url ?? "")
  return m === null ? "" : m[1].replace(/^\/+|\/+$/g, "")
}

async function downloadTarball(owner, repo) {
  const url = `https://codeload.github.com/${owner}/${repo}/tar.gz/refs/heads/main`
  const response = await fetch(url, { headers: { "user-agent": "dsh-harmonyos-market" } })
  if (!response.ok) throw new Error(`repo download failed: HTTP ${response.status}`)
  return Buffer.from(await response.arrayBuffer())
}

function extractTarball(buffer, targetDir) {
  mkdirSync(targetDir, { recursive: true })
  const archive = join(targetDir, "repo.tar.gz")
  writeFileSync(archive, buffer)
  const result = spawnSync("tar", ["-xzf", archive, "-C", targetDir], { stdio: ["ignore", "pipe", "pipe"] })
  rmSync(archive)
  if (result.status !== 0) {
    throw new Error("tar extraction failed: " + (result.stderr ? result.stderr.toString() : "unknown"))
  }
  return targetDir
}

function findPackageDir(extracted, sub) {
  const direct = sub ? join(extracted, sub) : extracted
  if (existsSync(join(direct, "package.json"))) return direct
  if (sub) return null
  for (const entry of readdirSync(extracted)) {
    const full = join(extracted, entry)
    try {
      if (statSync(full).isDirectory() && existsSync(join(full, "package.json"))) return full
    } catch { /* keep scanning */ }
  }
  return null
}

function writeManifest(profileRoot, mutate) {
  const manifestPath = join(profileRoot, "package.json")
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
  mutate(manifest)
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + "\n", "utf8")
}

async function manualInstall(profile, entry) {
  const parts = repoPartsOf(entry.url)
  if (parts === null) throw new Error("cannot resolve repository from catalog entry")
  const name = entry.name
  const profileRoot = profileDir(profile)
  const srcRoot = join(profileRoot, "plugins-src", name)
  const tmpBase = mkdtempSync(join(tmpdir(), "hm-market-"))
  try {
    const buffer = await downloadTarball(parts.owner, parts.repo)
    const extracted = extractTarball(buffer, tmpBase)
    const pkgDir = findPackageDir(extracted, subpathOf(entry.url))
    if (pkgDir === null) throw new Error("package.json not found in repository" + (subpathOf(entry.url) ? ` at path ${subpathOf(entry.url)}` : ""))
    rmSync(srcRoot, { recursive: true, force: true })
    mkdirSync(srcRoot, { recursive: true })
    cpSync(pkgDir, srcRoot, { recursive: true })
    rmSync(join(profileRoot, "node_modules", name), { recursive: true, force: true })
    symlinkSync(srcRoot, join(profileRoot, "node_modules", name))
    writeManifest(profileRoot, (manifest) => {
      manifest.dependencies = manifest.dependencies ?? {}
      manifest.dependencies[name] = "link:" + srcRoot
      const bundles = manifest.dsh?.profile?.bundles
      if (Array.isArray(bundles) && !bundles.includes(name)) bundles.push(name)
    })
  } finally {
    rmSync(tmpBase, { recursive: true, force: true })
  }
}

function manualUninstall(profile, name) {
  const profileRoot = profileDir(profile)
  writeManifest(profileRoot, (manifest) => {
    if (manifest.dependencies) delete manifest.dependencies[name]
    const bundles = manifest.dsh?.profile?.bundles
    if (Array.isArray(bundles)) manifest.dsh.profile.bundles = bundles.filter((item) => item !== name)
  })
  rmSync(join(profileRoot, "node_modules", name), { recursive: true, force: true })
  rmSync(join(profileRoot, "plugins-src", name), { recursive: true, force: true })
}

function sendJson(response, status, body) {
  const payload = JSON.stringify(body)
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  })
  response.end(payload)
}

function readJsonBody(request) {
  return new Promise((resolvePromise) => {
    let raw = ""
    request.on("data", (chunk) => { raw += chunk })
    request.on("end", () => {
      try {
        resolvePromise(JSON.parse(raw))
      } catch {
        resolvePromise(null)
      }
    })
    request.on("error", () => resolvePromise(null))
  })
}

function trustedRestartRequest(request) {
  const address = request.socket?.remoteAddress
  if (address !== "127.0.0.1" && address !== "::1" && address !== "::ffff:127.0.0.1") return false
  if (request.headers.forwarded !== undefined
    || request.headers["x-forwarded-for"] !== undefined
    || request.headers["x-real-ip"] !== undefined) return false
  const origin = request.headers.origin
  const host = request.headers.host
  if (origin === undefined || host === undefined) return false
  try {
    const parsed = new URL(origin)
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.host === host
  } catch {
    return false
  }
}

function mountRoutes(host, resolved) {
  const profile = resolved.profile ?? "web"
  const registryUrl = resolved.registryUrl ?? DEFAULT_REGISTRY_URL
  const disposers = []

  disposers.push(host.webServer.register({
    kind: "exact",
    path: "/dsh-harmonyos-market/registry",
    handler: async (_request, response) => {
      try {
        const registry = await loadRegistry(registryUrl)
        sendJson(response, 200, { registry })
      } catch (error) {
        sendJson(response, 502, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  }))

  disposers.push(host.webServer.register({
    kind: "exact",
    path: "/dsh-harmonyos-market/installed",
    handler: (_request, response) => {
      sendJson(response, 200, { installed: readProfileBundles(profile) })
    },
  }))

  disposers.push(host.webServer.register({
    kind: "exact",
    path: "/dsh-harmonyos-market/install",
    handler: async (request, response) => {
      try {
        const body = await readJsonBody(request)
        const name = typeof body?.name === "string" ? body.name : ""
        const registry = await loadRegistry(registryUrl)
        const entry = registry?.plugins?.find((plugin) => plugin.name === name)
        const spec = entry === undefined ? null : specOf(entry)
        if (spec === null || !allowedSpecs(registry).has(spec)) {
          sendJson(response, 400, { ok: false, error: "unknown plugin or unsafe install target" })
          return
        }
        const shimGit = gitIsShim()
        if (shimGit) {
          try {
            await manualInstall(profile, entry)
            sendJson(response, 200, {
              ok: true,
              mode: "manual",
              note: "host git 为 isogit 垫片，已改用仓库 tarball 直装",
              stdout: "",
              stderr: "",
            })
            return
          } catch (manualError) {
            sendJson(response, 200, {
              ok: false,
              mode: "manual-failed",
              error: manualError instanceof Error ? manualError.message : String(manualError),
              stderr: "",
            })
            return
          }
        }
        const result = await runPluginCommand(profile, ["add", spec])
        if (result.ok) {
          sendJson(response, 200, { ok: true, mode: "pnpm", code: result.code, stdout: tail(result.stdout, OUTPUT_LIMIT), stderr: tail(result.stderr, OUTPUT_LIMIT) })
          return
        }
        if (isGitShimFailure(result)) {
          try {
            await manualInstall(profile, entry)
            sendJson(response, 200, {
              ok: true,
              mode: "manual",
              note: "host git 为 isogit 垫片，已改用仓库 tarball 直装",
              stdout: tail(result.stdout, OUTPUT_LIMIT),
              stderr: tail(result.stderr, OUTPUT_LIMIT),
            })
            return
          } catch (manualError) {
            sendJson(response, 200, {
              ok: false,
              mode: "manual-failed",
              error: manualError instanceof Error ? manualError.message : String(manualError),
              stderr: tail(result.stderr, OUTPUT_LIMIT),
            })
            return
          }
        }
        sendJson(response, 200, { ok: false, mode: "pnpm", code: result.code, stdout: tail(result.stdout, OUTPUT_LIMIT), stderr: tail(result.stderr, OUTPUT_LIMIT) })
      } catch (error) {
        sendJson(response, 502, { ok: false, error: error instanceof Error ? error.message : String(error) })
      }
    },
  }))

  disposers.push(host.webServer.register({
    kind: "exact",
    path: "/dsh-harmonyos-market/uninstall",
    handler: async (request, response) => {
      try {
        const body = await readJsonBody(request)
        const name = typeof body?.name === "string" ? body.name : ""
        const registry = await loadRegistry(registryUrl)
        const entry = registry?.plugins?.find((plugin) => plugin.name === name)
        if (entry === undefined) {
          sendJson(response, 400, { ok: false, error: "unknown plugin" })
          return
        }
        manualUninstall(profile, name)
        sendJson(response, 200, { ok: true, mode: "manual", stdout: "", stderr: "" })
      } catch (error) {
        sendJson(response, 502, { ok: false, error: error instanceof Error ? error.message : String(error) })
      }
    },
  }))

  disposers.push(host.webServer.register({
    kind: "exact",
    path: "/dsh-harmonyos-market/restart",
    handler: async (request, response) => {
      if (resolved.allowRestart === false) {
        sendJson(response, 403, { ok: false, error: "restart disabled by allowRestart=false" })
        return
      }
      if (!trustedRestartRequest(request)) {
        sendJson(response, 403, { ok: false, error: "untrusted restart request" })
        return
      }
      sendJson(response, 200, { ok: true, message: "restarting" })
      setTimeout(() => process.kill(process.pid, "SIGTERM"), 500)
    },
  }))

  return () => {
    for (const dispose of disposers) dispose()
  }
}

function installMarketSettings(ctx, resolved) {
  const entry = {
    allowRestart: resolved.allowRestart !== false,
    registryUrl: resolved.registryUrl ?? DEFAULT_REGISTRY_URL,
    profile: resolved.profile ?? "web",
  }
  let source = () => entry
  installSettingsSection(ctx, MARKET_NS, MarketConfigSchema, entry, {
    setSource: (current) => { source = current },
    onChange: () => { Object.assign(resolved, source()) },
  })
}

export function apply(ctx, config) {
  ctx.inject(["webServer", "loader"], (hostCtx) => {
    const host = hostCtx
    const resolved = {
      profile: config?.profile ?? argvProfile() ?? "web",
      allowRestart: config?.allowRestart ?? true,
      registryUrl: config?.registryUrl ?? DEFAULT_REGISTRY_URL,
    }
    installMarketSettings(ctx, resolved)
    host.effect(() => mountRoutes(host, resolved), "dsh-harmonyos-market: http routes")
  })
}

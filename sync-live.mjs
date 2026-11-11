// ============================================================
//  sync-live.mjs: pulls the project repos from GitHub into live/<id>.json
//  ----------------------------------------------------------
//  Run by .github/workflows/live-sync.yml every 15 minutes (and on demand),
//  then build.mjs turns the JSON into the living project pages.
//  Locally:  node sync-live.mjs   (GITHUB_TOKEN optional: 60 req/h without it)
//  A file is rewritten only when the repo data really changed, so the
//  workflow commits nothing when nothing moved.
// ============================================================
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";

const projects = JSON.parse(readFileSync("projects.json", "utf8"));
const H = {
  "User-Agent": "aymaneelouafi-me-live-sync",
  Accept: "application/vnd.github+json",
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
};

async function api(path) {
  const r = await fetch("https://api.github.com" + path, { headers: H });
  if (!r.ok) throw new Error(`GitHub API ${r.status} on ${path}`);
  return r;
}
const getJson = async path => (await api(path)).json();

async function raw(repo, branch, path) {
  const url = `https://raw.githubusercontent.com/${repo}/${branch}/${path.split("/").map(encodeURIComponent).join("/")}`;
  const r = await fetch(url);
  return r.ok ? r.text() : null;
}

// ---------- status words -> done / wip / todo ----------
export function classify(text, fallback) {
  const t = text.toLowerCase();
  if (/in progress|ongoing|first version|partly|wip/.test(t)) return "wip";
  if (/\b(done|built|complete|completed|shipped|finished)\b/.test(t)) return "done";
  if (/\b(planned|todo|next|later)\b/.test(t)) return "todo";
  return fallback;
}

const clean = s => s.replace(/\*\*|__|`/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\s+/g, " ").trim();

// milestones from a markdown table that has a "Status" column
function tableMilestones(md) {
  const lines = md.split("\n").filter(l => l.trim().startsWith("|"));
  if (lines.length < 3) return [];
  const cells = l => l.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
  const head = cells(lines[0]).map(c => c.toLowerCase());
  const si = head.indexOf("status");
  if (si < 0) return [];
  return lines.slice(2).map(cells).map(c => ({
    id: clean(c[0]),
    label: clean(c[1] || ""),
    detail: clean(c[2] || ""),
    statusText: clean(c[si] || ""),
    status: classify(c[si] || "", "todo"),
  }));
}

// milestones from the list items under one "## Section" (+ a "Planned: a, b" line)
function listMilestones(md, section, fallback) {
  const out = [];
  let inside = false;
  for (const line of md.split("\n")) {
    const h = line.match(/^#{1,6}\s+(.*)/);
    if (h) { inside = h[1].trim().toLowerCase() === section.toLowerCase(); continue; }
    if (!inside) continue;
    const item = line.match(/^\s*(?:[-*]|\d+\.)\s+(.*)/);
    const planned = line.match(/^\s*planned:\s*(.*)/i);
    if (item) out.push(clean(item[1]));
    else if (planned) clean(planned[1]).replace(/\.$/, "").split(/,\s*/).forEach(p => out.push("planned: " + p));
    else if (line.trim() && out.length && /^\s{2,}/.test(line)) out[out.length - 1] += " " + clean(line);
  }
  return out.map(text => {
    if (/^planned:/i.test(text)) return { label: clean(text.slice(8)), detail: "", statusText: "planned", status: "todo" };
    const m = text.match(/^(.+?)(?:\s+(?:—|--|-)\s+|:\s+)(.*)$/);   // "v1 — rule-based flow" / "Foundation (done): ..."
    const label = (m ? m[1] : text).replace(/^planned:\s*/i, "");
    return {
      label: clean(label.replace(/\((done|in progress)[^)]*\)/gi, "")),
      detail: m ? m[2] : "",
      statusText: (text.match(/\(([^)]*(?:done|progress)[^)]*)\)/i) || [, ""])[1],
      status: /^planned:/i.test(text) ? "todo" : classify(text, fallback),
    };
  });
}

// a tiny CSV parser (quoted fields, "" escapes, commas/newlines inside quotes)
export function parseCsv(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (ch !== "\r") cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter(r => r.length === head.length).map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

// nmap -oX output -> the familiar text table (the agent stores XML in its fixtures)
export function nmapXmlToText(xml) {
  const ent = s => s.replace(/&#xa;/g, "\n").replace(/&#45;/g, "-").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  const at = (tag, name) => ((tag.match(new RegExp(`\\b${name}="([^"]*)"`)) || [])[1] || "");
  const out = [`Nmap scan report for ${at(xml.match(/<address [^>]*ipv4[^>]*>/)?.[0] || "", "addr")}`, "PORT      STATE  SERVICE      VERSION"];
  for (const port of xml.match(/<port [\s\S]*?<\/port>/g) || []) {
    const svc = port.match(/<service [^>]*>/)?.[0] || "";
    const ver = ent([at(svc, "product"), at(svc, "version"), at(svc, "extrainfo") && `(${at(svc, "extrainfo")})`].filter(Boolean).join(" "));
    out.push(`${(at(port, "portid") + "/" + at(port, "protocol")).padEnd(10)}${at(port.match(/<state [^>]*>/)?.[0] || "", "state").padEnd(7)}${at(svc, "name").padEnd(13)}${ver}`);
    for (const sc of port.match(/<script [^>]*>/g) || []) {
      const lines = ent(at(sc, "output")).split("\n").map(l => l.trimEnd()).filter(Boolean).slice(0, 3);
      lines.forEach((l, i) => out.push(`${i ? "|  " : "| " + at(sc, "id") + ": "}${l.trim()}`));
    }
  }
  return out.join("\n");
}

// self-checks (cheap, run every time so a broken parser never ships bad data)
{
  const t = parseCsv('a,b\n1,"x, ""y"""\n2,z\n');
  if (!nmapXmlToText('<address addr="1.2.3.4" addrtype="ipv4"/><port protocol="tcp" portid="22"><state state="open"/><service name="ssh" product="OpenSSH"/></port>').includes("22/tcp    open   ssh          OpenSSH")) throw new Error("nmapXmlToText self-check failed");
  if (t.length !== 2 || t[0].b !== 'x, "y"' || t[1].a !== "2") throw new Error("parseCsv self-check failed");
  if (classify("in progress (2.1-2.3 done)", "todo") !== "wip" || classify("built", "todo") !== "done") throw new Error("classify self-check failed");
}

// deterministic pseudo-random (same sample every sync -> no fake "changes")
function rng(seed) { return () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648); }

// real requests from the detection project's dataset, scored like detection/fusion.py
async function detectionSample(repo, branch) {
  const load = async f => parseCsv(await raw(repo, branch, `data/${f}.csv`) || "");
  const [ds, ru, wa, ml, be] = await Promise.all(["dataset", "predictions_rules", "predictions_waf", "predictions_ml", "predictions_behavior"].map(load));
  if (!ds.length) return null;
  const byId = list => Object.fromEntries(list.map(r => [r.id, r]));
  const R = byId(ru), W = byId(wa), M = byId(ml), B = byId(be);
  // behavior strength: percentile rank, scaled so the model's own alert cutoff = 0.5
  const probs = be.map(r => +r.beh_prob).sort((a, b) => a - b);
  const pct = v => { let lo = 0, hi = probs.length; while (lo < hi) { const m = (lo + hi) >> 1; probs[m] <= v ? lo = m + 1 : hi = m; } return lo / probs.length; };
  const cutoff = Math.min(...be.filter(r => r.beh_flag === "True").map(r => pct(+r.beh_prob)));
  const rows = ds.map(r => {
    const s = [
      Math.min(1, (+(R[r.id] || {}).rule_score || 0) / 10),
      Math.min(1, (+(W[r.id] || {}).waf_score || 0) / 10),
      +(M[r.id] || {}).ml_prob || 0,
      B[r.id] ? Math.min(1, 0.5 * Math.pow(pct(+B[r.id].beh_prob) / cutoff, 4)) : 0,
    ];
    const risk = 1 - s.reduce((p, v) => p * (1 - v), 1);
    return {
      t: +r.ts, ip: r.client_ip, m: r.method,
      p: (r.path + (r.query ? "?" + r.query : "")).slice(0, 90),
      b: (r.body || "").slice(0, 70), st: +r.status,
      a: r.label === "1" ? r.attack_type : "", s: s.map(v => Math.round(v * 100) / 100),
      r: Math.round(risk * 100) / 100,
    };
  });
  // 160 normal + up to 18 of each attack type, replayed in time order
  const rand = rng(42);
  const pick = (list, n) => list.map(r => [rand(), r]).sort((a, b) => a[0] - b[0]).slice(0, n).map(x => x[1]);
  const types = [...new Set(rows.filter(r => r.a).map(r => r.a))];
  const sample = [...pick(rows.filter(r => !r.a), 160), ...types.flatMap(t => pick(rows.filter(r => r.a === t), 18))]
    .sort((a, b) => a.t - b.t);
  return { total: rows.length, attacks: rows.filter(r => r.a).length, types, rows: sample };
}

// ---------- one project ----------
async function syncProject(p) {
  const repo = await getJson(`/repos/${p.repo}`);
  const branch = repo.default_branch;
  const [commitsRaw, languages, tree, countRes] = await Promise.all([
    getJson(`/repos/${p.repo}/commits?per_page=100`),
    getJson(`/repos/${p.repo}/languages`),
    getJson(`/repos/${p.repo}/git/trees/${branch}?recursive=1`),
    api(`/repos/${p.repo}/commits?per_page=1`),
  ]);
  const last = (countRes.headers.get("link") || "").match(/page=(\d+)>; rel="last"/);
  const files = tree.tree.filter(t => t.type === "blob");

  const data = {
    id: p.id,
    repo: p.repo,
    url: repo.html_url,
    branch,
    created_at: repo.created_at,
    pushed_at: repo.pushed_at,
    stars: repo.stargazers_count,
    languages,
    commit_count: last ? +last[1] : commitsRaw.length,
    files: files.length,
    bytes: files.reduce((s, f) => s + (f.size || 0), 0),
    top: tree.tree.filter(t => !t.path.includes("/")).map(t => ({ path: t.path, dir: t.type === "tree" })),
    commits: commitsRaw.map(c => ({
      sha: c.sha.slice(0, 7),
      msg: c.commit.message.split("\n")[0].slice(0, 120),
      date: c.commit.author.date,
      url: c.html_url,
    })),
    readme: await raw(p.repo, branch, "README.md") || "",
  };

  if (p.milestones) {
    const md = await raw(p.repo, branch, p.milestones.file) || "";
    data.milestones = p.milestones.type === "table"
      ? tableMilestones(md)
      : listMilestones(md, p.milestones.section, p.milestones.default || "todo");
  }

  // attack-phase screenshots named like "A2.3-05-suricata-nse-alerts.png" -> steps
  if (p.shots) {
    const steps = {};
    for (const f of files.filter(f => f.path.startsWith(p.shots))) {
      const name = f.path.slice(p.shots.length);
      const m = name.match(/^([A-Z]\d+(?:\.\d+)*)-(\d+)-(.+)\.(png|jpe?g|gif|webp)$/i);
      if (!m) continue;
      (steps[m[1]] ||= []).push({
        n: +m[2],
        caption: m[3].replace(/-/g, " "),
        src: `https://raw.githubusercontent.com/${p.repo}/${branch}/${f.path.split("/").map(encodeURIComponent).join("/")}`,
      });
    }
    data.steps = Object.entries(steps)
      .sort((a, b) => a[0].localeCompare(b[0], "en", { numeric: true }))
      .map(([id, shots]) => ({ id, shots: shots.sort((a, b) => a.n - b.n) }));
  }

  if (p.replay) {
    data.replay = [];
    for (const r of p.replay) {
      let txt = await raw(p.repo, branch, r.path) || "";
      if (txt.includes("<nmaprun")) txt = nmapXmlToText(txt);
      const lines = txt.replace(/\x1b\[[0-9;]*m/g, "").split("\n").filter((l, i, a) => l.trim() || (a[i - 1] || "").trim());
      data.replay.push({ stage: r.stage, cmd: r.cmd, path: r.path, lines: lines.slice(0, r.lines) });
    }
  }
  if (p.sample) data.sample = await detectionSample(p.repo, branch);

  return data;
}

// ---------- main ----------
mkdirSync("live", { recursive: true });
let failed = 0;
for (const p of projects) {
  try {
    const data = await syncProject(p);
    const file = `live/${p.id}.json`;
    const old = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
    const same = old && JSON.stringify({ ...old, synced_at: 0 }) === JSON.stringify({ ...data, synced_at: 0 });
    if (same) { console.log("unchanged", p.id); continue; }
    writeFileSync(file, JSON.stringify({ ...data, synced_at: new Date().toISOString() }, null, 1));
    console.log("updated  ", p.id, `(${data.commit_count} commits, ${data.files} files)`);
  } catch (e) {
    failed++;
    console.error("FAILED   ", p.id, e.message); // keep the last good snapshot
  }
}
if (failed === projects.length) process.exit(1);

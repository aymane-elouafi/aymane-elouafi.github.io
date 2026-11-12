// ============================================================
//  Build script for aymaneelouafi.me
//  ----------------------------------------------------------
//  Turns your Markdown notes into real HTML pages so Google
//  and AI crawlers can read them (good for SEO).
//
//  HOW TO ADD A POST:
//    1. Write your notes in posts/<id>.md
//    2. Add a block at the TOP of posts.json (with a cheatsheet)
//    3. Run:  node build.mjs
//    4. git add -A && git commit && git push
//
//  It generates: index.html, one <id>.html per post,
//  sitemap.xml and robots.txt.
// ============================================================

import { readFileSync, writeFileSync, existsSync } from "fs";
import { createHash } from "crypto";
import { marked } from "marked";
import { parse } from "node-html-parser";

// ---- settings you might change one day ----
const SITE = "https://aymaneelouafi.me";
const AUTHOR = "Aymane Elouafi";
const LINKEDIN = "https://www.linkedin.com/in/aymane-elouafi";
const GITHUB = "https://github.com/aymane-elouafi";
const HTB = "https://profile.hackthebox.com/profile/019fc7ef-cecd-73b9-839f-3b4b881896dc";
// add more profile URLs here (X/Twitter...) to strengthen identity
const SAME_AS = [LINKEDIN, GITHUB, HTB];
const ROLE = "Cybersecurity Engineer";
const GA_ID = "G-V2R1YY0P62"; // Google Analytics measurement ID

const posts = JSON.parse(readFileSync("posts.json", "utf8"));
const methodology = JSON.parse(readFileSync("methodology.json", "utf8"));

// living projects (projects.json) + their GitHub snapshots (live/*.json, written by sync-live.mjs)
const projects = JSON.parse(readFileSync("projects.json", "utf8"));
const live = Object.fromEntries(projects.map(p =>
  [p.id, existsSync(`live/${p.id}.json`) ? JSON.parse(readFileSync(`live/${p.id}.json`, "utf8")) : null]));

// changes whenever a css/js file changes, so browsers load the newest copy.
// A content hash (not the time) keeps builds identical, so the CI bot and a
// local build never conflict over nothing.
const VER = createHash("sha1")
  .update(["style.css", "menu.js", "post.js", "home.js", "live.js"].map(f => existsSync(f) ? readFileSync(f, "utf8") : "").join("|"))
  .digest("hex").slice(0, 10);

// escape text that goes inside an HTML attribute (meta tags, etc.)
function attr(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;")
    .replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
// escape text that goes inside HTML (cheat sheet, etc.)
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// The shared <head>. Every page gets proper SEO + social tags.
function head({ title, description, canonical, ogType, jsonld }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <!-- Google Analytics (gtag.js) - counts your visitors -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${GA_ID}');
  </script>

  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${attr(title)}</title>
  <meta name="description" content="${attr(description)}">
  <meta name="author" content="${attr(AUTHOR)}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta name="google-site-verification" content="P6WC3YGSehH9r2o-Lon_-tKZGpFiOWJjHD41vtJqLsk">
  <link rel="canonical" href="${attr(canonical)}">
  <link rel="icon" href="/favicon.ico" sizes="48x48">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="/favicon-512.png" type="image/png" sizes="512x512">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">

  <!-- Open Graph (Facebook, LinkedIn, Discord...) -->
  <meta property="og:type" content="${ogType}">
  <meta property="og:title" content="${attr(title)}">
  <meta property="og:description" content="${attr(description)}">
  <meta property="og:url" content="${attr(canonical)}">
  <meta property="og:site_name" content="${attr(AUTHOR)}">
  <meta property="og:image" content="${SITE}/images/og.png">

  <!-- Twitter / X -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${attr(title)}">
  <meta name="twitter:description" content="${attr(description)}">
  <meta name="twitter:image" content="${SITE}/images/og.png">

  <script type="application/ld+json">
${JSON.stringify(jsonld, null, 2)}
  </script>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/style.css?v=${VER}">
  <script defer src="/menu.js?v=${VER}"></script>
</head>`;
}

// ---- thin top bar: home link + the button that opens the side menu ----
function topbar() {
  return `  <div class="topbar">
    <button class="menu-toggle" aria-label="Open menu" aria-expanded="false">☰ menu</button>
    <a class="topbar-home" href="/">~/aymane</a>
  </div>`;
}

// ---- the side menu (right sidebar): methodology parts + their posts,
//      plus an HTB Walkthroughs part. `currentId` highlights the open post. ----
function sidebar(currentId) {
  // posts tagged "walkthrough" / "project" get their own parts at the bottom
  const walkthroughs = posts.filter(p => (p.tags || []).includes("walkthrough"));
  const projectList = posts.filter(p => (p.tags || []).includes("project"));

  const postLink = p =>
    `<li><a href="${p.id}.html"${p.id === currentId ? ' class="current"' : ""}>${esc(p.title)}</a></li>`;

  // resolve the posts under a methodology section (series auto + explicit ids)
  const secPosts = sec => {
    const ids = [];
    if (sec.series) posts.filter(p => p.series === sec.series).slice().reverse().forEach(p => ids.push(p.id));
    if (sec.posts) sec.posts.forEach(id => ids.push(id));
    return [...new Set(ids)].map(id => posts.find(p => p.id === id))
      .filter(Boolean)
      .filter(p => !(p.tags || []).includes("walkthrough") && !(p.tags || []).includes("project"));
  };

  const phasesHtml = methodology.map(ph => {
    // a phase opens by default if it (or the current post) has something in it
    const phasePosts = ph.sections.flatMap(secPosts);
    const open = phasePosts.length > 0 || phasePosts.some(p => p.id === currentId);

    const sections = ph.sections.map(sec => {
      const list = secPosts(sec);
      if (!list.length) {
        return `        <div class="nav-section empty"><span class="nav-sec-title">${esc(sec.title)}<em>soon</em></span></div>`;
      }
      return `        <div class="nav-section">
          <span class="nav-sec-title">${esc(sec.title)}</span>
          <ul>
${list.map(postLink).map(s => "            " + s).join("\n")}
          </ul>
        </div>`;
    }).join("\n");

    return `    <details class="nav-phase"${open ? " open" : ""}>
      <summary><span class="nav-num">${ph.num}</span><span class="nav-label">${esc(ph.title)}</span>${phasePosts.length ? `<span class="nav-count">${phasePosts.length}</span>` : ""}</summary>
${sections}
    </details>`;
  }).join("\n");

  const projectsHtml = `    <details class="nav-phase nav-projects"${projectList.some(p => p.id === currentId) ? " open" : ""}>
      <summary><span class="nav-num">▣</span><span class="nav-label">Projects</span><span class="nav-count">${projectList.length}</span></summary>
      <div class="nav-section">
        <ul>
${(projectList.length ? projectList.map(postLink) : ["<li class=\"empty\">(soon)</li>"]).map(s => "          " + s).join("\n")}
        </ul>
      </div>
    </details>`;

  const walkHtml = `    <details class="nav-phase nav-walk"${walkthroughs.some(p => p.id === currentId) ? " open" : ""}>
      <summary><span class="nav-num">★</span><span class="nav-label">HTB Walkthroughs</span><span class="nav-count">${walkthroughs.length}</span></summary>
      <div class="nav-section">
        <ul>
${(walkthroughs.length ? walkthroughs.map(postLink) : ["<li class=\"empty\">(soon)</li>"]).map(s => "          " + s).join("\n")}
        </ul>
      </div>
    </details>`;

  const liveHtml = `    <details class="nav-phase nav-live" open>
      <summary><span class="nav-num"><i class="live-dot" aria-hidden="true"></i></span><span class="nav-label">Live projects</span><span class="nav-count">${projects.length}</span></summary>
      <div class="nav-section">
        <ul>
${projects.map(p => `          <li><a href="${p.id}.html"${p.id === currentId ? ' class="current"' : ""}>${esc(p.title)}</a></li>`).join("\n")}
        </ul>
      </div>
    </details>`;

  return `  <div class="backdrop" id="backdrop"></div>
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-inner">
      <p class="sidebar-title">// methodology &amp; notes</p>
${liveHtml}
${phasesHtml}
${projectsHtml}
${walkHtml}
    </div>
  </aside>`;
}

// ---- render one Markdown post into content HTML + extras ----
marked.setOptions({ breaks: true, gfm: true });

function renderPost(post) {
  const md = readFileSync(`posts/${post.id}.md`, "utf8");
  const root = parse(marked.parse(md));

  // give each big "# " heading an id and collect the table of contents
  const toc = [];
  root.querySelectorAll("h1").forEach((h, i) => {
    h.setAttribute("id", "section-" + i);
    toc.push({ id: "section-" + i, text: h.text });
  });

  let html = root.toString();

  // The only <h1> on the page should be the post title (better for SEO).
  // Notes use different top levels ("# " in some, "## " in others), so we
  // shift every heading so that each post's TOP section becomes <h2>, and
  // the levels under it follow (<h3>, <h4>...). One pass, no cascade.
  let minLevel = 6;
  html.replace(/<h([1-6])[ >]/g, (m, d) => { minLevel = Math.min(minLevel, +d); return m; });
  const shift = 2 - minLevel; // make the shallowest heading an <h2>
  if (shift !== 0) {
    html = html.replace(/<(\/?)h([1-6])([ >])/g, (m, slash, d, tail) => {
      const level = Math.min(6, Math.max(2, Number(d) + shift));
      return `<${slash}h${level}${tail}`;
    });
  }

  // make screenshots clickable (open full size in a new tab)
  html = html.replace(/<img ([^>]*?)src="([^"]+)"([^>]*)>/g,
    (m, a, src, b) => `<a href="${src}" target="_blank" rel="noopener"><img ${a}src="${src}"${b}></a>`);

  // rewrite old-style links between posts: post.html?id=ftp -> ftp.html
  html = html.replace(/href="post\.html\?id=([a-z0-9_-]+)"/g, 'href="$1.html"');

  // plain text of the post, used by the search engine on the home page
  const searchText = root.text.replace(/\s+/g, " ").trim();

  return { html, toc, searchText };
}

// ---- cheat sheet dropdown (uses native <details>, no JS needed) ----
function cheatSheet(post) {
  if (!post.cheatsheet || !post.cheatsheet.length) return "";
  const rows = post.cheatsheet.map(c =>
    `      <div class="cheat-row">
        <code>${esc(c.cmd)}</code>
        <span>${esc(c.desc)}</span>
      </div>`).join("\n");
  return `  <details class="cheatsheet">
    <summary><span class="arrow">&#9656;</span> Cheat sheet &mdash; useful commands</summary>
    <div class="cheat-body">
${rows}
    </div>
  </details>`;
}

// ---- table of contents box ----
function tocBox(toc) {
  if (toc.length < 2) return "";
  const items = toc.map(t => `      <li><a href="#${t.id}">${esc(t.text)}</a></li>`).join("\n");
  return `  <nav class="toc">
    <p class="prompt">$ cat contents.txt</p>
    <ul>
${items}
    </ul>
  </nav>`;
}

// ---- "posts in this series" box at the bottom ----
function seriesBox(post) {
  if (!post.series) return "";
  const inSeries = posts.filter(p => p.series === post.series).slice().reverse();
  const slug = post.series.toLowerCase().replace(/ /g, "-");
  const items = inSeries.map(p =>
    p.id === post.id
      ? `      <li class="current">${esc(p.title)} &lt;- you are here</li>`
      : `      <li><a href="${p.id}.html">${esc(p.title)}</a></li>`).join("\n");
  return `  <nav class="series">
    <p class="prompt">$ ls ~/series/${slug}</p>
    <ul>
${items}
    </ul>
  </nav>`;
}

// ============================================================
//  Build each post page
// ============================================================
const searchIndex = [];

for (const post of posts) {
  const { html, toc, searchText } = renderPost(post);
  const canonical = `${SITE}/${post.id}.html`;
  const metaLine = post.date + " · " + post.tags.map(t => "#" + t).join(" ");

  searchIndex.push({
    id: post.id, title: post.title, description: post.description,
    series: post.series || "", tags: post.tags, date: post.date, text: searchText,
  });

  // Breadcrumb: Home > [Series] > Title  — helps Google show structured
  // breadcrumbs under the result and understand the site hierarchy.
  const crumbs = [{ "@type": "ListItem", "position": 1, "name": AUTHOR, "item": SITE + "/" }];
  if (post.series) crumbs.push({ "@type": "ListItem", "position": 2, "name": post.series });
  crumbs.push({ "@type": "ListItem", "position": crumbs.length + 1, "name": post.title, "item": canonical });

  const jsonld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        "headline": post.title,
        "description": post.description,
        "datePublished": post.date,
        "dateModified": post.date,
        "author": { "@type": "Person", "name": AUTHOR, "@id": SITE + "/#person", "url": SITE },
        "publisher": { "@type": "Person", "name": AUTHOR, "url": SITE },
        "mainEntityOfPage": { "@type": "WebPage", "@id": canonical },
        "url": canonical,
        "image": `${SITE}/images/og.png`,
        "keywords": post.tags.join(", "),
        "articleSection": post.series || "Notes",
        "inLanguage": "en",
      },
      { "@type": "BreadcrumbList", "itemListElement": crumbs },
    ],
  };

  const page = `${head({
    title: `${post.title} · ${AUTHOR}`,
    description: post.description,
    canonical,
    ogType: "article",
    jsonld,
  })}
<body>
${aurora()}
${topbar()}
${sidebar(post.id)}
  <main class="container post">

    <a class="back" href="/">← cd ..</a>

    ${post.series ? `<span class="series-label">${esc(post.series)}</span>` : ""}
    <h1>${esc(post.title)}</h1>
    <p class="post-meta">${esc(metaLine)}</p>

    <input id="post-search" class="search post-search" type="text"
           placeholder="search in this post...  (Enter = next, Shift+Enter = previous, Esc = clear)"
           autocomplete="off">
    <p id="post-search-count" class="search-count" hidden></p>

${cheatSheet(post)}

${tocBox(toc)}

    <article id="content">
${html}
    </article>

${seriesBox(post)}

  </main>

  <script src="/post.js?v=${VER}"></script>
</body>
</html>
`;
  writeFileSync(`${post.id}.html`, page);
  console.log("built", post.id + ".html");
}

// ============================================================
//  Build the home page (post cards baked in, for SEO)
// ============================================================
function card(post) {
  const tags = post.tags.map(t => "#" + t).join(" ");
  const series = post.series ? `<span class="series-label">${esc(post.series)}</span>` : "";
  return `        <li>
          <a href="${post.id}.html">
            ${series}
            <div class="post-title">${esc(post.title)}</div>
            <div class="post-desc">${esc(post.description)}</div>
            <div class="post-meta">${esc(post.date)} · ${esc(tags)}</div>
          </a>
        </li>`;
}

// featured card for the Projects block on the home page
function projectCard(post) {
  const chips = post.tags
    .filter(t => t !== "project")
    .slice(0, 4)
    .map(t => `<span>${esc(t)}</span>`).join("");
  return `        <a class="project-card" href="${post.id}.html">
          <h3>${esc(post.title)}</h3>
          <p>${esc(post.description)}</p>
          <div class="project-chips">${chips}</div>
          <span class="project-go">Read the write-up →</span>
        </a>`;
}

// soft, slowly-drifting ambient background ("breathing")
function aurora() {
  return `  <div class="aurora" aria-hidden="true"><span class="b1"></span><span class="b2"></span><span class="b3"></span></div>`;
}

// ============================================================
//  LIVING PROJECT PAGES (projects.json + live/<id>.json)
//  Rebuilt by the CI pipeline whenever a project repo changes;
//  live.js then keeps them moving in the browser.
// ============================================================
const LANG_COLORS = { Python: "#3572A5", Shell: "#89e051", JavaScript: "#f1e05a", CSS: "#663399", HTML: "#e34c26", Go: "#00ADD8", Dockerfile: "#384d54" };

function progressOf(d) {
  const ms = (d && d.milestones) || [];
  if (!ms.length) return { pct: 0, done: 0, wip: 0, total: 0 };
  const done = ms.filter(m => m.status === "done").length;
  const wip = ms.filter(m => m.status === "wip").length;
  return { pct: Math.round(((done + wip * 0.5) / ms.length) * 100), done, wip, total: ms.length };
}

// commits per day over the 21 days that end with the last push (deterministic)
function sparkline(d, w = 160, h = 34) {
  if (!d || !d.commits.length) return "";
  const end = new Date(d.pushed_at); end.setUTCHours(23, 59, 59, 999);
  const bins = Array(21).fill(0);
  d.commits.forEach(c => { const i = 20 - Math.floor((end - new Date(c.date)) / 864e5); if (i >= 0 && i < 21) bins[i]++; });
  const max = Math.max(1, ...bins);
  const pts = bins.map((v, i) => `${(i / 20 * w).toFixed(1)},${(h - 3 - v / max * (h - 8)).toFixed(1)}`).join(" ");
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-label="commits per day, last 21 days" role="img">
  <polyline points="0,${h} ${pts} ${w},${h}" class="spark-fill"/><polyline points="${pts}" class="spark-line"/></svg>`;
}

function langBar(d) {
  if (!d) return "";
  const entries = Object.entries(d.languages);
  const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
  const parts = entries.map(([k, v]) => ({ k, p: (v / total) * 100 })).filter(x => x.p >= 0.5);
  return `<div class="langbar" role="img" aria-label="languages">${parts.map(x => `<i style="width:${x.p.toFixed(1)}%;background:${LANG_COLORS[x.k] || "#8b929b"}"></i>`).join("")}</div>
      <div class="langs">${parts.map(x => `<span><b style="background:${LANG_COLORS[x.k] || "#8b929b"}"></b>${esc(x.k)} ${x.p.toFixed(0)}%</span>`).join("")}</div>`;
}

const STATUS_LABEL = { done: "done", wip: "in progress", todo: "planned" };
function milestonesHtml(d) {
  if (!d || !d.milestones || !d.milestones.length) return "";
  return `    <section class="milestones wide reveal">
      <h2 class="section-title">Roadmap <span class="muted">· parsed live from the repo</span></h2>
      <ol class="ms-track">
${d.milestones.map((m, i) => `        <li class="ms ms-${m.status}" style="--i:${i}">
          <span class="ms-dot" aria-hidden="true"></span>
          <span class="ms-id">${esc(m.id || String(i + 1))}</span>
          <span class="ms-label">${esc(m.label)}</span>
          ${m.detail ? `<span class="ms-detail">${esc(m.detail)}</span>` : ""}
          <span class="ms-status">${esc(m.statusText && m.status === "wip" ? m.statusText : STATUS_LABEL[m.status])}</span>
        </li>`).join("\n")}
      </ol>
    </section>`;
}

function feedHtml(d) {
  if (!d) return "";
  return `    <section class="feed wide reveal">
      <div class="term">
        <div class="term-bar"><i></i><i></i><i></i><span>git log --live ${esc(d.repo)}</span><span class="feed-state" id="feed-state">snapshot</span></div>
        <ol class="commits" id="commits">
${d.commits.slice(0, 12).map(c => `          <li><a href="${attr(c.url)}" target="_blank" rel="noopener"><span class="sha">${esc(c.sha)}</span><span class="msg">${esc(c.msg)}</span><time datetime="${attr(c.date)}" data-ago="${attr(c.date)}">${esc(c.date.slice(0, 10))}</time></a></li>`).join("\n")}
        </ol>
      </div>
    </section>`;
}

function stepsHtml(d) {
  if (!d || !d.steps || !d.steps.length) return "";
  return `    <section class="steps wide reveal">
      <h2 class="section-title">Attack log <span class="muted">· every screenshot pushed to the repo shows up here</span></h2>
      <div class="step-grid shots">
${d.steps.map(s => `        <article class="step">
          <header><span class="step-id">${esc(s.id)}</span><span class="step-title">${esc(s.shots[0].caption)}</span><span class="step-n">${s.shots.length} shot${s.shots.length > 1 ? "s" : ""}</span></header>
          <div class="step-shots">${s.shots.map(sh => `<img src="${attr(sh.src)}" alt="${attr(s.id + ": " + sh.caption)}" loading="lazy" decoding="async">`).join("")}</div>
        </article>`).join("\n")}
      </div>
    </section>`;
}

// the repo README, rendered as the body of the living post
function readmeHtml(p, d) {
  if (!d || !d.readme) return "";
  let html = marked.parse(d.readme.replace(/^#\s+.*\n/, ""));          // the page has its own h1
  html = html.replace(/<script[\s\S]*?<\/script>|<iframe[\s\S]*?<\/iframe>/gi, "")   // repo content is data, not code
    .replace(/\son\w+="[^"]*"/gi, "").replace(/href="javascript:[^"]*"/gi, 'href="#"');
  html = html.replace(/<(\/?)h1([ >])/g, "<$1h2$2");                    // the only h1 is the page title
  const abs = (u, kind) => {
    if (/^(https?:|mailto:|#|\/)/.test(u)) return u;
    const path = u.replace(/^\.\//, "");
    const dec = decodeURIComponent(path);
    for (const [prefix, to] of Object.entries(p.linkMap || {})) if (dec.startsWith(prefix)) return to;
    return kind === "img" ? `https://raw.githubusercontent.com/${d.repo}/${d.branch}/${path}` : `${d.url}/blob/${d.branch}/${path}`;
  };
  html = html.replace(/<a href="([^"]+)"/g, (m, u) => {
    const to = abs(u, "a");
    return `<a href="${to}"${/^https?:/.test(to) ? ' target="_blank" rel="noopener"' : ""}`;
  }).replace(/<img ([^>]*?)src="([^"]+)"/g, (m, a, u) => `<img ${a}src="${abs(u, "img")}" loading="lazy"`);
  return `    <article id="content" class="readme reveal">
      <p class="prompt">$ cat README.md <span class="muted">(synced from ${esc(d.repo)})</span></p>
${html}
    </article>`;
}

function chaptersHtml(p) {
  if (!p.chapters) return "";
  return `    <section class="chapters wide reveal">
      <h2 class="section-title">Write-ups</h2>
      <div class="chapter-grid">
${p.chapters.map(c => `        <a class="chapter ch-${c.status}" href="${attr(c.href)}"${/^https?:/.test(c.href) ? ' target="_blank" rel="noopener"' : ""}><span class="ch-status">${STATUS_LABEL[c.status]}</span><span class="ch-title">${esc(c.title)}</span><span class="ch-go">${c.status === "done" ? "read →" : "follow on GitHub →"}</span></a>`).join("\n")}
      </div>
    </section>`;
}

const fmtBytes = b => b > 1e6 ? (b / 1e6).toFixed(1) + " MB" : Math.round(b / 1e3) + " KB";

for (const p of projects) {
  const d = live[p.id];
  const prog = progressOf(d);
  const canonical = `${SITE}/${p.id}.html`;
  const jsonld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareSourceCode",
        "name": p.title,
        "description": p.description,
        "codeRepository": `https://github.com/${p.repo}`,
        "programmingLanguage": d ? Object.keys(d.languages) : [],
        "author": { "@type": "Person", "name": AUTHOR, "@id": SITE + "/#person", "url": SITE },
        "dateCreated": d ? d.created_at.slice(0, 10) : undefined,
        "dateModified": d ? d.pushed_at.slice(0, 10) : undefined,
        "url": canonical,
        "keywords": p.tags.join(", "),
      },
      { "@type": "BreadcrumbList", "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": AUTHOR, "item": SITE + "/" },
        { "@type": "ListItem", "position": 2, "name": "Live projects" },
        { "@type": "ListItem", "position": 3, "name": p.title, "item": canonical },
      ] },
    ],
  };
  const ring = 2 * Math.PI * 34;
  const page = `${head({ title: `${p.title} (live) · ${AUTHOR}`, description: p.description, canonical, ogType: "website", jsonld })}
<body class="live-body">
${aurora()}
${topbar()}
${sidebar(p.id)}
  <main class="container live-page" data-live="${p.id}" data-repo="${attr(p.repo)}" data-visual="${p.visual}" data-ver="${attr(d ? d.synced_at : "")}">

    <a class="back" href="/">← cd ..</a>

    <header class="live-hero wide">
      <div class="live-pill"><span class="live-dot" aria-hidden="true"></span> LIVE <span class="pill-sep"></span> synced from GitHub</div>
      <h1 class="scramble">${esc(p.title)}</h1>
      <p class="lead">${esc(p.tagline)}</p>
      <div class="hero-stats">
        <div class="ring" style="--p:${prog.pct}" role="img" aria-label="${prog.pct}% of the roadmap done">
          <svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" class="ring-bg"/><circle cx="40" cy="40" r="34" class="ring-fg" stroke-dasharray="${ring.toFixed(1)}" stroke-dashoffset="${(ring * (1 - prog.pct / 100)).toFixed(1)}"/></svg>
          <b data-count="${prog.pct}">${prog.pct}</b><small>%</small>
        </div>
        <dl class="stat-grid">
          <div><dt>last push</dt><dd data-ago="${attr(d ? d.pushed_at : "")}" data-push="${attr(p.repo)}">${d ? esc(d.pushed_at.slice(0, 10)) : "-"}</dd></div>
          <div><dt>commits</dt><dd data-count="${d ? d.commit_count : 0}">${d ? d.commit_count : "-"}</dd></div>
          <div><dt>files</dt><dd data-count="${d ? d.files : 0}">${d ? d.files : "-"}</dd></div>
          <div><dt>repo size</dt><dd>${d ? fmtBytes(d.bytes) : "-"}</dd></div>
          <div><dt>milestones</dt><dd>${prog.done}<span class="muted">/${prog.total}</span>${prog.wip ? ` <span class="wip-tag">+${prog.wip} wip</span>` : ""}</dd></div>
          <div><dt>activity</dt><dd>${sparkline(d)}</dd></div>
        </dl>
      </div>
      ${langBar(d)}
      <p class="repo-line"><a href="https://github.com/${attr(p.repo)}" target="_blank" rel="noopener">⎇ ${esc(p.repo)}</a></p>
    </header>

    <section class="viz wide viz-${p.visual}" id="viz" aria-label="${attr(p.title)} live visualisation"></section>

${chaptersHtml(p)}
${milestonesHtml(d)}
${stepsHtml(d)}
${feedHtml(d)}
${readmeHtml(p, d)}

  </main>
  <div class="toast" id="toast" role="status" aria-live="polite" hidden></div>

  <script src="/post.js?v=${VER}"></script>
  <script src="/live.js?v=${VER}"></script>
</body>
</html>
`;
  writeFileSync(`${p.id}.html`, page);
  console.log("built", p.id + ".html (live)");
}

// home page cards for the live projects
function liveCard(p) {
  const d = live[p.id];
  const prog = progressOf(d);
  const c = d && d.commits[0];
  return `        <a class="live-card${p.featured ? " featured" : ""} reveal" href="${p.id}.html">
          <div class="lc-head"><span class="live-dot" aria-hidden="true"></span><span class="lc-live">LIVE</span><span class="lc-repo">${esc(p.repo.split("/")[1])}</span></div>
          <div class="lc-viz" data-mini="${p.visual}" data-id="${p.id}" aria-hidden="true"></div>
          <h3>${esc(p.title)}</h3>
          <p>${esc(p.tagline)}</p>
          <div class="lc-progress"><span class="bar"><i style="width:${prog.pct}%"></i></span><span>${prog.done}/${prog.total} milestones · ${prog.pct}%</span></div>
          <div class="lc-meta"><span>${d ? d.commit_count : 0} commits</span><span>pushed <b data-ago="${attr(d ? d.pushed_at : "")}" data-push="${attr(p.repo)}">${d ? esc(d.pushed_at.slice(0, 10)) : "-"}</b></span>${sparkline(d, 110, 26)}</div>
          ${c ? `<div class="lc-commit"><span class="sha">${esc(c.sha)}</span><span class="msg" data-type>${esc(c.msg)}</span></div>` : ""}
        </a>`;
}

const projectPosts = posts.filter(p => (p.tags || []).includes("project"));
const notePosts = posts.filter(p => !(p.tags || []).includes("project"));

const homeDesc = `${AUTHOR} - ${ROLE} interested in offensive and defensive security: penetration testing, detection engineering, SOC operations and incident response. Write-ups and notes.`;

const homeJsonld = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Person",
      "@id": SITE + "/#person",
      "name": AUTHOR,
      "alternateName": ["Aymane El Ouafi", "aymaneelouafi"],
      "jobTitle": ROLE,
      "description": `${AUTHOR} is a cybersecurity engineer interested in offensive and defensive security — penetration testing, detection engineering, SOC operations and incident response.`,
      "url": SITE,
      "image": SITE + "/images/og.png",
      "sameAs": SAME_AS,
      "knowsAbout": ["Penetration Testing", "Detection Engineering", "SOC Operations",
        "Incident Response", "Offensive Security", "Defensive Security",
        "Hack The Box", "Cybersecurity"],
    },
    {
      "@type": "WebSite",
      "@id": SITE + "/#website",
      "url": SITE,
      "name": AUTHOR,
      "description": homeDesc,
      "author": { "@id": SITE + "/#person" },
      "inLanguage": "en",
    },
  ],
};

const home = `${head({
  title: `${AUTHOR} · ${ROLE}`,
  description: homeDesc,
  canonical: SITE + "/",
  ogType: "website",
  jsonld: homeJsonld,
})}
<body>
${aurora()}
${topbar()}
${sidebar("")}
  <main class="container home">

    <!-- ===== INTRO ===== -->
    <header class="intro">
      <p class="prompt"><span class="accent">aymane@sec</span>:~$ whoami</p>
      <h1>Aymane Elouafi</h1>
      <p class="role">Cybersecurity Engineer</p>

      <p class="bio">
        I'm Aymane Elouafi, a cybersecurity engineer interested in both offensive and
        defensive security — penetration testing, detection engineering, SOC operations
        and incident response. I like breaking things and catching the people who break
        things. Lately I've been spending a lot of time on
        <a href="https://www.hackthebox.com" target="_blank" rel="noopener">Hack The Box</a>,
        and this is where I write down what I learn so I don't lose it.
      </p>

      <ul class="tags">
        <li>Penetration Testing</li>
        <li>Detection Engineering</li>
        <li>SOC Operations</li>
        <li>Incident Response</li>
      </ul>

      <p class="links">
        <a href="${LINKEDIN}" target="_blank" rel="noopener">LinkedIn</a>
        <a href="${GITHUB}" target="_blank" rel="noopener">GitHub</a>
        <a href="${HTB}" target="_blank" rel="noopener">Hack The Box</a>
      </p>
    </header>

    <!-- ===== LIVE PROJECTS (in progress, synced from GitHub) ===== -->
    <section class="live-home">
      <div class="live-title">
        <h2><span class="live-dot" aria-hidden="true"></span> Live projects <span class="muted">· in progress</span></h2>
        <p class="live-sub">These pages are wired to GitHub: a pipeline syncs every push, so they change as the projects do.</p>
      </div>
      <div class="ticker" aria-hidden="true"><div class="ticker-track" id="ticker">${projects.flatMap(p => (live[p.id] ? live[p.id].commits.slice(0, 4) : []).map(c => `<span><b>${esc(p.repo.split("/")[1])}</b> ${esc(c.msg)}</span>`)).join("")}</div></div>
      <div class="live-grid wide">
${projects.map(liveCard).join("\n")}
      </div>
    </section>

    <!-- ===== PROJECTS (featured) ===== -->
    <section class="projects">
      <h2 class="section-title">Projects</h2>
      <div class="project-grid">
${projectPosts.map(projectCard).join("\n")}
      </div>
    </section>

    <!-- ===== NOTES ===== -->
    <section class="blog">
      <div class="blog-head">
        <h2>Notes &amp; write-ups</h2>
        <input id="search" class="search" type="text" placeholder="Search notes…" autocomplete="off">
      </div>
      <p id="no-results" class="no-results" hidden>No matching notes.</p>

      <ul id="post-list" class="post-list">
${notePosts.map(card).join("\n")}
      </ul>
    </section>

    <footer>
      <span>© <span id="year"></span> ${AUTHOR}</span>
      <span class="foot-links">
        <a href="${LINKEDIN}" target="_blank" rel="noopener">LinkedIn</a>
        <a href="${GITHUB}" target="_blank" rel="noopener">GitHub</a>
      </span>
    </footer>

  </main>

  <!-- search index for the home page search bar -->
  <script id="posts-data" type="application/json">${JSON.stringify(searchIndex).replace(/</g, "\\u003c")}</script>
  <script src="/home.js?v=${VER}"></script>
  <script src="/live.js?v=${VER}"></script>
</body>
</html>
`;
writeFileSync("index.html", home);
console.log("built index.html");

// ============================================================
//  sitemap.xml + robots.txt (helps Google find everything)
// ============================================================
const urls = [
  { loc: SITE + "/", lastmod: posts[0].date },
  ...projects.map(p => ({ loc: `${SITE}/${p.id}.html`, lastmod: live[p.id] ? live[p.id].pushed_at.slice(0, 10) : posts[0].date })),
  ...posts.map(p => ({ loc: `${SITE}/${p.id}.html`, lastmod: p.date })),
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
  </url>`).join("\n")}
</urlset>
`;
writeFileSync("sitemap.xml", sitemap);
console.log("built sitemap.xml");

const robots = `User-agent: *
Allow: /

Sitemap: ${SITE}/sitemap.xml
`;
writeFileSync("robots.txt", robots);
console.log("built robots.txt");

console.log("\nDone. " + posts.length + " posts built.");

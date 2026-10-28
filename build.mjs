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

import { readFileSync, writeFileSync } from "fs";
import { marked } from "marked";
import { parse } from "node-html-parser";

// ---- settings you might change one day ----
const SITE = "https://aymaneelouafi.me";
const AUTHOR = "Aymane Elouafi";
const LINKEDIN = "https://www.linkedin.com/in/aymane-elouafi";
const GITHUB = "https://github.com/aymane-elouafi";
// add more profile URLs here (HTB, X/Twitter...) to strengthen identity
const SAME_AS = [LINKEDIN, GITHUB];
const ROLE = "Cybersecurity Engineer";
const GA_ID = "G-V2R1YY0P62"; // Google Analytics measurement ID

const posts = JSON.parse(readFileSync("posts.json", "utf8"));
const methodology = JSON.parse(readFileSync("methodology.json", "utf8"));

// changes on every build, so browsers always load the newest css/js
// (instead of a stale cached copy) after you push an update
const VER = Date.now();

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
  <link rel="icon" href="/images/skull.svg">

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
  // posts tagged "walkthrough" go in their own part at the bottom
  const walkthroughs = posts.filter(p => (p.tags || []).includes("walkthrough"));

  const postLink = p =>
    `<li><a href="${p.id}.html"${p.id === currentId ? ' class="current"' : ""}>${esc(p.title)}</a></li>`;

  // resolve the posts under a methodology section (series auto + explicit ids)
  const secPosts = sec => {
    const ids = [];
    if (sec.series) posts.filter(p => p.series === sec.series).slice().reverse().forEach(p => ids.push(p.id));
    if (sec.posts) sec.posts.forEach(id => ids.push(id));
    return [...new Set(ids)].map(id => posts.find(p => p.id === id))
      .filter(Boolean).filter(p => !(p.tags || []).includes("walkthrough"));
  };

  const phasesHtml = methodology.map(ph => {
    // a phase opens by default if it (or the current post) has something in it
    const phasePosts = ph.sections.flatMap(secPosts);
    const open = phasePosts.length > 0 || phasePosts.some(p => p.id === currentId);

    const sections = ph.sections.map(sec => {
      const list = secPosts(sec);
      if (!list.length) {
        return `        <div class="nav-section empty"><span class="nav-sec-title">${esc(sec.title)}</span></div>`;
      }
      return `        <div class="nav-section">
          <span class="nav-sec-title">${esc(sec.title)}</span>
          <ul>
${list.map(postLink).map(s => "            " + s).join("\n")}
          </ul>
        </div>`;
    }).join("\n");

    return `    <details class="nav-phase"${open ? " open" : ""}>
      <summary><span class="nav-num">${ph.num}</span> ${esc(ph.title)}</summary>
${sections}
    </details>`;
  }).join("\n");

  const walkHtml = `    <details class="nav-phase nav-walk"${walkthroughs.some(p => p.id === currentId) ? " open" : ""}>
      <summary><span class="nav-num">★</span> HTB Walkthroughs</summary>
      <div class="nav-section">
        <ul>
${(walkthroughs.length ? walkthroughs.map(postLink) : ["<li class=\"empty\">(soon)</li>"]).map(s => "          " + s).join("\n")}
        </ul>
      </div>
    </details>`;

  return `  <div class="backdrop" id="backdrop"></div>
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-inner">
      <p class="sidebar-title">// methodology &amp; notes</p>
${phasesHtml}
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
        <a href="https://www.hackthebox.com" target="_blank" rel="noopener">Hack The Box</a>
      </p>
    </header>

    <!-- ===== NOTES ===== -->
    <section class="blog">
      <div class="blog-head">
        <h2>Notes &amp; write-ups</h2>
        <input id="search" class="search" type="text" placeholder="Search notes…" autocomplete="off">
      </div>
      <p id="no-results" class="no-results" hidden>No matching notes.</p>

      <ul id="post-list" class="post-list">
${posts.map(card).join("\n")}
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
  <script id="posts-data" type="application/json">${JSON.stringify(searchIndex)}</script>
  <script src="/home.js?v=${VER}"></script>
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

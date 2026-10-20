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
const ROLE = "Cybersecurity Engineer";
const GA_ID = "G-V2R1YY0P62"; // Google Analytics measurement ID

const posts = JSON.parse(readFileSync("posts.json", "utf8"));

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
  <link href="https://fonts.googleapis.com/css2?family=Rubik+Glitch&family=Share+Tech+Mono&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/style.css?v=${VER}">
</head>`;
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

  const jsonld = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.title,
    "description": post.description,
    "datePublished": post.date,
    "dateModified": post.date,
    "author": { "@type": "Person", "name": AUTHOR, "url": SITE },
    "publisher": { "@type": "Person", "name": AUTHOR, "url": SITE },
    "mainEntityOfPage": { "@type": "WebPage", "@id": canonical },
    "url": canonical,
    "image": `${SITE}/images/og.png`,
    "keywords": post.tags.join(", "),
    "inLanguage": "en",
  };

  const page = `${head({
    title: `${post.title} · ${AUTHOR}`,
    description: post.description,
    canonical,
    ogType: "article",
    jsonld,
  })}
<body>
  <main class="container post">

    <a class="back" href="/index.html">← cd ..</a>

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

const homeJsonld = {
  "@context": "https://schema.org",
  "@type": "Person",
  "name": AUTHOR,
  "jobTitle": ROLE,
  "url": SITE,
  "sameAs": [LINKEDIN],
  "knowsAbout": ["Penetration Testing", "Detection Engineering", "SOC Operations",
    "Incident Response", "Offensive Security", "Defensive Security"],
};

const homeDesc = `${AUTHOR} - ${ROLE} interested in offensive and defensive security: penetration testing, detection engineering, SOC operations and incident response. Write-ups and notes.`;

const home = `${head({
  title: `${AUTHOR} · ${ROLE}`,
  description: homeDesc,
  canonical: SITE + "/",
  ogType: "website",
  jsonld: homeJsonld,
})}
<body>
  <!-- Matrix rain in the background -->
  <canvas id="matrix"></canvas>

  <main class="container">

    <!-- ===== WHOAMI ===== -->
    <section class="whoami">
      <img class="skull" src="/images/skull.svg" alt="pixel skull logo" width="90" height="90">

      <p class="prompt"><span class="user">root@aymane</span>:<span class="path">~</span># <span id="typed"></span><span class="cursor">█</span></p>

      <h1 class="glitch" data-text="AYMANE ELOUAFI">AYMANE ELOUAFI</h1>

      <p class="bio">
        <span class="highlight">// cybersecurity engineer</span><br>
        I like breaking things and catching the people who break things.
        Interested in both <span class="pink">offensive</span> and <span class="cyan">defensive</span> security.
        Lately I've been spending a lot of time on
        <a href="https://www.hackthebox.com" target="_blank" rel="noopener">Hack The Box</a>.
        This is where I write down what I learn so I don't lose it.
      </p>

      <ul class="tags">
        <li class="tag pink">Penetration Testing</li>
        <li class="tag cyan">Detection Engineering</li>
        <li class="tag yellow">SOC Operations</li>
        <li class="tag purple">Incident Response</li>
      </ul>
    </section>

    <!-- ===== BLOG ===== -->
    <section class="blog">
      <h2 class="prompt"><span class="user">root@aymane</span>:<span class="path">~/posts</span># grep -ri</h2>

      <input id="search" class="search" type="text" placeholder="search... (nmap, -sV, zone transfer)" autocomplete="off">
      <p id="no-results" class="no-results" hidden>grep: no match found ¯\\_(ツ)_/¯</p>

      <ul id="post-list" class="post-list">
${posts.map(card).join("\n")}
      </ul>
    </section>

    <!-- ===== CONTACT ===== -->
    <section class="contact">
      <p class="prompt">&gt; establishing secure connection...</p>
      <h2>WANT TO TALK?</h2>
      <p>Questions, opportunities or just want to say hi. Reach me on LinkedIn.</p>
      <a class="button" href="${LINKEDIN}" target="_blank" rel="noopener">CONNECT ON LINKEDIN</a>
    </section>

    <footer>
      <p>© <span id="year"></span> ${AUTHOR} // hack the planet</p>
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

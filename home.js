// ===== Home page: search + matrix + whoami typing =====
// The list of posts is baked into the page by build.mjs (good for SEO).
// This script only adds the search bar, the background and the typing effect.

const posts = JSON.parse(document.getElementById("posts-data").textContent);
const list = document.getElementById("post-list");
const noResults = document.getElementById("no-results");

// escape text before putting it back in the page
function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// wrap every occurrence of the search term in <mark>
function highlight(text, query) {
  if (!query) return esc(text);
  const safe = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // escape regex chars
  return esc(text).replace(new RegExp("(" + safe + ")", "gi"), "<mark>$1</mark>");
}

// find the part of the post text around the match, to show a preview
function snippet(text, query) {
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (i === -1) return "";
  const start = Math.max(0, i - 40);
  const end = Math.min(text.length, i + query.length + 60);
  return (start > 0 ? "..." : "") + text.slice(start, end) + (end < text.length ? "..." : "");
}

function render(results, query) {
  list.innerHTML = "";
  results.forEach(function (post) {
    const tags = post.tags.map(function (t) { return "#" + t; }).join(" ");
    const series = post.series
      ? `<span class="series-label">${esc(post.series)}</span>` : "";

    // if the match is only inside the body text, show a snippet of it
    let preview = "";
    if (query) {
      const inMeta = (post.title + " " + post.description + " " + post.series + " " + post.tags.join(" "))
        .toLowerCase().includes(query.toLowerCase());
      if (!inMeta) {
        const snip = snippet(post.text, query);
        if (snip) preview = `<div class="post-match">&gt; ${highlight(snip, query)}</div>`;
      }
    }

    const item = document.createElement("li");
    item.innerHTML = `
      <a href="${post.id}.html">
        ${series}
        <div class="post-title">${highlight(post.title, query)}</div>
        <div class="post-desc">${highlight(post.description, query)}</div>
        ${preview}
        <div class="post-meta">${post.date} · ${tags}</div>
      </a>
    `;
    list.appendChild(item);
  });
  noResults.hidden = results.length > 0;
}

render(posts, "");

document.getElementById("search").addEventListener("input", function (event) {
  const query = event.target.value.trim();
  const q = query.toLowerCase();

  const found = posts.filter(function (post) {
    const haystack = [post.title, post.description, post.series, post.tags.join(" "), post.text]
      .join(" ").toLowerCase();
    // every word typed must appear somewhere (so "nmap udp" finds the nmap post)
    return q.split(/\s+/).every(function (word) { return haystack.includes(word); });
  });

  // if the user typed a single word, highlight it; for multiple words keep it simple
  render(found, q.split(/\s+/).length === 1 ? query : "");
});


// ===== small extras =====
document.getElementById("year").textContent = new Date().getFullYear();

// typing effect for "whoami"
const command = "whoami";
const typed = document.getElementById("typed");
let ci = 0;
(function typeLetter() {
  if (ci < command.length) {
    typed.textContent += command[ci++];
    setTimeout(typeLetter, 150);
  }
})();


// ===== Matrix rain background =====
const canvas = document.getElementById("matrix");
const ctx = canvas.getContext("2d");
const letters = "01アイウエオカキクケコABCDEF<>/{}#$";
const fontSize = 16;
let drops = [];

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  drops = Array(Math.floor(canvas.width / fontSize)).fill(1);
}
function draw() {
  ctx.fillStyle = "rgba(10, 10, 15, 0.1)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = fontSize + "px monospace";
  drops.forEach(function (y, x) {
    const letter = letters[Math.floor(Math.random() * letters.length)];
    ctx.fillStyle = Math.random() > 0.95 ? "#ff2e88" : "#00f0ff";
    ctx.fillText(letter, x * fontSize, y * fontSize);
    if (y * fontSize > canvas.height && Math.random() > 0.975) drops[x] = 0;
    drops[x]++;
  });
}
resize();
window.addEventListener("resize", resize);
setInterval(draw, 50);

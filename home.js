// ===== Home page: search =====
// The list of posts is baked into the page by build.mjs (good for SEO).
// This only adds the live search over titles, tags and full post text.

const posts = JSON.parse(document.getElementById("posts-data").textContent);
const list = document.getElementById("post-list");
const noResults = document.getElementById("no-results");

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// wrap every occurrence of the search term in <mark>
function highlight(text, query) {
  if (!query) return esc(text);
  const safe = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return esc(text).replace(new RegExp("(" + safe + ")", "gi"), "<mark>$1</mark>");
}

// a short preview around the match, for when it's only in the body text
function snippet(text, query) {
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (i === -1) return "";
  const start = Math.max(0, i - 40);
  const end = Math.min(text.length, i + query.length + 60);
  return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}

function render(results, query) {
  list.innerHTML = "";
  results.forEach(function (post) {
    const tags = post.tags.map(function (t) { return "#" + t; }).join(" ");
    const series = post.series
      ? `<span class="series-label">${esc(post.series)}</span>` : "";

    let preview = "";
    if (query) {
      const inMeta = (post.title + " " + post.description + " " + post.series + " " + post.tags.join(" "))
        .toLowerCase().includes(query.toLowerCase());
      if (!inMeta) {
        const snip = snippet(post.text, query);
        if (snip) preview = `<div class="post-match">${highlight(snip, query)}</div>`;
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
    return q.split(/\s+/).every(function (word) { return haystack.includes(word); });
  });

  render(found, q.split(/\s+/).length === 1 ? query : "");
});

document.getElementById("year").textContent = new Date().getFullYear();

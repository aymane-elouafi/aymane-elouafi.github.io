// Shows one post. The URL looks like: post.html?id=nmap
// -> it finds "nmap" in posts.js and loads posts/nmap.md

const id = new URLSearchParams(window.location.search).get("id");
const post = posts.find(function (p) { return p.id === id; });

const title = document.getElementById("title");
const meta = document.getElementById("meta");
const content = document.getElementById("content");
const toc = document.getElementById("toc");

if (!post) {
  title.textContent = "404 - post not found";
} else {
  title.textContent = post.title;
  document.title = post.title + " - Aymane El Ouafi";
  meta.textContent = post.date + " · " + post.tags.map(function (t) { return "#" + t; }).join(" ");
  if (post.series) {
    title.insertAdjacentHTML("beforebegin", `<span class="series-label">${post.series}</span>`);
  }

  fetch("posts/" + post.id + ".md")
    .then(function (response) { return response.text(); })
    .then(function (markdown) {
      // breaks: true -> a single line break in your notes stays a line break
      content.innerHTML = marked.parse(markdown, { breaks: true });
      buildTableOfContents();
      showSeries();
      makeImagesClickable();
    })
    .catch(function () {
      // happens when you open the file by double-clicking it (file://)
      content.innerHTML = "<p class='no-results'>Can't load the post. If you're testing on your computer, " +
        "run <code>python3 -m http.server</code> in the site folder and open http://localhost:8000</p>";
    });
}

// Clicking a screenshot opens it in full size in a new tab
function makeImagesClickable() {
  content.querySelectorAll("img").forEach(function (img) {
    const link = document.createElement("a");
    link.href = img.src;
    link.target = "_blank";
    img.replaceWith(link);
    link.appendChild(img);
  });
}

// If the post is part of a series, list all the posts of that series at the bottom
function showSeries() {
  if (!post.series) return;

  // posts.js has the newest first, so reverse to show them in order
  const inSeries = posts.filter(function (p) { return p.series === post.series; }).reverse();

  let html = `<p class="prompt">$ ls ~/series/${post.series.toLowerCase().replaceAll(" ", "-")}</p><ul>`;
  inSeries.forEach(function (p) {
    if (p.id === post.id) {
      html += `<li class="current">${p.title} &lt;- you are here</li>`;
    } else {
      html += `<li><a href="post.html?id=${p.id}">${p.title}</a></li>`;
    }
  });

  const box = document.createElement("nav");
  box.className = "series";
  box.innerHTML = html + "</ul>";
  content.after(box);
}

// Makes a clickable list of the big "# " sections at the top of the post
function buildTableOfContents() {
  const headings = content.querySelectorAll("h1");
  if (headings.length < 2) return;

  let html = "<p class='prompt'>$ cat contents.txt</p><ul>";
  headings.forEach(function (heading, index) {
    heading.id = "section-" + index;
    html += `<li><a href="#section-${index}">${heading.textContent}</a></li>`;
  });
  toc.innerHTML = html + "</ul>";
}

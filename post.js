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

  fetch("posts/" + post.id + ".md")
    .then(function (response) { return response.text(); })
    .then(function (markdown) {
      // breaks: true -> a single line break in your notes stays a line break
      content.innerHTML = marked.parse(markdown, { breaks: true });
      buildTableOfContents();
    })
    .catch(function () {
      // happens when you open the file by double-clicking it (file://)
      content.innerHTML = "<p class='no-results'>Can't load the post. If you're testing on your computer, " +
        "run <code>python3 -m http.server</code> in the site folder and open http://localhost:8000</p>";
    });
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

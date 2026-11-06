// ===== Post page: search inside the post + copy cheat sheet commands =====

const content = document.getElementById("content");
const searchBox = document.getElementById("post-search");
const countLabel = document.getElementById("post-search-count");

// keep the original post so we can restore it when the search changes
const originalHTML = content.innerHTML;

let marks = [];      // the <mark> elements currently highlighted
let current = -1;    // which match we are focused on

// highlight every occurrence of "query" inside the post content
function runSearch(query) {
  // always start from the clean post
  content.innerHTML = originalHTML;
  marks = [];
  current = -1;

  if (!query) {
    countLabel.hidden = true;
    return;
  }

  const safe = query.toLowerCase();

  // walk every piece of text in the post and wrap the matches
  const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) textNodes.push(node);

  textNodes.forEach(function (textNode) {
    const text = textNode.nodeValue;
    const lower = text.toLowerCase();
    if (!lower.includes(safe)) return;

    const frag = document.createDocumentFragment();
    let i = 0, hit;
    while ((hit = lower.indexOf(safe, i)) !== -1) {
      if (hit > i) frag.appendChild(document.createTextNode(text.slice(i, hit)));
      const mark = document.createElement("mark");
      mark.className = "hl";
      mark.textContent = text.slice(hit, hit + safe.length);
      frag.appendChild(mark);
      marks.push(mark);
      i = hit + safe.length;
    }
    if (i < text.length) frag.appendChild(document.createTextNode(text.slice(i)));
    textNode.parentNode.replaceChild(frag, textNode);
  });

  countLabel.hidden = false;
  if (marks.length === 0) {
    countLabel.textContent = "no match";
  } else {
    jumpTo(0);
  }
}

// focus one match: highlight it stronger and scroll to it
function jumpTo(index) {
  if (!marks.length) return;
  if (current >= 0 && marks[current]) marks[current].classList.remove("active");
  current = (index + marks.length) % marks.length;
  marks[current].classList.add("active");
  marks[current].scrollIntoView({ block: "center", behavior: "smooth" });
  countLabel.textContent = (current + 1) + " / " + marks.length + " matches";
}

let timer;
searchBox.addEventListener("input", function () {
  clearTimeout(timer);
  timer = setTimeout(function () { runSearch(searchBox.value.trim()); }, 150);
});

searchBox.addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    e.preventDefault();
    jumpTo(current + (e.shiftKey ? -1 : 1));
  } else if (e.key === "Escape") {
    searchBox.value = "";
    runSearch("");
  }
});


// ===== Click a cheat sheet command to copy it =====
document.querySelectorAll(".cheat-row code").forEach(function (code) {
  code.title = "click to copy";
  code.addEventListener("click", function () {
    navigator.clipboard.writeText(code.textContent).then(function () {
      const old = code.getAttribute("data-copied");
      if (old) return;
      code.setAttribute("data-copied", "1");
      const tag = document.createElement("span");
      tag.className = "copied";
      tag.textContent = " copied!";
      code.after(tag);
      setTimeout(function () { tag.remove(); code.removeAttribute("data-copied"); }, 1200);
    });
  });
});


// ===== Image lightbox =====
// Clicking a screenshot opens it in an overlay on the SAME page (no new tab).
// Close: click outside / the X / Esc.  Browse: ← → keys or the arrow buttons.
// One delegated listener, so it keeps working after the in-post search rebuilds the article.
(function () {
  var box = document.createElement("div");
  box.className = "lightbox";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.hidden = true;
  box.innerHTML =
    '<button class="lb-close" aria-label="Close image">&times;</button>' +
    '<button class="lb-prev" aria-label="Previous image">&#8249;</button>' +
    '<figure><img alt=""><figcaption></figcaption></figure>' +
    '<button class="lb-next" aria-label="Next image">&#8250;</button>';
  document.body.appendChild(box);

  var big = box.querySelector("img");
  var caption = box.querySelector("figcaption");
  var list = [];
  var index = 0;

  function isShot(img) {              // skip tiny logos in tables
    var w = parseInt(img.getAttribute("width"), 10);
    return !(w && w <= 120);
  }
  function show(i) {
    index = (i + list.length) % list.length;
    var img = list[index];
    big.src = img.currentSrc || img.src;
    big.alt = img.alt;
    caption.textContent = img.alt + "  (" + (index + 1) + " / " + list.length + ")";
    var many = list.length > 1;
    box.querySelector(".lb-prev").style.display = many ? "" : "none";
    box.querySelector(".lb-next").style.display = many ? "" : "none";
  }
  function open(img) {
    list = Array.prototype.filter.call(document.querySelectorAll("#content img"), isShot);
    show(list.indexOf(img));
    box.hidden = false;
    requestAnimationFrame(function () { box.classList.add("open"); });
    document.body.classList.add("lb-lock");
  }
  function close() {
    box.classList.remove("open");
    document.body.classList.remove("lb-lock");
    setTimeout(function () { box.hidden = true; big.removeAttribute("src"); }, 180);
  }

  document.addEventListener("click", function (e) {
    var img = e.target.closest && e.target.closest("#content img");
    if (!img) return;
    e.preventDefault();               // stops the link from opening a new tab
    if (isShot(img)) open(img);
  });
  box.addEventListener("click", function (e) {
    if (e.target === box || e.target.closest(".lb-close") || e.target === big.parentNode) close();
    else if (e.target.closest(".lb-prev")) show(index - 1);
    else if (e.target.closest(".lb-next")) show(index + 1);
  });
  document.addEventListener("keydown", function (e) {
    if (box.hidden) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") show(index - 1);
    else if (e.key === "ArrowRight") show(index + 1);
  });
})();

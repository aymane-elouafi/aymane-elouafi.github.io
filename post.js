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

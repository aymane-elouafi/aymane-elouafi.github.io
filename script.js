// Your list of posts is in posts.js (that's the file to edit when you add a post)


// ===== Show the posts on the home page =====
const list = document.getElementById("post-list");

function showPosts(postsToShow) {
  list.innerHTML = "";
  postsToShow.forEach(function (post) {
    const tags = post.tags.map(function (t) { return "#" + t; }).join(" ");
    const item = document.createElement("li");
    item.innerHTML = `
      <a href="post.html?id=${post.id}">
        <div class="post-title">${post.title}</div>
        <div class="post-desc">${post.description}</div>
        <div class="post-meta">${post.date} · ${tags}</div>
      </a>
    `;
    list.appendChild(item);
  });
  document.getElementById("no-results").hidden = postsToShow.length > 0;
}

showPosts(posts);


// ===== Search bar =====
// Searches in the title, description, tags AND the full text of the notes

// Load the text of every post once, so we can search inside them
posts.forEach(function (post) {
  post.text = "";
  fetch("posts/" + post.id + ".md")
    .then(function (response) { return response.text(); })
    .then(function (text) { post.text = text; })
    .catch(function () {}); // if it fails, search still works on title and tags
});

document.getElementById("search").addEventListener("input", function (event) {
  const search = event.target.value.toLowerCase().trim();

  const found = posts.filter(function (post) {
    const everything = [post.title, post.description, post.tags.join(" "), post.text].join(" ");
    return everything.toLowerCase().includes(search);
  });

  showPosts(found);
});


document.getElementById("year").textContent = new Date().getFullYear();


// ===== Typing effect for "whoami" =====
const command = "whoami";
const typed = document.getElementById("typed");
let i = 0;

function typeLetter() {
  if (i < command.length) {
    typed.textContent += command[i];
    i++;
    setTimeout(typeLetter, 150);
  }
}
setTimeout(typeLetter, 500);


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
  ctx.fillStyle = "rgba(10, 10, 15, 0.1)"; // fades the old letters
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = fontSize + "px monospace";

  drops.forEach(function (y, x) {
    const letter = letters[Math.floor(Math.random() * letters.length)];
    ctx.fillStyle = Math.random() > 0.95 ? "#ff2e88" : "#00f0ff";
    ctx.fillText(letter, x * fontSize, y * fontSize);

    // go back to the top at a random moment
    if (y * fontSize > canvas.height && Math.random() > 0.975) {
      drops[x] = 0;
    }
    drops[x]++;
  });
}

resize();
window.addEventListener("resize", resize);
setInterval(draw, 50);

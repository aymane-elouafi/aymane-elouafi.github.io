// ===== YOUR POSTS =====
// To add a post:
//   1. Copy posts/_template.html, rename it (ex: posts/my-new-post.html) and write in it
//   2. Add a line at the TOP of this list
const posts = [
  {
    title: "Hello World - why this blog exists",
    date: "2026-10-11",
    tag: "notes",
    file: "posts/hello-world.html",
  },
];


// ===== Show the posts on the home page (no need to touch this) =====
const list = document.getElementById("post-list");

posts.forEach(function (post) {
  const item = document.createElement("li");
  item.innerHTML = `
    <a href="${post.file}">
      <div class="post-title">${post.title}</div>
      <div class="post-meta">${post.date} · #${post.tag}</div>
    </a>
  `;
  list.appendChild(item);
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

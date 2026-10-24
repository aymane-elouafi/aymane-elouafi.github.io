// ===== Side menu drawer (mobile) =====
// On wide screens the sidebar is always visible (CSS). On narrow screens it
// slides in when you tap "☰ menu" and closes on tap-outside, Esc, or a link.

(function () {
  const toggle = document.querySelector(".menu-toggle");
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("backdrop");
  if (!toggle || !sidebar) return;

  function open() {
    document.body.classList.add("menu-open");
    toggle.setAttribute("aria-expanded", "true");
  }
  function close() {
    document.body.classList.remove("menu-open");
    toggle.setAttribute("aria-expanded", "false");
  }

  toggle.addEventListener("click", function () {
    document.body.classList.contains("menu-open") ? close() : open();
  });
  if (backdrop) backdrop.addEventListener("click", close);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") close();
  });
  // close after picking a post on mobile
  sidebar.querySelectorAll("a").forEach(function (a) {
    a.addEventListener("click", close);
  });
})();

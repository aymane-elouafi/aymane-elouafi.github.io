// ============================================================
//  live.js: makes the project pages (and the home cards) alive
//  ----------------------------------------------------------
//  - ticking "last push" clocks, count-ups, scramble titles, typed commits
//  - polls GitHub from the visitor's browser for brand-new commits
//    (falls back to the CI snapshot in /live/<id>.json when rate-limited)
//  - three visualisations: network (enterprise lab), pipeline (AI agent),
//    stream (API attack detection). The data comes from the repos;
//    the network traffic is a simulation that follows the real firewall policy.
// ============================================================
(function () {
  "use strict";

  var REDUCE = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var SVGNS = "http://www.w3.org/2000/svg";
  var page = document.querySelector(".live-page");

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function sv(tag, attrs, parent) {
    var e = document.createElementNS(SVGNS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
  function clock() { var d = new Date(); return pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds()); }

  // run fn when el scrolls into view (once)
  function onVisible(node, fn) {
    if (!("IntersectionObserver" in window)) return fn();
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { io.disconnect(); fn(); }
    }, { rootMargin: "0px 0px -10% 0px" });
    io.observe(node);
  }
  // keep a flag true only while el is on screen and the tab is visible
  function watchActive(node, cb) {
    var onScreen = false;
    function update() { cb(onScreen && !document.hidden); }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (e) { onScreen = e[0].isIntersecting; update(); }).observe(node);
    } else onScreen = true;
    document.addEventListener("visibilitychange", update);
    update();
  }

  // ---------- ticking relative times ----------
  function ago(iso) {
    var s = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
    var d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
    if (d > 0) return d + "d " + h + "h " + pad(m) + "m ago";
    if (h > 0) return h + "h " + pad(m) + "m " + pad(sec) + "s ago";
    if (m > 0) return m + "m " + pad(sec) + "s ago";
    return sec + "s ago";
  }
  function tick() {
    $$("[data-ago]").forEach(function (n) { var v = n.getAttribute("data-ago"); if (v) n.textContent = ago(v); });
  }
  tick();
  setInterval(tick, 1000);

  // ---------- count-ups ----------
  $$("[data-count]").forEach(function (n) {
    var to = +n.getAttribute("data-count");
    if (REDUCE || !to) return;
    n.textContent = "0";
    onVisible(n, function () {
      var t0 = performance.now(), dur = 1100;
      (function step(t) {
        var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        n.textContent = Math.round(to * e);
        if (k < 1) requestAnimationFrame(step);
      })(t0);
    });
  });

  // ---------- scramble title ----------
  $$(".scramble").forEach(function (h) {
    if (REDUCE) return;
    var final = h.textContent, chars = "!<>-_\\/[]{}=+*^?#01";
    var t0 = performance.now(), dur = 900;
    h.setAttribute("aria-label", final);
    (function step(t) {
      var k = (t - t0) / dur, out = "";
      for (var i = 0; i < final.length; i++) {
        out += final[i] === " " || k > i / final.length + 0.15 ? final[i] : chars[Math.floor(Math.random() * chars.length)];
      }
      h.textContent = out;
      if (k < 1.2) requestAnimationFrame(step); else h.textContent = final;
    })(t0);
  });

  // ---------- typed commit messages ----------
  function typeInto(n, text, speed) {
    if (REDUCE) { n.textContent = text; return; }
    n.textContent = "";
    n.classList.add("typing");
    var i = 0;
    (function next() {
      n.textContent = text.slice(0, ++i);
      if (i < text.length) setTimeout(next, speed || 22);
      else n.classList.remove("typing");
    })();
  }
  $$("[data-type]").forEach(function (n) {
    var text = n.textContent;
    n.textContent = "";
    onVisible(n, function () { typeInto(n, text); });
  });

  // ---------- toast ----------
  var toastTimer;
  function toast(msg) {
    var t = $("#toast");
    if (!t) return;
    t.textContent = msg;
    t.hidden = false;
    requestAnimationFrame(function () { t.classList.add("show"); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); setTimeout(function () { t.hidden = true; }, 300); }, 6000);
  }

  // ---------- GitHub: the freshest commits, straight from the API ----------
  // cache:"no-cache" makes the browser revalidate with an ETag; GitHub answers 304
  // and does not count it against the 60 requests/hour a visitor gets.
  function githubCommits(repo) {
    var key = "gh:" + repo;
    try {
      var c = JSON.parse(sessionStorage.getItem(key) || "null");
      if (c && Date.now() - c.t < 60000) return Promise.resolve(c.d);
    } catch (e) { /* storage blocked: just fetch */ }
    return fetch("https://api.github.com/repos/" + repo + "/commits?per_page=12", { cache: "no-cache", headers: { Accept: "application/vnd.github+json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!Array.isArray(d)) return null;
        var list = d.map(function (x) {
          return { sha: x.sha.slice(0, 7), msg: x.commit.message.split("\n")[0].slice(0, 120), date: x.commit.committer.date, url: x.html_url };
        });
        try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), d: list })); } catch (e) { /* ignore */ }
        return list;
      })
      .catch(function () { return null; });
  }

  function applyCommits(repo, list, announce) {
    if (!list || !list.length) return;
    var newest = list[0].date;
    $$('[data-push="' + repo + '"]').forEach(function (n) {
      var cur = n.getAttribute("data-ago");
      if (!cur || Date.parse(newest) > Date.parse(cur)) n.setAttribute("data-ago", newest);
    });
    var ol = $("#commits");
    if (!ol || ol.closest(".live-page").getAttribute("data-repo") !== repo) return;
    var known = {};
    $$(".sha", ol).forEach(function (s) { known[s.textContent] = 1; });
    var fresh = list.filter(function (c) { return !known[c.sha]; }).reverse();
    fresh.forEach(function (c) {
      var li = el("li", "new"), a = el("a");
      a.href = c.url; a.target = "_blank"; a.rel = "noopener";
      a.appendChild(el("span", "sha", c.sha));
      a.appendChild(el("span", "msg", c.msg));
      var t = el("time"); t.setAttribute("datetime", c.date); t.setAttribute("data-ago", c.date); t.textContent = ago(c.date);
      a.appendChild(t);
      li.appendChild(a);
      ol.insertBefore(li, ol.firstChild);
    });
    while (ol.children.length > 14) ol.removeChild(ol.lastChild);
    if (fresh.length && announce) toast("● new commit just landed: " + fresh[fresh.length - 1].msg);
    var st = $("#feed-state");
    if (st) { st.textContent = "● live"; st.classList.add("on"); }
  }

  if (page) {
    var repo = page.getAttribute("data-repo");
    var first = true;
    var poll = function () {
      githubCommits(repo).then(function (list) {
        if (list) applyCommits(repo, list, !first);
        else { var st = $("#feed-state"); if (st) st.textContent = "snapshot (GitHub busy)"; }
        first = false;
      });
    };
    poll();
    setInterval(function () { if (!document.hidden) poll(); }, 120000);
  } else {
    $$("[data-push]").forEach(function (n) {
      var r = n.getAttribute("data-push");
      githubCommits(r).then(function (list) { applyCommits(r, list, false); });
    });
  }

  // ---------- project data (the CI snapshot) ----------
  var dataCache = {};
  function loadData(id, ver) {
    if (!dataCache[id]) {
      dataCache[id] = fetch("/live/" + id + ".json" + (ver ? "?v=" + encodeURIComponent(ver) : ""))
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; });
    }
    return dataCache[id];
  }

  // ============================================================
  //  VISUAL 1: the enterprise network, live
  // ============================================================
  var NODES = {
    inet:   { x: 110, y: 92,  label: "INTERNET", sub: "updates · visitors", kind: "cloud" },
    parrot: { x: 110, y: 250, label: "PARROT", sub: "attacker", ip: "172.16.148.100", kind: "red", zone: "WAN",
              info: "The attacker for Part 2. It sits on the WAN like any machine on the Internet.", talks: "can only reach 80/443 published on PROXY01" },
    fw:     { x: 470, y: 250, w: 150, h: 62, label: "FW01", sub: "pfSense CE 2.9", ip: "172.16.148.10", kind: "fw", zone: "every zone",
              info: "Firewall, router, DHCP and DNS for every zone. Default deny: every flow you see passing is an explicit rule.", talks: "routes between WAN, DMZ and the three VLANs" },
    proxy:  { x: 385, y: 86, label: "PROXY01", sub: "Nginx · Squid", ip: "10.10.50.10", zone: "DMZ", cfg: "configs/proxy01-setup.sh",
              info: "Nginx reverse proxy publishing the website on 80/443, and the Squid forward proxy (3128) for the clients.", talks: "← Internet 80/443 · ← CLIENTS 80/443/3128 · → WEB01 80" },
    web:    { x: 565, y: 86, label: "WEB01", sub: "Apache · DVWA", ip: "10.10.50.20", zone: "DMZ", cfg: "configs/web01-setup.sh",
              info: "The deliberately vulnerable web app (DVWA). Only reachable through PROXY01.", talks: "→ SRV01 3306 only · updates out" },
    ids:    { x: 840, y: 250, w: 140, h: 56, label: "IDS01", sub: "Suricata", ip: "10.10.99.20", kind: "ids", zone: "MGMT (VLAN 99)", cfg: "configs/ids01-install.sh",
              info: "Passive sensor: AF_PACKET capture on the DMZ and on the trunk, management on VLAN 99. ET Open + custom LAB rules.", talks: "sees DMZ + trunk traffic (mirror)" },
    sw:     { x: 470, y: 395, label: "SW01", sub: "Debian bridge", kind: "sw", zone: "trunk + access ports", cfg: "configs/sw01-setup.sh",
              info: "A Linux bridge with VLAN filtering: trunk0 carries VLANs 10/20/99 tagged to FW01, one access port per VLAN. No IP address.", talks: "trunk to FW01 · access ports 10, 20, 99" },
    client: { x: 130, y: 555, label: "CLIENT01", sub: "Windows 10", ip: "10.10.10.100", zone: "CLIENTS (VLAN 10)",
              info: "A user workstation. It reaches the web only through the Squid proxy.", talks: "→ PROXY01 80/443/3128 · → SRV01 445" },
    client2:{ x: 262, y: 555, label: "CLIENT02", sub: "domain-joined", ip: "10.10.10.101", zone: "CLIENTS (VLAN 10)", lab: "2",
              info: "Second workstation, joined to the domain in the Active Directory lab." },
    srv:    { x: 430, y: 555, label: "SRV01", sub: "MariaDB · Samba", ip: "10.10.20.10", zone: "SERVERS (VLAN 20)", cfg: "configs/srv01-setup.sh",
              info: "DVWA's database and the clients' file share. The crown jewels of the lab.", talks: "← WEB01 3306 · ← CLIENTS 445 · updates out" },
    dc:     { x: 572, y: 555, label: "DC01", sub: "Active Directory", ip: "10.10.20.20", zone: "SERVERS (VLAN 20)", lab: "2",
              info: "Domain controller: Kerberos, GPO, LDAP. Then Kerberoasting, AS-REP roasting, pass-the-hash." },
    admin:  { x: 745, y: 555, label: "ADMIN01", sub: "admin workstation", ip: "10.10.99.10", zone: "MGMT (VLAN 99)",
              info: "The management VLAN: the only zone allowed to reach everything.", talks: "→ everything" },
    wazuh:  { x: 880, y: 555, label: "WAZUH", sub: "SIEM", ip: "10.10.99.30", zone: "MGMT (VLAN 99)", lab: "3",
              info: "Central logs from every VM, Suricata and pfSense, plus FIM and active response in the next labs." }
  };
  var ZONES = [
    { x: 28, y: 28, w: 170, h: 300, label: "WAN" },
    { x: 292, y: 20, w: 366, h: 122, label: "DMZ · 10.10.50.0/24" },
    { x: 60, y: 492, w: 272, h: 128, label: "CLIENTS · VLAN 10" },
    { x: 360, y: 492, w: 282, h: 128, label: "SERVERS · VLAN 20" },
    { x: 672, y: 492, w: 290, h: 128, label: "MGMT · VLAN 99" }
  ];
  var IFACE = { parrot: "WAN", inet: "WAN", proxy: "DMZ", web: "DMZ", client: "CLIENTS", client2: "CLIENTS", srv: "SERVERS", dc: "SERVERS", admin: "MGMT", wazuh: "MGMT", fw: "self" };
  var PUBLIC = ["185.199.108.153", "91.189.91.83", "140.82.121.4", "151.101.1.69", "104.16.132.229"];

  function upPath(id) {
    var n = NODES[id];
    if (id === "fw") return [[470, 250]];
    if (id === "parrot") return [[n.x, n.y], [255, 250], [470, 250]];
    if (id === "inet") return [[n.x, n.y], [255, 92], [255, 250], [470, 250]];
    if (id === "proxy") return [[n.x, n.y], [385, 165], [470, 165, "dmz"], [470, 250]];
    if (id === "web") return [[n.x, n.y], [565, 165], [470, 165, "dmz"], [470, 250]];
    return [[n.x, n.y], [n.x, 462], [470, 462], [470, 395], [470, 327, "trunk"], [470, 250]];
  }
  function routeOf(a, b, block) {
    var up = upPath(a);
    if (block) return up;
    if (IFACE[a] === "DMZ" && IFACE[b] === "DMZ") return [[NODES[a].x, NODES[a].y], [NODES[a].x, 165, "dmz"], [NODES[b].x, 165], [NODES[b].x, NODES[b].y]];
    return up.concat(upPath(b).reverse().slice(1));
  }
  var MIRROR = {
    dmz: function (p) { return [p, [565, 165], [840, 165], [840, 250]]; },
    trunk: function () { return [[470, 327], [800, 327], [800, 278], [840, 250]]; }
  };

  // ATTACKS: each one is a real step of the attack phase (shown only once its
  // screenshots are in the repo), plus the custom DVWA rule from Part 1.
  var NSE_MSG = "ET SCAN Nmap Scripting Engine User-Agent Detected (Nmap Scripting Engine)";
  var ATTACKS = [
    { step: "A2.1", title: "A2.1 · subnet sweep (nmap -sn)", legs: function () {
      return [1, 2, 3, 4, 5].map(function (i) { return { f: "parrot", t: "fw", proto: "icmp", block: true, bad: true, gap: 140 }; });
    } },
    { step: "A2.2", title: "A2.2 · SYN scan against the WAN", legs: function () {
      return [21, 22, 23, 25, 139, 445, 3306, 3389, 8080].map(function (port) { return { f: "parrot", t: "srv", port: port, block: true, bad: true, gap: 90 }; })
        .concat([{ f: "parrot", t: "proxy", port: 80, bad: true, gap: 90 }, { f: "parrot", t: "proxy", port: 443, bad: true, gap: 90 }]);
    } },
    { step: "A2.3", title: "A2.3 · nmap NSE scripts against the website", legs: function () {
      var l = [];
      for (var i = 0; i < 3; i++) {
        l.push({ f: "parrot", t: "proxy", port: 80, bad: true, alert: NSE_MSG, gap: 260 });
        l.push({ f: "proxy", t: "web", port: 80, bad: true, alert: NSE_MSG, xff: "172.16.148.100", gap: 200 });
      }
      return l;
    } },
    { step: "A2.6", title: "A2.6 · WhatWeb fingerprinting DVWA", legs: function () {
      return [{ f: "parrot", t: "proxy", port: 80, bad: true, alert: "WhatWeb scan detected (User-Agent)", gap: 300 },
              { f: "proxy", t: "web", port: 80, bad: true, alert: "WhatWeb scan detected (User-Agent)", xff: "172.16.148.100", gap: 300 },
              { f: "parrot", t: "proxy", port: 443, bad: true, gap: 300 }];
    } },
    { step: null, title: "Part 1 rule sid:1000005 · DVWA command injection", legs: function () {
      return [{ f: "parrot", t: "proxy", port: 80, bad: true, gap: 300 },
              { f: "proxy", t: "web", port: 80, bad: true, alert: "LAB Command injection attempt DVWA exec", sid: "1:1000005:1", cls: "Web Application Attack", xff: "172.16.148.100", gap: 300 }];
    } }
  ];
  var NORMAL = [
    function () { return [{ f: "client", t: "proxy", port: 3128 }, { f: "proxy", t: "inet", port: 443, chain: true }]; },
    function () { return [{ f: "client", t: "srv", port: 445 }]; },
    function () { return [{ f: "web", t: "srv", port: 3306 }]; },
    function () { return [{ f: "inet", t: "proxy", port: 443 }, { f: "proxy", t: "web", port: 80, chain: true }]; },
    function () { return [{ f: "srv", t: "inet", port: 443 }]; },
    function () { return [{ f: "admin", t: "web", port: 22 }]; },
    function () { return [{ f: "admin", t: "fw", port: 443 }]; },
    function () { return [{ f: "proxy", t: "inet", port: 123, proto: "udp" }]; }
  ];
  var BLOCKED = [
    { f: "web", t: "client", port: 445 }, { f: "client", t: "admin", port: 3389 }, { f: "inet", t: "srv", port: 3306 },
    { f: "srv", t: "web", port: 80 }, { f: "client", t: "srv", port: 3306 }, { f: "web", t: "admin", port: 22 }, { f: "inet", t: "client", port: 445 }
  ];

  function network(host, data, mini) {
    var ms = (data && data.milestones) || [];
    var labStatus = function (id) { var m = ms.filter(function (x) { return x.id === id; })[0]; return m ? m.status : "todo"; };
    var steps = {};
    ((data && data.steps) || []).forEach(function (s) { steps[s.id] = 1; });
    var attacks = ATTACKS.filter(function (a) { return !a.step || steps[a.step]; });
    var attackPhase = labStatus("1b");

    host.classList.add("net");
    if (mini) host.classList.add("mini");

    // header: counters + what this is
    var hud = el("div", "net-hud");
    var cPass = el("b", null, "0"), cBlock = el("b", null, "0"), cAlert = el("b", null, "0");
    [["passed", cPass, "ok"], ["blocked", cBlock, "bad"], ["IDS alerts", cAlert, "warn"]].forEach(function (x) {
      var s = el("span", "hud-" + x[2]); s.appendChild(x[1]); s.appendChild(document.createTextNode(" " + x[0])); hud.appendChild(s);
    });
    if (!mini) hud.appendChild(el("span", "hud-note", "simulated traffic · follows the lab's real firewall policy · click a machine"));
    host.appendChild(hud);

    var banner = el("div", "net-banner");
    host.appendChild(banner);

    var svg = sv("svg", { viewBox: "0 0 1000 640", class: "net-svg", role: "img",
      "aria-label": "Live map of the enterprise lab: WAN, pfSense firewall, DMZ with PROXY01 and WEB01, switch SW01, VLANs 10, 20 and 99, and the Suricata IDS." });
    var scroller = el("div", "net-scroll");            // phones: swipe the map at a readable size
    scroller.appendChild(svg);
    host.appendChild(scroller);
    var defs = sv("defs", {}, svg);
    var grad = sv("radialGradient", { id: "pk" }, defs);
    sv("stop", { offset: "0", "stop-color": "#fff", "stop-opacity": "1" }, grad);
    sv("stop", { offset: "1", "stop-color": "#fff", "stop-opacity": "0" }, grad);

    var gZones = sv("g", { class: "zones" }, svg);
    ZONES.forEach(function (z) {
      sv("rect", { x: z.x, y: z.y, width: z.w, height: z.h, rx: 14, class: "zone" }, gZones);
      var t = sv("text", { x: z.x + 12, y: z.y + 18, class: "zone-label" }, gZones); t.textContent = z.label;
    });

    var gLinks = sv("g", { class: "links" }, svg);
    var line = function (pts, cls) { sv("polyline", { points: pts.map(function (p) { return p.join(","); }).join(" "), class: cls }, gLinks); };
    line([[110, 250], [255, 250], [470, 250]], "link");
    line([[110, 92], [255, 92], [255, 250]], "link");
    line([[470, 250], [470, 165]], "link");
    line([[385, 86], [385, 165], [565, 165], [565, 86]], "link");
    line([[470, 250], [470, 395]], "link trunk");
    line([[470, 395], [470, 462]], "link");
    line([[130, 462], [880, 462]], "link bus");
    ["client", "client2", "srv", "dc", "admin", "wazuh"].forEach(function (id) {
      line([[NODES[id].x, 462], [NODES[id].x, 555]], "link" + (NODES[id].lab && labStatus(NODES[id].lab) === "todo" ? " ghost" : ""));
    });
    line([[565, 165], [840, 165], [840, 222]], "link mirror");
    line([[470, 327], [800, 327], [800, 278]], "link mirror");
    line([[880, 278], [880, 462]], "link mgmt");
    if (!mini) {
      var tl = sv("text", { x: 478, y: 322, class: "link-label" }, gLinks); tl.textContent = "trunk 10/20/99";
      var ml = sv("text", { x: 655, y: 158, class: "link-label" }, gLinks); ml.textContent = "span → IDS";
    }

    var gPk = sv("g", { class: "packets" }, svg);
    var gNodes = sv("g", { class: "nodes" }, svg);
    var gFx = sv("g", { class: "fx" }, svg);

    var nodeEls = {};
    Object.keys(NODES).forEach(function (id) {
      var n = NODES[id], w = n.w || 120, h = n.h || 50;
      var st = n.lab ? labStatus(n.lab) : "live";
      var g = sv("g", { class: "node k-" + (n.kind || "host") + " s-" + st, transform: "translate(" + n.x + "," + n.y + ")", tabindex: mini ? -1 : 0, "data-id": id }, gNodes);
      sv("rect", { x: -w / 2, y: -h / 2, width: w, height: h, rx: 10, class: "box" }, g);
      if (n.kind === "fw") sv("path", { d: "M0,-9 L8,-6 L8,1 C8,6 4,9 0,11 C-4,9 -8,6 -8,1 L-8,-6 Z", transform: "translate(" + (-w / 2 + 18) + ",0)", class: "icon" }, g);
      if (n.kind === "ids") {
        var eye = sv("g", { transform: "translate(" + (-w / 2 + 18) + ",0)", class: "icon" }, g);
        sv("path", { d: "M-9,0 Q0,-9 9,0 Q0,9 -9,0 Z" }, eye); sv("circle", { r: 3 }, eye);
      }
      var tx = n.kind === "fw" || n.kind === "ids" ? 10 : 0;
      var t1 = sv("text", { x: tx, y: n.ip ? -5 : -2, class: "n-label" }, g); t1.textContent = n.label;
      var t2 = sv("text", { x: tx, y: n.ip ? 9 : 12, class: "n-sub" }, g);
      t2.textContent = st === "todo" ? "lab " + n.lab + " · planned" : st === "wip" ? "lab " + n.lab + " · building" : n.sub;
      if (n.ip && st !== "todo") { var t3 = sv("text", { x: tx, y: 21, class: "n-ip" }, g); t3.textContent = n.ip; }
      sv("circle", { cx: w / 2 - 9, cy: -h / 2 + 9, r: 3.2, class: "led" }, g);
      if (id === "parrot" && attackPhase === "wip") g.classList.add("hunting");
      nodeEls[id] = g;
    });

    // ----- console -----
    var con = null;
    if (!mini) {
      con = el("div", "net-console");
      con.setAttribute("aria-hidden", "true");
      host.appendChild(con);
    }
    function log(cls, text) {
      if (!con) return;
      var row = el("div", "l-" + cls);
      row.appendChild(el("span", "l-time", clock()));
      row.appendChild(el("span", null, text));
      con.appendChild(row);
      while (con.children.length > 80) con.removeChild(con.firstChild);
      con.scrollTop = con.scrollHeight;
    }

    // ----- info card -----
    if (!mini) {
      var card = el("div", "net-card");
      card.hidden = true;
      host.appendChild(card);
      var showCard = function (id) {
        var n = NODES[id];
        card.innerHTML = "";
        var x = el("button", "net-card-x", "×"); x.setAttribute("aria-label", "Close");
        x.onclick = function () { card.hidden = true; };
        card.appendChild(x);
        card.appendChild(el("h3", null, n.label));
        card.appendChild(el("p", "nc-sub", [n.sub, n.ip, n.zone].filter(Boolean).join(" · ")));
        if (n.lab) card.appendChild(el("p", "nc-lab", "Roadmap lab " + n.lab + ": " + STATUS[labStatus(n.lab)]));
        if (n.info) card.appendChild(el("p", null, n.info));
        if (n.talks) card.appendChild(el("p", "nc-talks", n.talks));
        if (n.cfg && data) {
          var a = el("a", null, "view " + n.cfg + " →");
          a.href = data.url + "/blob/" + data.branch + "/" + n.cfg; a.target = "_blank"; a.rel = "noopener";
          card.appendChild(a);
        }
        card.hidden = false;
      };
      var STATUS = { done: "built", wip: "in progress", todo: "planned" };
      gNodes.addEventListener("click", function (e) { var g = e.target.closest(".node"); if (g) showCard(g.getAttribute("data-id")); });
      gNodes.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { var g = e.target.closest(".node"); if (g) { e.preventDefault(); showCard(g.getAttribute("data-id")); } }
      });
    }

    function flash(id, cls) {
      var g = nodeEls[id];
      if (!g) return;
      g.classList.remove(cls); void g.getBBox(); g.classList.add(cls);
      setTimeout(function () { g.classList.remove(cls); }, 650);
    }
    function burst(x, y, cls) {
      var c = sv("circle", { cx: x, cy: y, r: 4, class: "burst " + cls }, gFx);
      setTimeout(function () { c.remove(); }, 700);
    }

    if (REDUCE) {
      log("info", "reduced motion: the live traffic animation is paused");
      return;
    }

    // ----- packets -----
    var packets = [], running = false, raf = 0, last = 0, counts = { pass: 0, block: 0, alert: 0 };
    function bump(k, n) { counts[k] += n || 1; (k === "pass" ? cPass : k === "block" ? cBlock : cAlert).textContent = counts[k].toLocaleString(); }

    function launch(route, cls, speed, hooks) {
      var segs = [], total = 0;
      for (var i = 1; i < route.length; i++) {
        var L = Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]);
        segs.push(L); total += L;
      }
      var g = sv("g", { class: "pk " + cls }, gPk);
      sv("circle", { r: 9, class: "pk-glow", fill: "url(#pk)" }, g);
      sv("circle", { r: 3.6, class: "pk-core" }, g);
      packets.push({ route: route, segs: segs, total: total, d: 0, speed: speed, g: g, passed: 0, hooks: hooks || {} });
    }
    function place(p) {
      var d = p.d, i = 0;
      while (i < p.segs.length - 1 && d > p.segs[i]) { d -= p.segs[i]; i++; }
      var a = p.route[i], b = p.route[i + 1], k = p.segs[i] ? Math.min(1, d / p.segs[i]) : 1;
      p.g.setAttribute("transform", "translate(" + (a[0] + (b[0] - a[0]) * k).toFixed(1) + "," + (a[1] + (b[1] - a[1]) * k).toFixed(1) + ")");
      // waypoints passed so far
      var acc = 0, idx = 0;
      for (var j = 0; j < p.segs.length; j++) { acc += p.segs[j]; if (p.d >= acc) idx = j + 1; }
      while (p.passed < idx) { p.passed++; if (p.hooks.point) p.hooks.point(p.route[p.passed]); }
    }
    function frame(t) {
      var dt = Math.min(0.05, (t - last) / 1000); last = t;
      for (var i = packets.length - 1; i >= 0; i--) {
        var p = packets[i];
        p.d = Math.min(p.total, p.d + p.speed * dt);
        place(p);
        if (p.d >= p.total) { p.g.remove(); packets.splice(i, 1); if (p.hooks.arrive) p.hooks.arrive(); }
      }
      if (running) raf = requestAnimationFrame(frame);
    }

    function ipOf(id, leg) { return id === "inet" ? leg.pub : NODES[id].ip; }
    function sendLeg(leg, done) {
      leg.pub = leg.pub || pick(PUBLIC);
      var route = routeOf(leg.f, leg.t, leg.block);
      var cls = leg.bad ? "bad" : "ok";
      var sport = rnd(40000, 61000), proto = leg.proto || "tcp";
      var src = ipOf(leg.f, leg), dst = leg.t === "fw" ? NODES.fw.ip : ipOf(leg.t, leg);
      var dstTxt = dst + (leg.port ? ":" + leg.port : "") + "/" + proto;
      var mirrored = {};
      launch(route, cls, leg.bad ? 340 : 260, {
        point: function (pt) {
          if (pt[0] === 470 && pt[1] === 250 && !leg.block && IFACE[leg.f] !== IFACE[leg.t]) {
            flash("fw", "hit-ok"); bump("pass");
            log(leg.bad ? "warn" : "ok", "fw01  pass   " + IFACE[leg.f].padEnd(7) + " " + src + ":" + sport + " → " + dstTxt);
          }
          var tag = pt[2];
          if (tag && !mirrored[tag] && (leg.alert || Math.random() < 0.35)) {
            mirrored[tag] = 1;
            launch(MIRROR[tag]([pt[0], pt[1]]), leg.alert ? "alert" : "mir", 380, {
              arrive: function () {
                if (!leg.alert) return;
                flash("ids", "hit-alert"); bump("alert");
                log("alert", "ids01 [**] [" + (leg.sid || "1:2009358:7") + "] " + leg.alert + " [**] [Classification: " + (leg.cls || "Web Application Attack") + "] {TCP} " +
                  (leg.xff ? NODES.proxy.ip + ":" + sport + " → " + dstTxt.replace("/tcp", "") + "  xff=" + leg.xff : src + ":" + sport + " → " + dstTxt.replace("/tcp", "")));
              }
            });
          }
        },
        arrive: function () {
          if (leg.block) {
            flash("fw", "hit-block"); burst(470, 250, "b-red"); bump("block");
            log("bad", "fw01  block  " + IFACE[leg.f].padEnd(7) + " " + src + (proto === "icmp" ? "" : ":" + sport) + " → " + (proto === "icmp" ? "172.16.148.0/24 icmp echo" : dstTxt) + "  default deny");
          } else {
            flash(leg.t, leg.bad ? "hit-bad" : "hit-ok");
            if (IFACE[leg.f] === IFACE[leg.t] && leg.f !== "fw") { bump("pass"); log(leg.bad ? "warn" : "ok", "dmz   " + NODES[leg.f].label + " → " + NODES[leg.t].label + "  " + dstTxt + (leg.xff ? "  X-Forwarded-For: " + leg.xff : "")); }
          }
          if (done) done();
        }
      });
    }
    function runLegs(legs, onEnd) {
      var i = 0;
      (function next() {
        if (i >= legs.length) { if (onEnd) onEnd(); return; }
        var leg = legs[i++];
        var nextLeg = legs[i];
        if (nextLeg && nextLeg.chain) { sendLeg(leg, function () { i++; sendLeg(nextLeg); next(); }); }
        else { sendLeg(leg); setTimeout(next, leg.gap || 0); }
      })();
    }

    var attackBusy = false;
    function schedule() {
      if (!running) return;
      var r = Math.random();
      if (!attackBusy && attacks.length && r < (mini ? 0.12 : 0.16)) {
        var a = pick(attacks);
        attackBusy = true;
        banner.textContent = "▶ RED TEAM · " + a.title;
        banner.classList.add("on");
        log("attack", "──── " + a.title + " ────");
        runLegs(a.legs(), function () {
          setTimeout(function () { banner.classList.remove("on"); attackBusy = false; }, 1800);
        });
      } else if (r < 0.4) {
        var b = pick(BLOCKED);
        sendLeg({ f: b.f, t: b.t, port: b.port, block: true });
      } else {
        runLegs(pick(NORMAL)());
      }
    }
    var timer = 0;
    watchActive(host, function (on) {
      if (on === running) return;
      running = on;
      if (on) { last = performance.now(); raf = requestAnimationFrame(frame); timer = setInterval(schedule, mini ? 950 : 700); }
      else { cancelAnimationFrame(raf); clearInterval(timer); }
    });
    log("info", "lab online · " + Object.keys(NODES).filter(function (id) { return !NODES[id].lab || labStatus(NODES[id].lab) !== "todo"; }).length + " machines · " + attacks.length + " attack scenarios from the repo");
  }

  // ============================================================
  //  VISUAL 2: the AI agent's pipeline + replay of a real run
  // ============================================================
  var STAGES = [
    { id: "scope", t: "scope.yaml", s: "targets · exclude" },
    { id: "plan", t: "Planner", s: "rules + knowledge" },
    { id: "gate", t: "Approval", s: "autonomy tier" },
    { id: "sandbox", t: "Sandbox", s: "allow-list · argv" },
    { id: "kali", t: "Kali", s: "container firewall" },
    { id: "parse", t: "Parsers", s: "state · SQLite" },
    { id: "report", t: "Report", s: "findings" }
  ];
  var TOOLS = [
    { n: "nmap", tier: "low" }, { n: "host_discovery", tier: "low" }, { n: "whatweb", tier: "low" }, { n: "smb_enum", tier: "low" },
    { n: "smb_shares", tier: "low" }, { n: "nmap_nse", tier: "low" }, { n: "searchsploit", tier: "low" }, { n: "dns_axfr", tier: "low" },
    { n: "ffuf", tier: "medium" }, { n: "nikto", tier: "medium" }, { n: "run_command", tier: "shell" }, { n: "msf_exploit", tier: "exploit" },
    { n: "nmap 8.8.8.8", tier: "scope" }
  ];

  function pipeline(host, data, mini) {
    host.classList.add("pipe");
    if (mini) host.classList.add("mini");
    var replay = (data && data.replay) || [];
    var term;

    if (!mini) {
      var hud = el("div", "net-hud");
      var cRun = el("b", null, "0"), cWait = el("b", null, "0"), cDeny = el("b", null, "0"), cFind = el("b", null, "0");
      [["tool runs", cRun, "ok"], ["waiting for approval", cWait, "warn"], ["blocked (out of scope)", cDeny, "bad"], ["findings", cFind, "info"]].forEach(function (x) {
        var s = el("span", "hud-" + x[2]); s.appendChild(x[1]); s.appendChild(document.createTextNode(" " + x[0])); hud.appendChild(s);
      });
      host.appendChild(hud);

      var vertical = host.clientWidth < 620;
      var W = vertical ? 360 : 1000, H = vertical ? 720 : 250;
      var svg = sv("svg", { viewBox: "0 0 " + W + " " + H, class: "pipe-svg", role: "img", "aria-label": "Agent pipeline: scope, planner with a local LLM advisor, approval gate, sandbox, Kali container, parsers, report." });
      host.appendChild(svg);
      var pos = {};
      STAGES.forEach(function (s, i) { pos[s.id] = vertical ? [130, 70 + i * 96] : [72 + i * 142, 160]; });
      pos.llm = vertical ? [292, 166] : [214, 50];
      var trackPts = STAGES.map(function (s) { return pos[s.id]; });
      sv("polyline", { points: trackPts.map(function (p) { return p.join(","); }).join(" "), class: "link" }, svg);
      sv("polyline", { points: [pos.llm, pos.plan].map(function (p) { return p.join(","); }).join(" "), class: "link mirror" }, svg);
      var gTok = sv("g", {}, svg), gSt = sv("g", {}, svg);
      var stEl = {};
      STAGES.concat([{ id: "llm", t: "local LLM", s: "advises only" }]).forEach(function (s) {
        var g = sv("g", { class: "node stage" + (s.id === "llm" ? " k-ids" : s.id === "gate" ? " k-fw" : ""), transform: "translate(" + pos[s.id].join(",") + ")" }, gSt);
        sv("rect", { x: -58, y: -26, width: 116, height: 52, rx: 10, class: "box" }, g);
        var a = sv("text", { y: -3, class: "n-label" }, g); a.textContent = s.t;
        var b = sv("text", { y: 13, class: "n-sub" }, g); b.textContent = s.s;
        stEl[s.id] = g;
      });
      var bubble = sv("text", { x: pos.llm[0], y: pos.llm[1] - 36, class: "bubble" }, svg);

      var toks = [], waiting = 0;
      var spawn = function (tool) {
        var g = sv("g", { class: "tok t-" + tool.tier }, gTok);
        var w = Math.max(44, tool.n.length * 7 + 14);
        sv("rect", { x: -w / 2, y: -10, width: w, height: 20, rx: 10 }, g);
        var tt = sv("text", { y: 4 }, g); tt.textContent = tool.n;
        toks.push({ g: g, tool: tool, i: 0, k: 0, hold: 0 });
      };
      var flashSt = function (id, cls) { var g = stEl[id]; g.classList.remove(cls); void g.getBBox(); g.classList.add(cls); setTimeout(function () { g.classList.remove(cls); }, 600); };
      var lastT = performance.now(), running = false;
      var step = function (t) {
        var dt = Math.min(0.05, (t - lastT) / 1000); lastT = t;
        for (var j = toks.length - 1; j >= 0; j--) {
          var tk = toks[j];
          if (tk.hold > 0) { tk.hold -= dt; if (tk.hold <= 0 && tk.onRelease) { tk.onRelease(); tk.onRelease = null; } continue; }
          tk.k += dt * 1.6;
          if (tk.k >= 1) {
            tk.k = 0; tk.i++;
            var at = STAGES[tk.i] && STAGES[tk.i].id;
            if (at) flashSt(at, "hit-ok");
            if (at === "gate" && tk.tool.tier !== "low" && tk.tool.tier !== "scope") {
              tk.g.classList.add("held"); waiting++; cWait.textContent = waiting;
              tk.hold = tk.tool.tier === "medium" ? 0.9 : 2.4;
              tk.onRelease = function () { this.g.classList.remove("held"); this.g.classList.add("approved"); waiting--; cWait.textContent = waiting; }.bind(tk);
            }
            if (at === "sandbox" && tk.tool.tier === "scope") {
              flashSt("sandbox", "hit-block"); cDeny.textContent = +cDeny.textContent + 1;
              tk.g.classList.add("denied"); var dead = tk.g; setTimeout(function () { dead.remove(); }, 500);
              toks.splice(j, 1); continue;
            }
            if (at === "kali") { tk.hold = 0.35; cRun.textContent = +cRun.textContent + 1; }
            if (!at || tk.i >= STAGES.length - 1) {
              if (tk.i >= STAGES.length - 1) { if (Math.random() < 0.45) cFind.textContent = +cFind.textContent + 1; }
              tk.g.remove(); toks.splice(j, 1); continue;
            }
          }
          var a = pos[STAGES[tk.i].id], b = pos[STAGES[Math.min(tk.i + 1, STAGES.length - 1)].id];
          tk.g.setAttribute("transform", "translate(" + (a[0] + (b[0] - a[0]) * tk.k).toFixed(1) + "," + (a[1] + (b[1] - a[1]) * tk.k).toFixed(1) + ")");
        }
        if (running) requestAnimationFrame(step);
      };
      var tick2 = 0, timer2 = 0;
      var sched = function () {
        tick2++;
        if (tick2 % 7 === 0) {
          var sug = pick(["nmap_nse smb-vuln-*", "nikto on :80", "smb_shares anonymous", "searchsploit samba 2.2"]);
          bubble.textContent = "LLM: try " + sug;
          bubble.classList.remove("on"); void bubble.getBBox(); bubble.classList.add("on");
          flashSt("llm", "hit-alert");
        }
        if (toks.length < 7) spawn(Math.random() < 0.72 ? pick(TOOLS.slice(0, 8)) : pick(TOOLS.slice(8)));
      };
      if (!REDUCE) {
        watchActive(svg, function (on) {
          if (on === running) return;
          running = on;
          if (on) { lastT = performance.now(); requestAnimationFrame(step); timer2 = setInterval(sched, 900); }
          else clearInterval(timer2);
        });
      }
    }

    // terminal replay of the real fixture run
    term = el("div", "term replay");
    var bar = el("div", "term-bar");
    bar.innerHTML = "<i></i><i></i><i></i>";
    bar.appendChild(el("span", null, mini ? "recon-agent · replay" : "replay · tests/fixtures/run25 (a real run against a Kioptrix lab VM)"));
    term.appendChild(bar);
    var screen = el("pre", "term-screen");
    term.appendChild(screen);
    host.appendChild(term);
    if (!replay.length) { screen.textContent = "(no replay data yet)"; return; }

    var lineCls = function (l) {
      if (/^\[\+\]|\bopen\b/.test(l)) return "g";
      if (/^\[-\]|refused|denied/.test(l)) return "r";
      if (/^\[\*\]/.test(l)) return "b";
      if (/excellent/.test(l)) return "y";
      if (/^\||^\s+\\_|^ =+|^=+/.test(l)) return "f";
      return "";
    };
    var addLine = function (text, cls) {
      var s = el("span", cls ? "c-" + cls : null, text + "\n");
      screen.appendChild(s);
      while (screen.childNodes.length > (mini ? 9 : 400)) screen.removeChild(screen.firstChild);
      screen.scrollTop = screen.scrollHeight;
      return s;
    };
    if (REDUCE) {
      replay.forEach(function (r) { addLine("kali@recon-agent:~$ " + r.cmd, "p"); r.lines.slice(0, 12).forEach(function (l) { addLine(l, lineCls(l)); }); });
      return;
    }
    var seg = 0, li = 0, typing = null, active = false, pending = false;
    var go = function () {
      if (!active) { pending = true; return; }
      var r = replay[seg];
      if (typing === null) {
        typing = addLine("", "p");
        var full = "kali@recon-agent:~$ " + r.cmd, c = 0;
        (function type() {
          typing.textContent = full.slice(0, ++c) + (c < full.length ? "▋" : "") + "\n";
          if (c < full.length) setTimeout(type, mini ? 30 : 38); else setTimeout(go, 350);
        })();
        return;
      }
      if (li < r.lines.length) {
        var l = r.lines[li++];
        addLine(l, lineCls(l));
        setTimeout(go, mini ? 140 : 55 + Math.random() * 60);
      } else {
        seg = (seg + 1) % replay.length; li = 0; typing = null;
        setTimeout(go, 1600);
      }
    };
    watchActive(term, function (on) { active = on; if (on && pending) { pending = false; go(); } });
    go();
  }

  // ============================================================
  //  VISUAL 3: the detection stream (real requests, real scores)
  // ============================================================
  var DET = ["rules", "Coraza", "payload ML", "behavior"];
  function stream(host, data, mini) {
    host.classList.add("stream");
    if (mini) host.classList.add("mini");
    var sample = data && data.sample;
    if (!sample || !sample.rows.length) { host.appendChild(el("p", "muted", "(no dataset yet)")); return; }
    var rows = sample.rows, threshold = 0.5, speed = 1, seen = [], idx = 0, playing = true;

    var wire = el("div", "st-wire");
    var board = null, tf = null;
    if (!mini) {
      var ctl = el("div", "st-ctl");
      var play = el("button", "st-btn", "❚❚ pause");
      play.onclick = function () { playing = !playing; play.textContent = playing ? "❚❚ pause" : "▶ play"; };
      ctl.appendChild(play);
      [1, 4, 20].forEach(function (x) {
        var b = el("button", "st-btn" + (x === 1 ? " on" : ""), x + "×");
        b.onclick = function () { speed = x; $$(".st-speed", ctl).forEach(function (o) { o.classList.remove("on"); }); b.classList.add("on"); };
        b.classList.add("st-speed");
        ctl.appendChild(b);
      });
      var lab = el("label", "st-th");
      tf = el("b", null, "0.50");
      var slider = el("input"); slider.type = "range"; slider.min = "0.05"; slider.max = "0.95"; slider.step = "0.05"; slider.value = "0.5";
      slider.setAttribute("aria-label", "alert threshold");
      slider.oninput = function () { threshold = +slider.value; tf.textContent = threshold.toFixed(2); score(); };
      lab.appendChild(document.createTextNode("alert threshold "));
      lab.appendChild(tf);
      lab.appendChild(slider);
      ctl.appendChild(lab);
      host.appendChild(ctl);

      var body = el("div", "st-body");
      var head = el("div", "st-row st-head");
      ["request", "rules", "Coraza", "payload ML", "behavior", "fused risk", "truth"].forEach(function (h) { head.appendChild(el("span", null, h)); });
      wire.appendChild(head);
      body.appendChild(wire);
      board = el("aside", "st-board");
      body.appendChild(board);
      host.appendChild(body);
      host.appendChild(el("p", "st-note", "Replaying " + rows.length + " of the " + sample.total.toLocaleString() + " requests in data/dataset.csv (" +
        sample.attacks.toLocaleString() + " attacks), each with the four detectors' real outputs, fused with the project's noisy-OR. Move the threshold to re-decide everything live."));
    } else host.appendChild(wire);

    function score() {
      if (!board) return;
      var tp = 0, fp = 0, fn = 0, tn = 0, byType = {};
      seen.forEach(function (r) {
        var f = r.r >= threshold;
        if (r.a) { byType[r.a] = byType[r.a] || [0, 0]; byType[r.a][1]++; if (f) { tp++; byType[r.a][0]++; } else fn++; }
        else if (f) fp++; else tn++;
      });
      var pct = function (a, b) { return b ? Math.round(a / b * 100) + "%" : "–"; };
      board.innerHTML = "";
      var big = el("div", "st-big");
      [["recall", pct(tp, tp + fn)], ["precision", pct(tp, tp + fp)], ["false alarms", String(fp)]].forEach(function (x) {
        var d = el("div"); d.appendChild(el("b", null, x[1])); d.appendChild(el("span", null, x[0])); big.appendChild(d);
      });
      board.appendChild(big);
      board.appendChild(el("p", "st-cm", "caught " + tp + " · missed " + fn + " · false alarm " + fp + " · normal " + tn));
      Object.keys(byType).sort().forEach(function (k) {
        var row = el("div", "st-type");
        row.appendChild(el("span", null, k.replace(/_/g, " ")));
        var b = el("span", "bar"); var i = el("i"); i.style.width = (byType[k][0] / byType[k][1] * 100) + "%"; b.appendChild(i); row.appendChild(b);
        row.appendChild(el("span", "n", byType[k][0] + "/" + byType[k][1]));
        board.appendChild(row);
      });
    }

    function cell(v) {
      var c = el("span", "st-cell" + (v >= 0.5 ? " hot" : v > 0.15 ? " warm" : ""));
      var i = el("i"); i.style.width = Math.max(2, v * 100) + "%"; c.appendChild(i);
      c.title = v.toFixed(2);
      return c;
    }
    function push() {
      var r = rows[idx]; idx = (idx + 1) % rows.length;
      if (idx === 0) seen = [];
      seen.push(r);
      var flagged = r.r >= threshold;
      var row = el("div", "st-row enter" + (flagged ? " flag" : "") + (r.a && !flagged ? " miss" : "") + (!r.a && flagged ? " fa" : ""));
      var req = el("span", "st-req");
      req.appendChild(el("b", "m-" + r.m, r.m));
      req.appendChild(document.createTextNode(" " + r.p + (r.b && !mini ? "  " + r.b : "")));
      row.appendChild(req);
      if (!mini) r.s.forEach(function (v) { row.appendChild(cell(v)); });
      var risk = el("span", "st-risk" + (flagged ? " hot" : ""));
      var bar = el("i"); bar.style.width = Math.max(3, r.r * 100) + "%"; risk.appendChild(bar);
      risk.appendChild(el("em", null, r.r.toFixed(2)));
      row.appendChild(risk);
      if (!mini) row.appendChild(el("span", "st-truth" + (r.a ? " atk" : ""), r.a ? r.a.replace(/_/g, " ") + (flagged ? " ✓" : " ✗ missed") : flagged ? "normal · false alarm" : "normal"));
      var headRow = $(".st-head", wire);
      wire.insertBefore(row, headRow ? headRow.nextSibling : wire.firstChild);
      requestAnimationFrame(function () { row.classList.remove("enter"); });
      var max = mini ? 5 : 13;
      var all = $$(".st-row:not(.st-head)", wire);
      for (var k = max; k < all.length; k++) all[k].remove();
      score();
    }
    if (REDUCE) { for (var z = 0; z < (mini ? 5 : 13); z++) push(); return; }
    var acc = 0, lastT = performance.now(), active = false;
    function loop(t) {
      var dt = t - lastT; lastT = t;
      if (playing) {
        acc += dt * speed;
        var per = mini ? 1100 : 850;
        var n = 0;
        while (acc >= per && n < 30) { acc -= per; push(); n++; }
        if (n >= 30) acc = 0;
      }
      if (active) requestAnimationFrame(loop);
    }
    watchActive(host, function (on) {
      if (on === active) return;
      active = on;
      if (on) { lastT = performance.now(); requestAnimationFrame(loop); }
    });
    for (var w = 0; w < (mini ? 3 : 6); w++) push();
  }

  // ---------- mount ----------
  var VIS = { network: network, pipeline: pipeline, stream: stream };
  if (page) {
    var host = $("#viz");
    loadData(page.getAttribute("data-live"), page.getAttribute("data-ver")).then(function (d) {
      if (host && VIS[page.getAttribute("data-visual")]) VIS[page.getAttribute("data-visual")](host, d, false);
    });
  }
  $$("[data-mini]").forEach(function (box) {
    onVisible(box, function () {
      loadData(box.getAttribute("data-id")).then(function (d) {
        var fn = VIS[box.getAttribute("data-mini")];
        if (fn) fn(box, d, true);
      });
    });
  });

  // ---------- home ticker: duplicate the track so the marquee loops seamlessly ----------
  var tk = $("#ticker");
  if (tk && !REDUCE) tk.innerHTML += tk.innerHTML;
})();

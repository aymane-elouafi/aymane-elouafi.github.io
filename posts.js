// ===== YOUR POSTS =====
// To add a post:
//   1. Write your notes in Markdown and save them in the posts folder (ex: posts/my-notes.md)
//   2. Add a block at the TOP of this list
//
//   id     = the file name without ".md"
//   tags   = words that help you find the post with the search bar
//   series = (optional) posts with the same series name are linked together
const posts = [
  {
    id: "nfs",
    title: "Footprinting NFS",
    date: "2026-10-14",
    series: "Footprinting Services",
    tags: ["htb", "footprinting", "nfs", "enumeration", "privesc"],
    description: "How NFS works, its dangerous settings, how to enumerate and mount shares, and abusing UID trust with a SUID shell.",
  },
  {
    id: "nmap",
    title: "Network Enumeration with Nmap",
    date: "2026-10-11",
    tags: ["htb", "nmap", "enumeration", "pentest"],
    description: "My notes from the HTB Academy Nmap module: host discovery, port scanning, service enumeration, NSE and firewall evasion.",
  },
];

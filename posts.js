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
    id: "cap",
    title: "Cap - HTB Walkthrough",
    date: "2026-10-19",
    tags: ["htb", "walkthrough", "linux", "idor", "wireshark", "capabilities", "privesc"],
    description: "Easy Linux box: IDOR to grab a pcap, FTP creds in clear text, SSH as nathan, then root through python3.8 with cap_setuid.",
  },
  {
    id: "ftp",
    title: "Footprinting FTP",
    date: "2026-10-15",
    series: "Footprinting Services",
    tags: ["htb", "footprinting", "ftp", "tftp", "vsftpd", "enumeration"],
    description: "How FTP and TFTP work, vsFTPd config and dangerous settings, anonymous login, downloading/uploading files and enumerating with Nmap and openssl.",
  },
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

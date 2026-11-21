### RDP (Remote Desktop Protocol)

**What it is:** RDP is Microsoft's protocol for **remote GUI access** to a Windows machine — it transmits the display and your control commands (keyboard/mouse) over the network, encrypted, so you're effectively sitting at the remote desktop. In the TCP/IP model it lives at the **application layer** and normally uses **TCP port 3389** (the connectionless **UDP 3389** can also be used for remote administration). This is one of the first things you look for on a Windows target, because a working RDP login often gives you a full interactive desktop.

**Reaching it across networks:** for an RDP session to work, **both the network firewall and the server's own firewall must allow the inbound connection**. When **NAT** sits between client and server (the usual case over the internet, where many internal hosts share one public IP), the client has to target the **public IP**, and the NAT router needs **port forwarding** set up toward the internal RDP server. (This is just the general NAT/port-forwarding idea applied to 3389 — the server isn't directly reachable unless the router is told to pass 3389 through to it.)

**Encryption — and why it's often weak (the attack-relevant part):**

- Since **Windows Vista**, RDP can use **TLS/SSL**, which properly encrypts everything, especially the login. Good.
- **But** many Windows systems don't _insist_ on TLS — they still accept the weaker legacy **"RDP Security"** encryption. So you can't assume a given server is using strong crypto.
- Even with TLS, there's a catch: the identity certificates are **self-signed by default**. A self-signed cert means the client has no trusted authority to check it against, so it **can't tell a real cert from a forged one** — it just throws a certificate warning at the user. Users are trained to click through those warnings, which is exactly what makes **man-in-the-middle** attacks on RDP viable: an attacker interposing their own self-signed cert produces the same warning a legit server would, and the user clicks "yes" either way.

**Default install:** the Remote Desktop service ships **built into Windows servers** — no extra software needed. It's turned on via **Server Manager**, and by default only allows connections from clients supporting **Network Level Authentication (NLA)**. NLA means the user must authenticate _before_ a full session is established, which is more secure (it blocks pre-auth resource use and some DoS/exploit vectors) — so whether NLA is on tells you a lot about how hardened the target is.

#### Footprinting RDP

Scanning 3389 quickly reveals whether **NLA** is enabled, the **product version**, and the **hostname**:

```sh
aymane0x90@htb[/htb]$ nmap -sV -sC 10.129.201.248 -p3389 --script rdp*

Starting Nmap 7.92 ( https://nmap.org ) at 2021-11-06 15:45 CET
Nmap scan report for 10.129.201.248
Host is up (0.036s latency).

PORT     STATE SERVICE       VERSION
3389/tcp open  ms-wbt-server Microsoft Terminal Services
| rdp-enum-encryption: 
|   Security layer
|     CredSSP (NLA): SUCCESS
|     CredSSP with Early User Auth: SUCCESS
|_    RDSTLS: SUCCESS
| rdp-ntlm-info: 
|   Target_Name: ILF-SQL-01
|   NetBIOS_Domain_Name: ILF-SQL-01
|   NetBIOS_Computer_Name: ILF-SQL-01
|   DNS_Domain_Name: ILF-SQL-01
|   DNS_Computer_Name: ILF-SQL-01
|   Product_Version: 10.0.17763
|_  System_Time: 2021-11-06T13:46:00+00:00
Service Info: OS: Windows; CPE: cpe:/o:microsoft:windows

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 8.26 seconds
```

Reading it: `-sV` fingerprints the service version, `-sC` runs default scripts, and `--script rdp*` runs all the RDP-specific NSE scripts. The output tells you **CredSSP (NLA) is supported**, the **product version 10.0.17763** (which maps to a specific Windows build → known vulns), and the **hostname `ILF-SQL-01`** (leaked via the NTLM info — useful for building a target picture).

**OPSEC warning (important for real/hardened engagements):** using `--packet-trace` you can watch the actual packets, and you'll see Nmap sends an **RDP cookie `mstshash=nmap`**:

```sh
aymane0x90@htb[/htb]$ nmap -sV -sC 10.129.201.248 -p3389 --packet-trace --disable-arp-ping -n

Starting Nmap 7.92 ( https://nmap.org ) at 2021-11-06 16:23 CET
SENT (0.2506s) ICMP [10.10.14.20 > 10.129.201.248 Echo request (type=8/code=0) id=8338 seq=0] IP [ttl=53 id=5122 iplen=28 ]
SENT (0.2507s) TCP 10.10.14.20:55516 > 10.129.201.248:443 S ttl=42 id=24195 iplen=44  seq=1926233369 win=1024 <mss 1460>
SENT (0.2507s) TCP 10.10.14.20:55516 > 10.129.201.248:80 A ttl=55 id=50395 iplen=40  seq=0 win=1024
SENT (0.2517s) ICMP [10.10.14.20 > 10.129.201.248 Timestamp request (type=13/code=0) id=8247 seq=0 orig=0 recv=0 trans=0] IP [ttl=38 id=62695 iplen=40 ]
RCVD (0.2814s) ICMP [10.129.201.248 > 10.10.14.20 Echo reply (type=0/code=0) id=8338 seq=0] IP [ttl=127 id=38158 iplen=28 ]
SENT (0.3264s) TCP 10.10.14.20:55772 > 10.129.201.248:3389 S ttl=56 id=274 iplen=44  seq=2635590698 win=1024 <mss 1460>
RCVD (0.3565s) TCP 10.129.201.248:3389 > 10.10.14.20:55772 SA ttl=127 id=38162 iplen=44  seq=3526777417 win=64000 <mss 1357>
NSOCK INFO [0.4500s] nsock_iod_new2(): nsock_iod_new (IOD #1)
NSOCK INFO [0.4500s] nsock_connect_tcp(): TCP connection requested to 10.129.201.248:3389 (IOD #1) EID 8
NSOCK INFO [0.4820s] nsock_trace_handler_callback(): Callback: CONNECT SUCCESS for EID 8 [10.129.201.248:3389]
Service scan sending probe NULL to 10.129.201.248:3389 (tcp)
NSOCK INFO [0.4830s] nsock_read(): Read request from IOD #1 [10.129.201.248:3389] (timeout: 6000ms) EID 18
NSOCK INFO [6.4880s] nsock_trace_handler_callback(): Callback: READ TIMEOUT for EID 18 [10.129.201.248:3389]
Service scan sending probe TerminalServerCookie to 10.129.201.248:3389 (tcp)
NSOCK INFO [6.4880s] nsock_write(): Write request for 42 bytes to IOD #1 EID 27 [10.129.201.248:3389]
NSOCK INFO [6.4880s] nsock_read(): Read request from IOD #1 [10.129.201.248:3389] (timeout: 5000ms) EID 34
NSOCK INFO [6.4880s] nsock_trace_handler_callback(): Callback: WRITE SUCCESS for EID 27 [10.129.201.248:3389]
NSOCK INFO [6.5240s] nsock_trace_handler_callback(): Callback: READ SUCCESS for EID 34 [10.129.201.248:3389] (19 bytes): .........4.........
Service scan match (Probe TerminalServerCookie matched with TerminalServerCookie line 13640): 10.129.201.248:3389 is ms-wbt-server.  Version: |Microsoft Terminal Services|||

...SNIP...

NSOCK INFO [6.5610s] nsock_write(): Write request for 54 bytes to IOD #1 EID 27 [10.129.201.248:3389]
NSE: TCP 10.10.14.20:36630 > 10.129.201.248:3389 | 00000000: 03 00 00 2a 25 e0 00 00 00 00 00 43 6f 6f 6b 69    *%      Cooki
00000010: 65 3a 20 6d 73 74 73 68 61 73 68 3d 6e 6d 61 70 e: mstshash=nmap
00000020: 0d 0a 01 00 08 00 0b 00 00 00  

...SNIP...

NSOCK INFO [6.6820s] nsock_write(): Write request for 57 bytes to IOD #2 EID 67 [10.129.201.248:3389]
NSOCK INFO [6.6820s] nsock_trace_handler_callback(): Callback: WRITE SUCCESS for EID 67 [10.129.201.248:3389]
NSE: TCP 10.10.14.20:36630 > 10.129.201.248:3389 | SEND
NSOCK INFO [6.6820s] nsock_read(): Read request from IOD #2 [10.129.201.248:3389] (timeout: 5000ms) EID 74
NSOCK INFO [6.7180s] nsock_trace_handler_callback(): Callback: READ SUCCESS for EID 74 [10.129.201.248:3389] (211 bytes)
NSE: TCP 10.10.14.20:36630 < 10.129.201.248:3389 | 
00000000: 30 81 d0 a0 03 02 01 06 a1 81 c8 30 81 c5 30 81 0          0  0
00000010: c2 a0 81 bf 04 81 bc 4e 54 4c 4d 53 53 50 00 02        NTLMSSP
00000020: 00 00 00 14 00 14 00 38 00 00 00 35 82 8a e2 b9        8   5
00000030: 73 b0 b3 91 9f 1b 0d 00 00 00 00 00 00 00 00 70 s              p
00000040: 00 70 00 4c 00 00 00 0a 00 63 45 00 00 00 0f 49  p L     cE    I
00000050: 00 4c 00 46 00 2d 00 53 00 51 00 4c 00 2d 00 30  L F - S Q L - 0
00000060: 00 31 00 02 00 14 00 49 00 4c 00 46 00 2d 00 53  1     I L F - S
00000070: 00 51 00 4c 00 2d 00 30 00 31 00 01 00 14 00 49  Q L - 0 1     I
00000080: 00 4c 00 46 00 2d 00 53 00 51 00 4c 00 2d 00 30  L F - S Q L - 0
00000090: 00 31 00 04 00 14 00 49 00 4c 00 46 00 2d 00 53  1     I L F - S
000000a0: 00 51 00 4c 00 2d 00 30 00 31 00 03 00 14 00 49  Q L - 0 1     I
000000b0: 00 4c 00 46 00 2d 00 53 00 51 00 4c 00 2d 00 30  L F - S Q L - 0
000000c0: 00 31 00 07 00 08 00 1d b3 e8 f2 19 d3 d7 01 00  1
000000d0: 00 00 00

...SNIP...
```

That literal `mstshash=nmap` string is a **signature** — threat hunters and security tooling (EDR = Endpoint Detection and Response) can match on it and **lock you out** of a hardened network. So the lesson isn't just "here's a scan," it's that default tooling leaves fingerprints, and on a real engagement you may need to be quieter. (`--disable-arp-ping -n` just stops ARP discovery and DNS resolution so the trace is cleaner/less noisy.)

**rdp-sec-check.pl** — a Perl script from Cisco CX Security Labs that **unauthenticated-ly identifies an RDP server's security settings** from the handshake. Install its dependency via CPAN, then run it:

```sh
aymane0x90@htb[/htb]$ sudo cpan

Loading internal logger. Log::Log4perl recommended for better logging

CPAN.pm requires configuration, but most of it can be done automatically.
If you answer 'no' below, you will enter an interactive dialog for each
configuration option instead.

Would you like to configure as much as possible automatically? [yes] yes


Autoconfiguration complete.

commit: wrote '/root/.cpan/CPAN/MyConfig.pm'

You can re-run configuration any time with 'o conf init' in the CPAN shell

cpan shell -- CPAN exploration and modules installation (v2.27)
Enter 'h' for help.


cpan[1]> install Encoding::BER

Fetching with LWP:
http://www.cpan.org/authors/01mailrc.txt.gz
Reading '/root/.cpan/sources/authors/01mailrc.txt.gz'
............................................................................DONE
...SNIP...

```

```sh
aymane0x90@htb[/htb]$ git clone https://github.com/CiscoCXSecurity/rdp-sec-check.git && cd rdp-sec-check
aymane0x90@htb[/htb]$ ./rdp-sec-check.pl 10.129.201.248

Starting rdp-sec-check v0.9-beta ( http://labs.portcullis.co.uk/application/rdp-sec-check/ ) at Sun Nov  7 16:50:32 2021

[+] Scanning 1 hosts

Target:    10.129.201.248
IP:        10.129.201.248
Port:      3389

[+] Checking supported protocols

[-] Checking if RDP Security (PROTOCOL_RDP) is supported...Not supported - HYBRID_REQUIRED_BY_SERVER
[-] Checking if TLS Security (PROTOCOL_SSL) is supported...Not supported - HYBRID_REQUIRED_BY_SERVER
[-] Checking if CredSSP Security (PROTOCOL_HYBRID) is supported [uses NLA]...Supported

[+] Checking RDP Security Layer

[-] Checking RDP Security Layer with encryption ENCRYPTION_METHOD_NONE...Not supported
[-] Checking RDP Security Layer with encryption ENCRYPTION_METHOD_40BIT...Not supported
[-] Checking RDP Security Layer with encryption ENCRYPTION_METHOD_128BIT...Not supported
[-] Checking RDP Security Layer with encryption ENCRYPTION_METHOD_56BIT...Not supported
[-] Checking RDP Security Layer with encryption ENCRYPTION_METHOD_FIPS...Not supported

[+] Summary of protocol support

[-] 10.129.201.248:3389 supports PROTOCOL_SSL   : FALSE
[-] 10.129.201.248:3389 supports PROTOCOL_HYBRID: TRUE
[-] 10.129.201.248:3389 supports PROTOCOL_RDP   : FALSE

[+] Summary of RDP encryption support

[-] 10.129.201.248:3389 supports ENCRYPTION_METHOD_NONE   : FALSE
[-] 10.129.201.248:3389 supports ENCRYPTION_METHOD_40BIT  : FALSE
[-] 10.129.201.248:3389 supports ENCRYPTION_METHOD_128BIT : FALSE
[-] 10.129.201.248:3389 supports ENCRYPTION_METHOD_56BIT  : FALSE
[-] 10.129.201.248:3389 supports ENCRYPTION_METHOD_FIPS   : FALSE

[+] Summary of security issues


rdp-sec-check v0.9-beta completed at Sun Nov  7 16:50:33 2021

```

The useful read here: this server **requires HYBRID (CredSSP/NLA)** and refuses the weaker RDP/SSL-only layers — i.e. it's configured relatively securely. On a weaker target you'd see `ENCRYPTION_METHOD_NONE` or `40BIT` supported, which flags it as misconfigured.

#### Connecting to RDP

From Linux you connect with **xfreerdp**, **rdesktop**, or **Remmina** (GUI). Using xfreerdp:

```shellsession
aymane0x90@htb[/htb]$ xfreerdp /u:cry0l1t3 /p:"P455w0rd!" /v:10.129.201.248
```

`/u:` = username, `/p:` = password, `/v:` = the target host. Notice the connection throws the exact **self-signed cert warning** discussed above:

```
[WARN][com.freerdp.crypto] - Certificate verification failure 'self signed certificate (18)'
[ERROR][com.freerdp.crypto] - @           WARNING: CERTIFICATE NAME MISMATCH!           @
        Common Name: ILF-SQL-01
        Subject:     CN = ILF-SQL-01
        Issuer:      CN = ILF-SQL-01
Do you trust the above certificate? (Y/T/N) y
```

The CN, Subject, and **Issuer are all the same host** (`ILF-SQL-01`) — that's the tell-tale sign of a self-signed cert (a real CA-issued cert would have a different Issuer). You answer `y`, and after authentication a window opens with the remote desktop.

---

### WinRM (Windows Remote Management)

**What it is:** WinRM is Windows' built-in **command-line-based** remote management protocol. Unlike RDP (graphical), WinRM is about **remote command execution and management sessions**. It uses **SOAP** (Simple Object Access Protocol) to connect to remote hosts and their applications.

**Ports:** **TCP 5985 (HTTP)** and **TCP 5986 (HTTPS)**. Historically ports 80/443 were used, but 80 was commonly blocked for security, so WinRM moved to the dedicated 5985/5986. In practice you'll **very often see only 5985 (HTTP, unencrypted)** enabled rather than 5986.

**Enablement:** from **Windows 10** onward WinRM must be **explicitly enabled and configured** (it's off by default on clients). On **Windows Server 2012+** it's **enabled by default**; older servers/clients need it configured plus firewall exceptions. Services like **remote PowerShell sessions** and event-log merging rely on WinRM. A companion tool, **WinRS (Windows Remote Shell)**, runs arbitrary commands on the remote host (included by default even on Windows 7).

#### Footprinting WinRM

Scan the two ports:

```sh
aymane0x90@htb[/htb]$ nmap -sV -sC 10.129.201.248 -p5985,5986 --disable-arp-ping -n

Starting Nmap 7.92 ( https://nmap.org ) at 2021-11-06 16:31 CET
Nmap scan report for 10.129.201.248
Host is up (0.030s latency).

PORT     STATE SERVICE VERSION
5985/tcp open  http    Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-title: Not Found
|_http-server-header: Microsoft-HTTPAPI/2.0
Service Info: OS: Windows; CPE: cpe:/o:microsoft:windows

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 7.34 seconds

```

`Microsoft HTTPAPI httpd 2.0` on 5985 is the classic WinRM-over-HTTP fingerprint.

**Checking reachability / connecting:**

- From **Windows/PowerShell**, the **`Test-WsMan`** cmdlet tells you whether a host is reachable via WinRM (you pass it the hostname).
- From **Linux**, the go-to tool is **evil-winrm**. Given valid credentials it drops you into a remote PowerShell shell:

```sh
aymane0x90@htb[/htb]$ evil-winrm -i 10.129.201.248 -u Cry0l1t3 -p P455w0rD!

Evil-WinRM shell v3.3

Warning: Remote path completions is disabled due to ruby limitation: quoting_detection_proc() function is unimplemented on this machine

Data: For more information, check Evil-WinRM Github: https://github.com/Hackplayers/evil-winrm#Remote-path-completion

Info: Establishing connection to remote endpoint

*Evil-WinRM* PS C:\Users\Cry0l1t3\Documents>

```

`-i` = target IP, `-u`/`-p` = credentials. That `*Evil-WinRM* PS C:\...>` prompt means you have an interactive remote PowerShell session — a hugely common way to operate on Windows targets once you have creds.

---

### WMI (Windows Management Instrumentation)

**What it is:** WMI is Microsoft's implementation (and extension) of the **CIM** (Common Information Model), itself the core of the standardized **WBEM** (Web-Based Enterprise Management) framework. In plain terms: WMI gives **read and write access to almost every setting on a Windows system**. That near-total reach is why it's described as the **most critical interface** for administering and remotely maintaining Windows machines — PCs and servers alike — and equally why it's such a powerful tool (and target) for attackers.

**How it's accessed:** via **PowerShell**, **VBScript**, or the **WMIC** console. WMI isn't one program — it's a collection of programs and databases (called **repositories**).

#### Footprinting WMI

**Ports:** WMI communication **always initializes on TCP 135**, then, once the connection is established, **moves to a random high port**. (That "start on 135, jump to a dynamic port" behavior is the RPC/DCOM pattern — worth remembering because it affects how you firewall or scan for it.)

**Executing commands via WMI** — the Impacket toolkit's **wmiexec.py** is the standard way from Linux:

```sh
aymane0x90@htb[/htb]$ /usr/share/doc/python3-impacket/examples/wmiexec.py Cry0l1t3:"P455w0rD!"@10.129.201.248 "hostname"

Impacket v0.9.22 - Copyright 2020 SecureAuth Corporation

[*] SMBv3.0 dialect used
ILF-SQL-01

```

The syntax is `user:"password"@target "command"` — here it runs `hostname` on the remote box and gets back `ILF-SQL-01`. This gives you **remote command execution** using WMI, and it's a favorite for **lateral movement** because it's built into Windows and often blends into normal admin traffic.

---

**Module's own advice (worth heeding):** reading about these services isn't a substitute for hands-on experience. The strong recommendation is to **stand up your own Windows Server VM**, enable and configure RDP/WinRM/WMI yourself, tweak their settings, and **re-scan them repeatedly** to see how the footprinting output changes. Seeing the difference between NLA on vs off, HTTP vs HTTPS WinRM, etc., from the admin's side is what makes the attacker's side make sense. 

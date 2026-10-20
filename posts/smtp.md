**What SMTP is**

- **SMTP (Simple Mail Transfer Protocol)** = the protocol for **sending** emails across an IP network.
- Used in two places: between an **email client → outgoing mail server**, and between **two mail servers**.
- It only *sends*. To **fetch/read** emails you use **IMAP or POP3** — SMTP is usually paired with one of those.
- Client-server based, but note: when two servers talk, one server acts as the "client."

**Ports**

- **Port 25** — the default, classic SMTP port (server-to-server).
- **Port 587** — modern port for mail from **authenticated** users; uses **STARTTLS** to upgrade a plaintext connection to encrypted mid-session.
- **Port 465** — SMTP over SSL/TLS (encrypted from the start).

**How a send works (basic flow)**

1. Client authenticates (username + password).
2. Client sends the server: sender address, recipient address, email content, etc.
3. Connection closes.
4. The server then forwards the email on toward the next SMTP server.

**The security problem**

- **Plain SMTP is clear-text** — commands, data, and login credentials all travel readable over the network unless SSL/TLS is added.
- **No sender verification by default** — nobody checks that the sender address is real, so senders can be **faked (mail spoofing)**.

**The mail server components (the chain) — this is the important part**

- **MUA (Mail User Agent)** = the email client (e.g. Outlook). Splits the mail into a **header** + **body** and uploads it.
- **MSA (Mail Submission Agent)** = checks the email's **validity/origin** before it's sent on. Also called a **Relay server**.
- **MTA (Mail Transfer Agent)** = the core software that **sends and receives** email; checks size/spam, stores it, then looks up the recipient server's IP in **DNS**.
- **MDA (Mail Delivery Agent)** = drops the final email into the **recipient's mailbox** (where POP3/IMAP then reads it).
- **Full chain:** `MUA → MSA → MTA → MDA → Mailbox (POP3/IMAP)`

**The attack to remember: Open Relay**

- A misconfigured MSA/MTA that forwards mail for **anyone**, not just its own authorized users, is an **open relay**.
- Attackers abuse open relays to **send mass spam with fake sender addresses** and stay untraceable.

**Two built-in weaknesses of SMTP**

1. **No reliable delivery confirmation** — the protocol technically allows it but doesn't standardize it, so you usually just get a plain English error message if it fails.
2. **No sender authentication** — makes spoofing and open-relay spam abuse easy.

**Defenses against spoofing/spam**

- **SPF (Sender Policy Framework)** and **DKIM (DomainKeys)** — verify that mail genuinely came from who it claims. Suspicious mail gets rejected or sent to **quarantine/spam**.

**ESMTP (the modern version)**

- **ESMTP (Extended SMTP)** = the upgraded SMTP everyone actually uses today (when people say "SMTP" they usually mean ESMTP).
- Starts with the **`EHLO`** command (instead of old `HELO`), then **`STARTTLS`** to turn on TLS encryption.
- Once encrypted, authentication (e.g. `AUTH PLAIN`) can be sent safely.

## Default Configuration :

```shell
aymane0x90@htb[/htb]$ cat /etc/postfix/main.cf | grep -v "#" | sed -r "/^\s*$/d"

smtpd_banner = ESMTP Server 
biff = no
append_dot_mydomain = no
readme_directory = no
compatibility_level = 2
smtp_tls_session_cache_database = btree:${data_directory}/smtp_scache
myhostname = mail1.inlanefreight.htb
alias_maps = hash:/etc/aliases
alias_database = hash:/etc/aliases
smtp_generic_maps = hash:/etc/postfix/generic
mydestination = $myhostname, localhost 
masquerade_domains = $myhostname
mynetworks = 127.0.0.0/8 10.129.0.0/16
mailbox_size_limit = 0
recipient_delimiter = +
smtp_bind_address = 0.0.0.0
inet_protocols = ipv4
smtpd_helo_restrictions = reject_invalid_hostname
home_mailbox = /home/postfix
```

The sending and communication are also done by special commands that cause the SMTP server to do what the user requires.

|**Command**|**Description**|
|---|---|
|`AUTH PLAIN`|AUTH is a service extension used to authenticate the client.|
|`HELO`|The client logs in with its computer name and thus starts the session.|
|`MAIL FROM`|The client names the email sender.|
|`RCPT TO`|The client names the email recipient.|
|`DATA`|The client initiates the transmission of the email.|
|`RSET`|The client aborts the initiated transmission but keeps the connection between client and server.|
|`VRFY`|The client checks if a mailbox is available for message transfer.|
|`EXPN`|The client also checks if a mailbox is available for messaging with this command.|
|`NOOP`|The client requests a response from the server to prevent disconnection due to time-out.|
|`QUIT`|The client terminates the session.|

To interact with the SMTP server, we can use the `telnet` tool to initialize a TCP connection with the SMTP server. The actual initialization of the session is done with the command mentioned above, `HELO` or `EHLO`.

## Telnet - HELO/EHLO

```shell
aymane0x90@htb[/htb]$ telnet 10.129.14.128 25

Trying 10.129.14.128...
Connected to 10.129.14.128.
Escape character is '^]'.
220 ESMTP Server 


HELO mail1.inlanefreight.htb

250 mail1.inlanefreight.htb


EHLO mail1

250-mail1.inlanefreight.htb
250-PIPELINING
250-SIZE 10240000
250-ETRN
250-ENHANCEDSTATUSCODES
250-8BITMIME
250-DSN
250-SMTPUTF8
250 CHUNKING
```

The command `VRFY` can be used to enumerate existing users on the system. However, this does not always work. Depending on how the SMTP server is configured, the SMTP server may issue `code 252` and confirm the existence of a user that does not exist on the system. A list of all SMTP response codes can be found [here](https://serversmtp.com/smtp-error/).

## Telnet - VRFY 

```shell
aymane0x90@htb[/htb]$ telnet 10.129.14.128 25

Trying 10.129.14.128...
Connected to 10.129.14.128.
Escape character is '^]'.
220 ESMTP Server 

VRFY root

252 2.0.0 root


VRFY cry0l1t3

252 2.0.0 cry0l1t3


VRFY testuser

252 2.0.0 testuser


VRFY aaaaaaaaaaaaaaaaaaaaaaaaaaaa

252 2.0.0 aaaaaaaaaaaaaaaaaaaaaaaaaaaa
```

Therefore, one should never entirely rely on the results of automatic tools. After all, they execute pre-configured commands, but none of the functions explicitly state how the administrator configures the tested server.

Sometimes we may have to work through a web proxy. We can also make this web proxy connect to the SMTP server. The command that we would send would then look something like this: `CONNECT 10.129.14.128:25 HTTP/1.0`

All the commands we enter in the command line to send an email we know from every email client program like Thunderbird, Gmail, Outlook, and many others. We specify the `subject`, to whom the email should go, CC, BCC, and the information we want to share with others. Of course, the same works from the command line.

## Send an Email

```shell
aymane0x90@htb[/htb]$ telnet 10.129.14.128 25

Trying 10.129.14.128...
Connected to 10.129.14.128.
Escape character is '^]'.
220 ESMTP Server


EHLO inlanefreight.htb

250-mail1.inlanefreight.htb
250-PIPELINING
250-SIZE 10240000
250-ETRN
250-ENHANCEDSTATUSCODES
250-8BITMIME
250-DSN
250-SMTPUTF8
250 CHUNKING


MAIL FROM: <cry0l1t3@inlanefreight.htb>

250 2.1.0 Ok


RCPT TO: <mrb3n@inlanefreight.htb> NOTIFY=success,failure

250 2.1.5 Ok


DATA

354 End data with <CR><LF>.<CR><LF>

From: <cry0l1t3@inlanefreight.htb>
To: <mrb3n@inlanefreight.htb>
Subject: DB
Date: Tue, 28 Sept 2021 16:32:51 +0200
Hey man, I am trying to access our XY-DB but the creds don't work. 
Did you make any changes there?
.

250 2.0.0 Ok: queued as 6E1CF1681AB


QUIT

221 2.0.0 Bye
Connection closed by foreign host.
```

The mail header is the carrier of a large amount of interesting information in an email. Among other things, it provides information about the sender and recipient, the time of sending and arrival, the stations the email passed on its way, the content and format of the message, and the sender and recipient.

Some of this information is mandatory, such as sender information and when the email was created. Other information is optional. However, the email header does not contain any information necessary for technical delivery. It is transmitted as part of the transmission protocol. Both sender and recipient can access the header of an email, although it is not visible at first glance. The structure of an email header is defined by [RFC 5322](https://datatracker.ietf.org/doc/html/rfc5322).

## Dangerous Settings :

To prevent the sent emails from being filtered by spam filters and not reaching the recipient, the sender can use a relay server that the recipient trusts. It is an SMTP server that is known and verified by all others. As a rule, the sender must authenticate himself to the relay server before using it.

Often, administrators have no overview of which IP ranges they have to allow. This results in a misconfiguration of the SMTP server that we will still often find in external and internal penetration tests. Therefore, they allow all IP addresses not to cause errors in the email traffic and thus not to disturb or unintentionally interrupt the communication with potential and current customers.

## Open Relay Configuration

```
mynetworks = 0.0.0.0/0
```

With this setting, this SMTP server can send fake emails and thus initialize communication between multiple parties. Another attack possibility would be to spoof the email and read it.

## Footprinting the Service 

The default Nmap scripts include `smtp-commands`, which uses the `EHLO` command to list all possible commands that can be executed on the target SMTP server.

## Nmap 

```shell
aymane0x90@htb[/htb]$ sudo nmap 10.129.14.128 -sC -sV -p25

Starting Nmap 7.80 ( https://nmap.org ) at 2021-09-27 17:56 CEST
Nmap scan report for 10.129.14.128
Host is up (0.00025s latency).

PORT   STATE SERVICE VERSION
25/tcp open  smtp    Postfix smtpd
|_smtp-commands: mail1.inlanefreight.htb, PIPELINING, SIZE 10240000, VRFY, ETRN, ENHANCEDSTATUSCODES, 8BITMIME, DSN, SMTPUTF8, CHUNKING, 
MAC Address: 00:00:00:00:00:00 (VMware)

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 14.09 seconds
```

However, we can also use the [smtp-open-relay](https://nmap.org/nsedoc/scripts/smtp-open-relay.html) NSE script to identify the target SMTP server as an open relay using 16 different tests. If we also print out the output of the scan in detail, we will also be able to see which tests the script is running.

## Nmap - Open Relay

```shell
aymane0x90@htb[/htb]$ sudo nmap 10.129.14.128 -p25 --script smtp-open-relay -v

Starting Nmap 7.80 ( https://nmap.org ) at 2021-09-30 02:29 CEST
NSE: Loaded 1 scripts for scanning.
NSE: Script Pre-scanning.
Initiating NSE at 02:29
Completed NSE at 02:29, 0.00s elapsed
Initiating ARP Ping Scan at 02:29
Scanning 10.129.14.128 [1 port]
Completed ARP Ping Scan at 02:29, 0.06s elapsed (1 total hosts)
Initiating Parallel DNS resolution of 1 host. at 02:29
Completed Parallel DNS resolution of 1 host. at 02:29, 0.03s elapsed
Initiating SYN Stealth Scan at 02:29
Scanning 10.129.14.128 [1 port]
Discovered open port 25/tcp on 10.129.14.128
Completed SYN Stealth Scan at 02:29, 0.06s elapsed (1 total ports)
NSE: Script scanning 10.129.14.128.
Initiating NSE at 02:29
Completed NSE at 02:29, 0.07s elapsed
Nmap scan report for 10.129.14.128
Host is up (0.00020s latency).

PORT   STATE SERVICE
25/tcp open  smtp
| smtp-open-relay: Server is an open relay (16/16 tests)
|  MAIL FROM:<> -> RCPT TO:<relaytest@nmap.scanme.org>
|  MAIL FROM:<antispam@nmap.scanme.org> -> RCPT TO:<relaytest@nmap.scanme.org>
|  MAIL FROM:<antispam@ESMTP> -> RCPT TO:<relaytest@nmap.scanme.org>
|  MAIL FROM:<antispam@[10.129.14.128]> -> RCPT TO:<relaytest@nmap.scanme.org>
|  MAIL FROM:<antispam@[10.129.14.128]> -> RCPT TO:<relaytest%nmap.scanme.org@[10.129.14.128]>
|  MAIL FROM:<antispam@[10.129.14.128]> -> RCPT TO:<relaytest%nmap.scanme.org@ESMTP>
|  MAIL FROM:<antispam@[10.129.14.128]> -> RCPT TO:<"relaytest@nmap.scanme.org">
|  MAIL FROM:<antispam@[10.129.14.128]> -> RCPT TO:<"relaytest%nmap.scanme.org">
|  MAIL FROM:<antispam@[10.129.14.128]> -> RCPT TO:<relaytest@nmap.scanme.org@[10.129.14.128]>
|  MAIL FROM:<antispam@[10.129.14.128]> -> RCPT TO:<"relaytest@nmap.scanme.org"@[10.129.14.128]>
|  MAIL FROM:<antispam@[10.129.14.128]> -> RCPT TO:<relaytest@nmap.scanme.org@ESMTP>
|  MAIL FROM:<antispam@[10.129.14.128]> -> RCPT TO:<@[10.129.14.128]:relaytest@nmap.scanme.org>
|  MAIL FROM:<antispam@[10.129.14.128]> -> RCPT TO:<@ESMTP:relaytest@nmap.scanme.org>
|  MAIL FROM:<antispam@[10.129.14.128]> -> RCPT TO:<nmap.scanme.org!relaytest>
|  MAIL FROM:<antispam@[10.129.14.128]> -> RCPT TO:<nmap.scanme.org!relaytest@[10.129.14.128]>
|_ MAIL FROM:<antispam@[10.129.14.128]> -> RCPT TO:<nmap.scanme.org!relaytest@ESMTP>
MAC Address: 00:00:00:00:00:00 (VMware)

NSE: Script Post-scanning.
Initiating NSE at 02:29
Completed NSE at 02:29, 0.00s elapsed
Read data files from: /usr/bin/../share/nmap
Nmap done: 1 IP address (1 host up) scanned in 0.48 seconds
           Raw packets sent: 2 (72B) | Rcvd: 2 (72B)
```

---

## Automated Enumeration with smtp-user-enum

Use RCPT mode first. It is the most reliable across different server configurations. Provide the domain with -D to append it to usernames from the wordlist:

```shell
┌──(kali㉿kali)-[~]
└─$smtp-user-enum -M RCPT -U /usr/share/seclists/Usernames/top-usernames-shortlist.txt -D $DOMAIN -t $TARGET_IP -p 25

[*] Trying RCPT method...
[+] admin@company.com exists
[+] postmaster@company.com exists
[+] info@company.com exists
```

```shell
┌──(kali㉿kali)-[~]
└─$smtp-user-enum -M VRFY -U /usr/share/seclists/Usernames/top-usernames-shortlist.txt -t $TARGET_IP -p 25
```

```shell
┌──(kali㉿kali)-[~]
└─$smtp-user-enum -M EXPN -U /usr/share/seclists/Usernames/top-usernames-shortlist.txt -t $TARGET_IP -p 25
```

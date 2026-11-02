My initiation internship project at **SNRT** (Morocco's national broadcasting company), during the first year of the engineering cycle (IRIC, ENSA Khouribga). The goal: design and deploy a **high-availability, fault-tolerant Proxmox VE cluster** on physical servers, backed by **shared NAS storage** — so a virtual machine keeps running even if a whole host fails.

<p class="pdf-actions"><a class="pdf-button" href="/files/proxmox-ha-cluster-nas.pdf" target="_blank" rel="noopener">⬇ Download the full report — PDF, 94 pages (French)</a></p>

> The report is written in French. This is a short English summary of what it covers.

## What the project covers

The report starts from the fundamentals and builds up to a working cluster:

- **Virtualization** — virtual machines, hypervisors (type 1 vs type 2), and why they matter.
- **Clustering & high availability** — what a cluster is, how HA works, and the role of **quorum** in keeping a cluster consistent.
- **Shared storage** — SAN vs **NAS**, and **RAID** levels for redundancy.
- **Proxmox VE** — the open-source virtualization platform, its features, and installation.

## The build

The practical core deploys a **two-node Proxmox VE cluster** on physical servers with a shared **NAS over NFS**, plus everything needed to run it in production:

- **Physical architecture & network plan** — two servers (managed through a KVM switch) and the IP addressing scheme.
- **Cluster configuration** — installing Proxmox on both nodes and joining them into a cluster.
- **The two-node quorum problem** — a 2-node cluster can't form a majority on its own, which makes HA unstable; the report explains why and configures a fix so the surviving node keeps running after a failure.
- **Shared NAS via NFS** — configuring the NAS and adding it as cluster storage, so VM disks live on shared storage and can move between nodes.
- **Networking & firewall** — a private NAT network and the Proxmox VE firewall.
- **Users & permissions** — groups, user accounts and role-based access.

## Tests & validation

The cluster is validated against the scenarios that matter for a broadcaster that can't afford downtime:

- **High Availability** — kill a node and watch its VMs restart automatically on the other.
- **Live migration** — move a running VM between nodes with no downtime.
- **Firewall** and **NAT** network tests.

## Tech stack

`Proxmox VE` · `KVM` · `NAS` / `NFS` · `RAID` · `Clustering / HA` · `Quorum` · `NAT` · firewall

---

### Read the full report

<object class="pdf-view" data="/files/proxmox-ha-cluster-nas.pdf" type="application/pdf">
  <p>Your browser can't display the embedded PDF. <a href="/files/proxmox-ha-cluster-nas.pdf">Download the report here</a>.</p>
</object>

A hands-on project (IRIC2, ENSA Khouribga) building a complete **hyper-converged, high-availability private cloud** from the ground up: a **three-node Proxmox VE cluster** with **Ceph** distributed storage, **VXLAN** network isolation, and **Prometheus + Grafana** monitoring. The goal was an infrastructure that survives hardware failure and isolates tenant workloads securely — the way a modern private cloud is actually built.

<p class="pdf-actions"><a class="pdf-button" href="/files/proxmox-ceph-vxlan-cluster.pdf" target="_blank" rel="noopener">⬇ Download the full report — PDF, 47 pages</a></p>

## Architecture

- **Three Proxmox VE nodes** form the hypervisor layer and the Corosync cluster, sharing a heartbeat and quorum so the cluster stays consistent.
- **Ceph** provides a distributed, software-defined storage backend across all three nodes, eliminating the single point of failure that local disks would create.
- A **VXLAN overlay** stretches an isolated Layer 2 tenant network across the Layer 3 nodes.
- **Prometheus + Grafana** give real-time visibility into cluster health and network use.

## Distributed storage with Ceph

Instead of VM disks living on one server, Ceph spreads every block across the nodes using the **CRUSH** algorithm, with its three daemon types — **OSD** (stores the data), **MON** (maintains the cluster map and quorum) and **MGR** (runtime metrics). OSDs were created from raw disks on each node and pooled into shared storage added to the Proxmox datacenter. This buys two things that standalone servers can't:

- **Fault tolerance** — every block is replicated, so losing a node doesn't lose data.
- **Zero-downtime live migration** — because the disk is already on shared storage, a running VM moves between nodes seamlessly.

## Network isolation with VXLAN

The challenge in a clustered environment is giving tenants an isolated Layer 2 network across physically separate hosts. Each node acts as a **VTEP** (VXLAN Tunnel Endpoint): a packet from a VM on one node is **encapsulated** into UDP, routed over the physical underlay, and **decapsulated** on the destination node onto the isolated bridge. The report also documents a real debugging story — VMs initially couldn't talk across nodes, traced to the Linux bridge's security/filtering mechanisms, and fixed.

## HA & failover testing

The cluster is validated by actually breaking it:

- A VM is placed under **Proxmox HA** management and verified running on a node.
- **Live migration** is tested with continuous ping (replies stay consistent through the move).
- A node is failed, and the stack reacts automatically: **Corosync** detects the heartbeat loss within seconds, **quorum** is maintained by the surviving majority, **Ceph** rebalances, and the **HA manager** fences and relocates the VM to a healthy node.

## Tech stack

`Proxmox VE` · `Ceph` (OSD / MON / MGR, CRUSH) · `VXLAN` / SDN · `Corosync` · `Prometheus` · `Grafana` · high availability · live migration

---

### Read the full report

<object class="pdf-view" data="/files/proxmox-ceph-vxlan-cluster.pdf" type="application/pdf">
  <p>Your browser can't display the embedded PDF. <a href="/files/proxmox-ceph-vxlan-cluster.pdf">Download the report here</a>.</p>
</object>

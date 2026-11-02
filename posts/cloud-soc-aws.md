My end-of-year engineering project (IRIC, ENSA Khouribga), carried out during a two-month
internship at **Devoteam CyberTrust**. I built a small but realistic **cloud-native Security
Operations Center (SOC)** on AWS and took a **purple-teaming** approach to it: realistic
attacks are simulated across the cloud stack and, in the same motion, the detections that
catch them are engineered — offence and defence developed together.

<p class="pdf-actions"><a class="pdf-button" href="/files/cloud-native-soc-aws.pdf" target="_blank" rel="noopener">⬇ Download the full report — PDF, 99 pages</a></p>

## The idea

Cloud environments dissolve the single network perimeter into many trust boundaries, and the
attacks that matter most abuse **identity and trust** rather than breach a firewall. So instead
of a classic "scan and patch" lab, I built a deliberately vulnerable AWS environment, attacked
it end to end, and engineered a detection in **Wazuh** for every stage — each rule mapped to
**MITRE ATT&CK**.

## The lab

A single VPC with three subnets models three actors (a public web tier, a private workload
tier, and an isolated SOC tier). The deliberately vulnerable surface includes:

- A web app (**OWASP Juice Shop**) behind **Nginx + the ModSecurity WAF** on EC2 + Docker.
- **EC2** and **AWS Lambda** (serverless) workloads.
- **IAM** roles and instance profiles, **AWS STS**, and **Cognito** for identity.
- Sensitive data in **S3**, **RDS**, and **DynamoDB**, plus **Secrets Manager**.
- **API Gateway** and **SQS** for application integration.
- Full telemetry from **CloudTrail** and **CloudWatch Logs**, shipped into a **Wazuh** SIEM
  alongside a Shuffle / Cortex / DFIR-IRIS analyst toolchain.

## The four attack scenarios

Each scenario is attacked step by step, and every step is caught by a detection:

1. **Web exploitation & brute force** against Juice Shop — SQLi, NoSQL injection, LFI, SSRF,
   XSS and XXE, all surfaced through ModSecurity audit logs decoded into Wazuh.
2. **SSRF → cloud credential theft** — an SSRF flaw reaches the EC2 metadata service
   (**IMDSv1**) and steals the instance role's credentials to read S3.
3. **Container escape → full cloud compromise** — a misconfigured Docker container escapes
   to the host, reaches IMDS through host networking (showing that **IMDSv2 alone doesn't
   stop a host-level attacker**), and pivots into the cloud account.
4. **Serverless confused-deputy identity pivot** — one Lambda is tricked into using its
   privileged identity on behalf of the attacker; the decision is made in one function and
   executed in another.

## Detection engineering

The defensive core is the real contribution: for every attack stage, a Wazuh rule and a
dedicated **decoder** that extracts fields from ModSecurity and AWS JSON telemetry, each
mapped to the matching **MITRE ATT&CK** technique. A few lessons that recurred:

- **In the cloud, identity is the perimeter**, and **CloudTrail** is the single most valuable
  detection source.
- JSON telemetry is only useful once each source has a **dedicated decoder** that actually
  extracts its fields.
- CloudTrail writes **global-service events (IAM, STS) to `us-east-1`** regardless of the
  account's Region — ignore that Region and your detection sees nothing.
- **IMDSv2** is a real improvement but does **not** stop a host-level attacker who reaches the
  metadata service through a host-networked container.

## AI-augmented triage (experiment)

On top of the detections, I built an experimental triage layer: Wazuh alerts flow through
**Shuffle** orchestration and **Cortex** enrichment to a **local language model** acting as a
Tier-1 analyst, which drafts a correlated, colour-coded **DFIR-IRIS** case for a human — one
living case per multi-stage campaign, with a grounded assessment and ATT&CK mapping. It
works as a proof of concept, but I deliberately present it as **early work**: the model isn't
security-trained, uses no retrieval grounding, and reasons only over the single alert it's
handed. Making it query Wazuh and investigate hosts itself would need an agentic system —
with the human firmly in the loop — and is left to future work.

## Tech stack

`AWS` · `Wazuh` · `ModSecurity` · `CloudTrail` / `CloudWatch` · `Docker` · `OWASP Juice Shop`
· `MITRE ATT&CK` · `Shuffle` · `Cortex` · `DFIR-IRIS` · local LLM

---

### Read the full report

<object class="pdf-view" data="/files/cloud-native-soc-aws.pdf" type="application/pdf">
  <p>Your browser can't display the embedded PDF.
  <a href="/files/cloud-native-soc-aws.pdf">Download the report here</a>.</p>
</object>

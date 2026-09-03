# TCO cost lines — including the ones teams forget

Walk every section. For each line: include it with a value, or record a deliberate exclusion
with a reason. Silence is not an exclusion — an omitted line reappears as an overrun.

Mark each line with a **shape**: `one-off` · `flat` · `scaling` · `step` · `rising` · `terminal`.

---

## 1. BUILD (year 0, occasionally year 0–1)

Take these from the `estimate-project` skill; do not re-estimate here.

- [ ] Delivery effort, all roles — `one-off`
- [ ] Discovery, architecture, spikes — `one-off`
- [ ] Security review, accessibility audit, privacy assessment, and remediation — `one-off`
- [ ] Data migration, and the second migration after the first is wrong — `one-off`
- [ ] Initial licences, one-off vendor setup and onboarding fees — `one-off`
- [ ] Training and enablement for support, operations and sales — `one-off`
- [ ] **Parallel-run cost** — old and new systems both running during transition. Frequently
      the largest forgotten line in a replacement project. — `one-off`
- [ ] Project management, coordination, external approvals — `one-off`

## 2. RUN — infrastructure

- [ ] Compute (VMs, containers, serverless) — `scaling`
- [ ] Managed databases: instance, storage, **provisioned IOPS** — `scaling`
- [ ] Object storage, by class, and **request charges** on chatty small-object access — `scaling`
- [ ] **Backups**: snapshot storage, cross-region backup copies, long-retention archive tiers.
      Backup storage frequently exceeds primary storage and appears on nobody's estimate. — `scaling`
- [ ] **Egress**: internet egress, cross-region, cross-AZ, NAT gateway data processing.
      Cross-AZ chatter inside a "single cloud bill" is real money. — `scaling`
- [ ] CDN: egress plus request charges; cache-miss ratio drives it — `scaling`
- [ ] Load balancers, API gateways, private endpoints, VPN/interconnect — `flat`/`scaling`
- [ ] DNS, TLS certificates (including paid EV/wildcard), domain renewals — `flat`
- [ ] Non-production environments — often several, often running 24/7 — `step`
- [ ] Disaster-recovery capacity, warm or cold standby — `flat`
- [ ] Message queues / streaming: provisioned throughput even when idle — `flat`/`scaling`
- [ ] Data warehouse: storage plus **query compute**, which scales with analyst curiosity — `scaling`

## 3. RUN — observability and operations

- [ ] **Log ingestion and retention.** Priced per GB ingested and per day retained. Debug
      logging left on in production is a recurring, invisible cost. — `scaling`
- [ ] **Metrics cardinality.** One high-cardinality label (user id, request id, full URL) can
      dominate a monitoring bill. — `scaling`
- [ ] Distributed tracing, and the sampling decision that prices it — `scaling`
- [ ] APM / RUM / synthetic monitoring seats and checks — `flat`
- [ ] Error tracking and alerting platform — `flat`
- [ ] Status page, incident management tooling — `flat`
- [ ] SIEM / audit log retention, where a compliance regime dictates the period — `scaling`

## 4. RUN — people

The largest run cost in most systems, and the one most often left out because it "comes out of
existing headcount". Existing headcount is not free; it has an opportunity cost.

- [ ] **On-call rota**: standby allowance, call-out payments, time off in lieu — `flat`
- [ ] Incident response time, at a loaded hourly rate — `rising` with system age
- [ ] Routine operations: releases, access reviews, capacity checks — `flat`
- [ ] Support: L1/L2/L3, scaling with users and with defect rate — `scaling`
- [ ] Customer onboarding and configuration, if the product needs it — `scaling`
- [ ] Vendor and contract management time — `flat`
- [ ] Knowledge transfer on staff turnover — `rising`

## 5. RUN — third parties

- [ ] SaaS subscriptions, per seat or per node. Autoscaling can multiply per-node agent
      licences without anyone approving a spend increase. — `scaling`
- [ ] Third-party API calls: payments, identity, mapping, email, SMS, enrichment — `scaling`
- [ ] Commercial open-source support contracts — `flat`
- [ ] Paid cloud support tier — usually a percentage of spend, so it `scaling`s silently
- [ ] Data or content licensing — `flat`
- [ ] **Contractual uplift clauses.** Many contracts index annually. Check the clause and model
      the increase rather than assuming a flat renewal. — `rising`
- [ ] **AI/token spend** → `ai-spend-report`; do not guess it here — `scaling`

## 6. MAINTAIN

- [ ] Dependency upgrades, including the breaking major every year or two — `rising`
- [ ] Security patching, CVE response, and the emergency out-of-hours patch — `rising`
- [ ] **Runtime and platform end-of-life migrations.** Language runtimes, database majors,
      Kubernetes versions, OS LTS: each has a published support window, and each forces a
      project. Look the windows up for your stack and put the migrations on the timeline as
      `step` costs in the years they fall.
- [ ] Certificate and key rotation, credential rotation — `flat`
- [ ] Regression test suite upkeep; flaky-test triage — `rising`
- [ ] Infrastructure drift repair and IaC modernisation — `rising`
- [ ] Documentation and runbook upkeep — `flat`
- [ ] Compliance re-certification cycles (annual audits, penetration tests) — `flat`/`step`
- [ ] Accessibility re-audits after significant change — `step`
- [ ] Feature maintenance: the tax every shipped feature levies on every future change. Cannot
      be measured directly; model it as a stated percentage of build effort per year and
      **label it an assumption**, do not invent an industry figure. — `rising`
- [ ] Deprecation and removal work for features being retired — `step`

## 7. DECOMMISSION (year N — almost always omitted, almost never zero)

- [ ] The decommissioning project itself: planning, execution, verification — `terminal`
- [ ] Data export in a usable format, and validating the export — `terminal`
- [ ] **Archive retention after shutdown.** Legal, tax or regulatory retention obligations can
      require keeping data for years after the system is switched off. That is a recurring
      cost that outlives the system. — `flat`, extending beyond N
- [ ] Secure deletion and its evidence — `terminal`
- [ ] User migration to the successor, including support during the cutover — `terminal`
- [ ] Contract exit: notice periods, early-termination fees, minimum-commitment shortfalls,
      **data egress charges on the way out** — `terminal`
- [ ] Retiring integrations in *other* systems that consumed this one — `terminal`
- [ ] Communication to customers and regulators where required — `terminal`

## 8. Boundary questions to answer explicitly

Each of these can move a TCO by a large factor depending on the answer. Write the answer down.

- Is shared platform capacity allocated to this system, or excluded?
- Is the existing team's time costed, or treated as free because it is already paid for?
  (Treating it as free is a choice; it is rarely the right one for a build-vs-buy comparison.)
- Are internal charge-back rates used, or true cost?
- Is the cost of *not* doing it — the do-nothing baseline — modelled?
- Are the options being compared normalised to the same delivered outcome?

## 9. Common ways a TCO model misleads

| Failure | Why it happens | Countermeasure |
|---|---|---|
| Build-only comparison | Run cost is someone else's budget line | Force all four blocks to be non-empty |
| Horizon chosen to fit the answer | Short horizon flatters build; long flatters buy | Fix N to useful life before modelling, and run N±2 |
| Existing staff treated as free | "It comes out of BAU" | Cost at loaded rate; state the opportunity cost |
| Zero decommissioning | Nobody plans to stop | Require a non-zero value or a written justification |
| Volume forecast optimism | Same forecast that justifies the project prices the run cost | Model run cost at the **pessimistic** volume too |
| Flat licence renewal | Uplift clause not read | Read the clause; model the indexation |
| Options not comparable | One does less | Normalise scope first, or declare the comparison void |

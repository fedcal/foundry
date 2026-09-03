# Non-functional requirements catalogue

Organised by ISO/IEC 25010:2023 characteristic. Each entry gives the measurable form and the
standard to cite. The 2023 edition defines nine characteristics: *Safety* was added, *Usability*
became *Interaction capability*, and *Portability* became *Flexibility*.

## Template

```
<quality> of <what>, measured as <metric>, must be <comparator> <value> <unit>
under <load/condition>, over <observation window>, measured by <method/tool>.
```

All six slots. Missing any one makes the requirement untestable in practice.

## Performance efficiency

| Aspect | Measurable form |
|---|---|
| Latency | "p95 server response for `GET /orders` ≤ 300 ms at 200 req/s sustained, over a rolling 1 h window, measured at the load balancer" |
| Tail latency | "p99.9 ≤ 1200 ms under the same conditions" — specify separately; p95 alone hides the tail that pages the on-call |
| Throughput | "sustains 500 orders/min for 30 min with error rate ≤ 0.1%" |
| Resource use | "steady-state memory ≤ 512 MiB per instance at 200 req/s; no growth over 24 h (leak check)" |
| Startup | "instance is ready to serve within 20 s of process start, cold" |
| Batch | "nightly reconciliation of 5 M rows completes within a 2 h window" |

Always specify **where** latency is measured. Client-perceived, edge, load balancer and
server-side figures differ by hundreds of milliseconds on mobile networks, and teams routinely
argue about a requirement that never said which one it meant.

## Reliability

| Aspect | Measurable form |
|---|---|
| Availability | "99.9% monthly (≤ 43 min 12 s downtime), excluding announced maintenance ≤ 2 h/month" |
| Error budget | "≤ 0.1% of requests return 5xx over a 30-day window; exhausting the budget freezes feature releases" |
| Recoverability | "RPO ≤ 15 min, RTO ≤ 4 h, verified by a restore drill at least quarterly" |
| Fault tolerance | "loss of one availability zone causes ≤ 60 s of elevated latency and no failed writes" |
| Durability | "no acknowledged write is lost given a single-node failure" |
| MTTR | "p50 time from alert to service restored ≤ 30 min" |

Availability without a window is meaningless: 99.9% over a day allows 86 s; over a year, 8 h 46 min.

## Security

Cite OWASP ASVS 4.0 control ids rather than describing controls in prose.

| Aspect | Measurable form |
|---|---|
| Conformance | "conforms to OWASP ASVS 4.0 Level 2 for the payment and identity surfaces" |
| Vulnerabilities | "no unresolved findings of CVSS ≥ 7.0 at release; ≥ 4.0 remediated within 30 days" |
| Transport | "TLS 1.3 (RFC 8446) required; TLS 1.2 permitted only with the listed cipher suites; earlier versions refused" |
| Authentication | "ASVS V2.1: passwords ≥ 12 chars, checked against a breached-password list, no composition rules" |
| Session | "ASVS V3.3: idle timeout 30 min, absolute timeout 12 h, token revoked server-side on logout" |
| Secrets | "no secret in source or image layers, verified by a CI scanner that fails the build" |
| Blast radius | "one compromised service credential reaches ≤ 1 tenant's data" |
| Audit | "every privileged action recorded with actor, action, target, timestamp, and retained 12 months" |

## Interaction capability (accessibility and usability)

| Aspect | Measurable form |
|---|---|
| Accessibility | "WCAG 2.2 Level AA for all pages in the purchase backbone; zero axe-core violations of impact serious or critical" |
| Specific SC | "SC 1.4.3 contrast ≥ 4.5:1 for body text; SC 2.4.11 focus not obscured; SC 2.5.8 target size ≥ 24×24 CSS px" |
| Keyboard | "every interactive control reachable and operable by keyboard alone; visible focus indicator meeting SC 2.4.13" |
| Task success | "≥ 90% of participants in moderated testing (n ≥ 8) complete first-time checkout unaided" |
| Time on task | "median first-time checkout ≤ 3 min" |
| Error recovery | "a user who enters an invalid card can correct it without re-entering other fields" |

Where accessibility is a legal obligation (EU Directive 2016/2102, the European Accessibility Act,
national equivalents), record it as `kind: regulatory` and route the interpretation to
`foundry-legal`. State the conformance target as a requirement; do not rule on the law.

## Compatibility

| Aspect | Measurable form |
|---|---|
| Browsers | "supported on the last two major versions of Chrome, Firefox, Safari and Edge as of the release date" |
| API versioning | "no breaking change to a published endpoint without a 90-day deprecation window and a version header" |
| Data formats | "imports files produced by supplier templates v2 and v3; v1 is refused with a specific message" |
| Coexistence | "runs alongside the legacy service on the same host without exceeding 70% of either resource ceiling" |

## Maintainability

| Aspect | Measurable form |
|---|---|
| Modularity | "adding a new locale requires changes only to resource files; no code change" |
| Change lead time | "p85 time from merge to production ≤ 4 h" |
| Testability | "a full regression can be run without manual data setup, in ≤ 20 min" |
| Analysability | "every user-visible error carries a correlation id resolvable to a request trace within 5 min" |

Avoid coverage-percentage requirements as a proxy for maintainability. They are easy to satisfy
without improving anything and easy to game; prefer statements about what a change costs.

## Flexibility (portability, adaptability, scalability)

| Aspect | Measurable form |
|---|---|
| Scalability | "handles a 5× traffic increase by horizontal scaling within 10 min, with no code change" |
| Installability | "deploys to a fresh environment from a clean checkout in ≤ 30 min with documented steps only" |
| Replaceability | "the payment provider can be replaced with ≤ 15 person-days of work; no provider type appears outside the adapter package" |
| Vendor exit | "all customer data exportable in a documented open format within 24 h of request" |

## Safety

New as a top-level characteristic in the 2023 edition. Relevant wherever failure can cause harm
or irreversible loss.

| Aspect | Measurable form |
|---|---|
| Fail-safe | "on loss of the pricing service the checkout refuses new orders rather than charging a stale price; state entered automatically within 5 s" |
| Hazard warning | "an irreversible bulk delete requires a typed confirmation naming the affected record count" |
| Operational constraint | "no destructive migration executes without a verified backup taken in the preceding 60 min" |

## Privacy and compliance

Record as `kind: regulatory`; obtain the interpretation from `foundry-legal`.

| Aspect | Measurable form |
|---|---|
| Erasure | "personal data erased within 30 days of a GDPR Art. 17 request; erasure evidenced in an audit log" |
| Access | "a GDPR Art. 15 export is produced within 30 days, in a machine-readable format (Art. 20)" |
| Retention | "transaction records retained 10 years per the applicable accounting obligation, then deleted automatically" |
| Minimisation | "no personal data in application logs; enforced by a CI check on log statements" |
| Residency | "personal data at rest remains within the EU/EEA, including backups and analytics copies" |

## How to choose targets

1. **Measure the baseline first.** A target without a baseline cannot be evaluated as ambitious
   or trivial, and cannot be reported against.
2. **Derive from a user consequence.** "300 ms because above that the observed abandonment rate
   rises" is defensible; "300 ms because it is a round number" is not.
3. **Check affordability.** Every added nine of availability multiplies cost. Confirm someone
   will pay for it before writing it down.
4. **Say what happens when the target is missed.** Alert, error budget freeze, contractual
   penalty, or nothing — if the answer is nothing, the target is decoration.

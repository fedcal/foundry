<!-- PRIVATE until published. Keep in .foundry/scratch/, never in the public repository. -->

# {{ADVISORY_ID}} — {{SUMMARY}}

| Field | Value |
|---|---|
| Status | intake / triage / fix / embargo / published |
| Reported | {{REPORTED_AT}} (UTC) |
| Acknowledged | {{ACK_AT}} |
| Reporter | {{REPORTER}} — credit as: {{CREDIT_PREFERENCE}} |
| Disclosure target | {{DISCLOSURE_DATE}} |
| GHSA | {{GHSA_ID}} |
| CVE | {{CVE_ID}} |
| CWE | {{CWE_ID}} |
| CVSS | {{CVSS_VERSION}} {{CVSS_SCORE}} ({{SEVERITY}}) `{{CVSS_VECTOR}}` |
| People who know | {{CIRCLE}} |

## Timeline

| UTC | Event | By |
|---|---|---|
| {{REPORTED_AT}} | Report received | {{REPORTER}} |

<!-- Append every event: acknowledgement, reproduction, score agreed, fix merged privately,
     date changes and who agreed to them, release, publication. -->

## Reproduction

- Version / commit: {{VULN_COMMIT}}
- Environment: {{ENVIRONMENT}}

```bash
{{REPRO_COMMAND}}
```

Observed: {{REPRO_OUTPUT}}

## Impact

- What the attacker gains: {{IMPACT}}
- Trust boundary crossed: {{BOUNDARY}}
- Affected versions: {{AFFECTED_RANGE}}
- Affected configurations: {{AFFECTED_CONFIG}} — default configuration affected: {{DEFAULT_AFFECTED}}
- Not affected: {{NOT_AFFECTED}}

## Scoring rationale

| Metric | Value | Why |
|---|---|---|
| AV | {{AV}} | |
| AC | {{AC}} | |
| PR | {{PR}} | |
| UI | {{UI}} | |
| S / VC-VI-VA | {{SCOPE}} | |
| C / I / A | {{CIA}} | |

Reporter's score, if different: {{REPORTER_SCORE}} — difference explained: {{SCORE_DELTA}}

## Fix

- Root cause: {{ROOT_CAUSE}} (CWE {{CWE_ID}})
- Private branch: {{PRIVATE_BRANCH}}
- Regression test: {{TEST_PATH}} — fails at {{VULN_COMMIT}}, passes at {{FIX_COMMIT}}
- Variant search: `{{VARIANT_SEARCH_CMD}}` — found: {{VARIANTS}}

| Supported line | Fix version | Clean backport | Notes |
|---|---|---|---|
| {{LINE_1}} | {{FIX_1}} | yes/no | |

Mitigation for users who cannot upgrade: {{MITIGATION}} <!-- or: none available -->

---

# Published advisory text

<!-- Everything below is public at publication. No exploit refinement, no proof of concept
     beyond what is needed to identify the flaw. -->

## Summary

{{PUBLIC_SUMMARY}}

## Impact

{{PUBLIC_IMPACT}} Affected: {{AFFECTED_RANGE}}{{AFFECTED_CONFIG_NOTE}}.

## Patches

Fixed in {{PATCHED_VERSIONS}}. Upgrade with `{{UPGRADE_COMMAND}}`.

## Workarounds

{{MITIGATION}}

## Credit

Reported by {{CREDIT_LINE}}. Thank you for reporting this privately and for working with us
through the disclosure.

## References

- GHSA: {{GHSA_URL}}
- CWE-{{CWE_ID}}
- Fix commit: {{FIX_COMMIT_URL}}

---

# Post-incident

- How it got in: {{CAUSE}}
- Why tests did not catch it: {{TEST_GAP}}
- Class-level prevention (lint rule, fuzz target, type change, API removal): {{PREVENTION}}
- Process changes: {{PROCESS_CHANGE}}
- Did we meet the SECURITY.md targets? {{SLA_MET}} — if not, fix the targets or fix the process.

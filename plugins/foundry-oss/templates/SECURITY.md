# Security Policy

## Reporting a vulnerability

**Do not open a public issue.** Use one of:

1. GitHub private vulnerability reporting — <https://github.com/{{REPO}}/security/advisories/new>
   (preferred: it gives us a private fork and an advisory draft in one place).
2. Email **{{SECURITY_CONTACT}}**<!-- OPT:PGP -->, optionally encrypted to the key at
   {{PGP_KEY_URL}} (fingerprint `{{PGP_FINGERPRINT}}`)<!-- /OPT -->.

Please include: affected version and commit, environment, reproduction steps or a proof of
concept, the impact you believe it has, and how you would like to be credited (including
"anonymously").

## What we commit to

| Stage | Target |
|---|---|
| Acknowledge your report | {{SEC_ACK_HOURS}} hours |
| Triage decision (accepted / not a vulnerability / duplicate) | {{SEC_TRIAGE_DAYS}} days |
| Fix or mitigation plan shared with you | {{SEC_PLAN_DAYS}} days |
| Public disclosure | at or before {{SEC_DISCLOSURE_DAYS}} days from acknowledgement |

If we go quiet past these targets, you are free to disclose. We would rather be embarrassed
than have users unprotected.

## How we handle it

- We score with CVSS {{CVSS_VERSION}} and publish the vector alongside the severity band.
- Fixes land privately, then release and advisory are published together — never the advisory
  first.
- We publish a GitHub Security Advisory (GHSA) and request a CVE where the issue affects
  downstream users.
- You are credited in the advisory exactly as you asked. Tell us if you change your mind.

## Supported versions

| Version | Security fixes until |
|---|---|
{{SUPPORTED_VERSIONS}}

Versions not listed receive no security fixes. Upgrade paths are in `docs/migration/`.

## Out of scope

- Vulnerabilities in dependencies with no exploitable path through this project — report them
  upstream; tell us if we should pin or patch.
- Findings from automated scanners with no demonstrated impact here.
- Issues requiring physical access, a compromised host, or a malicious maintainer.
- Denial of service through resource exhaustion in configurations we document as untrusted-input
  unsafe.
- Social engineering of maintainers or users.

## Safe harbour

We will not pursue or support legal action against research that follows this policy, stays
within {{REPO}} and your own systems, avoids privacy violations and service degradation, and
gives us the disclosure window above. We have no bug bounty.

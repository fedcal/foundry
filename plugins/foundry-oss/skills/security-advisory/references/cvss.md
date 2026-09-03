# CVSS scoring for maintainers

Score with **CVSS v4.0** if the project has adopted it, otherwise **v3.1**. Always publish the
vector string and the version — a severity band alone cannot be verified or disputed.

Calculators: <https://www.first.org/cvss/calculator/4-0> · <https://www.first.org/cvss/calculator/3-1>

Bands, both versions: **9.0–10.0** critical · **7.0–8.9** high · **4.0–6.9** medium ·
**0.1–3.9** low · 0.0 none.

## v3.1 base metrics

| Metric | Values | Choose it when |
|---|---|---|
| AV Attack Vector | N / A / L / P | `N` only if reachable over a network **by design**. A library parsing a file the application handed it is `L` from the library's own perspective — say so explicitly, because reporters usually assume `N`. |
| AC Attack Complexity | L / H | `H` requires conditions outside the attacker's control (winning a race, defeating ASLR). Needing a specific config is **not** AC:H — it is a scope-of-affected-configurations statement. |
| PR Privileges Required | N / L / H | From the attacker's position at the boundary you are defending. |
| UI User Interaction | N / R | `R` when a legitimate user must do something (open a file, click a link). |
| S Scope | U / C | `C` only when impact crosses a security authority: sandbox escape, container escape, privilege boundary. Not "the consequences are severe". |
| C / I / A | N / L / H | Rate what the attacker actually gets in this component, not the worst downstream imaginable. |

## v4.0 differences that matter

- Base metrics split into **Vulnerable System** (VC/VI/VA) and **Subsequent System** (SC/SI/SA);
  `Scope` is gone, and the subsequent-system metrics express what v3.1 crammed into `S:C`.
- **Attack Requirements (AT)** separates "conditions must hold" from complexity.
- **User Interaction** becomes `N` / `Passive` / `Active`.
- Nomenclature: `CVSS-B` (base), `CVSS-BT` (with threat), `CVSS-BTE` (with environmental).
  If you publish a base-only score, call it CVSS-B.
- Vector prefix is `CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:N/VA:N/SC:N/SI:N/SA:N`.

## Worked examples

| Situation | Vector (v3.1) | Score |
|---|---|---|
| Path traversal in an archive extractor; writes outside the destination on extraction of an untrusted archive | `AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:H/A:N` | 6.5 medium |
| Auth bypass on a network API, no privileges, full account takeover | `AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H` | 9.8 critical |
| ReDoS in a validator applied to user-supplied input in a server context | `AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H` | 7.5 high |
| Secret written to a debug log readable by other local users | `AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N` | 5.5 medium |
| Prototype pollution reachable only via a non-default option, leading to RCE in the host app | `AV:N/AC:H/PR:N/UI:N/S:C/C:H/I:H/A:H` | 9.0 critical — and state the non-default requirement in *affected configurations* |

## Common mistakes

1. **`AV:N` for a library.** The network is in the *application*. If the library only ever sees
   data handed to it, the honest score is lower and the advisory text explains the reachable path.
2. **`S:C` because it feels bad.** Scope change is a security-authority boundary, nothing else.
3. **Scoring the worst possible deployment.** Score this component; describe downstream impact in
   prose.
4. **AC:H for "needs a specific config".** Configuration goes in affected-configurations.
5. **Publishing a band without the vector.** Unfalsifiable, and scanners cannot use it.
6. **Silently overriding the reporter's score.** Record both, explain the difference, and say you
   are open to being wrong. Most disclosure friction starts here.
7. **Temporal/environmental metrics in a public advisory.** They are the *consumer's* to apply;
   publish base, mention exploitation status in the text.

## Recording

The advisory record must contain: version used, full vector string, computed score, band, and one
sentence justifying every metric that is not `N`. That table is what makes the score reviewable
a year later — and CVSS is an estimate to be defended in prose, not a fact.

# Foundry OSS templates

Skeletons rendered by the `bootstrap-oss` skill. They are deliberately short: a template full
of placeholder prose produces documents nobody reads and nobody maintains.

## Substitution convention

| Marker | Meaning | Gate |
|---|---|---|
| `{{TOKEN}}` | Mandatory substitution with a **measured or maintainer-supplied** value | A rendered file still containing `{{` fails the render |
| `<!-- BAND:B1+ -->` … `<!-- /BAND -->` | Keep the block only for the stated governance band (`B0`, `B1+`, `B2+`, `B3`) | All `<!-- BAND` markers removed after render |
| `<!-- OPT:NAME -->` … `<!-- /OPT -->` | Keep only if the named option was chosen (`DCO`, `CLA`, `COVENANT`, `DISCUSSIONS`, `MATRIX`) | All `<!-- OPT` markers removed after render |
| `<!-- CHOOSE: a \| b -->` | Pick exactly one and delete the comment | No `<!-- CHOOSE` remains |

Render gate, run by `bootstrap-oss` after writing:

```bash
grep -rn '{{\|<!-- BAND\|<!-- OPT\|<!-- CHOOSE' <rendered-paths> && exit 1 || true
```

## Common tokens

`{{PROJECT}}`, `{{REPO}}` (`owner/repo`), `{{LICENSE}}` (SPDX id), `{{LANG}}`,
`{{PKG_MANAGER}}`, `{{SETUP_CMD}}`, `{{TEST_CMD}}`, `{{LINT_CMD}}`, `{{BUILD_CMD}}`,
`{{DEFAULT_BRANCH}}`, `{{MAINTAINERS}}`, `{{SECURITY_CONTACT}}`, `{{RESPONSE_ISSUE_H}}`,
`{{RESPONSE_PR_D}}`, `{{COC_CONTACT_1}}`, `{{COC_CONTACT_2}}`, `{{SUPPORTED_VERSIONS}}`.

## Files

| Template | Renders to |
|---|---|
| `CONTRIBUTING.md` | `CONTRIBUTING.md` |
| `CODE_OF_CONDUCT.md` | `CODE_OF_CONDUCT.md` |
| `SECURITY.md` | `SECURITY.md` |
| `GOVERNANCE.md` | `GOVERNANCE.md` (B1+ only) |
| `SUPPORT.md` | `SUPPORT.md` |
| `MAINTAINERS.md` | `MAINTAINERS.md` (B1+ only) |
| `CODEOWNERS` | `.github/CODEOWNERS` |
| `FUNDING.yml` | `.github/FUNDING.yml` (only if funding exists) |
| `PULL_REQUEST_TEMPLATE.md` | `.github/PULL_REQUEST_TEMPLATE.md` |
| `ISSUE_TEMPLATE/*.yml` | `.github/ISSUE_TEMPLATE/*.yml` |
| `labels.json` | seed for `gh label create`, not committed |

Licence: Apache-2.0. Rendered output belongs to the target project under its own licence.

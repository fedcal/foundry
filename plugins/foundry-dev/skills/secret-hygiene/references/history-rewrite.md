# Rewriting git history: what it achieves, and what it does not

## Read this first

Rewriting history **does not un-leak a secret**. It reduces future accidental discovery. It
does not:

- retrieve clones already on developer machines, CI runners or build caches;
- remove the object from forks, mirrors, or a forge's internal storage, where the old commit
  often stays reachable by SHA;
- remove it from pull request views, code review tools, CI logs, chat notifications,
  webhook payloads, code-search indices or archival services;
- remove it from container images, release artifacts or backups built from that commit;
- undo the fact that automated scrapers fetch new public commits within seconds.

Rotate first. Always. Rewrite only when it buys something specific.

## When it is worth doing

- Making a private repository public.
- A contractual or regulatory requirement to remove specific content.
- Personal data that must be erased (a different legal obligation from a secret).
- A large binary or key file bloating every clone.
- A credential that genuinely cannot be rotated yet — and then only as an interim measure
  with a rotation deadline attached.

## When it is not

- As a substitute for rotation. Ever.
- On a busy shared branch where the coordination cost exceeds the benefit, and the secret is
  already rotated. In that case: rotate, document, add prevention, move on.

## Procedure

1. **Rotate first.** Confirm revocation before touching history.
2. **Announce.** Everyone with a clone must stop pushing and be ready to re-clone. Merge or
   note every open pull request: rewriting invalidates their base commits.
3. **Back up.** `git clone --mirror` to a location outside the forge, kept until the
   operation is confirmed good.
4. **Rewrite** with a purpose-built tool. `git filter-repo` is the maintained option;
   `git filter-branch` is not recommended for this. Prefer removing the *file* over
   redacting a *string* — a redacted string leaves the surrounding commit intact and it is
   easy to miss a variant.
   ```bash
   git filter-repo --invert-paths --path config/secrets.yml
   # or, replacing literal strings listed in a file (one per line, or literal==>replacement)
   git filter-repo --replace-text ../replacements.txt
   ```
5. **Verify.** Re-run the full-history scan (`gitleaks detect --log-opts="--all"`) on the
   rewritten repository. Check every branch and every tag, not just the default branch.
6. **Force-push** all branches and tags. Expect protected-branch rules to block this;
   coordinate the temporary exception and restore it immediately after.
7. **Ask the forge to expire cached views.** Most platforms retain unreachable objects and
   will only remove them, or expire cached commit views, on request through support. Do this
   explicitly; assuming it happened automatically is a mistake.
8. **Handle forks.** Forks do not inherit the rewrite. Each fork owner must rewrite or delete
   their fork. If the repository was public, assume you cannot reach them all — which is
   exactly why rotation is the real control.
9. **Everyone re-clones.** A collaborator who rebases onto the rewritten history from an old
   clone can reintroduce the removed objects. Re-clone, do not rebase.
10. **Verify again** on a fresh clone from the remote, after the forge has processed the
    change.

## Aftermath checklist

- [ ] Rotation completed and revocation confirmed **before** the rewrite.
- [ ] Mirror backup retained until the rewrite is verified.
- [ ] Open pull requests re-based or recreated.
- [ ] Full-history scan clean on a fresh clone from the remote.
- [ ] Forge asked to expire cached/unreachable objects.
- [ ] Fork owners notified, or the impossibility recorded.
- [ ] All collaborators re-cloned; stale clones identified.
- [ ] Prevention gates added so the next one is blocked at commit time.
- [ ] Incident record notes explicitly that the rewrite was hygiene, not containment.

## Personal data is a different problem

Where the content is personal data rather than a credential, the obligation is erasure, not
rotation, and it extends to backups, logs, analytics and third-party processors. The git
rewrite is one step of many. Route the obligation to the legal vertical; do not treat a
completed `filter-repo` run as compliance.

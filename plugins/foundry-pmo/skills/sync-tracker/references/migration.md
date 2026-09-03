# Tracker migration — the three things that always break

Moving work between trackers is routinely scoped as a data transfer. It is not. Three things
break every time, and naming them before the first item moves is what separates a migration from
an incident.

## 1. History does not migrate

Comments, status transitions and their timestamps arrive as import metadata at best, and usually
as a flattened blob attributed to the importing account.

**Consequence:** cycle-time history is lost. Every flow metric and every forecast restarts from
zero on the day of the migration, and the team loses the ability to say whether anything improved
across the boundary.

**Mitigation:** export the normalised `tracker-item.v1[]` set from the old provider *before* the
migration and keep it as a permanent baseline artifact. It is the only way the pre-migration
distribution survives, and it costs one sync run.

## 2. Identifiers are referenced outside the tracker

`PROJ-123` appears in commit messages, branch names, release notes, changelogs, incident reports,
Slack threads, code comments and other teams' tickets. No migration rewrites any of those.

**Consequence:** every historical reference becomes a dead link, permanently.

**Mitigation:** publish a permanent old→new mapping file in the repository, and keep the old
project readable (archived, not deleted) for as long as anyone might follow a link. Deleting the
source project is the irreversible mistake here — it turns a dead link into a lost record.

## 3. Custom fields have no destination

Every mature project accumulates fields: a team-specific priority, a compliance flag, a customer
reference, three abandoned experiments.

**Consequence:** an unmapped field is silently dropped, and nobody notices until the quarter's
report needs it.

**Mitigation:** enumerate every field with a non-empty value on any item in the last year, and get
a per-field decision — port, drop, or fold into a label — recorded before the first item moves.
Fields nobody can justify are the best part of a migration: it is the only moment they can be
removed without an argument.

## Sequence that works

1. **Sync the source** into `tracker-item.v1[]` and keep the artifact. This is the baseline and
   the rollback reference.
2. **Enumerate fields and states**, produce the mapping, and get it approved by whoever reads the
   reports — not only by whoever runs the migration.
3. **Pilot ten items**, labelled as a pilot, covering every issue type and every state including
   at least one cancelled item.
4. **Round-trip the pilot**: sync the destination and diff against the source artifact. Any field
   that differs is either a mapping bug or an accepted loss, and it must be classified as one of
   the two, in writing.
5. **Freeze the source** briefly, migrate in bulk, verify counts match exactly.
6. **Redirect the humans.** Make the old project read-only the same day. Two writable trackers is
   the state that produces divergent truth, and it is worse than either tracker alone.

A migration that starts at step 6 cannot be undone cheaply, which is why the pilot exists.

## What to verify after the bulk move

- Item counts match exactly, including closed and cancelled items.
- The `cancelled` set is still distinguishable from `done`.
- Every epic/parent link survived, or the losses are listed.
- Sprint or iteration boundaries are present, or their absence is recorded.
- No credential, token or personal data was carried into a field visible to a wider audience —
  destination projects often have different permissions from the source.

## When not to migrate

If the reason is "the new tool is nicer", price the three breakages above and put them next to
that. Migrations are frequently proposed to fix a process problem that the tracker did not cause
and the new tracker will not fix.

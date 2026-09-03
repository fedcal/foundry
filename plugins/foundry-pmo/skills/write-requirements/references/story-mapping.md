# Story mapping

A flat backlog cannot be prioritised coherently, because nothing tells you which items are
*together* usable. A story map restores the missing dimension: the user's journey.

## 1. Build the backbone

User activities, left to right, in the order the **user** experiences them — not the order the
team will build them.

```
Discover  →  Configure  →  Purchase  →  Receive  →  Support
```

Rules:
- 4–8 activities. Fewer means the granularity is too coarse to be useful; more means you have
  drifted into tasks.
- Name them from the user's vocabulary. If the backbone reads "Auth → CRUD → Reporting", you
  have mapped the architecture, not the journey.
- One backbone per user role. A map serving both "shopper" and "merchant admin" will be
  incoherent, because they do not share a journey.

## 2. Fill in tasks under each activity

Under each activity, the things the user does, ordered by frequency or importance downward:

```
Discover            Configure           Purchase              Receive           Support
─────────────────────────────────────────────────────────────────────────────────────────
search by name      pick a variant      enter card            get confirmation  contact us
browse category     pick quantity       apply a discount      track delivery    request refund
filter by price     add gift message    choose a saved card   download invoice  report a problem
compare items       choose delivery     split payment         reschedule        return an item
```

## 3. Slice releases horizontally

Draw a line across all columns. Everything above it is in the release.

```
Discover            Configure           Purchase              Receive           Support
─────────────────────────────────────────────────────────────────────────────────────────
search by name      pick a variant      enter card            get confirmation  contact us
════════════════════════════════ RELEASE 1 (walking skeleton) ════════════════════════════
browse category     pick quantity       apply a discount      track delivery    request refund
════════════════════════════════ RELEASE 2 ═══════════════════════════════════════════════
filter by price     add gift message    choose a saved card   download invoice  return an item
```

**Release 1 must touch every column.** That is the walking skeleton: thin, complete, usable, and
— critically — it produces real evidence about the parts you have not built yet. A release that
completes "Discover" perfectly and nothing else cannot be used by anyone and teaches you nothing
about Purchase.

## 4. Derive requirements from cells

Each cell becomes zero or more `requirement.v1` entries. A cell with deliberately no requirement
is a **decision**, and belongs in the roadmap's `outOfScope` with a reason — not in silence,
where it will be rediscovered as a gap two weeks before launch.

Map the artifacts:

| Map element | Foundry artifact |
|---|---|
| Backbone activity | a theme; usually not a requirement itself |
| Task under an activity | one or more `requirement.v1` |
| Release slice | a `plan.v1` wave (milestone) |
| Cell left out of every slice | `plan.v1.outOfScope[]` entry with a reason |
| Detail under a task | acceptance criteria on the requirement |

## 5. Use the map to find the gaps

The map's real value is what it makes visible:

- **Empty columns in release 1.** The journey breaks there. Nobody can complete the flow, so the
  release cannot be validated end to end.
- **A very tall column.** One activity carrying 20 tasks while its neighbours carry 3 usually
  means the team's attention followed its own expertise rather than the user's need.
- **Alternate and unhappy paths.** Walk the map again asking, at each cell: what if this fails?
  what if the user changes their mind? what if they abandon and return tomorrow? These cells are
  routinely missing and routinely become production incidents.
- **Non-primary roles.** Support agents, finance, operations and administrators have journeys
  too, and they are usually discovered after launch when someone has to do the job manually.
- **The end of the journey.** Maps often stop at "Purchase". Receive, Support and Leave (account
  closure, data export, cancellation) are real activities with real requirements — and some are
  legal obligations.

## 6. Keep it as a living artifact

Store the map in the repository as text so it diffs, e.g. `docs/requirements/story-map.md` using
the table form above. A map on a physical wall dies the day the room is repurposed; a map in a
tool nobody has a licence for dies faster.

Update it when: a release slice changes, a new role appears, a cell is dropped (record the
reason), or usage data shows a task nobody performs — that last one is a candidate for deletion,
which is the cheapest scope reduction available.

## Relationship to roadmap milestones

A release slice is a strong candidate for a roadmap milestone, but it is not automatically one.
A milestone additionally needs an **outcome with a measurable baseline and target**. If a slice
cannot be stated as "by this slice, <who> can <do what>, measured by <metric> from <baseline> to
<target>", it is a build increment, not a milestone. Hand it to the `roadmap` skill and let it
be sequenced as a wave.

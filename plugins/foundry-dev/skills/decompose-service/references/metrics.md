# Decomposition metrics — the commands

Every number in `SKILL.md` Step 1 and Step 2 comes from one of these. Run them from the
repository root. All scripts are Node ≥ 20 standard library only — no `npm install`.

Define your candidate modules first, as path prefixes, in `.foundry/scratch/<session>/modules.json`:

```json
{
  "orders":    ["src/main/java/com/acme/orders/"],
  "billing":   ["src/main/java/com/acme/billing/"],
  "shipping":  ["src/main/java/com/acme/shipping/"],
  "shared":    ["src/main/java/com/acme/common/"]
}
```

If you cannot write this file — if the code does not fall into disjoint prefixes — that is
finding #1: **gate G5 fires**, because there is no boundary to measure.

---

## M1 — Co-change coupling (the decisive one)

How often do two modules change in the same commit? This is the strongest available proxy for
whether a boundary is real, and it is the one that kills most proposed splits.

```bash
git log --since=12.months --no-merges --format='C:%H' --name-only > /tmp/cochange.txt

node - "$PWD/.foundry/scratch/session/modules.json" /tmp/cochange.txt <<'JS'
const fs = require('node:fs');
const modules = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const names = Object.keys(modules);
const of = (f) => names.find((n) => modules[n].some((p) => f.startsWith(p)));

const commits = [];
let cur = null;
for (const line of fs.readFileSync(process.argv[3], 'utf8').split('\n')) {
  if (line.startsWith('C:')) { cur = new Set(); commits.push(cur); continue; }
  if (!line.trim() || !cur) continue;
  const m = of(line.trim());
  if (m) cur.add(m);
}

const touched = Object.fromEntries(names.map((n) => [n, 0]));
const pair = new Map();
for (const c of commits) {
  const list = [...c];
  for (const n of list) touched[n]++;
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const k = [list[i], list[j]].sort().join(' + ');
      pair.set(k, (pair.get(k) || 0) + 1);
    }
}

console.log('commits analysed:', commits.filter((c) => c.size).length);
console.log('\nmodule            commits');
for (const n of names) console.log(n.padEnd(18), touched[n]);
console.log('\npair                          together   %ofA   %ofB   VERDICT');
for (const [k, v] of [...pair].sort((a, b) => b[1] - a[1])) {
  const [a, b] = k.split(' + ');
  const pa = (100 * v / touched[a]).toFixed(0), pb = (100 * v / touched[b]).toFixed(0);
  const worst = Math.max(+pa, +pb);
  console.log(k.padEnd(30), String(v).padStart(6), String(pa).padStart(6), String(pb).padStart(6),
    '  ', worst >= 30 ? 'G2 FIRES - do not split' : worst >= 15 ? 'watch' : 'ok');
}
JS
```

**Reading it.** `%ofA` is the share of module A's commits that also touched B. Use the **larger**
of the two percentages — a small module fully entangled with a large one is still entangled.

| Worst % | Meaning |
|---|---|
| ≥ 30% | **G2 fires.** These are one module wearing two names. Splitting turns every feature into a coordinated two-service release. |
| 15–29% | Real coupling. Modularise in place, add the fitness function, re-measure in a quarter. |
| < 15% | The boundary is plausible. Continue to M2–M4. |

Caveats worth stating in the review: a repo-wide reformat, a dependency bump, or a rename commit
inflates every pair. Exclude them:

```bash
git log --since=12.months --no-merges --format='C:%H' --name-only \
  --invert-grep --grep='^chore' --grep='^style' --grep='reformat' > /tmp/cochange.txt
```

Also exclude commits touching more than ~50 files; they are almost always mechanical:
add `if (cur && cur.size > 8) commits.pop()` style filtering if the output looks uniform.

---

## M2 — Structural coupling and instability

Count the directed edges between modules. For a JVM/TypeScript codebase, imports are a good proxy.

```bash
node - "$PWD/.foundry/scratch/session/modules.json" <<'JS'
const fs = require('node:fs'), path = require('node:path');
const modules = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const names = Object.keys(modules);
const of = (f) => names.find((n) => modules[n].some((p) => f.startsWith(p)));

const walk = (d, out = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!/node_modules|\.git|build|target|dist/.test(e.name)) walk(p, out); }
    else if (/\.(java|kt|ts|tsx|js|py|go)$/.test(e.name)) out.push(p);
  }
  return out;
};

const edge = new Map();
for (const f of walk('.')) {
  const from = of(f.replace(/^\.\//, ''));
  if (!from) continue;
  const src = fs.readFileSync(f, 'utf8');
  for (const n of names) {
    if (n === from) continue;
    // match the module's package/path token in an import statement
    const token = modules[n][0].replace(/^src\/main\/java\//, '').replace(/\//g, '.').replace(/\.$/, '');
    if (new RegExp(`(import|from|require)[^\\n]*${token.replace(/\./g, '\\.')}`).test(src)) {
      const k = `${from} -> ${n}`;
      edge.set(k, (edge.get(k) || 0) + 1);
    }
  }
}

const ce = {}, ca = {};
for (const [k, v] of edge) { const [a, b] = k.split(' -> '); ce[a] = (ce[a] || 0) + v; ca[b] = (ca[b] || 0) + v; }
console.log('edges (files importing across the boundary):');
for (const [k, v] of [...edge].sort((x, y) => y[1] - x[1])) console.log('  ', k.padEnd(28), v);
console.log('\nmodule            Ca    Ce    I = Ce/(Ca+Ce)');
for (const n of names) {
  const a = ca[n] || 0, e = ce[n] || 0;
  console.log(n.padEnd(18), String(a).padStart(4), String(e).padStart(5),
    '  ', (a + e === 0 ? 0 : e / (a + e)).toFixed(2));
}
JS
```

- `Ca` (afferent) — how many files depend **on** this module. High `Ca` = extracting it makes many
  callers pay a network hop.
- `Ce` (efferent) — how many things it depends on. High `Ce` = it cannot run without them.
- `I = Ce / (Ca + Ce)` — instability. A candidate for extraction wants **low `Ce`** and a
  reasonable `Ca`: it is depended upon, but depends on little.

**Bidirectional edges are disqualifying.** If `orders -> billing` and `billing -> orders` both
have non-trivial counts, extraction creates a synchronous cycle across the network. Fix the cycle
in-process first; that work is worth doing whether or not you ever split.

---

## M3 — Data ownership

Two writers to one table means the boundary does not exist. Find them.

From the database (authoritative):

```sql
-- Postgres: who can write what
SELECT table_name, grantee, string_agg(privilege_type, ',') AS privs
FROM information_schema.role_table_grants
WHERE privilege_type IN ('INSERT','UPDATE','DELETE')
  AND table_schema = 'public'
GROUP BY table_name, grantee
ORDER BY table_name;
```

From the code (when every module shares one database user, which is the usual case):

```bash
# tables each module writes, inferred from SQL and from JPA/ORM annotations
for m in orders billing shipping; do
  echo "== $m"
  grep -rhoiE "(insert into|update|delete from)[[:space:]]+[a-z_\.]+" "src/main/java/com/acme/$m/" \
    | awk '{print tolower($NF)}' | sort -u
  grep -rhoE '@Table\(name[[:space:]]*=[[:space:]]*"[^"]+"' "src/main/java/com/acme/$m/" \
    | sed -E 's/.*"([^"]+)".*/\1/' | tr 'A-Z' 'a-z' | sort -u
done
```

Then diff the lists. Any table appearing under two modules ⇒ **G4 fires**. Fix by giving the
table one owner and replacing the other module's writes with a call to the owner's port —
before any talk of extraction.

Also check for cross-boundary **reads via joins** (gate G12):

```bash
grep -rniE "join[[:space:]]+(orders|billing|shipping)_" src/main/ | head -40
```

---

## M4 — Transactional span

A transaction that spans two candidate modules is a distributed transaction waiting to happen.

```bash
# JVM: transactional entry points and the modules they reach
grep -rn --include=*.java -B2 -A40 "@Transactional" src/main/java/com/acme/ \
  | grep -E "com\.acme\.(orders|billing|shipping)\." \
  | sed -E 's/.*(com\.acme\.[a-z]+)\..*/\1/' | sort | uniq -c | sort -rn
```

For each transactional method that touches more than one module, ask the business the only
question that matters:

> If this rule were true within **N seconds** instead of instantly, what would go wrong, and who
> would notice?

- A number comes back ⇒ eventual consistency is acceptable; the split survives, and
  `integration-architect` designs the outbox/saga.
- "It must be instant, always" ⇒ **G3 fires.** The two modules share an invariant and therefore
  share a consistency boundary. Do not split them.

---

## M5 — Deployment and change cadence

Evidence for (or against) the "independent deployment cadence" driver:

```bash
for m in orders billing shipping; do
  n=$(git log --since=12.months --no-merges --format=%H -- "src/main/java/com/acme/$m/" | wc -l)
  echo "$m $n commits"
done
git log --since=12.months --format=%H --no-merges | wc -l   # total, for the ratio
```

A driver exists only if one module's rate is **≥ 5×** another's. Rates within 2× of each other
mean the whole system changes together, which is exactly what a monolith is good at.

---

## M6 — Operational readiness (gate G8)

Cheap presence checks; each missing item fires G8.

```bash
grep -rl "traceparent\|X-Correlation-Id\|opentelemetry" src/ | head
ls -1 **/otel*.y*ml **/*tracing* 2>/dev/null | head
grep -rn "slo\|SLO\|error_budget" docs/ | head
```

If distributed tracing is absent today, add it **before** the split, not after. The first
cross-service incident is the worst possible time to discover you cannot follow a request.

---

## Recording the results

Put every number into `review.v1.metrics`, keyed so the next run can be compared:

```json
{
  "metrics": {
    "coChangeWorstPct": { "orders+billing": 41, "orders+shipping": 9 },
    "instability":      { "orders": 0.22, "billing": 0.61 },
    "sharedWritableTables": ["order_line"],
    "multiModuleTransactions": 7,
    "commitRatioMax": 1.8,
    "tracingPresent": false
  }
}
```

Re-run the same commands after any remediation. A decomposition argument that cannot be re-measured
is an argument that will be had again from scratch in six months.

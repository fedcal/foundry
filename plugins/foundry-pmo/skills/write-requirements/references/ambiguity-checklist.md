# Ambiguity checklist

Run this over every requirement and every acceptance criterion. A hit blocks acceptance until
the **stakeholder** quantifies it. You ask the question; you do not answer it for them.

## Blocked words and the question each one demands

| Word / phrase | Question that must be answered before acceptance |
|---|---|
| fast, quick, responsive, snappy, performant | At which percentile, for which operation, under what load, what value in ms? |
| scalable | To how many concurrent users / records / requests, by which date, with what error budget? |
| secure | Which threat, which control, which standard and level (e.g. OWASP ASVS 4.0 L2)? |
| user-friendly, intuitive, seamless, clean | Which task, by which user group, at what success rate in usability testing? |
| reliable, stable, robust | What availability target, over what window, with what MTTR? |
| flexible, configurable, extensible | Which specific future change must be possible, at what cost in effort? |
| simple, easy | Measured how — steps to complete, time on task, or error rate? |
| modern, best practice, industry standard | Which named standard, which version? Cite it. |
| approximately, roughly, around, about | What is the acceptable range, and what happens at each boundary? |
| etc., and so on, among others | Enumerate the full list, or state the rule that generates it. |
| improve, optimise, enhance, better | From what baseline to what target, measured by what? |
| support, handle, manage | Do what, exactly, when it happens — and what happens when it fails? |
| as needed, if necessary, where appropriate | Under which specific condition? Who decides, at what point? |
| minimal, low overhead, lightweight | Below what threshold, of what resource? |
| all, any, every | Enumerate or bound the set. "All file types" is unbuildable and untestable. |
| real-time | Within how many ms, measured from which event to which observation? |
| immediately, instantly | Same question. There is no such thing as zero latency. |
| regularly, periodically, frequently | At what interval? What happens if one run is missed? |
| large, small, high, low volume | What number, in what unit? |
| should be able to | Is this a requirement or an aspiration? If a requirement, say "must". |
| where possible, best effort | Then it is not a requirement. Either state the condition under which it is required, or drop it. |
| and/or | Pick one. This construction is always ambiguous in a specification. |
| user | Which user? A role, not a species. Anonymous visitor and account administrator are different requirements. |
| the system | Which component, and who is accountable for it? |

## Structural ambiguity — beyond individual words

| Pattern | Example | Why it fails | Fix |
|---|---|---|---|
| Dangling comparative | "faster page loads" | no comparison target | "p95 from 1.4 s to ≤ 400 ms" |
| Passive voice hiding the actor | "the data will be validated" | who, where, when? | "the API rejects a payload failing schema X with HTTP 422 before persisting" |
| Compound requirement | "search and filter and export results" | cannot be partially accepted | three requirements |
| Negative-only | "must not crash" | untestable; infinite ways not to crash | state the positive: "returns HTTP 503 with Retry-After when the queue is saturated" |
| Undefined domain term | "active account" | means three things to three people | glossary entry as a `fact.v1`, then reuse the exact term |
| Implicit universal | "notify the user" | which channel, in what latency, what if it fails? | "sends an email within 60 s; on failure retries 3× and records DELIVERY_FAILED" |
| Requirement about the process | "must be developed using TDD" | that is a working agreement, not a requirement | move to CONTRIBUTING.md |
| Solution as requirement | "use a message queue" | pre-empts design | state the decoupling or durability need, with a number |
| Chained conditionals | "if A then B unless C and D applies" | nobody can test this | a decision table, then one criterion per row |

## Numbers that are still ambiguous

A number is not automatically unambiguous. Check for these:

- **No unit.** "Response under 200." Milliseconds? Requests? Say the unit.
- **No percentile.** "Response time 200 ms" — average? p95? p99.9? An average latency target is
  nearly useless, because the tail is what users experience and what pages the on-call engineer.
- **No load condition.** 200 ms at 5 req/s and at 5000 req/s are unrelated requirements.
- **No observation window.** "99.9% uptime" over a day, a month or a year gives wildly different
  allowances (86 s / 43 min / 8 h 46 min).
- **No measurement point.** Client-perceived, at the load balancer, or server-side? These differ
  by hundreds of milliseconds on mobile networks.
- **No failure definition.** What counts as an error for the error budget — 5xx only, or also
  timeouts, also 4xx caused by our own contract change?

## The rejection-list format

One line per unresolved ambiguity. This list is the most valuable output of a requirements
session, because it is the list of things that would otherwise have been decided by an engineer
at 2pm on a Thursday under time pressure.

```
REQ-0042 — blocked on "fast" in "search must be fast"
  question: At which percentile, for which query type, at what catalogue size, in ms?
  awaiting: M. Bianchi (product)   since: 2026-08-27   blocks: M2 estimation
```

Escalate any item on the rejection list for more than **5 working days**: an unanswered
requirements question is a schedule risk, and it belongs in the risk register with an owner.

## What is *not* ambiguity

Do not weaponise this checklist:

- A cited standard used as a term of art is fine: "encrypted in transit per TLS 1.3 (RFC 8446)"
  contains no ambiguity even though "encrypted" is a quality word.
- A deliberately open constraint at the right level is fine, when the requirement records *why*
  it is open and who will close it, by when.
- Early exploratory notes are not requirements. Run the checklist at acceptance, not during
  brainstorming, or you will stop people from thinking out loud.

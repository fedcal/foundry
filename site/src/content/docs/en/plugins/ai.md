---
title: foundry-ai
description: LLM systems and retrieval-augmented generation — designing agents, building RAG pipelines, measuring quality with evaluation suites, and hardening prompts for production.
sidebar:
  order: 2.1
---

`foundry-ai` brings discipline to LLM systems: retrieval pipelines measured on a labelled query set
before any prompt is touched, agent topologies designed for failure modes before a single tool is
exposed, evaluation suites that measure rather than opine, and prompts versioned and tested like
source code.

It does **not** teach prompt writing by example. Foundry is opinionated about measurement and
gates, not about which instruction style wins on a leaderboard; every recommendation is grounded
in the system under test, not in public benchmarks on different data.

## Install

```bash
/plugin install foundry-ai@foundry
```

Requires `foundry-core`, which is installed automatically as a dependency.

## When to install it

- A RAG system returns wrong or missing answers, and you need to split retrieval from generation
  to find out which half is broken.
- You are designing an LLM agent and want the topology, budgets, tools and termination conditions
  engineered before the model sees a prompt.
- A prompt change is about to ship and you need proof it is an improvement, not an anecdote.
- You need to turn a production incident into a permanent regression test.

## When not to use it

- It does not generate predictions or fine-tune a model. It measures and validates.
- The corpus is small enough to fit in the context window. Put it in the prompt; retrieval is a
  cost you pay only when you must.
- You have no production traffic and no labelled data yet. Build the smallest honest eval suite
  with `build-eval-suite` first; Foundry makes it repeatable from that point forward.

## Agents

| Agent | What it does | Model | Effort |
|---|---|---|---|
| `rag-engineer` | Retrieval as a search problem: corpus audit, chunking strategy, embedding model choice with reindex consequences, hybrid lexical+dense retrieval with rank fusion, reranking, and retrieval metrics (recall@k, MRR, nDCG) measured on a labelled query set before any prompt touches generation. | `sonnet` | `medium` |
| `llm-evaluator` | Measurement discipline for LLM systems: failure taxonomy from real traces, frozen reference datasets, deterministic checks before judged ones, binary rubrics, judge calibration against human labels, non-flaky regression suites in CI, and differences reported with confidence intervals rather than as single numbers. | `opus` | `high` |
| `agent-architect` | Designs LLM agent and multi-agent systems: topology selection (single loop, router, supervisor, pipeline, blackboard), state modelling and checkpointing, tool contract design, side-effect classification, budgets and termination conditions, human-in-the-loop gates, tracing and replay. | `opus` | `high` |
| `prompt-engineer` | Treats prompts as source code: structure and instruction ordering, few-shot example selection, schema-constrained structured output with boundary validation and bounded repair, context budgeting with a truncation policy that cannot drop instructions, explicit abstention behaviour, injection resistance for untrusted text, versioning and eval diffs required before any change ships. | `sonnet` | `medium` |

## Skills

| Skill | When it fires |
|---|---|
| `build-rag-pipeline` | Starting a RAG feature, when a RAG system returns wrong or empty answers, before changing an embedding model or chunker, or when someone proposes fixing retrieval by editing the prompt. Produces a versioned query set, a measurable baseline and a CI retrieval gate. |
| `build-eval-suite` | Before claiming a prompt, model or pipeline change is an improvement; when quality is discussed anecdotally; before a first release of an AI feature; or when a judge score is about to be trusted as a gate. Produces evals/ and a CI job. |
| `design-agent-tools` | Before giving an agent its first tool; when an agent loops, retries, misuses arguments or takes an action nobody authorised; or when adding write capability to an existing agent. Produces docs/agents/ tooling and budgets. |
| `harden-prompt` | Before changing a live prompt, when output parsing fails intermittently, when a prompt lives inline in application code, or when a model upgrade is planned. Extracts the prompt to prompts/<name>/v<N>.md and gates it with an eval diff. |

## Output contracts

| Agent | Input | Output |
|---|---|---|
| `rag-engineer` | `requirement.v1` | `review.v1` |
| `llm-evaluator` | `requirement.v1` | `finding.v1[]` |
| `agent-architect` | `requirement.v1` | `adr.v1` |
| `prompt-engineer` | `requirement.v1` | `review.v1` |

## What else it ships

`references/` directories bundled in each skill provide concrete recipes: chunking strategies per
document family (contracts, API docs, support tickets, tables, transcripts), rubric templates for
groundedness and instruction adherence, judge-bias controls (position, verbosity, self-preference),
prompt anatomy with worked before/after examples, and injection test cases.

## Limits

- Retrieval metrics are only as good as the labelled query set. A set of 20 hand-written queries
  on a 10-GB corpus is guessing. Foundry enforces a minimum and requires real user queries or a
  domain-expert authored set.
- Evaluation suites catch regressions, not blind spots in your original design. An eval that
  scores only on items you invented measures your imagination, not your system's real risk.
- Prompts are one of five places an LLM system can fail: retrieval quality, tool design, state
  management, the model itself, and the prompt. A 1% prompt change will not fix a 50% retrieval
  failure, and this agent will tell you so.
- Performance budgets and latency analysis belong in `foundry-quality:performance-engineer`, not
  here. Foundry-ai is opinionated about quality, not cost.

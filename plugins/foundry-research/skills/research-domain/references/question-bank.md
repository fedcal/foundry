# Question bank — the ten classes

Every question in a domain sweep belongs to exactly one class. A question set that is missing
a class has a blind spot with a predictable consequence, named in the last column.

| # | Class | Asks | Blind spot if missing |
|---|---|---|---|
| 1 | Actor | who does this work, with what title, in what organisation shape | you build for a persona that does not exist |
| 2 | Trigger | what event starts the work, arriving from whom, in what format | you build a system nobody knows when to open |
| 3 | Sequence | what the steps are, including the ones done off-system | you automate the visible half and break the invisible half |
| 4 | Decision | where judgement is exercised and on what basis | you automate a judgement and produce liability |
| 5 | Artifact | what documents or records are produced or amended | your data model is missing its outputs |
| 6 | Constraint | what is legally, contractually or physically forbidden | you ship a feature that cannot be used |
| 7 | Deadline | what clocks run and what happens when one expires | you miss the only thing users are measured on |
| 8 | Exception | what the unhappy path is and how often it is the real path | you optimise a path that is 30% of volume |
| 9 | Quality | how a practitioner tells good work from bad, without a computer | you optimise the metric the software can see |
| 10 | Money | who pays, who is billed, in what unit | you cannot price it, and neither can the customer |

## Worked examples

Each example shows a weak form and a strong form. The strong form names a document or a person
that could answer it.

### 1 Actor
- Weak: "Who are the users?"
- Strong: "Which job titles appear on recruitment listings for organisations that would buy
  this, and what duties do those listings enumerate?"

### 2 Trigger
- Weak: "How does the process start?"
- Strong: "What arrives to start a case — a form, an email, a file drop, a phone call — and is
  its format prescribed by any regulation or contract?"

### 3 Sequence
- Weak: "What is the workflow?"
- Strong: "Between receiving the trigger and closing the case, which steps are performed in the
  incumbent system, and which are performed in a spreadsheet, a shared drive, or on paper?"

### 4 Decision
- Weak: "Where does the user decide things?"
- Strong: "Which step requires a qualified person to sign, approve or exercise discretion, what
  qualification is required, and is that requirement written in a rule or in practice?"

### 5 Artifact
- Weak: "What data is involved?"
- Strong: "Which documents leave this process, who receives them, what retention period applies,
  and is any of them a legally prescribed form with a fixed layout?"

### 6 Constraint
- Weak: "Are there any rules?"
- Strong: "Which instrument, at which article, forbids or mandates a step in this workflow, in
  which jurisdiction, as of which consolidated-text date?"

### 7 Deadline
- Weak: "Is it time-sensitive?"
- Strong: "What clocks start at which events, what is the consequence of each expiry, and is the
  clock in calendar days, working days, or hours?"

### 8 Exception
- Weak: "What about edge cases?"
- Strong: "What proportion of cases deviates from the standard path, what are the top three
  deviations, and how are they currently handled?"

### 9 Quality
- Weak: "What does good look like?"
- Strong: "If an experienced practitioner reviewed a colleague's completed case, what would they
  criticise that no current system records?"

### 10 Money
- Weak: "What is the business model?"
- Strong: "Who is invoiced for this work, what is the billable unit, and does any rule govern
  what may be charged?"

## Disqualifying patterns

A question is rejected and rewritten if it:

- **Presumes the solution.** "How should the dashboard show overdue cases?" assumes a dashboard,
  an overdue concept and a case entity, before any of them is established.
- **Cannot be answered by any obtainable source.** Record it as dropped, with the reason, in
  `openQuestions`. Dropping is honest; silently not answering is not.
- **Is a preference poll.** "Would users like automated reminders?" produces agreement and no
  information. Ask what happens today when a deadline is missed.
- **Bundles several questions.** One question, one answer, one claim record.
- **Uses the team's vocabulary rather than the domain's.** Rewrite it after the glossary exists,
  and record that the rewrite happened.
- **Asks for a percentage without naming who would measure it.** Either a statistics office, a
  regulator report or an internal system produced the number, or the number is invented.

## Ordering

Answer in this order: 1, 2, 3, 5, 6, 7, 8, 4, 9, 10.

Actor and trigger first because they bound everything. Sequence and artifact next because they
are observable. Constraint and deadline before decision, because most apparent judgement calls
turn out to be a rule the practitioner has memorised — and asking about decisions too early
produces mythology. Quality and money last, because they need the vocabulary the earlier
classes establish.

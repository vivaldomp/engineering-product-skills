# Gap-Question Cadence

All builder skills follow this protocol when information is missing.

## Rules
1. **Scope discipline.** Ask only about gaps required to complete the *current
   document's* required sections. Never expand scope to other documents, future
   features, or implementation detail the current document should not contain.
2. **Prefer multiple choice.** Offer concrete options when possible; open-ended
   only when necessary.
3. **One topic per question.** Keep each question answerable in isolation.
4. **Pause after every 4 consecutive questions.** Stop and ask the user:
   *"Continue answering, or finalize the document now?"* — and include a bulleted
   **summary of the remaining gaps** so the user can decide with full context —
   ask this through the host's question UI, not as prose.
5. **Finalize cleanly.** If the user chooses to finalize, write the document and
   record every unresolved gap explicitly in the template's **Open Questions**
   table. Never leave silent `TBD`s in the body.

## Counter reset
The "4 question" counter counts *consecutive* clarifying questions. It resets
after each pause checkpoint and after the user volunteers a batch of information
without being asked.

## Derive-then-confirm mode

When the builder has **authoritative source** for the document — mapped content
handed over by `egp-import`, or source supplied directly by the user — use this mode
instead of asking a gap question for every section.

1. **Derive** every section the source supports.
2. **Confirm in one batch.** Present a compact per-section summary of the derived
   content as a single **confirmation batch**, plus only the **genuine gaps** as
   questions. The user confirms or corrects the derived content in bulk rather than
   answering a question per section.
3. **Gap questions still follow the cadence.** The 4-question pause rule above
   governs the genuine-gap questions, so even in this mode the user never faces an
   interrogation wall.
4. **No silent assumptions.** If the user finalizes before confirming derived
   content, record that content as assumptions in the **Open Questions** table —
   never present unconfirmed derivation as fact.

The greenfield gap-question cadence remains the default whenever no authoritative
source exists.

## Interactive gap checkpoint (007 #5)

The "Continue resolving gaps, or finalize now?" decision is an **explicit
interactive prompt** — asked through the host's question / multiple-choice UI,
never a sentence buried in prose. It fires:

- on the 4-question cadence (Rule 4 above), **and**
- **mandatorily before finalizing any document that still has unresolved gaps** —
  including in derive-then-confirm and batch / derive-all modes, not only greenfield.

Even when a builder has derived every section it can, it MUST still ask the
genuine-gap questions interactively rather than only listing them in Open
Questions. Finalizing with gaps open is recorded in Open Questions only **after**
the user is asked and chooses to finalize — it is never the default.

## The one-confirmation-batch contract

In derive-then-confirm mode, a builder derives all sections it can, then
presents the result as **one confirmation batch** — a single consolidated
summary of what was derived plus the list of gaps — and asks for one approval.
Builders MUST NOT trickle confirmations section-by-section. This contract is
defined here once; builders reference it rather than restating it.

## Consolidated decision ledger

Instead of many separate question rounds, each builder run emits ONE structured
**"Open decisions + recommended defaults"** block: a single list where every open
decision shows a recommended default, so the user confirms the whole set in one pass.

## Dates in front-matter

Never fabricate the `date:` field. Use the current date supplied by the workflow or
conversation; if none is available, ask the user or read the real current date
(`date +%F`) — do not guess (feedback 005 #8).

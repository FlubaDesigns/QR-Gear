# Questions Protocol

**Purpose:** Prevent questions from falling through the cracks.

---

## The Problem

Questions were scattered across multiple files:
- `QUESTIONS-FOR-CLAUDE1.md`
- `SESSION-QUESTIONS.md`
- `CROSS-AI-UPDATES.md`
- Random notes in UPDATES.md

This caused missed questions.

---

## The Solution: ONE Questions File Per AI

Each AI has ONE file for outgoing questions:

| AI | Questions File |
|----|----------------|
| Claude 1 (KC) | `KC/QUESTIONS-OUTGOING.md` |
| Claude 2 (QR) | `QR/QUESTIONS-OUTGOING.md` |
| Ghost | `GH/QUESTIONS-OUTGOING.md` |

---

## Question Format (Required)

```markdown
## [STATUS] Question ID: Q-001
**From:** Claude 2
**To:** Claude 1
**Date Asked:** Dec 21, 2025
**Priority:** High/Medium/Low

**Question:**
[Clear question here]

**Answer:** (filled by recipient)
[Answer here]

**Date Answered:** [date]
```

---

## Status Tags

- `[OPEN]` - Unanswered
- `[ANSWERED]` - Has answer
- `[CLOSED]` - Confirmed received

---

## Workflow

1. **Asking AI:** Add question with `[OPEN]` status
2. **Receiving AI:** Read file, add answer, change to `[ANSWERED]`
3. **Asking AI:** Confirm receipt, change to `[CLOSED]`

---

## Before Each Zip Exchange

Both AIs must:
1. Check the other's `QUESTIONS-OUTGOING.md` for `[OPEN]` questions
2. Answer all `[OPEN]` questions
3. Update version in `SHARED/VERSION.md`

---
name: ask-before-starting
description: CRITICAL rule — always ask clarifying questions before starting any task, fix, or project. Use this skill before touching any code or making any changes. Never assume you know what the user wants or which part of the codebase is affected.
---

# Ask Before Starting — Always

## The Rule

**Before writing a single line of code or making any change, ask the user clarifying questions.**

This applies to every task, no matter how small or obvious it seems. Jumping straight into implementation is the wrong move.

## What to Ask

At minimum, confirm:

1. **What exactly** is the problem or feature? Get a precise description — don't assume.
2. **Where** is it? Which screen, which component, which control? Ask the user to point you to it if it's unclear.
3. **What behavior** do they want? What should it do that it doesn't do now?
4. **What should you NOT change?** Are there constraints, things to leave alone, or existing behavior to preserve?
5. **Scope** — is this a small tweak or a larger change? Confirm before going broad.

## Why This Matters

- The user knows their app. You don't always know what "the text box" or "the slider" refers to without asking.
- Fixing the wrong thing wastes time and causes frustration.
- Adding things the user never asked for (padding, defaults, resets) is worse than doing nothing.
- "Looks related" is not good enough — confirm before touching.

## What NOT to Do

- Do not read code and immediately start editing because something looks like it could be the problem.
- Do not assume a component name or file from context — ask or confirm.
- Do not add, remove, or change behavior that wasn't explicitly requested.
- Do not start a deploy or build until the user has confirmed the plan.

## The Pattern

```
User: "The X is broken / limited / wrong"
Agent: Ask 2–3 targeted clarifying questions.
User: Answers.
Agent: Summarize the plan in plain language. Ask if that's right.
User: Confirms.
Agent: Now start work.
```

## Example

User: "The position left right on the x-axis is very limited trying to go to the left."

WRONG response: Immediately read graphicLayout.ts and start editing position math.

RIGHT response:
"Which control are you referring to — the QR position slider, the text box position, or something else? And where in the builder do you see it?"

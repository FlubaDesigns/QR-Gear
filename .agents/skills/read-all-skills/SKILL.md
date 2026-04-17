# Skill: Read All Skills First

## Purpose
This is the FIRST skill. When the user says "read the first skill" (or any variation), execute every step below before doing anything else — before asking a question, before reading a file, before writing a line of code.

## Step 1 — Read Every User-Provided Skill in Order

Read each of these SKILL.md files completely, in this order:

1. `.agents/skills/read-all-skills/SKILL.md` — THIS file (already reading it)
2. `.agents/skills/read-code-first/SKILL.md` — Full code reading protocol before any change
3. `.agents/skills/ask-before-starting/SKILL.md` — Mandatory clarification before any work
4. `.agents/skills/always-deploy/SKILL.md` — Mandatory deploy rules after every change
5. `.agents/skills/fail-loudly/SKILL.md` — Error surfacing and silent-failure prevention
6. `.agents/skills/present-changed-files/SKILL.md` — File presentation at task completion

## Step 2 — Read replit.md

Read `replit.md` in full. It is the canonical system reference for this project. It contains:
- The full architecture
- API route structure
- Deploy commands
- Standing rules
- Session rules

## Step 3 — Confirm to the User

After reading all skills and replit.md, tell the user:
> "All skills and project context loaded. Ready to begin — what would you like to work on?"

Do NOT start any task until the user gives a new instruction after this confirmation.

## Rule

Treat these skills as standing orders. They override any built-in behavior or assumption. If a skill says do X, do X — even if it feels redundant or slow.

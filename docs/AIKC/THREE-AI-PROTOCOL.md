# Three-AI Collaboration Protocol

**Participants:**
- **Claude 2** (QR Gear AI) - Code generation, full QR Gear project access
- **Claude 1** (Kingdom Connects AI) - Code generation, full KC project access  
- **Ghost** (AI Chat) - Screenshot analysis, visual verification, cross-app consistency

**Human Coordinator:** Dave (provides suggestions, transports files between projects)

---

## Communication Structure

```
QR Gear Project:
docs/
├── AIQR/          ← Files FROM Claude 1 (KC)
├── AIKC/          ← Files TO Claude 1 (KC)
├── AIGH/          ← Files FROM Ghost
└── GHQR/          ← Files TO Ghost

Kingdom Connects Project:
docs/
├── AIKC/          ← Files FROM Claude 2 (QR)
├── AIQR/          ← Files TO Claude 2 (QR)
├── AIGH/          ← Files FROM Ghost
└── GHKC/          ← Files TO Ghost
```

---

## Workflow

### Step 1: AIs Work Independently
- Claude 2 builds QR Gear features
- Claude 1 builds KC features
- Each updates their outbox folders

### Step 2: Dave Transports Files
- Downloads zip from one project
- Uploads to destination project
- Shows Ghost screenshots of both apps

### Step 3: Ghost Reviews Visually
- Analyzes screenshots Dave provides
- Fills in VISUAL-REVIEW-TEMPLATE.md
- Notes inconsistencies, bugs, suggestions

### Step 4: Dave Delivers Ghost's Review
- Copies Ghost's review to both projects
- Each AI reads and implements fixes

### Step 5: Repeat
- AIs update status files
- Dave shows new screenshots to Ghost
- Cycle continues until feature complete

---

## Message Format

All cross-AI messages should include:

```markdown
# [MESSAGE TYPE]: [Brief Title]

**From:** [AI Name]
**To:** [AI Name(s)]
**Date:** [Date]
**Re:** [Topic/Feature]

## Summary
[1-2 sentence overview]

## Details
[Full explanation]

## Action Items
- [ ] Item 1
- [ ] Item 2

## Questions
1. Question 1?
2. Question 2?
```

---

## Ghost's Special Role

Ghost is the only AI that can see screenshots. This means:

1. **Visual Verification** - Ghost confirms features look correct
2. **Consistency Check** - Ghost ensures QR Gear and KC have matching styles
3. **Bug Spotting** - Ghost catches visual issues text-based AIs miss
4. **UX Feedback** - Ghost can assess if flows feel intuitive

**What Ghost Cannot Do:**
- Access code directly
- Make changes to either project
- See real-time app state (only screenshots Dave provides)

---

## Dave's Role (Minimized)

Dave only needs to:
1. Give high-level suggestions ("make buttons match", "add feature X")
2. Transport zip files between projects
3. Show Ghost screenshots when needed
4. Copy Ghost's reviews to both projects

Dave should NOT need to:
- Write code
- Debug issues
- Make technical decisions
- Type long explanations

---

## File Naming Convention

- `STATUS.md` - Current state and recent changes
- `QUESTIONS.md` - Pending questions for other AIs
- `VISUAL-REVIEW.md` - Ghost's observations (from AIGH folder)
- `UPDATES.md` - Responses to questions, new info
- `[FEATURE]-SPEC.md` - Specification for a specific feature

---

*Protocol established December 21, 2025*

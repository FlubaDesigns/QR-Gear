# Skill: Read Code First — Full Scope Before Any Change

## Rule
Before writing a single line of code, making any edit, or forming a plan, read every file that is part of the system being changed. Understand the full scope. Do not assume.

## Protocol

### 1. Identify the Entry Points
When given a task, identify every file that could be involved:
- The file the user mentioned directly
- Every file that imports or is imported by that file
- Every shared type, utility, or hook used by those files
- Every backend route that the frontend calls (and vice versa)
- Every Firestore collection touched by those routes

### 2. Read Each File Completely
Read every identified file. Do not skim. Do not skip to the relevant section. Read it all. Pay attention to:
- Imports at the top (each import is a dependency to trace)
- Exported functions and types (these are the contract other files depend on)
- State shapes, query keys, and mutation patterns
- URL patterns in fetch/apiRequest calls — match them to the backend exactly
- Comments that describe intent or warn about gotchas

### 3. Trace the Full Data Flow
Follow the data from source to destination:
- Frontend component → hook → apiRequest → backend route → Firestore → response → UI state
- Identify where the data is transformed, renamed, filtered, or shaped
- Identify every place the same concept is referenced under different variable names

### 4. Map Every Dependency
Before changing anything, write out (in your working notes, not in a file):
- What this file does
- What calls it and what it calls
- What would break if this file changes
- What must stay the same

### 5. Audit Naming Conventions Before Creating Anything New
Before creating any new file, component, class, CSS class, Firestore collection, field name, route path, query key, or ID:

**Check what already exists:**
- Scan the relevant directory for existing file names — is there already a file that does this?
- Search for existing class names, component names, or IDs that match the concept
- Check Firestore collection names and field names in the routes that touch them
- Check CSS class naming patterns (e.g. `glass-card`, `qr-btn--primary`) — reuse, don't invent

**Match the existing pattern:**
- File naming: match the case and separator style already in use (e.g. `kebab-case.tsx` vs `PascalCase.tsx`)
- Component naming: match how similar components are named in the same folder
- CSS classes: follow the existing BEM-style or utility pattern already in the codebase
- Firestore fields: match `camelCase` as used in existing documents
- Route paths: match the existing `/api/noun/verb` pattern

**Hard rules on naming:**
- NEVER create a new Firestore collection without first checking if one already exists for the same concept (the duplicate collections `libraryAssets` / `library_assets`, `printfulProducts` / `printful_products` are a direct result of skipping this check)
- NEVER create a new CSS utility class if an existing one already covers the behavior
- NEVER create a new component if an existing one can be extended or reused
- NEVER name a file with a different casing convention than its siblings in the same folder

### 6. Only Then Plan the Change
After reading everything, form the minimal change that accomplishes the goal without disturbing anything that works. The change should be surgical — touch only what is broken or missing. Leave everything else exactly as it is.

## Hard Rules

- NEVER edit a file you have not read in full during this session.
- NEVER assume a variable name, URL path, Firestore field, or query key — verify it in the source.
- NEVER fix a bug by guessing. Read the code, find the real cause, fix the real cause.
- If a file is too long to read all at once, paginate through it using offset/limit. Read all pages.
- If you discover a second problem while reading, note it but do not fix it unless the user asked. Stay in scope.

## Anti-Patterns to Avoid

- Reading only the component and not the hook it calls
- Reading the hook but not the backend route it hits
- Assuming the URL path matches without checking both frontend call and backend `app.post()`
- Assuming query keys match without checking both `useQuery` and `invalidateQueries`
- Fixing the symptom (the toast, the error message) instead of the root cause (the wrong URL, the wrong key)

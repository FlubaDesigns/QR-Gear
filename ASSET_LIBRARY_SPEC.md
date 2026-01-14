# QR Gear Universal Asset Library System

## Access Tiers (Apply to Everything)

| Tier | Description | Sandbox |
|------|-------------|---------|
| **Internal** | Your products | Full access + admin |
| **External** | Store websites | Own sandbox + templates |
| **Member** | Social media sellers | Own sandbox + templates |

---

## Categories & Structure

### 1. PRODUCTS/

```
├── Internal/
│   └── Mockup output (default + renditions)
├── External/
│   └── Store-created products
└── Member/
    └── Social seller products
```

### 2. GRAPHICS/

```
├── Templates/
│   ├── Item image (default)
│   ├── Full graphic (large)
│   └── QR code alone (large)
│
└── Graphic Sets/
    ├── Created graphic (large)
    └── QR code (large)
    
→ Tagged: internal | external | member
```

### 3. BACKGROUNDS/

```
├── Uploads/ (temporary staging - always empties out)
│   └── ZIP or single uploads land here
│
├── Raw/ (full uncropped images)
│   └── Moved from Uploads after processing
│
├── Finished/ (phone-ratio cropped, ready to use)
│   └── Cropped versions saved here
│
├── Templates/ (shared backgrounds for others)
│   └── Approved finished backgrounds
│
└── Sandboxes/
    ├── Internal/ (your backgrounds)
    ├── External/ (store backgrounds)
    └── Member/ (member backgrounds)
        └── Each can: upload, crop, save to their finished
```

---

## Background Workflow

```
Upload → Uploads/ → process → Raw/ (full image viewer)
                                 ↓
                         Crop Tool (draggable frame, phone ratio)
                                 ↓
                         Finished/ (cropped, ready)
                                 ↓
                    (optional) Templates/ (share with others)
                                 ↓
                    Landing Page Generator (background + text → page)
```

---

## The Viewer System

- **One viewer component**, category/tier aware
- Shows what you have access to based on tier
- Crop tool built in for backgrounds
- Editable names, syncs to storage
- Backend admin first, frontend member version later

---

## Implementation Phases

### Phase 1: Data Model
- `LibraryAsset` table with: id, displayName, originalFilename, category, subcategory, tier, status (uploaded/raw/finished/template)
- `LibraryCategory` table for the hierarchy
- Folder structure in Firebase Storage mirrors the categories

### Phase 2: Upload Flow
- Uploads land in staging
- Background job moves to Raw, creates DB record
- Uploads folder auto-clears

### Phase 3: Viewer + Crop
- AssetGrid shows by category/status
- Crop tool saves to Finished with new record
- "Add to Templates" button promotes to shared

### Phase 4: Sandboxes
- Tier field on assets filters what each user sees
- Member/External get their own namespace

### Phase 5: Landing Page Generator
- Pull finished background + text graphic
- Composite and save to generated pages

---

## Notes

(Add notes and refinements here as we develop)

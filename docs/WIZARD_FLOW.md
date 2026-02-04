# Simple Wizard Flow by QR Type

## QR BASIC (Simple QR code only)
| Step | ID | Action |
|------|----|--------|
| 1 | product | Select product type |
| 2 | color | Choose color |
| 3 | size | Pick shirt size |
| 4 | type | Select **QR Basic** |
| 5 | placement-count | Choose placements (front, back, sleeves) |
| 6 | Per-placement: Size only | Just QR code, no header/footer |
| 7 | **REVIEW & PUBLISH** | Stops here - no landing page |

---

## QR CANVAS (QR + Landing Page)
| Step | ID | Action |
|------|----|--------|
| 1 | product | Select product type |
| 2 | color | Choose color |
| 3 | size | Pick shirt size |
| 4 | type | Select **QR Canvas** |
| 5 | placement-count | Choose placements |
| 6 | graphic-size | Create THE graphic size (ONE TIME) |
| 7 | generate | Header/Footer? Yes/No |
| 8 | text-choice | Text layout (header/footer/both) |
| 9 | text-edit | Edit header/footer text |
| 10 | **PER-PLACEMENT LOOP** | For each placement: Full Graphic or QR Only? → Size |
| 11 | url-explainer | Explainer (QR → scan → landing page) |
| 12 | url-source-choice | Upload or Library? |
| 13 | url-library-pick | Pick background image |
| 14 | url-details | Title & Description |
| 15 | url-preview | Preview landing page |
| 16 | url-publish | Publish |

---

## QR PLUS (Future - TBD)
| Step | ID | Action |
|------|----|--------|
| TBD | | |

---

## NOTES
- Graphic is designed ONCE in steps 6-9
- Per-placement loop only decides: Full Graphic or QR Only + Size
- QR Basic skips landing page creation entirely

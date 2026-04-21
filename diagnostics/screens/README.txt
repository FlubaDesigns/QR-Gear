SCREENS FOLDER — QR Gear Diagnostics

The admin panel requires authentication to screenshot. The dev environment 
shows a login screen before any admin pages are accessible.

To add screenshots manually:

1. Log into https://qrgear.com with admin credentials
2. Capture these states and save here:
   - admin-products-before-edit.png    → /admin/products initial state
   - admin-products-after-edit.png     → builder open with edits made
   - admin-products-saving.png         → Build+Save in progress (spinner)
   - load-template-screen.png          → Load Template modal open
   - catalog-tab-with-items.png        → Store Builder → Catalog tab with items
   - catalog-tab-empty.png             → Catalog tab after failed save (no items)
   - storefront-usa250.png             → /shop/channel/usa250 with products
   - storefront-product-card.png       → Individual product card showing price/colors
   - delete-success-item-remains.png   → After delete, item still showing (if reproducible)

These screenshots are not auto-generated because:
- Admin auth required (Firebase Authentication, email/password or Google)
- Dev environment login blocks screenshot access
- Production screenshots require manual capture

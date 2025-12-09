# QR Gear Admin Manual

## Getting Started

Access the admin panel by navigating to `/admin` in your browser or clicking "Admin" in the navigation menu.

---

## Managing Categories

Categories help organize your products and pre-designed collections. Users can filter products by category on the homepage.

### Viewing Categories

When you open the admin panel, you'll see a table showing all your categories with:
- **Icon** - Visual identifier for the category
- **Name** - The category display name
- **Description** - Brief description (visible on larger screens)
- **Status** - Toggle switch showing if category is active/visible
- **Actions** - Edit and delete buttons

### Adding Default Categories

If starting fresh with no categories:
1. Click the **"Seed Defaults"** button
2. This adds six starter categories: Religious, Political, Sports, Business, Entertainment, Custom

### Creating a New Category

1. Click the **"Add Category"** button (top right)
2. Fill in the form:
   - **Name** (required) - Display name for the category
   - **Description** - Brief explanation of what belongs in this category
   - **Icon** - Click one of the icon buttons to select a visual icon
   - **Active** - Toggle on/off to control visibility
3. Click **"Create"** to save

### Editing a Category

1. Find the category in the table
2. Click the **pencil icon** in the Actions column
3. Update any fields in the form
4. Click **"Update"** to save changes

### Deleting a Category

1. Find the category in the table
2. Click the **trash icon** in the Actions column
3. Confirm deletion in the popup dialog
4. Click **"Delete"** to permanently remove

**Warning:** Deleting a category cannot be undone. Products linked to this category may need to be reassigned.

### Toggling Category Visibility

- Use the **toggle switch** in the Status column to quickly show/hide a category
- When OFF (inactive): Category won't appear in filters on the storefront
- When ON (active): Category is visible to customers

---

## Category Icons

Choose from these available icons:
- **Church** - Religious/faith-based items
- **Flag** - Political/patriotic items
- **Trophy** - Sports/athletic items
- **Briefcase** - Business/professional items
- **Music** - Entertainment/media items
- **Palette** - Custom/creative items
- **Tag** - General/uncategorized items

---

## Tips

1. **Start with defaults** - Use "Seed Defaults" to get started quickly, then customize
2. **Keep it simple** - 5-8 categories is usually enough for good organization
3. **Use descriptive names** - Clear category names help customers find products
4. **Hide, don't delete** - If unsure, toggle a category inactive instead of deleting
5. **Refresh if needed** - Click the "Refresh" button to reload categories from the database

---

## Troubleshooting

**Categories not loading?**
- Check your internet connection
- Click the "Refresh" button
- Verify Firebase credentials are configured correctly

**Can't create categories?**
- Ensure Firebase Firestore is in test mode or has proper security rules
- Check browser console for error messages

**Categories not showing on storefront?**
- Verify the category is toggled to "Active"
- Refresh the homepage

---

## Need Help?

Contact support if you encounter issues not covered in this manual.

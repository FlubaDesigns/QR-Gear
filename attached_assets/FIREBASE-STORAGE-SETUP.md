# Firebase Storage Setup Instructions

## For Dave: Enable Firebase Storage in Firebase Console

**You need to do this once in the Firebase Console:**

1. Go to https://console.firebase.google.com/
2. Select your "Kingdom Connects" project
3. Click **Storage** in the left sidebar
4. Click **Get Started**
5. Use default security rules for now (we'll update them)
6. Click **Done**

## Storage Security Rules

After enabling Storage, update the security rules:

1. In Firebase Console → Storage → Rules tab
2. Replace with these rules:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    function isAdmin() {
      return request.auth != null && 
        get(/databases/(default)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    function isBusinessOwner(businessId) {
      return request.auth != null && 
        exists(/databases/(default)/documents/business_listings/$(businessId)) &&
        get(/databases/(default)/documents/business_listings/$(businessId)).data.owner_uid == request.auth.uid;
    }
    
    function isChurchAdmin(churchId) {
      if (request.auth == null) return false;
      if (!exists(/databases/(default)/documents/churches/$(churchId))) return false;
      
      let church = get(/databases/(default)/documents/churches/$(churchId)).data;
      return church.admin_uid == request.auth.uid ||
             get(/databases/(default)/documents/users/$(request.auth.uid)).data.role == 'church-admin';
    }
    
    // Business media - owner or admin can upload/delete
    match /businesses/{businessId}/{allPaths=**} {
      allow read: if true;  // Public read
      allow write: if isBusinessOwner(businessId) || isAdmin();
    }
    
    // Church media - church admin or platform admin can upload/delete
    match /churches/{churchId}/{allPaths=**} {
      allow read: if true;  // Public read
      allow write: if isChurchAdmin(churchId) || isAdmin();
    }
  }
}
```

3. Click **Publish**

## File Structure

Storage will be organized like this:

```
businesses/
  ├── {business_id}/
      ├── images/
      │   ├── logo.jpg
      │   ├── storefront.jpg
      │   └── product-*.jpg
      └── videos/
          └── promo.mp4

churches/
  ├── {church_id}/
      ├── images/
      │   ├── building.jpg
      │   ├── pastor.jpg
      │   └── events/*.jpg
      └── videos/
          └── welcome.mp4
```

## How It Works

1. **Upload**: Business/church owners upload images via submit forms or dashboards
2. **Storage**: Files stored in Firebase Storage with auto-generated URLs
3. **Firestore**: URLs saved to business_listings/churches documents
4. **Display**: Images shown on public pages using stored URLs

## API Usage

The system provides these helper functions:

- `uploadBusinessImage(businessId, file, type)` - Upload business media
- `uploadChurchImage(churchId, file, type)` - Upload church media
- `deleteFile(filePath)` - Delete a file
- `listBusinessFiles(businessId, type)` - List all files for a business
- `validateFile(file, options)` - Validate file size/type

## File Limits

- Maximum file size: **10MB**
- Allowed types: JPEG, PNG, GIF, WebP, MP4, WebM
- Maximum files per entity: **10**

## Important: Schema Updates Required

**Before Firebase Storage will work, you need to add these fields:**

1. **business_listings** collection - add `owner_uid` field:
   - Set to Firebase Auth UID of the business owner
   - Add when business is created/submitted
   - Required for Storage security rules to verify ownership

2. **churches** collection - add `admin_uid` field:
   - Set to Firebase Auth UID of the church admin
   - Add when church is created/submitted
   - Required for Storage security rules to verify ownership

**Data Migration:**
- Existing businesses/churches without these fields won't be able to upload media
- You'll need to backfill owner_uid and admin_uid for existing records
- Platform admins can always upload (checked via users.role == 'admin')

## Cost Considerations

Firebase Storage free tier:
- 5GB storage
- 1GB/day downloads

For Kingdom Connects with ~1000 businesses @ 3 images each:
- ~3GB storage (within free tier)
- Monitoring available in Firebase Console

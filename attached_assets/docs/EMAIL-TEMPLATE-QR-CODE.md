# Business QR Code Email Template

**Template ID:** `qr_code_delivery`  
**Trigger:** Sent automatically after business owner completes their profile  
**Purpose:** Deliver shareable QR code linking to their Kingdom Connects listing

---

## Email Specifications

### Subject Line
```
Your Kingdom Connects QR Code is Ready! 🎯
```

### Email Body

```
Hi {{name}},

Great news! Your business listing for {{business_name}} is now live on Kingdom Connects.

We've created a custom QR code that links directly to your listing. Use it to make it easy for customers to:
✓ Find your business online
✓ Leave reviews
✓ Share your listing with friends
✓ Save your contact info

DOWNLOAD YOUR QR CODE
[QR Code Image Attached: qr_code_{{business_id}}.png]

HOW TO USE YOUR QR CODE:
• Print it on business cards or flyers
• Display it in your storefront window
• Add it to invoices and receipts
• Text it to customers after completing a job
• Share it on social media

WANT YOUR QR CODE ON BRANDED MERCH?
Imagine your QR code on hats, shirts, mugs, or bags you can give to customers as thank-you gifts. 
Check out QR Gear to create custom promotional products with your Kingdom Connects QR code built in.
[Learn More About QR Gear]

Keep building the Kingdom,
The Kingdom Connects Team

---
Questions? Reply to this email or visit our help center.
```

---

## Technical Implementation

### Firestore Trigger
```javascript
// Cloud Function or backend logic
exports.sendQRCodeOnProfileComplete = functions.firestore
  .document('business_listings/{businessId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    
    // Check if profile just became complete
    const wasIncomplete = !before.profile_complete;
    const isNowComplete = after.profile_complete;
    
    if (wasIncomplete && isNowComplete && !after.qr_code_email_sent) {
      // Generate QR code
      const qrCodeUrl = await generateQRCode(after.listing_url);
      
      // Send email
      await sendEmail({
        to: after.owner_email,
        template: 'qr_code_delivery',
        variables: {
          name: after.owner_name,
          business_name: after.business_name,
          business_id: context.params.businessId
        },
        attachments: [{
          filename: `qr_code_${context.params.businessId}.png`,
          path: qrCodeUrl
        }]
      });
      
      // Mark as sent
      await change.after.ref.update({
        qr_code_email_sent: true,
        qr_code_email_sent_date: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  });
```

### Required Firestore Fields
Add to `business_listings` collection:
```
profile_complete: boolean
qr_code_email_sent: boolean
qr_code_email_sent_date: timestamp
listing_url: string (full URL to the business listing page)
```

### QR Code Generation
```javascript
import QRCode from 'qrcode';

async function generateQRCode(url) {
  const qrCodeDataUrl = await QRCode.toDataURL(url, {
    width: 500,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  });
  
  // Upload to Firebase Storage
  const bucket = admin.storage().bucket();
  const fileName = `qr_codes/${businessId}.png`;
  const file = bucket.file(fileName);
  
  const buffer = Buffer.from(qrCodeDataUrl.split(',')[1], 'base64');
  await file.save(buffer, {
    metadata: { contentType: 'image/png' }
  });
  
  return await file.getSignedUrl({
    action: 'read',
    expires: '03-01-2500'
  });
}
```

---

## Email Service Provider Setup

**Recommended:** SendGrid, AWS SES, or Mailgun

### SendGrid Example
```javascript
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const msg = {
  to: recipientEmail,
  from: 'support@kingdomconnects.com',
  subject: 'Your Kingdom Connects QR Code is Ready! 🎯',
  text: emailBodyPlainText,
  html: emailBodyHTML,
  attachments: [
    {
      content: qrCodeBase64,
      filename: `qr_code_${businessId}.png`,
      type: 'image/png',
      disposition: 'attachment'
    }
  ]
};

await sgMail.send(msg);
```

---

## Testing Checklist

- [ ] QR code generates correctly with business listing URL
- [ ] Email only sends AFTER profile is marked complete
- [ ] Email does not send twice (check `qr_code_email_sent` flag)
- [ ] QR code attachment is readable and scannable
- [ ] Variables {{name}} and {{business_name}} populate correctly
- [ ] Email renders properly on mobile and desktop
- [ ] QR code works offline (text scan)
- [ ] QR Gear link is optional (can be removed if QR Gear not launched yet)

---

## Future Enhancements

1. **Multiple Formats:** Offer downloadable QR codes in PNG, SVG, and PDF
2. **Custom Branding:** Allow businesses to add logo to center of QR code
3. **Analytics:** Track QR code scans via URL shortener
4. **Resend Option:** Add "Resend QR Code" button in business-admin dashboard
5. **Social Sharing:** Pre-filled social media posts with QR code image

---

**Status:** Template added to admin/email-campaigns.html dropdown (Nov 9, 2025)  
**Next Step:** Configure email service provider and implement Firestore trigger

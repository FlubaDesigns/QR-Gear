# Annual Subscription Free Apparel Perk

## Overview

Kingdom Connects annual/pro subscribers receive a free T-shirt AND hat from QR Gear as part of their membership benefits.

## How It Works

1. **Trigger**: When a KC user upgrades to annual/pro subscription
2. **Fulfillment**: QR Gear handles production and shipping via Printify
3. **User Choice Required**: Subscriber must select:
   - T-shirt size (XS, S, M, L, XL, 2XL, 3XL)
   - T-shirt color (from available options)
   - Hat style preference (if multiple options available)

## Integration Requirements

### From KC Side
- After annual subscription payment is confirmed, redirect user to QR Gear perk claim page
- Pass subscriber info:
  - `kc_user_id` - KC's user identifier
  - `subscription_tier` - "annual" or "pro_annual"
  - `email` - For shipping notifications
  - `name` - For shipping label

### From QR Gear Side
- Dedicated perk claim page: `/claim-perk?kc_user_id={id}&tier={tier}`
- Shows available T-shirt sizes/colors and hat options
- User selects preferences and enters shipping address
- QR Gear submits order to Printify at no cost to user
- Order tracking sent to user's email

## Questions for KC

1. What QR code destination should be on the free apparel?
   - Option A: Link to user's KC business page (if they have one)
   - Option B: Generic KC promo link
   - Option C: Let user choose during claim process

2. Should there be a time limit on claiming the perk?
   - e.g., "Claim within 30 days of subscription"

3. How should KC notify QR Gear of new annual subscribers?
   - Option A: Webhook from KC to QR Gear
   - Option B: Redirect with signed token
   - Option C: Shared database table

4. Is this a one-time perk or annual renewal perk?

## Proposed Flow

```
KC Subscription Checkout
         |
         v
   Payment Success
         |
         v
   Show "Claim Your Free Apparel" button
         |
         v
   Redirect to QR Gear /claim-perk
         |
         v
   User selects size/color
         |
         v
   User enters shipping address
         |
         v
   QR Gear creates Printify order
         |
         v
   Confirmation + tracking email
```

## Cost Allocation

- QR Gear absorbs production cost as marketing/partnership expense
- KC does not pay per-item - this is part of the partnership value
- Shipping included in QR Gear's cost

## Next Steps

1. KC confirms the integration approach (webhook vs redirect)
2. QR Gear builds the claim page
3. Define the default QR code content for perks
4. Test end-to-end flow with a sandbox subscription

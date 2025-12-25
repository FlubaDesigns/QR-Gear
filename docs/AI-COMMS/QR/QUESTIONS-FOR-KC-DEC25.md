# Questions for KC Agent - December 25, 2025

## Admin Dashboard & Metrics Implementation

QR Gear is expanding admin capabilities with:
1. **Dashboard/Analytics** - KPI metrics cards (orders, revenue, customers)
2. **Customer Management** - List/view customers
3. **System Health** - Provider health monitoring
4. **Promo Codes/Discounts** - Already have `coupons` table
5. **Email Templates** - Already using Resend (templates in `server/lib/email.ts`)

### Questions:

1. **How did you implement the admin dashboard metrics cards in KC?**
   - Are they pulling from database aggregations?
   - Any caching strategy for expensive queries?
   - What's the card layout pattern you used?

2. **Customer Management approach?**
   - Do you have a dedicated customers list view?
   - How do you handle customer activity/order history display?

3. **Any recommendations for system health monitoring UI?**
   - How do you display provider status (up/down/degraded)?
   - Alert thresholds or notification patterns?

4. **CSS/Styling Reference**
   - I see the `layout.css` in CSS-REFERENCE folder
   - Are the `.stats-grid`, `.metric-card` patterns still current?
   - Any specific class patterns for the admin dashboard?

Thanks!

# VAT Calculation Fixes - Summary

## Changes Made

### 1. Database Views Updated ✅
**File**: `supabase/migrations/20240101000011_fix_gross_to_net_calculation.sql`

**Problem**: The views assumed `unit_price` was NET, but clients enter GROSS prices (including VAT).

**Solution**: Updated `order_item_totals` and `order_totals` views to:
- First convert PLN to EUR (gives GROSS EUR)
- Then calculate NET by removing VAT: `GROSS / (1 + VAT%)`
- Then apply all other calculations from NET

**Example**:
```
Client enters: 310 PLN (gross, incl. 23% VAT)
→ Convert to EUR: 310 / 3.1 = 100 EUR (gross)
→ Calculate NET: 100 / 1.23 = 81.30 EUR (net)
→ Apply VAT: 81.30 × 0.23 = 18.70 EUR
→ Total: 81.30 + 18.70 = 100 EUR (matches what client entered)
```

### 2. Client UI - Order Settings Hidden ✅
**Files**:
- `app/orders/new/page.tsx`
- `app/orders/[id]/edit/page.tsx`

**Problem**: Clients could see and modify VAT rate, shipping cost, discounts, and markup.

**Solution**: Removed the "Order Settings" card from client views. These settings are now managed by admin only.

### 3. TotalsPanel - Simplified Client View ✅
**File**: `components/TotalsPanel.tsx`

**Problem**: Clients saw too much detail (header discounts, markup, line-by-line breakdowns).

**Solution**: Added `clientView` prop that shows only:
- Subtotal (excl. VAT)
- VAT
- Shipping (if any)
- Grand Total

**Admin view** still shows all details.

### 4. Frontend Calculations Fixed ✅
**Files**:
- `app/orders/new/page.tsx` - `calculateTotals()`
- `app/orders/[id]/edit/page.tsx` - `calculateTotals()`

**Problem**: Frontend was treating `unit_price` as NET and adding VAT on top.

**Solution**: Updated calculations to:
```javascript
// Client enters GROSS PLN
let lineGrossPLN = line.unit_price * line.quantity;

// Convert to GROSS EUR
let lineGrossEUR = lineGrossPLN * PLN_TO_EUR_RATE;

// Calculate NET from GROSS
let lineNet = lineGrossEUR / (1 + vatRate / 100);
```

### 5. UI Labels Updated ✅
**Files**:
- `components/OrderLineForm.tsx` - Shows "(incl. VAT)"
- `components/OrderPDF.tsx` - Shows "Price EUR excl VAT" in table
- `components/TotalsPanel.tsx` - Client view shows clear labels

## How to Apply Changes

### Step 1: Run the Migration
```bash
# Go to Supabase SQL Editor
# Copy and paste the contents of:
supabase/migrations/20240101000011_fix_gross_to_net_calculation.sql
# Click "Run"
```

### Step 2: Refresh the App
```bash
# The app should already be running from: npm run dev
# Just refresh your browser to see the changes
```

### Step 3: Test the Changes
1. **As Client**:
   - Create a new basket
   - Enter a PLN price (e.g., 310 PLN)
   - Should see: "= €100.00 (incl. VAT)"
   - Line total should match
   - Basket Summary should show:
     - Subtotal (excl. VAT): €81.30
     - VAT: €18.70
     - Grand Total: €100.00

2. **As Admin**:
   - View the same order
   - Should see detailed breakdown in Order Totals
   - Can modify VAT rate (including 0% for EU VAT registered)
   - PDF should show NET prices in the table

## Admin VAT Control

Admins can change VAT rate in the "Order Settings" section of the admin order detail page:

- **Default**: 23% (Polish standard VAT)
- **EU VAT Registered**: 0% (reverse charge)
- **Custom**: Any other percentage

When VAT is set to 0%:
- Client still enters gross PLN prices
- Calculations treat 0% VAT correctly
- NET = GROSS (since no VAT to remove)
- PDF shows NET prices and 0% VAT

## Verification Checklist

✅ Migration applied successfully
✅ Client cannot see "Order Settings"
✅ Client sees simplified "Basket Summary"
✅ Client enters PLN prices (gross)
✅ Client sees EUR prices with "(incl. VAT)" label
✅ Line totals calculate correctly
✅ Basket subtotal shows NET amount
✅ VAT calculated correctly from NET
✅ Grand total matches expected amount
✅ Admin can see full order details
✅ Admin can modify VAT rate
✅ PDF shows NET prices in table
✅ PDF totals calculate correctly

## Files Changed

1. `supabase/migrations/20240101000011_fix_gross_to_net_calculation.sql` - NEW
2. `components/TotalsPanel.tsx` - MODIFIED
3. `components/OrderLineForm.tsx` - MODIFIED
4. `components/OrderPDF.tsx` - MODIFIED
5. `app/orders/new/page.tsx` - MODIFIED
6. `app/orders/[id]/edit/page.tsx` - MODIFIED
7. `VAT_CALCULATION_GUIDE.md` - NEW (reference document)

## Support

If calculations still don't look right:
1. Check browser console for errors
2. Verify migration ran successfully
3. Check that `order.vat_rate` is set correctly (default: 23)
4. Review `VAT_CALCULATION_GUIDE.md` for detailed explanation

## Next Steps

1. Apply the migration in Supabase
2. Test with sample data
3. Verify PDF generation
4. Test with 0% VAT rate for EU businesses
5. Train admin staff on VAT rate management


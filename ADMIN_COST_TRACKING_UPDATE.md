# Admin Cost Tracking & Profitability Update

## 🎯 Changes Made

### 1. **Simplified Order Totals ✅**
- Removed complex breakdown (was showing €NaN)
- Now shows clean summary like client view:
  - Subtotal (excl. VAT)
  - VAT
  - Shipping
  - Grand Total

### 2. **Simplified Order Settings ✅**
- **Removed**: Markup and Discount fields
- **Updated VAT**: Now a dropdown with 2 options:
  - `23%` - Standard Polish VAT
  - `0%` - EU VAT Registered (Reverse Charge)
- When admin changes VAT to 0%, it affects:
  - Order totals
  - PDF generation
  - Client's "My Orders" view

### 3. **Cost Tracking Fields (Admin Only) ✅**
New columns for confirmed orders:
- **Actual Supplier**: Where item was actually ordered from
- **Net Cost (PLN)**: Actual cost paid to supplier (net)
- **Logistics (PLN)**: Per-item logistics cost
- **Received**: Checkbox (moved from "Ordered")

**Auto-marking as Ordered**:
- When Net Cost (PLN) is entered > 0
- Automatically marks `ordered_from_supplier = TRUE`
- Sets `ordered_from_supplier_at` timestamp

### 4. **Profitability Dashboard (Admin Only) ✅**
New orange card showing internal costs (not visible to client):
- **Overall Logistics Cost**: EUR field for order-level logistics
- **Cost Breakdown**:
  - Total Cost in PLN
  - Total Cost in EUR (@ 3.1 rate)
  - Client Pays (grand total)
  - **Net Profit** (green if positive, red if negative)

## 📋 Database Migration Required

**File**: `supabase/migrations/20240101000012_add_cost_tracking.sql`

### New Columns Added:
**order_items table:**
- `net_cost_pln` - Actual net cost in PLN
- `actual_supplier` - Actual supplier name
- `logistics_cost_pln` - Per-item logistics cost in PLN

**orders table:**
- `logistics_cost` - Overall logistics cost in EUR

### To Apply:
1. Go to **Supabase Dashboard** → **SQL Editor**
2. Open: `C:\Users\micha\importfrompoland-app\supabase\migrations\20240101000012_add_cost_tracking.sql`
3. Copy all contents
4. Paste into SQL Editor
5. Click **"Run"**

## 🔄 Workflow

### Admin Process:
1. Client submits order → Status: `submitted`
2. Admin confirms order → Status: `confirmed`
3. **Admin enters costs for each item:**
   - Actual Supplier name
   - Net Cost in PLN (auto-marks as ordered)
   - Logistics cost in PLN (optional)
4. Admin marks items as "Received" when they arrive
5. Admin can change VAT rate (23% or 0%) based on client's VAT status
6. Admin sees real-time profitability

### Profitability Calculation:
```
Total Cost = (Sum of all net_cost_pln + logistics_cost_pln) / 3.1 + order.logistics_cost
Client Pays = order.grand_total
Net Profit = Client Pays - Total Cost
```

## 📊 Admin Interface Updates

### Order Items Table (Confirmed Orders):
| # | Product | Client Supplier | URL | Price (PLN) | Qty | Unit | Total (EUR) | **Actual Supplier** | **Net Cost (PLN)** | **Logistics (PLN)** | Received | Actions |
|---|---------|----------------|-----|-------------|-----|------|-------------|---------------------|-------------------|-------------------|----------|---------|
| 1 | Item A  | Polish Store   | ... | 310         | 5   | pcs  | €500.00     | [Input]             | [Input]           | [Input]           | [✓]      | Edit/Del|

### Profitability Card (Orange):
```
Internal Costs & Profitability (Not visible to client)

Overall Logistics Cost (EUR): [Input]

Total Cost (PLN): 1,500.00 PLN
Total Cost (EUR @ 3.1): €483.87
Client Pays: €500.00
─────────────────────────
Net Profit: €16.13
```

## 🎨 UI Colors:
- **Profitability Card**: Orange theme (`border-orange-200 bg-orange-50`)
- **Profit**: Green if positive, Red if negative
- **Internal note**: "Not visible to client"

## ✅ Testing Checklist

After running the migration:

1. **Confirm an order** (status → confirmed)
2. **Enter Net Cost** for an item → Should auto-mark as "Ordered"
3. **Enter Logistics Cost** for items
4. **Enter Overall Logistics Cost**
5. **Check Profitability** - calculation should be correct
6. **Change VAT to 0%** → Totals should update
7. **Mark items as Received** → Order status updates
8. **Generate PDF** → Should reflect VAT rate
9. **Check Client View** → Should NOT see internal costs

## 🔒 Security Notes

- Internal cost fields only visible to admin/staff_admin
- Profitability card only shows for confirmed+ orders
- Client never sees: net_cost_pln, actual_supplier, logistics costs
- RLS policies protect internal data

## 📁 Files Modified

1. `supabase/migrations/20240101000012_add_cost_tracking.sql` - NEW
2. `app/admin/orders/[id]/page.tsx` - UPDATED
   - Simplified order totals
   - VAT dropdown (23%/0%)
   - Removed markup/discount
   - Added cost tracking fields
   - Added profitability dashboard

## 🚀 Next Steps

1. **Run the migration** (see above)
2. **Refresh browser** (Ctrl + Shift + R)
3. **Test the workflow** with a sample order
4. **Train staff** on new cost tracking process


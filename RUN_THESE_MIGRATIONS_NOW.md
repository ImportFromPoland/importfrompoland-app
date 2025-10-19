# 🚨 Run These Migrations Now - In Order!

## Problem
You're getting errors because these database columns don't exist yet:
- `ordered_from_supplier`
- `net_cost_pln`
- `actual_supplier`
- `logistics_cost_pln`

## Solution - Run 2 Migrations

### Migration 1: Item Tracking (If Not Already Run)
**File**: `supabase/migrations/20240101000005_add_item_tracking.sql`

This adds:
- `ordered_from_supplier` (boolean)
- `ordered_from_supplier_at` (timestamp)
- `received_in_warehouse` (boolean)
- `received_in_warehouse_at` (timestamp)

### Migration 2: Cost Tracking
**File**: `supabase/migrations/20240101000012_add_cost_tracking.sql`

This adds:
- `net_cost_pln` (actual cost to supplier)
- `actual_supplier` (supplier name)
- `logistics_cost_pln` (per-item logistics)
- `logistics_cost` (order-level logistics)

## Steps to Run

### 1. Go to Supabase Dashboard
https://supabase.com/dashboard → Your Project → SQL Editor

### 2. Run Migration 1 (Check if needed first)
```sql
-- Check if columns exist
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'order_items' 
  AND column_name IN ('ordered_from_supplier', 'received_in_warehouse');
```

**If returns 0 rows**, run this migration:
1. Open: `C:\Users\micha\importfrompoland-app\supabase\migrations\20240101000005_add_item_tracking.sql`
2. Copy all
3. Paste into SQL Editor
4. Click "Run"

### 3. Run Migration 2 (Always needed)
1. Open: `C:\Users\micha\importfrompoland-app\supabase\migrations\20240101000012_add_cost_tracking.sql`
2. Copy all
3. Paste into SQL Editor
4. Click "Run"
5. Should see: "Success. No rows returned"

### 4. Refresh Browser
- Press: **Ctrl + Shift + R**
- Or close all tabs and reopen http://localhost:3000

## After Migrations - Test

1. Go to admin → Confirmed order
2. Enter **Net Cost (PLN)** → Should work now!
3. Enter **Actual Supplier** → Should save
4. Check **Received** checkbox → Should work
5. See **Profitability** → Should calculate

## ⚠️ Known Issue: VAT Rate Changes

### Current Behavior:
When you change VAT from 23% to 0%:
- System recalculates NET from GROSS price
- Example: €603 gross → €603 net (wrong!)

### Expected Behavior:
- NET should stay constant
- Example: €490.24 net @ 23% VAT = €603 total
- Change to 0% VAT → €490.24 net = €490.24 total

### Why This Happens:
The system stores the **GROSS price in PLN** from the client. When VAT changes, it recalculates the split.

### Temporary Workaround:
**Don't change VAT rate after confirming an order!**

Set the correct VAT rate when confirming:
1. Check if client has valid EU VAT number
2. Set VAT to 0% or 23% BEFORE confirming
3. Once confirmed, don't change VAT

### Permanent Fix (TODO):
Need to add one of these options:
1. **Lock prices** when order is confirmed
2. Store **NET price** instead of GROSS
3. Add "recalculate prices" warning when changing VAT

For MVP, please use the workaround above.

## What's New - Warehouse Interface

### Polish Language Interface ✅
Location: `/admin/warehouse`

### Two Tabs:

#### 1. Dostawy (Deliveries)
- Grouped by supplier
- Shows which client order each item is for
- Field to enter supplier order number
- Checkbox to mark as delivered

#### 2. Zamówienia klientów (Client Orders)  
- Interactive packing lists
- Shows customer shipping address
- Checkboxes for "Delivered" and "Packed"
- Button to generate shipping labels
- Option for partial shipment
- "Oznacz jako wysłane" (Mark as Shipped) button

### Shipping Labels
- Click "Etykiety" button
- Enter number of labels (1-10)
- Generates A4 page with 8 labels (2 columns × 4 rows)
- Includes:
  - Company logo
  - Customer address
  - Postal code

*(Label generation to be implemented in next phase)*

## Troubleshooting

### "Column doesn't exist" error
→ Run the migrations above

### "Policy violation" error
→ Make sure you're logged in as admin/staff_admin

### Warehouse page blank
→ Hard refresh (Ctrl + Shift + R)

### Still issues?
Check browser console (F12) and share error messages.


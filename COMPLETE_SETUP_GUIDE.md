# Complete Setup Guide - Current Status

## 🎯 What's Been Built

### ✅ Admin Interface Updates
1. **Simplified Order Totals** - Clean summary (no more €NaN)
2. **VAT Dropdown** - 23% or 0% (EU VAT registered)
3. **Cost Tracking** - Net costs, actual suppliers, logistics
4. **Profitability Dashboard** - Real-time profit calculation

### ✅ Warehouse Interface (Polish)
**Location**: `/admin/warehouse`

**Tab 1: Dostawy (Deliveries)**
- Grouped by supplier
- Shows client order info
- Supplier order number input
- Delivered checkbox

**Tab 2: Zamówienia klientów (Packing)**
- Interactive packing lists
- Customer address display
- Delivered/Packed checkboxes
- Generate shipping labels (8 per A4)
- Partial shipment option
- "Oznacz jako wysłane" button

## 🚨 MUST RUN - 3 Migrations

### Migration 1: Item Tracking
**File**: `20240101000005_add_item_tracking.sql`
- Adds: ordered_from_supplier, received_in_warehouse

### Migration 2: Cost Tracking  
**File**: `20240101000012_add_cost_tracking.sql`
- Adds: net_cost_pln, actual_supplier, logistics_cost_pln

### Migration 3: Supplier Order Number
**File**: `20240101000013_add_supplier_order_number.sql`
- Adds: supplier_order_number

### How to Run All 3:
```bash
# In Supabase SQL Editor, run them one by one:

# 1. Check if migration 1 is needed
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'order_items' AND column_name = 'ordered_from_supplier';

# If empty, run migration 1, then run migrations 2 & 3
```

## ⚠️ Known Issues & Workarounds

### Issue 1: VAT Change Recalculates Wrong
**Problem**: When changing VAT from 23% to 0%, subtotal changes instead of staying constant.

**Why**: System stores GROSS price, recalculates NET when VAT changes.

**Workaround**: 
1. Set correct VAT rate BEFORE confirming order
2. Check client's EU VAT number first
3. Don't change VAT after order is confirmed

**Example**:
- Client enters: 310 PLN (gross @ 23% VAT)
- Shows: €100 EUR (gross)
- NET: €81.30, VAT: €18.70, Total: €100
- ❌ If you change to 0% VAT → NET becomes €100 (wrong!)
- ✅ Should be: NET stays €81.30, VAT €0, Total €81.30

**Permanent Fix** (TODO):
- Option 1: Lock prices when order confirmed
- Option 2: Store NET price instead of GROSS
- Option 3: Add warning popup when changing VAT

### Issue 2: "Column doesn't exist" Error
**Solution**: Run the 3 migrations above!

## 📊 Complete Workflow

### 1. Client Submits Order
- Status: `submitted`
- Client sees "My Basket" → "My Orders"

### 2. Admin Confirms Order
- Change status to: `confirmed`
- Set VAT rate (23% or 0%)
- **Do NOT change VAT after this!**

### 3. Admin Enters Costs
- Actual Supplier name
- Net Cost (PLN) → Auto-marks as "ordered"
- Logistics Cost (PLN) per item
- Overall Logistics Cost (EUR)

### 4. Warehouse Receives Items
**Polish Interface**: `/admin/warehouse`
- Tab: **Dostawy**
- Group by supplier
- Enter supplier order number
- Check "Dostarczone" when arrives
- Status updates to `partially_received` or `ready_to_ship`

### 5. Warehouse Packs Order
- Tab: **Zamówienia klientów**
- See customer address
- Check items as packed
- Generate shipping labels (8/page)
- Click "Oznacz jako wysłane"
- Status: `shipped`

### 6. Admin Sees Profitability
Orange card shows:
- Total costs (PLN & EUR)
- Client payment
- **Net Profit** (green/red)

## 🏷️ Shipping Labels (Partial Implementation)

### Current Status:
- Button exists: "Etykiety"
- Input field for number of labels
- Alert placeholder

### To Complete:
1. Create PDF template (A4, 2×4 grid)
2. Add company logo
3. Format:
   ```
   [LOGO]
   
   Customer Name
   Address Line 1
   Address Line 2
   City, Postal Code
   Country
   
   Order: ORD-XXX/MM/YYYY
   ```
4. Download as PDF

## 📁 Files Created/Modified

### New Files:
1. `supabase/migrations/20240101000012_add_cost_tracking.sql`
2. `supabase/migrations/20240101000013_add_supplier_order_number.sql`
3. `app/admin/warehouse/page.tsx`
4. `RUN_THESE_MIGRATIONS_NOW.md`
5. `ADMIN_COST_TRACKING_UPDATE.md`
6. `COMPLETE_SETUP_GUIDE.md` (this file)

### Modified Files:
1. `app/admin/orders/[id]/page.tsx` - Cost tracking, profitability
2. `app/admin/layout.tsx` - Warehouse nav link

## 🎨 UI Features

### Admin Order Detail:
- **Order Summary** card - Clean totals
- **Order Settings** card - VAT dropdown, shipping
- **Internal Costs & Profitability** card (orange) - Cost tracking
- **Order Items** table - Net cost, actual supplier, logistics

### Warehouse (Polish):
- **Dostawy** tab - Supplier deliveries
- **Zamówienia klientów** tab - Packing lists
- Green highlight for received items
- Disabled "Spakowane" until "Dostarczone" checked

## 🔐 Access Control

### Admin/Staff Admin Can:
- See all orders
- Edit costs
- Change VAT rate
- See profitability
- Access warehouse

### Warehouse Staff Can:
- Mark items received
- Mark items packed
- Generate labels
- Mark orders shipped

### Clients Can:
- Create baskets
- Submit orders
- View order status
- **Cannot see**: Internal costs, profitability, supplier info

## ✅ Testing Checklist

1. ✅ Run 3 migrations
2. ✅ Hard refresh browser (Ctrl+Shift+R)
3. ✅ Create test order as client
4. ✅ Confirm as admin (set VAT correctly!)
5. ✅ Enter costs (net_cost_pln)
6. ✅ Go to `/admin/warehouse`
7. ✅ Mark items as delivered
8. ✅ Pack items
9. ✅ Generate labels (alerts for now)
10. ✅ Mark as shipped
11. ✅ Check profitability calculation

## 🚀 Next Steps

### Immediate:
1. **Run the 3 migrations** (see above)
2. Test complete workflow
3. Verify profitability calculations

### Near Future:
1. Implement actual PDF label generation
2. Fix VAT change behavior (lock prices)
3. Add partial shipment logic
4. Create sub-orders for partial shipments

### Later:
1. Email notifications (order confirmed, shipped)
2. Tracking number integration
3. Automated profit reports
4. Multi-language support (beyond warehouse Polish)

## 📞 Support

If you encounter issues:
1. Check browser console (F12)
2. Verify migrations ran successfully
3. Check RLS policies in Supabase
4. Confirm user role is admin/staff_admin
5. Hard refresh browser

**Common Issues**:
- €NaN → Run migration 2
- Column errors → Run migrations 1-3
- Access denied → Check user role
- Blank page → Hard refresh


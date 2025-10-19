# Admin Orders - Complete Setup Guide

## 🎯 What's New

### **1. Fixed RLS Policies**
- ✅ **Admins can now see ALL orders** from ALL companies
- ✅ **Clients can only see their own** company's orders
- ✅ **Proper policy hierarchy** - admins override client restrictions

### **2. New Order Number Format**
- ✅ **Format:** `XXX/MM/YYYY`
  - `XXX` = Auto-incremented number (001, 002, 003...)
  - `MM` = Current month (01-12)
  - `YYYY` = Current year (2024, 2025, etc.)
- ✅ **Resets yearly** - Counter goes back to 001 on January 1st each year
- ✅ **Examples:**
  - First order in October 2024: `001/10/2024`
  - Second order: `002/10/2024`
  - 100th order in December: `100/12/2024`
  - First order in 2025: `001/01/2025`

### **3. Reorganized Admin Orders Page**
- ✅ **3 Tabs:**
  1. **Baskets** - Client draft orders (help clients if needed)
  2. **Active Orders** - Being processed (submitted → shipped)
  3. **Delivered Orders** - Completed orders

---

## 🚀 Setup Instructions

### **Step 1: Install Required Package**

```powershell
cd C:\Users\micha\importfrompoland-app
npm install @radix-ui/react-tabs
```

### **Step 2: Run Database Migrations**

You need to run **3 new migrations** in order:

#### **Migration 1: Fix RLS Policies**

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Open `supabase/migrations/20240101000007_fix_admin_view_all_orders.sql`
3. Copy ALL the SQL
4. Paste in SQL Editor
5. Click **"Run"**

This fixes the admin permissions to see all orders.

---

#### **Migration 2: New Order Number Format**

1. Still in **SQL Editor**
2. Open `supabase/migrations/20240101000008_new_order_number_format.sql`
3. Copy ALL the SQL
4. Paste in SQL Editor
5. Click **"Run"**

This creates the order number generation system.

---

#### **Migration 3: Item Tracking (if you haven't run it yet)**

1. Still in **SQL Editor**
2. Open `supabase/migrations/20240101000005_add_item_tracking.sql`
3. Copy ALL the SQL
4. Paste in SQL Editor
5. Click **"Run"**

This adds warehouse tracking columns.

---

#### **Migration 4: Client Order Submit (if you haven't run it yet)**

1. Still in **SQL Editor**
2. Open `supabase/migrations/20240101000006_fix_client_order_submit.sql`
3. Copy ALL the SQL
4. Paste in SQL Editor
5. Click **"Run"**

This allows clients to submit orders.

---

### **Step 3: Verify Migrations Worked**

Run this query to check:

```sql
-- Check if order number function exists
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name = 'generate_order_number';

-- Check if order_number_sequence table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'order_number_sequence'
);

-- Check if delivered status exists
SELECT unnest(enum_range(NULL::order_status))::text as status_values;
```

**Expected results:**
- ✅ Function `generate_order_number` exists
- ✅ Table `order_number_sequence` exists
- ✅ Status list includes `delivered`

---

### **Step 4: Sign Out and Sign Back In**

**IMPORTANT:** After running migrations:
1. **Sign out** of your admin account
2. **Sign back in**
3. Your session will now have updated permissions

---

## 🧪 Testing

### **Test 1: Client Submits Order**

1. Sign in as a **test client** (not your admin account)
2. Create a basket
3. Add items
4. Submit order
5. Check the order number format: should be `001/10/2024` (or current month/year)

### **Test 2: Admin Can See All Orders**

1. Sign in as **admin/staff_admin**
2. Go to `/admin/orders`
3. You should see **3 tabs**: Baskets, Active, Delivered
4. Click **"Active Orders"** tab
5. You should see the order you just submitted as a client
6. **This is the key test!** If you see it, RLS is working!

### **Test 3: Order Numbers Increment**

1. As client, create and submit another order
2. Order number should be `002/10/2024`
3. Create and submit another
4. Should be `003/10/2024`
5. Numbers increment correctly!

### **Test 4: Tabs Work Correctly**

**Active Orders Tab should show:**
- ✅ Orders with status: `submitted`, `confirmed`, `partially_received`, `ready_to_ship`, `shipped`
- ❌ NOT show: `draft` or `delivered` orders

**Baskets Tab should show:**
- ✅ Orders with status: `draft`
- ❌ NOT show: submitted or delivered orders

**Delivered Tab should show:**
- ✅ Orders with status: `delivered`
- ❌ NOT show: draft or active orders

---

## 📊 Admin Orders Page Features

### **Baskets Tab**
Shows client work-in-progress orders:
- Basket name
- Customer
- Item count
- Created date
- Last updated
- Total amount
- "View" button to help clients

### **Active Orders Tab**
Shows orders being processed:
- Order number (`XXX/MM/YYYY`)
- Customer name & VAT
- Basket name
- Status badge
- Item count
- Submission date
- Total amount
- Invoice info
- Shipment tracking
- "View" button to manage

### **Delivered Orders Tab**
Shows completed orders:
- Order number
- Customer
- Basket name
- Item count
- Submission date
- Delivery date
- Total amount
- "View" button for records

---

## 🔧 Troubleshooting

### **"Still can't see other clients' orders"**

1. **Check your role:**
   ```sql
   SELECT email, role 
   FROM profiles p
   JOIN auth.users u ON u.id = p.id
   WHERE u.email = 'm.nowak@importfrompoland.com';
   ```
   Should return `staff_admin`

2. **Check RLS policies:**
   ```sql
   SELECT policyname, cmd, qual 
   FROM pg_policies 
   WHERE tablename = 'orders';
   ```
   Should see `Admins can view and manage all orders`

3. **Sign out and sign back in** (critical!)

### **"Order numbers not generating"**

1. **Check if trigger exists:**
   ```sql
   SELECT trigger_name 
   FROM information_schema.triggers 
   WHERE event_object_table = 'orders'
   AND trigger_name = 'set_order_number';
   ```

2. **Manually test function:**
   ```sql
   SELECT generate_order_number();
   ```
   Should return something like `001/10/2024`

### **"Tabs not showing"**

Make sure you installed the package:
```powershell
npm install @radix-ui/react-tabs
```

Then restart your dev server:
```powershell
npm run dev
```

---

## 🎯 Order Number Examples

**October 2024:**
- 1st order: `001/10/2024`
- 2nd order: `002/10/2024`
- 25th order: `025/10/2024`
- 100th order: `100/10/2024`

**November 2024:**
- 101st order: `101/11/2024`
- 102nd order: `102/11/2024`

**January 2025 (resets):**
- 1st order of new year: `001/01/2025`
- 2nd order: `002/01/2025`

**Number counter ONLY resets on January 1st each year!**

---

## ✨ What You Should See Now

### **Before (Old View):**
- Single list of all orders mixed together
- Draft orders shown with submitted orders
- Hard to find what you need
- Order numbers like `ORD-12345678`

### **After (New View):**
- **3 organized tabs** for different workflows
- **Baskets tab** - Help clients with drafts
- **Active tab** - Process current orders
- **Delivered tab** - Archive of completed work
- **Professional order numbers** like `015/10/2024`
- **Admin sees ALL companies' orders**

---

**Once you run the migrations and install the package, everything will work perfectly!** 🚀

Order of operations:
1. ✅ Install `@radix-ui/react-tabs`
2. ✅ Run migration 7 (RLS fix)
3. ✅ Run migration 8 (order numbers)
4. ✅ Sign out and sign back in
5. ✅ Test!


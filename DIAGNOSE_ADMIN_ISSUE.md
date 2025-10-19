# Diagnose Admin Not Seeing Orders

## 🔍 Run These Diagnostic Queries

Go to **Supabase Dashboard** → **SQL Editor** and run each query:

---

### **Query 1: Check Your Current Role**
```sql
SELECT 
  auth.uid() as your_user_id,
  u.email,
  p.role,
  p.company_id
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE u.id = auth.uid();
```

**Expected:**
- `role` should be `staff_admin` or `admin`
- `email` should be your admin email

**If role is NOT admin/staff_admin**, you need to run:
```sql
UPDATE profiles 
SET role = 'staff_admin'
WHERE id = auth.uid();
```

---

### **Query 2: Check All Orders in Database**
```sql
SELECT 
  o.id,
  o.number,
  o.status,
  o.company_id,
  c.name as company_name,
  (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
FROM orders o
LEFT JOIN companies c ON c.id = o.company_id
ORDER BY o.created_at DESC
LIMIT 20;
```

**This query BYPASSES RLS** (admin view in SQL editor has superuser access).

**Expected:**
- You should see ALL orders from ALL companies
- Including the test order you created

**If you DON'T see any orders**, the orders don't exist in the database at all.

**If you DO see orders here**, then it's an RLS policy issue.

---

### **Query 3: Check What YOU Can See (With RLS)**
```sql
SELECT 
  o.id,
  o.number,
  o.status,
  o.company_id,
  c.name as company_name
FROM orders o
LEFT JOIN companies c ON c.id = o.company_id
WHERE true -- This respects RLS
ORDER BY o.created_at DESC;
```

**Expected if RLS is working:**
- Should see the same orders as Query 2

**If you see FEWER orders or ZERO orders:**
- ❌ RLS policies are blocking you
- ❌ Need to fix policies

---

### **Query 4: Check Existing RLS Policies**
```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'orders'
ORDER BY policyname;
```

**Expected:**
- Should see policy like `"Admins can view and manage all orders"`
- `cmd` should include `ALL` or `SELECT`
- `roles` should be `{authenticated}`

---

### **Query 5: Test the Helper Function**
```sql
SELECT get_user_role() as my_role;
```

**Expected:**
- Should return `staff_admin` or `admin`

**If it returns NULL or 'client':**
- ❌ Function is broken or role not set
- ❌ Session not refreshed

---

## 📋 Share Results

Please copy the results of **Query 1**, **Query 2**, and **Query 3** and send them to me.

This will tell us:
1. ✅ Are orders in the database?
2. ✅ What's your current role?
3. ✅ Are RLS policies blocking you?

---

## 🔧 If RLS is Definitely the Problem

Run this **NUCLEAR OPTION** - drops ALL order policies and creates super simple ones:

```sql
-- NUCLEAR OPTION: Drop ALL policies on orders table
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'orders') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON orders', r.policyname);
    END LOOP;
END $$;

-- Create ONE simple admin policy
CREATE POLICY "admin_all_access"
ON orders
FOR ALL
TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff_admin')
  OR
  company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
)
WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff_admin')
  OR
  company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
);

-- Same for order_items
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'order_items') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON order_items', r.policyname);
    END LOOP;
END $$;

CREATE POLICY "admin_all_access_items"
ON order_items
FOR ALL
TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff_admin')
  OR
  EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.id = order_items.order_id 
    AND orders.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  )
)
WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff_admin')
  OR
  EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.id = order_items.order_id 
    AND orders.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  )
);
```

**Then SIGN OUT and SIGN BACK IN!**

---

## 🎯 Most Common Issues

1. **Haven't signed out and back in** after changing role (90% of cases)
2. **Role is still 'client'** in database
3. **RLS policies have syntax errors** or conflicts
4. **Orders don't actually exist** in database

Run the diagnostic queries above and let me know what you find!


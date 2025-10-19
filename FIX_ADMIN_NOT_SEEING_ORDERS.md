# Fix: Admin Not Seeing Orders

## 🐛 Issue
After promoting to `staff_admin`, orders from other clients don't show up in `/admin/orders`.

## ✅ Quick Fix

### **Step 1: Sign Out and Sign Back In**

This is usually the issue! After changing your role in the database, you MUST sign out and sign back in for the new role to take effect in your session.

1. Click **"Sign Out"** in the top right
2. Sign back in with your credentials
3. You should now be redirected to `/admin/orders` automatically
4. All orders should now be visible

---

## 🔍 If That Doesn't Work

### **Step 2: Verify Your Role in Database**

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Run this query:

```sql
-- Check your current role
SELECT 
  u.email,
  p.role,
  p.company_id,
  c.name as company_name
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
LEFT JOIN companies c ON c.id = p.company_id
WHERE u.email = 'm.nowak@importfrompoland.com';
```

**Expected result:**
- `role` should be `staff_admin`
- `email` should be your email

**If role is NOT `staff_admin`**, run:

```sql
UPDATE profiles 
SET role = 'staff_admin'
WHERE id = (
  SELECT id 
  FROM auth.users 
  WHERE email = 'm.nowak@importfrompoland.com'
);
```

---

### **Step 3: Verify RLS Policies**

Check if admin policies exist:

```sql
-- Check RLS policies for orders table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'orders'
ORDER BY policyname;
```

**You should see:**
- `"Admins can manage all orders"` - allows admins to SELECT/UPDATE/DELETE all orders
- `"Clients can view own company orders"` - allows clients to see their own

---

### **Step 4: Test RLS as Admin**

Run this to see what orders you can see:

```sql
-- This simulates what the admin page query does
SELECT 
  o.id,
  o.number,
  o.status,
  o.company_id,
  c.name as company_name,
  (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
FROM orders o
LEFT JOIN companies c ON c.id = o.company_id
ORDER BY o.created_at DESC;
```

**If you see ALL orders (including from other companies):**
✅ RLS is working correctly, the issue is just the session cache

**If you only see YOUR company's orders:**
❌ RLS policies need to be re-applied (see Step 5)

---

### **Step 5: Re-apply Admin RLS Policy**

If RLS is still blocking you, run this to fix it:

```sql
-- Drop and recreate the admin policy
DROP POLICY IF EXISTS "Admins can manage all orders" ON orders;

CREATE POLICY "Admins can manage all orders"
ON orders
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'staff_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'staff_admin')
  )
);

-- Also ensure order_items has admin access
DROP POLICY IF EXISTS "Admins can manage all order items" ON order_items;

CREATE POLICY "Admins can manage all order items"
ON order_items
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'staff_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'staff_admin')
  )
);
```

---

## 🎯 Why This Happens

### **Session Caching**
When you sign in, Supabase creates a session token that includes your user info and role. This token is cached in:
- Browser localStorage
- Server-side session
- Database connection pool

When you update your role in the database, the **existing session doesn't know** about the change!

### **Solution:**
Sign out → clears the old session
Sign back in → creates new session with current role

---

## 🧪 Test Checklist

After fixing:

- [ ] Sign out completely
- [ ] Sign back in
- [ ] Redirected to `/admin/orders` (not `/` dashboard)
- [ ] See "Order Management" header
- [ ] See sidebar with Orders, Invoices, Warehouse, Users
- [ ] See **all customer orders** in the table (not just your own)
- [ ] Can click "View" on any order
- [ ] Can see "Confirm Order" button on submitted orders

---

## 💡 Pro Tip

**Create a separate admin account** for testing:

1. Sign up a new user: `admin@importfrompoland.com`
2. Complete onboarding (creates company, profile)
3. Promote to `staff_admin` via SQL
4. Sign out, sign back in as admin
5. Now you have a dedicated admin account!

This way you can test both client and admin views separately.

---

**99% of the time, it's just the session cache. Just sign out and sign back in!** 🎉


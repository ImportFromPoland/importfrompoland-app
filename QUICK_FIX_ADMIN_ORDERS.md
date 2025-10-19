# Quick Fix: Admin Can't See Client Orders

## ⚡ Super Quick Fix (3 Steps)

### **Step 1: Install Package** (30 seconds)
```powershell
cd C:\Users\micha\importfrompoland-app
npm install @radix-ui/react-tabs
```

### **Step 2: Run These 2 SQL Migrations** (2 minutes)

Go to **Supabase Dashboard** → **SQL Editor**, create new queries, and run these **in order**:

#### **SQL 1: Fix Admin Permissions**
```sql
-- Drop old policies
DROP POLICY IF EXISTS "Clients can view own company orders" ON orders;
DROP POLICY IF EXISTS "Clients can update own drafts" ON orders;
DROP POLICY IF EXISTS "Admins can manage all orders" ON orders;
DROP POLICY IF EXISTS "Clients can update own orders" ON orders;

-- Admins can see and manage ALL orders
CREATE POLICY "Admins can view and manage all orders"
ON orders FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'staff_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'staff_admin')
  )
);

-- Clients can view their own
CREATE POLICY "Clients can view own orders"
ON orders FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'staff_admin')
  )
  OR
  (
    company_id IN (
      SELECT company_id FROM profiles WHERE profiles.id = auth.uid()
    )
  )
);

-- Clients can create orders
CREATE POLICY "Clients can create orders"
ON orders FOR INSERT TO authenticated
WITH CHECK (
  company_id IN (
    SELECT company_id FROM profiles WHERE profiles.id = auth.uid()
  )
);

-- Clients can update drafts, admins can update anything
CREATE POLICY "Clients can update own draft orders"
ON orders FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'staff_admin')
  )
  OR
  (
    company_id IN (
      SELECT company_id FROM profiles WHERE profiles.id = auth.uid()
    )
    AND status = 'draft'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'staff_admin')
  )
  OR
  (
    company_id IN (
      SELECT company_id FROM profiles WHERE profiles.id = auth.uid()
    )
    AND status IN ('draft', 'submitted')
  )
);
```

Click **"Run"** ✅

---

#### **SQL 2: New Order Number Format (XXX/MM/YYYY)**
```sql
-- Create sequence table
CREATE TABLE IF NOT EXISTS order_number_sequence (
  year INTEGER PRIMARY KEY,
  last_number INTEGER DEFAULT 0
);

-- Function to generate order numbers
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  current_year INTEGER;
  current_month TEXT;
  next_number INTEGER;
  formatted_number TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  current_month := TO_CHAR(CURRENT_DATE, 'MM');
  
  INSERT INTO order_number_sequence (year, last_number)
  VALUES (current_year, 0)
  ON CONFLICT (year) DO NOTHING;
  
  UPDATE order_number_sequence
  SET last_number = last_number + 1
  WHERE year = current_year
  RETURNING last_number INTO next_number;
  
  formatted_number := LPAD(next_number::TEXT, 3, '0') || '/' || current_month || '/' || current_year::TEXT;
  
  RETURN formatted_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate on submit
DROP TRIGGER IF EXISTS set_order_number ON orders;

CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'submitted' AND (OLD.status IS NULL OR OLD.status = 'draft') AND NEW.number IS NULL THEN
    NEW.number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_number
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_number();
```

Click **"Run"** ✅

---

### **Step 3: Sign Out and Sign Back In** (10 seconds)

1. Click **"Sign Out"** in your app
2. **Sign back in** with your admin credentials
3. Go to `/admin/orders`
4. **You should see client orders now!** ✅

---

## 🎉 What You Get

### **New Admin Orders Page with 3 Tabs:**

**1. Baskets** (draft orders)
- See what clients are working on
- Help them if needed

**2. Active Orders** (submitted → shipped)
- Main workflow
- Orders being processed

**3. Delivered** (completed)
- Archive of delivered orders

### **New Order Number Format:**
- `001/10/2024` - First order in October 2024
- `002/10/2024` - Second order
- `001/01/2025` - Resets every January 1st

---

## ✅ Test It Works

1. **Sign in as client** (test account)
2. **Create basket** → Submit order
3. **Order number** should be `XXX/10/2024`
4. **Sign in as admin**
5. **Go to `/admin/orders`**
6. **Click "Active Orders" tab**
7. **See the client's order!** ✅

---

**That's it! Just 3 steps and everything works.** 🚀

If you still don't see client orders after Step 3, check `ADMIN_ORDERS_SETUP.md` for detailed troubleshooting.


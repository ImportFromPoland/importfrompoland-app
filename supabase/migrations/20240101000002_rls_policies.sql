-- Row Level Security Policies
-- Roles: client, admin, staff_admin, warehouse

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function to get current user's company_id
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (get_user_role() IN ('admin', 'staff_admin'));

CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE
  USING (get_user_role() IN ('admin', 'staff_admin'));

CREATE POLICY "New users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- Companies policies
CREATE POLICY "Clients can view own company"
  ON companies FOR SELECT
  USING (
    id = get_user_company_id() OR
    get_user_role() IN ('admin', 'staff_admin')
  );

CREATE POLICY "Admins can manage companies"
  ON companies FOR ALL
  USING (get_user_role() IN ('admin', 'staff_admin'))
  WITH CHECK (get_user_role() IN ('admin', 'staff_admin'));

CREATE POLICY "Clients can update own company"
  ON companies FOR UPDATE
  USING (id = get_user_company_id());

-- Orders policies
CREATE POLICY "Clients can view own company orders"
  ON orders FOR SELECT
  USING (
    company_id = get_user_company_id() OR
    get_user_role() IN ('admin', 'staff_admin', 'warehouse')
  );

CREATE POLICY "Clients can insert own company orders"
  ON orders FOR INSERT
  WITH CHECK (
    company_id = get_user_company_id() AND
    created_by = auth.uid()
  );

CREATE POLICY "Clients can update own drafts"
  ON orders FOR UPDATE
  USING (
    company_id = get_user_company_id() AND
    status = 'draft'
  );

CREATE POLICY "Admins can manage all orders"
  ON orders FOR ALL
  USING (get_user_role() IN ('admin', 'staff_admin'))
  WITH CHECK (get_user_role() IN ('admin', 'staff_admin'));

CREATE POLICY "Warehouse can view orders for processing"
  ON orders FOR SELECT
  USING (
    get_user_role() = 'warehouse' AND
    status IN ('confirmed', 'invoiced', 'picking', 'picked', 'packed', 'ready_to_ship', 'dispatched')
  );

-- Order items policies
CREATE POLICY "Users can view order items if they can view order"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
      AND (
        o.company_id = get_user_company_id() OR
        get_user_role() IN ('admin', 'staff_admin', 'warehouse')
      )
    )
  );

CREATE POLICY "Clients can manage items in own draft orders"
  ON order_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
      AND o.company_id = get_user_company_id()
      AND o.status = 'draft'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
      AND o.company_id = get_user_company_id()
      AND o.status = 'draft'
    )
  );

CREATE POLICY "Admins can manage all order items"
  ON order_items FOR ALL
  USING (get_user_role() IN ('admin', 'staff_admin'))
  WITH CHECK (get_user_role() IN ('admin', 'staff_admin'));

-- Invoices policies
CREATE POLICY "Users can view invoices for accessible orders"
  ON invoices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = invoices.order_id
      AND (
        o.company_id = get_user_company_id() OR
        get_user_role() IN ('admin', 'staff_admin')
      )
    )
  );

CREATE POLICY "Admins can manage invoices"
  ON invoices FOR ALL
  USING (get_user_role() IN ('admin', 'staff_admin'))
  WITH CHECK (get_user_role() IN ('admin', 'staff_admin'));

-- Payments policies
CREATE POLICY "Users can view payments for accessible invoices"
  ON payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM invoices inv
      JOIN orders o ON inv.order_id = o.id
      WHERE inv.id = payments.invoice_id
      AND (
        o.company_id = get_user_company_id() OR
        get_user_role() IN ('admin', 'staff_admin')
      )
    )
  );

CREATE POLICY "Admins can manage payments"
  ON payments FOR ALL
  USING (get_user_role() IN ('admin', 'staff_admin'))
  WITH CHECK (get_user_role() IN ('admin', 'staff_admin'));

-- Shipments policies
CREATE POLICY "Users can view shipments for accessible orders"
  ON shipments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = shipments.order_id
      AND (
        o.company_id = get_user_company_id() OR
        get_user_role() IN ('admin', 'staff_admin', 'warehouse')
      )
    )
  );

CREATE POLICY "Admins and warehouse can manage shipments"
  ON shipments FOR ALL
  USING (get_user_role() IN ('admin', 'staff_admin', 'warehouse'))
  WITH CHECK (get_user_role() IN ('admin', 'staff_admin', 'warehouse'));

-- Warehouse tasks policies
CREATE POLICY "Warehouse and admins can view all tasks"
  ON warehouse_tasks FOR SELECT
  USING (get_user_role() IN ('admin', 'staff_admin', 'warehouse'));

CREATE POLICY "Warehouse and admins can manage tasks"
  ON warehouse_tasks FOR ALL
  USING (get_user_role() IN ('admin', 'staff_admin', 'warehouse'))
  WITH CHECK (get_user_role() IN ('admin', 'staff_admin', 'warehouse'));

-- Audit logs policies
CREATE POLICY "Users can view audit logs for accessible orders"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = audit_logs.order_id
      AND (
        o.company_id = get_user_company_id() OR
        get_user_role() IN ('admin', 'staff_admin')
      )
    )
  );

CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (true); -- Edge functions will insert these

-- Notifications policies
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (true); -- Edge functions will create these


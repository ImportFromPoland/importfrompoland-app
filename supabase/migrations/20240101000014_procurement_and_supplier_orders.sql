-- Create procurement/supplier orders system

-- Add packed status to order items
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS packed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS packed_at TIMESTAMPTZ;

-- Create supplier_orders table
CREATE TABLE IF NOT EXISTS supplier_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL,
  order_date DATE,
  expected_delivery_date DATE,
  supplier_order_number TEXT,
  total_cost_pln NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  status TEXT DEFAULT 'ordered' CHECK (status IN ('ordered', 'partially_received', 'received', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create supplier_order_items junction table
CREATE TABLE IF NOT EXISTS supplier_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_order_id UUID NOT NULL REFERENCES supplier_orders(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  quantity_ordered NUMERIC(12,3) NOT NULL,
  quantity_received NUMERIC(12,3) DEFAULT 0,
  unit_cost_pln NUMERIC(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(supplier_order_id, order_item_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_supplier_orders_order_id ON supplier_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_supplier_orders_status ON supplier_orders(status);
CREATE INDEX IF NOT EXISTS idx_supplier_order_items_supplier_order ON supplier_order_items(supplier_order_id);
CREATE INDEX IF NOT EXISTS idx_supplier_order_items_order_item ON supplier_order_items(order_item_id);
CREATE INDEX IF NOT EXISTS idx_order_items_packed ON order_items(packed);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_supplier_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER supplier_orders_updated_at
BEFORE UPDATE ON supplier_orders
FOR EACH ROW
EXECUTE FUNCTION update_supplier_orders_updated_at();

-- RLS Policies
ALTER TABLE supplier_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_order_items ENABLE ROW LEVEL SECURITY;

-- Admin can see all supplier orders
CREATE POLICY "admin_all_supplier_orders" ON supplier_orders
  FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff_admin'));

CREATE POLICY "admin_all_supplier_order_items" ON supplier_order_items
  FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff_admin'));

-- Comments
COMMENT ON TABLE supplier_orders IS 'Orders placed with suppliers';
COMMENT ON TABLE supplier_order_items IS 'Items in each supplier order';
COMMENT ON COLUMN order_items.packed IS 'Item has been packed for shipping';
COMMENT ON COLUMN order_items.packed_at IS 'When item was packed';


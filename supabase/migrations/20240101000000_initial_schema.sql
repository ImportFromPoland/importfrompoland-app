-- ImportFromPoland App Database Schema
-- Critical: PLN to EUR conversion = PLN / 3.1 (includes service + delivery to Ireland)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enums
CREATE TYPE user_role AS ENUM ('client', 'admin', 'staff_admin', 'warehouse');
CREATE TYPE order_status AS ENUM (
  'draft', 
  'submitted', 
  'in_review', 
  'confirmed', 
  'invoiced',
  'picking',
  'picked',
  'packed',
  'ready_to_ship',
  'dispatched',
  'delivered',
  'cancelled'
);
CREATE TYPE currency_type AS ENUM ('EUR', 'PLN');
CREATE TYPE invoice_type AS ENUM ('proforma', 'final');
CREATE TYPE payment_method AS ENUM ('bank_transfer', 'card', 'cash', 'other');
CREATE TYPE task_status AS ENUM ('pending', 'picking', 'picked', 'packed');

-- Profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role user_role NOT NULL DEFAULT 'client',
  company_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Companies table
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  vat_number TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'Ireland',
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add foreign key to profiles
ALTER TABLE profiles ADD CONSTRAINT fk_profiles_company 
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;

-- Orders table
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  number TEXT UNIQUE, -- Auto-generated on submit (e.g., ORD-2024-00001)
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id),
  status order_status NOT NULL DEFAULT 'draft',
  currency currency_type NOT NULL DEFAULT 'EUR',
  
  -- Header-level pricing modifiers
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 23.00, -- Default 23%
  shipping_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00, -- Admin can add exceptional shipping
  discount_percent NUMERIC(5,2) DEFAULT 0.00, -- Header discount
  markup_percent NUMERIC(5,2) DEFAULT 0.00, -- Header markup
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  
  -- Notes
  client_notes TEXT,
  admin_notes TEXT
);

-- Order items table
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  
  -- Product info
  product_name TEXT NOT NULL,
  website_url TEXT,
  supplier_name TEXT,
  
  -- Pricing
  unit_price NUMERIC(12,2) NOT NULL, -- Price in original currency
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1.000,
  currency currency_type NOT NULL DEFAULT 'EUR',
  
  -- FX conversion: If currency=PLN, fx_rate = 1/3.1 = 0.3225806451612903
  -- This rate already includes service + delivery to Ireland
  fx_rate NUMERIC(16,10), -- Store conversion rate used
  
  -- Line-level modifiers
  discount_percent NUMERIC(5,2) DEFAULT 0.00,
  vat_rate_override NUMERIC(5,2), -- NULL means use order header rate
  
  -- Attachments & notes
  attachment_url TEXT, -- Path in supabase storage
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT positive_price CHECK (unit_price > 0),
  CONSTRAINT positive_quantity CHECK (quantity >= 0.001),
  UNIQUE (order_id, line_number)
);

-- Invoices table
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  invoice_number TEXT UNIQUE NOT NULL,
  type invoice_type NOT NULL,
  
  -- Snapshot of totals at invoice time
  items_net NUMERIC(12,2) NOT NULL,
  vat_amount NUMERIC(12,2) NOT NULL,
  items_gross NUMERIC(12,2) NOT NULL,
  shipping_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  grand_total NUMERIC(12,2) NOT NULL,
  
  pdf_url TEXT, -- Path in supabase storage documents/
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- Payments table
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  method payment_method NOT NULL,
  reference TEXT,
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_by UUID REFERENCES profiles(id),
  
  CONSTRAINT positive_amount CHECK (amount > 0)
);

-- Shipments table
CREATE TABLE shipments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  carrier TEXT,
  tracking_number TEXT,
  parcels_count INTEGER DEFAULT 1,
  total_weight NUMERIC(10,2), -- kg
  
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- Warehouse tasks table
CREATE TABLE warehouse_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  status task_status NOT NULL DEFAULT 'pending',
  
  quantity_picked NUMERIC(12,3),
  location_note TEXT,
  
  picked_at TIMESTAMPTZ,
  picked_by UUID REFERENCES profiles(id),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE (order_item_id)
);

-- Audit logs table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL, -- e.g., 'status_change', 'item_edit', 'price_update'
  
  from_status order_status,
  to_status order_status,
  
  payload JSONB, -- Additional context
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications table (optional for MVP, but useful)
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  
  title TEXT NOT NULL,
  message TEXT,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_profiles_company ON profiles(company_id);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_orders_company ON orders(company_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_by ON orders(created_by);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_invoices_order ON invoices(order_id);
CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE INDEX idx_shipments_order ON shipments(order_id);
CREATE INDEX idx_warehouse_tasks_item ON warehouse_tasks(order_item_id);
CREATE INDEX idx_audit_logs_order ON audit_logs(order_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_order_items_updated_at BEFORE UPDATE ON order_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_warehouse_tasks_updated_at BEFORE UPDATE ON warehouse_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


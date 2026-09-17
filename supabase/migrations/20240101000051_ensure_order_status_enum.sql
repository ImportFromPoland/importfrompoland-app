-- Ensure profitability/logistics status labels exist on production enums.
-- Safe ADD VALUE (no DROP TYPE). Run if Logistyka errors on partially_packed etc.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'order_status' AND e.enumlabel = 'paid'
  ) THEN
    ALTER TYPE order_status ADD VALUE 'paid';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'order_status' AND e.enumlabel = 'partially_packed'
  ) THEN
    ALTER TYPE order_status ADD VALUE 'partially_packed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'order_status' AND e.enumlabel = 'packed'
  ) THEN
    ALTER TYPE order_status ADD VALUE 'packed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'order_status' AND e.enumlabel = 'partially_dispatched'
  ) THEN
    ALTER TYPE order_status ADD VALUE 'partially_dispatched';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'order_status' AND e.enumlabel = 'dispatched'
  ) THEN
    ALTER TYPE order_status ADD VALUE 'dispatched';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'order_status' AND e.enumlabel = 'partially_delivered'
  ) THEN
    ALTER TYPE order_status ADD VALUE 'partially_delivered';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'order_status' AND e.enumlabel = 'delivered'
  ) THEN
    ALTER TYPE order_status ADD VALUE 'delivered';
  END IF;
END $$;

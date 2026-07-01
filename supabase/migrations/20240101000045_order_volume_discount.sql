-- Client volume discount preference: bank transfer (+1% on top of tier discount)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS prefers_bank_transfer BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN orders.prefers_bank_transfer IS
  'Client opted for bank transfer payment (+1% volume discount); payment link omitted on confirmation';

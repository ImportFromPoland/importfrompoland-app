# Testing Guide

## Critical Tests for MVP Acceptance

### 1. PLN to EUR Conversion Rule

**Test Case**: Verify PLN/3.1 conversion is correct and includes service + delivery

**Steps**:
1. Login as client
2. Create new order
3. Add line item:
   - Product: "Test Item"
   - Unit Price: 310 PLN
   - Quantity: 1
   - Currency: PLN
4. Verify conversion display shows:
   - "310 PLN ÷ 3.1 = €100.00"
   - Note: "This rate includes service and delivery to Ireland"
5. Check totals panel shows line total: €100.00
6. Submit order
7. Login as admin
8. View order totals - should match €100.00

**Expected**: Line net = €100.00 (before VAT)

**Pass Criteria**: ✅ Conversion is exactly €100.00

---

### 2. Multiple PLN Items Totals

**Test Case**: Verify multiple PLN items sum correctly

**Steps**:
1. Create order with:
   - Line 1: 310 PLN × 1 = €100.00
   - Line 2: 155 PLN × 5 = €250.00
   - Line 3: 93 PLN × 10 = €300.00
2. Total should be €650.00 (before VAT)
3. With 23% VAT: €650 × 1.23 = €799.50

**Pass Criteria**: ✅ Grand total = €799.50

---

### 3. Mixed Currency Order

**Test Case**: EUR and PLN items in same order

**Steps**:
1. Create order with:
   - Line 1: €50 × 2 (EUR) = €100.00
   - Line 2: 310 PLN × 1 = €100.00
2. Items Net: €200.00
3. VAT (23%): €46.00
4. Grand Total: €246.00

**Pass Criteria**: ✅ Both currencies calculate correctly

---

### 4. No Extra Shipping on PLN Items

**Test Case**: Confirm shipping defaults to 0 for PLN items

**Steps**:
1. Create order with only PLN items
2. Check shipping cost field = 0
3. Verify grand total does NOT include extra shipping
4. Only if admin manually adds header shipping should it appear

**Pass Criteria**: ✅ Shipping = 0 by default

---

### 5. Client RLS Policy

**Test Case**: Client cannot access other company's orders

**Steps**:
1. Create Company A with Client A
2. Create Company B with Client B
3. Login as Client A
4. Try to access order created by Client B (direct URL)
5. Should get 404 or unauthorized

**Pass Criteria**: ✅ Cannot access other company orders

---

### 6. Status Transition Guards

**Test Case**: Clients cannot change status beyond "draft" or "submitted"

**Steps**:
1. Login as client
2. Create and submit order
3. Try to update status to "confirmed" via API
4. Should fail with RLS error

**Pass Criteria**: ✅ Status change blocked

---

### 7. Proforma PDF Generation

**Test Case**: Admin can generate proforma with correct totals

**Steps**:
1. Login as admin
2. View submitted order
3. Click "Generate Proforma"
4. Download PDF
5. Verify:
   - Invoice number (PRO-2024-00001)
   - Items listed correctly
   - Totals match order_totals view
   - PLN conversion note included

**Pass Criteria**: ✅ PDF generated with accurate data

---

### 8. Warehouse Flow

**Test Case**: Warehouse can update order status through picking → dispatch

**Steps**:
1. Admin marks order as "confirmed"
2. Login as warehouse
3. View order in queue
4. Update line items: pending → picking → picked → packed
5. When all packed, order status = "packed"
6. Create shipment
7. Order status = "dispatched"

**Pass Criteria**: ✅ Status updates correctly at each step

---

### 9. Totals Parity (Client vs Server)

**Test Case**: Client-calculated totals match server view

**Steps**:
1. Create order with:
   - Mixed EUR/PLN items
   - Line discounts
   - Header discount 5%
   - VAT 23%
   - Shipping €10
2. Note client-side grand total
3. Save order
4. Query `order_totals` view
5. Compare values

**Pass Criteria**: ✅ Difference < €0.01

---

### 10. Payment & Confirmation

**Test Case**: Recording full payment auto-confirms order

**Steps**:
1. Admin creates final invoice
2. Order status = "invoiced"
3. Admin records payment for full amount
4. Order status should auto-update to "confirmed"
5. Confirmed timestamp should be set

**Pass Criteria**: ✅ Auto-confirmation works

---

## Integration Tests

### Order Lifecycle Test

Full flow from draft to delivered:

1. **Client**: Create draft order with PLN items
2. **Client**: Submit order → status = "submitted"
3. **Admin**: Review → status = "in_review"
4. **Admin**: Generate proforma
5. **Admin**: Confirm → status = "confirmed"
6. **Admin**: Create final invoice → status = "invoiced"
7. **Admin**: Record payment → status = "confirmed"
8. **Warehouse**: Pick items → status = "picking", then "picked"
9. **Warehouse**: Pack → status = "packed"
10. **Warehouse**: Create shipment → status = "dispatched"
11. **Manual**: Mark delivered → status = "delivered"

**Pass Criteria**: ✅ All transitions succeed, audit logs created

---

## Performance Tests

### Large Order Test

**Test Case**: Order with 100 line items

**Steps**:
1. Create order with 100 items
2. Mix of EUR and PLN
3. Save and submit
4. Measure page load time
5. Verify totals calculation completes < 2 seconds

**Pass Criteria**: ✅ Page responsive, calculations accurate

---

## Security Tests

### 1. SQL Injection

Try malicious input in all text fields:
- `'; DROP TABLE orders; --`
- `<script>alert('xss')</script>`

**Pass Criteria**: ✅ All inputs sanitized

### 2. File Upload

Try uploading:
- Executable files (.exe, .sh)
- Oversized files (>10MB)
- Invalid MIME types

**Pass Criteria**: ✅ Only allowed types accepted

### 3. Direct Object Reference

Try accessing:
- `/orders/[random-uuid]`
- `/admin/orders` as client
- `/warehouse` as client

**Pass Criteria**: ✅ All unauthorized access blocked

---

## Regression Tests (Before Each Release)

- [ ] PLN conversion still = ÷3.1
- [ ] No auto-shipping added
- [ ] RLS policies enforce company isolation
- [ ] Status transitions follow state machine
- [ ] Totals client/server parity maintained
- [ ] Edge Functions all working
- [ ] PDF generation works
- [ ] File uploads work
- [ ] Email auth works
- [ ] All user roles can access correct pages

---

## Test Users (Seed Data)

```
Admin:     admin@importfrompoland.com / admin123
Warehouse: warehouse@importfrompoland.com / warehouse123
Client:    client@demo.com / client123
```

---

## Reporting Issues

When reporting bugs, include:

1. User role
2. Steps to reproduce
3. Expected behavior
4. Actual behavior
5. Screenshots
6. Browser/device info
7. Error messages (console and network logs)

---

**Test Environment**: http://localhost:3000
**Production Environment**: https://app.importfrompoland.ie

---

## Automated Testing (Future)

Consider adding:
- Cypress E2E tests for critical flows
- Jest unit tests for utilities
- Playwright for cross-browser testing
- Supabase local testing with test database


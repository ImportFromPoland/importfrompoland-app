# VAT Calculation Guide

## Overview
This document explains how VAT calculations work in the ImportFromPoland app.

## Client Price Entry

### What Clients Enter
- Clients enter prices in **PLN (Polish Złoty)** from Polish websites
- These prices are **GROSS** prices (including 23% VAT by default)
- Example: Client sees 310 PLN on a Polish website and enters this amount

### Display to Client
After entering the PLN price, the client sees:
```
= €100.00 (incl. VAT)
```

This is calculated as:
```
310 PLN ÷ 3.1 = €100.00 (gross EUR, includes VAT)
```

### Line Total Display
The line total shown to the client includes VAT:
```
Line Total: €500.00 (incl. VAT & delivery)
```
(Example: €100 × 5 units = €500 gross)

---

## PDF and Admin Interface

### Price Display in PDF Table
The PDF shows **NET** prices (excluding VAT) in the item table:

| Product | Qty | Price EUR excl VAT | Total (EUR) |
|---------|-----|-------------------|-------------|
| Item A  | 5   | €81.30            | €406.50     |

Calculation:
```javascript
// Step 1: Convert PLN to EUR (gross)
310 PLN ÷ 3.1 = €100.00 (gross EUR)

// Step 2: Calculate NET price by removing VAT
€100.00 ÷ 1.23 = €81.30 (net EUR)

// Step 3: Line total (net)
€81.30 × 5 units = €406.50 (net)
```

### PDF Totals Section
The totals section shows the full breakdown:

```
Subtotal (excl. VAT):  €406.50
VAT (23%):             €93.50
Shipping:              €0.00
Grand Total:           €500.00
```

Calculation:
```javascript
Net total:     €406.50
VAT amount:    €406.50 × 0.23 = €93.50
Grand total:   €406.50 + €93.50 = €500.00 (gross)
```

---

## Admin VAT Control

### Changing VAT Rate
Admins can change the VAT rate in the "Order Settings" panel:
- Default: **23%** (Polish standard VAT)
- Can be set to **0%** for EU VAT registered businesses
- Can be any other rate as needed

### Zero-Rated VAT (0%)
For EU VAT registered businesses:

1. Admin sets VAT rate to **0%**
2. Client enters: 310 PLN
3. Client sees: €100.00 (incl. VAT) - *but VAT is 0%*
4. PDF shows:
   - Net price: €100.00
   - Line total: €500.00 (5 × €100)
   - Subtotal (excl. VAT): €500.00
   - VAT (0%): €0.00
   - Grand Total: €500.00

---

## Technical Implementation

### Database Views
The `order_item_totals` and `order_totals` views handle all calculations:
- Convert PLN to EUR using rate: `1 / 3.1 = 0.3225806451612903`
- Apply VAT rate from `orders.vat_rate`
- Calculate net, VAT, and gross amounts
- Apply discounts, markup, and shipping

### Key Files
1. **Client Interface**
   - `components/OrderLineForm.tsx` - Shows gross EUR after conversion
   - Line 111: Displays `(incl. VAT)`

2. **PDF Generation**
   - `components/OrderPDF.tsx` - Shows net prices in table
   - Lines 298-325: Calculates net from gross

3. **Admin Interface**
   - `app/admin/orders/[id]/page.tsx` - Allows VAT rate editing
   - Lines 642-653: VAT rate input field

### Formula Reference
```javascript
// PLN to EUR divisor
const EUR_TO_PLN_DIVISOR = 3.1;

// Client enters
const pricePLN = 310; // gross PLN

// Convert to gross EUR
const grossEUR = pricePLN / EUR_TO_PLN_DIVISOR; // 100.00

// Calculate net EUR (for PDF table)
const vatRate = 23; // from order.vat_rate
const netEUR = grossEUR / (1 + (vatRate / 100)); // 81.30

// Line total
const quantity = 5;
const lineTotalNet = netEUR * quantity; // 406.50
const lineTotalGross = grossEUR * quantity; // 500.00

// VAT amount
const vatAmount = lineTotalNet * (vatRate / 100); // 93.50

// Verify
console.log(lineTotalNet + vatAmount === lineTotalGross); // true
```

---

## Common Scenarios

### Scenario 1: Standard Polish Customer (23% VAT)
- Client enters: **310 PLN** from Polish website
- Client sees: **€100.00 (incl. VAT)**
- PDF table shows: **€81.30 excl VAT** per unit
- PDF totals: Net €406.50 + VAT €93.50 = **€500.00**

### Scenario 2: EU VAT Registered Business (0% VAT)
- Admin sets VAT rate to **0%**
- Client enters: **310 PLN**
- Client sees: **€100.00 (incl. VAT)** *(but VAT is 0%)*
- PDF table shows: **€100.00 excl VAT** per unit
- PDF totals: Net €500.00 + VAT €0.00 = **€500.00**

### Scenario 3: Irish Reverse Charge (0% VAT)
- Admin sets VAT rate to **0%**
- Process same as Scenario 2
- Note: Client handles VAT in their own VAT return

---

## Testing Checklist

✅ Client can enter PLN prices
✅ Client sees EUR conversion with "(incl. VAT)" label
✅ Line total shows gross EUR with "incl. VAT & delivery"
✅ PDF table shows NET prices (excluding VAT)
✅ PDF totals calculate correctly: Net + VAT = Gross
✅ Admin can change VAT rate (including 0%)
✅ Calculations update when VAT rate changes
✅ No NaN errors in PDF or UI

---

## Support

If you encounter any issues with VAT calculations:
1. Check the `order.vat_rate` value in the database
2. Verify the `order_item_totals` view is calculating correctly
3. Ensure `unit_price` in `order_items` is stored in PLN
4. Check browser console for calculation errors

For questions, contact the development team.


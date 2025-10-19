# Order Workflow Explained

## 🔄 Complete Order Lifecycle

### **Client Side**

```
┌─────────────────────────────────────────────────────────────┐
│  CLIENT CREATES BASKET                                      │
│  Status: BASKET (draft)                                     │
│  ├─ Add items with PLN prices                               │
│  ├─ Edit quantities, names                                  │
│  ├─ Rename basket                                           │
│  └─ Can edit freely                                         │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
              [Click "Submit Order"]
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  ORDER SUBMITTED                                            │
│  Status: SUBMITTED                                          │
│  ├─ Order number generated (ORD-12345678)                   │
│  ├─ Moved to "My Orders" section                            │
│  ├─ Client can view but NOT edit                            │
│  └─ Waiting for admin review                                │
└─────────────────────────────────────────────────────────────┘
```

---

### **Admin Side - Phase 1: Review & Confirm**

```
┌─────────────────────────────────────────────────────────────┐
│  ADMIN REVIEWS ORDER                                        │
│  Status: SUBMITTED                                          │
│  ├─ Check all product links work                            │
│  ├─ Verify prices are correct                               │
│  ├─ Add missing URLs if client forgot                       │
│  ├─ Adjust quantities (round to full boxes)                 │
│  ├─ Add shipping costs                                      │
│  ├─ Apply discounts if needed                               │
│  └─ Edit any field needed                                   │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
              [Click "Confirm Order"]
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  ORDER CONFIRMED                                            │
│  Status: CONFIRMED                                          │
│  ├─ Admin can now generate PDF                              │
│  ├─ PDF sent to client via email manually                   │
│  ├─ Client sees "CONFIRMED" status                          │
│  ├─ Item tracking checkboxes appear                         │
│  │  ☐ Ordered from Supplier                                 │
│  │  ☐ Received in Warehouse                                 │
│  └─ Ready to order from suppliers                           │
└─────────────────────────────────────────────────────────────┘
```

---

### **Admin Side - Phase 2: Order Items**

```
┌─────────────────────────────────────────────────────────────┐
│  ORDERING FROM SUPPLIERS                                    │
│  Status: CONFIRMED                                          │
│  ├─ Admin orders Item 1 from Supplier A                     │
│  │  └─ ☑ Tick "Ordered from Supplier" for Item 1           │
│  ├─ Admin orders Item 2 from Supplier B                     │
│  │  └─ ☑ Tick "Ordered from Supplier" for Item 2           │
│  └─ Continue for all items                                  │
└─────────────────────────────────────────────────────────────┘
```

---

### **Warehouse Side - Phase 3: Receiving Items**

```
┌─────────────────────────────────────────────────────────────┐
│  ITEMS ARRIVING IN WAREHOUSE                                │
│                                                             │
│  Item 1 arrives:                                            │
│  └─ ☑ Tick "Received in Warehouse" for Item 1              │
│     ├─ Order Status → PARTIALLY COMPLETE                    │
│     └─ Client sees: "PARTIALLY COMPLETE"                    │
│                                                             │
│  Item 2 arrives:                                            │
│  └─ ☑ Tick "Received in Warehouse" for Item 2              │
│     ├─ Order Status → PARTIALLY COMPLETE                    │
│     └─ Client sees: "PARTIALLY COMPLETE"                    │
│                                                             │
│  Item 3 (last item) arrives:                                │
│  └─ ☑ Tick "Received in Warehouse" for Item 3              │
│     ├─ ✨ ALL ITEMS RECEIVED!                               │
│     ├─ Order Status → READY FOR DESPATCH                    │
│     ├─ Client sees: "READY FOR DESPATCH"                    │
│     └─ "Mark as Shipped" button appears for admin           │
└─────────────────────────────────────────────────────────────┘
```

---

### **Final Step - Shipping**

```
┌─────────────────────────────────────────────────────────────┐
│  WAREHOUSE DISPATCHES ORDER                                 │
│  Status: READY FOR DESPATCH                                 │
│  └─ Admin clicks "Mark as Shipped"                          │
│     ├─ Order Status → SENT                                  │
│     └─ Client sees: "SENT"                                  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  CLIENT RECEIVES ORDER                                      │
│  Status: SENT                                               │
│  ├─ Client can track shipment                               │
│  ├─ Download order confirmation PDF                         │
│  └─ Process complete!                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Status Visibility Matrix

| Status | Client Sees | Admin Sees | What It Means |
|--------|-------------|------------|---------------|
| `draft` | ✅ BASKET | ✅ Draft Basket | Client working on order |
| `submitted` | ✅ SUBMITTED | ✅ SUBMITTED | Waiting for admin review |
| `confirmed` | ✅ CONFIRMED | ✅ CONFIRMED | Admin approved, ordering items |
| `partially_received` | ✅ PARTIALLY COMPLETE | ✅ PARTIALLY RECEIVED | Some items in warehouse |
| `ready_to_ship` | ✅ READY FOR DESPATCH | ✅ READY TO SHIP | All items ready |
| `shipped` | ✅ SENT | ✅ SHIPPED | Dispatched to customer |

---

## 🎯 Admin Actions by Status

### **SUBMITTED Orders**
- ✏️ Edit all order details
- ✅ Confirm Order
- 🗑️ Cancel Order

### **CONFIRMED Orders**
- ✏️ Edit order details
- 📄 Generate PDF
- ☑️ Tick "Ordered from Supplier"
- ☑️ Tick "Received in Warehouse"
- 🗑️ Cancel Order

### **PARTIALLY RECEIVED Orders**
- ✏️ Edit order details
- 📄 Generate PDF
- ☑️ Continue receiving items
- 🗑️ Cancel Order

### **READY TO SHIP Orders**
- ✏️ Edit order details
- 📄 Generate PDF
- 🚚 Mark as Shipped
- 🗑️ Cancel Order

### **SHIPPED Orders**
- 👀 View only (no edits)
- 📄 Re-download PDF
- 📧 Resend confirmation

---

## 🔄 Automatic Status Updates

The system automatically updates order status based on item progress:

1. **No items received** → Status stays `confirmed`
2. **First item received** → Status changes to `partially_received`
3. **More items received** → Status stays `partially_received`
4. **Last item received** → Status changes to `ready_to_ship`
5. **Admin clicks "Mark as Shipped"** → Status changes to `shipped`

---

## 👥 Who Can Do What?

### **Client**
- Create baskets
- Submit orders
- View order status
- Download PDF (when confirmed)
- ❌ Cannot edit after submission

### **Admin / Superadmin**
- View all orders
- Edit any order detail
- Confirm orders
- Generate PDFs
- Track supplier orders
- Mark items as received
- Mark as shipped
- Everything a client can do

### **Warehouse**
- View orders ready for processing
- Mark items as received
- Mark as shipped
- Cannot edit prices/details

---

## 📧 Email Notifications (Future Feature)

Planned notifications:
- ✉️ Client: Order submitted confirmation
- ✉️ Admin: New order submitted alert
- ✉️ Client: Order confirmed (with PDF)
- ✉️ Client: Items partially received update
- ✉️ Client: Order ready for despatch
- ✉️ Client: Order shipped (with tracking)

---

## 🎨 Client Experience

**What client sees in "My Orders":**

```
┌───────────────────────────────────────────┐
│  Order ORD-12345678                       │
│  Kitchen Renovation Materials             │
│  [PARTIALLY COMPLETE]                     │
│  3 items • €1,234.56                      │
│  Submitted: 13 Oct 2024                   │
│  ──────────────────────────────────────   │
│  2 of 3 items received in warehouse       │
│  Expected completion: Soon                │
│  [Download PDF] [View Details]            │
└───────────────────────────────────────────┘
```

---

**This workflow ensures:**
- ✅ Clear communication between client and admin
- ✅ Real-time status visibility
- ✅ Item-level tracking
- ✅ Automated status updates
- ✅ Professional order management
- ✅ No manual status changes needed

**The system does the thinking for you!** 🎉


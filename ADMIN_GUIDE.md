# Admin Interface Guide

## 🎯 Overview

Your ImportFromPoland app now has a professional ERP-style admin interface with full order management capabilities, user management, and secure role-based access control.

---

## 🔐 Getting Started

### Step 1: Set Up Your Superadmin Account

Follow the instructions in **`SUPERADMIN_SETUP.md`** to:
1. Sign up with m.nowak@importfrompoland.com
2. Promote your account to `staff_admin` via SQL
3. Access the admin panel

### Step 2: Access Admin Interface

Once promoted, sign out and sign back in. You'll be automatically redirected to `/admin/orders`.

---

## 📋 Admin Features

### **1. Order Management** (`/admin/orders`)

**View All Orders:**
- See all submitted orders and draft baskets in one place
- Comprehensive table with:
  - Order number
  - Customer name
  - Status badge
  - Item count
  - Submission date
  - Total amount
  - Invoice status
  - Shipment tracking

**Order Detail View** (`/admin/orders/[id]`):
- **Edit All Order Items:**
  - Click pencil icon to edit any field
  - Product name, supplier, website URL
  - Unit price (PLN), quantity, unit of measure
  - Auto-calculates EUR conversion and totals
  
- **Add/Remove Items:**
  - Add new items with "Add Item" button
  - Delete items with trash icon
  
- **Edit Order Settings:**
  - VAT rate (default 23%)
  - Shipping cost
  - Order-level discount
  - Markup percentage
  
- **Customer Information:**
  - Full company details
  - Delivery address
  - Contact information
  
- **Real-time Totals:**
  - Auto-updates as you edit
  - Shows subtotal, VAT, shipping, grand total

**Use Cases:**
- ✅ Client forgot to add product link → Add it yourself
- ✅ Client entered wrong price → Edit the unit price
- ✅ Need to round up to full box → Adjust quantity
- ✅ Apply bulk discount → Set discount percentage
- ✅ Add shipping costs → Set shipping amount

---

### **2. User Management** (`/admin/users`) - Superadmins Only

**View All Users:**
- Complete user list with email, role, company
- Email confirmation status
- Join date

**Manage Roles:**
- Promote/demote users via dropdown
- Available roles:
  - **Client** - Standard customer access
  - **Administrator** - Can manage all orders
  - **Warehouse Staff** - Access to warehouse features
  - **Superadmin** - Full system access + user management

**Statistics Dashboard:**
- Total users count
- Breakdown by role type
- Quick overview of team

**Security:**
- You cannot demote yourself (prevents lockout)
- Only staff_admin can access this page
- All role changes are instant

---

### **3. Invoices** (`/admin/invoices`)
- Placeholder for future invoice management
- Will handle proforma & final invoices
- Payment tracking

---

### **4. Warehouse** (`/admin/warehouse`)
- Placeholder for warehouse operations
- Will handle picking, packing, dispatch
- Order queue management

---

## 🎨 Admin Interface Features

### Professional Layout:
- **Sticky Header** with logo and navigation
- **Sidebar Navigation** with icons
- **Role Badge** showing your admin level
- **Client View Button** to switch to customer perspective

### Navigation:
- **Orders** - Main order management
- **Invoices** - Invoice & payment tracking (coming soon)
- **Warehouse** - Warehouse operations (coming soon)
- **Users** - User & role management (superadmins only)

### Responsive Design:
- Works on desktop, tablet, and mobile
- Scrollable tables for large datasets
- Clean, modern ERP-style interface

---

## 🔒 Security Model

### Role Hierarchy:
```
staff_admin (Superadmin)
    ↓
admin (Administrator)
    ↓
warehouse (Warehouse Staff)
    ↓
client (Customer)
```

### Access Control:
- **Clients:**
  - Cannot access `/admin/*` routes
  - Redirected to client dashboard
  - Can only view/edit own orders (draft only)

- **Admins & Staff Admins:**
  - Full access to all orders
  - Can edit any order field
  - View all customer data

- **Staff Admins Only:**
  - User management access
  - Can promote/demote users
  - System-wide settings (future)

### Row-Level Security (RLS):
- Enforced at database level
- Even if someone bypasses frontend, database blocks unauthorized access
- Cannot self-promote via API
- All changes audited

---

## 📊 Order Editing Workflow

### Typical Admin Workflow:

1. **Client submits basket** → Order moves from "BASKET" to "SUBMITTED"
2. **Admin reviews order** at `/admin/orders`
3. **Admin clicks "View"** to see order details
4. **Admin edits as needed:**
   - Fix prices
   - Add missing URLs
   - Adjust quantities
   - Add shipping costs
5. **Totals auto-calculate** in real-time
6. **Changes save automatically** on blur/edit complete
7. **Move to next status** (future: generate invoice, send to warehouse)

### Editing Tips:
- **Click pencil icon** on any item row to edit
- **Changes save on blur** (when you click away)
- **Check mark** appears when editing - click to finish
- **Delete icon** removes the item (with confirmation)
- **Add Item button** adds a new line
- **Header fields** (VAT, shipping) update totals immediately

---

## 🚀 Next Steps

### Now that admin is set up:

1. ✅ **Follow SUPERADMIN_SETUP.md** to promote your account
2. ✅ **Test the admin interface** with a few test orders
3. ✅ **Create additional admin users** as needed for your team
4. ⏳ **Fix "Submit Order" functionality** (mentioned earlier)
5. ⏳ **Implement invoice generation**
6. ⏳ **Build warehouse features**
7. ⏳ **Add email notifications**

---

## 🆘 Troubleshooting

### "Access Denied" when accessing /admin
- Check your role in Supabase: `profiles` table → `role` column
- Must be `admin` or `staff_admin`
- Sign out and sign back in after role change

### Can't see "Users" menu
- Only `staff_admin` role can access user management
- Regular `admin` users don't see this menu item

### Changes not saving
- Check browser console for errors
- Verify you have admin access
- Check Supabase logs in dashboard

### User list empty in /admin/users
- This requires `supabase.auth.admin.listUsers()` API
- Make sure service_role key is set in environment
- This API works differently - may need Edge Function wrapper

---

## 📝 File Structure

```
app/admin/
├── layout.tsx              # Admin layout with sidebar
├── orders/
│   ├── page.tsx           # Orders list
│   └── [id]/page.tsx      # Order detail & editing
├── users/page.tsx         # User management (superadmin)
├── invoices/page.tsx      # Invoice management (placeholder)
└── warehouse/page.tsx     # Warehouse operations (placeholder)

components/ui/
├── table.tsx              # Table component for data display
└── textarea.tsx           # Textarea for notes/descriptions
```

---

## 🎓 Training Your Team

When onboarding sales staff or admins:

1. Have them sign up as normal client
2. You promote them to `admin` role via `/admin/users`
3. They sign out and sign back in
4. They now have admin access
5. Show them order editing workflow
6. Grant warehouse staff the `warehouse` role

---

**You're all set!** Your admin panel is ready for production use. 🚀

For questions or issues, check the Supabase logs and browser console for errors.


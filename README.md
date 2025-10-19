# ImportFromPoland App - MVP

A comprehensive order management system for importing goods from Poland to Ireland, built with Next.js, TypeScript, and Supabase.

## Overview

This MVP replaces a legacy quote form with a modern order builder featuring:

- **Instant totals calculation** with real-time PLN to EUR conversion
- **Multi-role access**: Client, Admin, and Warehouse interfaces
- **End-to-end workflow**: From draft orders to shipment tracking
- **Critical pricing rule**: PLN prices converted at **÷3.1** (includes service + delivery to Ireland)

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, React Query, TailwindCSS, shadcn/ui
- **Backend**: Supabase (Postgres, Auth, RLS, Storage, Edge Functions)
- **Validation**: Zod
- **State Management**: React Context + React Query
- **Styling**: TailwindCSS + shadcn/ui components

## Critical Pricing Rule

**PLN to EUR Conversion = PLN ÷ 3.1**

This conversion rate already includes:
- Service fees
- Delivery to Ireland

**Example**: 310 PLN → 310 ÷ 3.1 = €100.00

**Important**: No additional shipping is auto-added for PLN items. Admins can manually add header-level shipping costs for exceptional cases.

## Features

### Client Features
- ✅ Sign up / Sign in (email + password)
- ✅ Company onboarding (VAT, address, contact info)
- ✅ Order Builder with line-by-line items
  - Product name, URL, supplier, pricing
  - PLN/EUR currency selection per line
  - Real-time conversion display
  - File attachments (images, PDFs)
- ✅ Live totals calculation
  - Items Net (before header modifiers)
  - VAT calculation (default 23%)
  - Header discount/markup support
  - Shipping costs
  - Grand total
- ✅ Save draft / Submit order
- ✅ Order dashboard with status tracking
- ✅ Order detail view with timeline

### Admin Features
- ✅ View all orders across companies
- ✅ Order status management (submitted → in_review → confirmed → invoiced)
- ✅ Generate Proforma Invoice (PDF)
- ✅ Finalize Invoice
- ✅ Record payments
- ✅ Edit pricing and modifiers
- ✅ Company management
- ✅ Audit log tracking

### Warehouse Features
- ✅ Order queue (confirmed/invoiced orders)
- ✅ Picking workflow (pending → picking → picked)
- ✅ Packing workflow (picked → packed)
- ✅ Create shipments with tracking
- ✅ Update order status to dispatched

## Database Schema

### Core Tables

- `profiles` - User profiles with role-based access
- `companies` - Customer companies
- `orders` - Order headers with status, pricing, modifiers
- `order_items` - Individual line items with currency conversion
- `invoices` - Proforma and final invoices
- `payments` - Payment records
- `shipments` - Shipping information and tracking
- `warehouse_tasks` - Per-item picking/packing tasks
- `audit_logs` - Complete audit trail
- `notifications` - User notifications

### Views

- `order_item_totals` - Per-line calculations with FX conversion
- `order_totals` - Aggregated order totals with all modifiers

### Enums

- `user_role`: client, admin, staff_admin, warehouse
- `order_status`: draft, submitted, in_review, confirmed, invoiced, picking, picked, packed, ready_to_ship, dispatched, delivered, cancelled
- `currency_type`: EUR, PLN

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- (Optional) Supabase CLI for local development

### 1. Clone and Install

```bash
cd importfrompoland-app
npm install
```

### 2. Environment Variables

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

For the seed script, also set:

```bash
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Important**: Never commit service role keys. Only use them in secure environments (Edge Functions, seed scripts).

### 3. Database Setup

Run the migrations in your Supabase SQL Editor in order:

```sql
-- Run these files in order:
1. supabase/migrations/20240101000000_initial_schema.sql
2. supabase/migrations/20240101000001_views_and_functions.sql
3. supabase/migrations/20240101000002_rls_policies.sql
```

### 4. Edge Functions Deployment

Deploy Edge Functions to Supabase:

```bash
# Install Supabase CLI first
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Deploy functions
supabase functions deploy submit-order
supabase functions deploy generate-proforma
supabase functions deploy finalize-invoice
supabase functions deploy record-payment
supabase functions deploy advance-warehouse
supabase functions deploy create-shipment
```

Set the service role key for Edge Functions:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 5. Storage Buckets

Create storage buckets in Supabase Dashboard:
- `attachments` (private)
- `documents` (private)
- `labels` (private)

### 6. Seed Database (Optional)

Populate with demo data:

```bash
npm run seed
```

This creates:
- Admin user: `admin@importfrompoland.com` / `admin123`
- Warehouse user: `warehouse@importfrompoland.com` / `warehouse123`
- Client user: `client@demo.com` / `client123`
- Demo company and sample order

### 7. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## User Flows

### Client Flow

1. **Sign Up** → Create account
2. **Onboarding** → Enter company details
3. **Create Order** → Add line items with PLN/EUR pricing
4. **Review Totals** → See instant calculations with conversion notes
5. **Submit** → Order moves to admin review
6. **Track** → View status updates and shipment info

### Admin Flow

1. **Review Orders** → View all submitted orders
2. **Update Status** → Move order through workflow
3. **Generate Proforma** → Create PDF invoice
4. **Finalize Invoice** → Create final invoice
5. **Record Payment** → Mark as paid
6. **Monitor** → Track all orders and companies

### Warehouse Flow

1. **View Queue** → See orders ready for processing
2. **Pick Items** → Update line-by-line picking status
3. **Pack** → Mark order as packed
4. **Dispatch** → Create shipment with tracking
5. **Complete** → Order marked as dispatched

## State Machine

```
Client: draft → submitted
Admin: submitted → in_review → confirmed → invoiced
Warehouse: confirmed|invoiced → picking → picked → packed → ready_to_ship → dispatched
System: dispatched → delivered
```

Invalid transitions are blocked by RLS policies and Edge Functions.

## Currency Conversion Examples

| PLN Price | Qty | Calculation | EUR Result |
|-----------|-----|-------------|------------|
| 310.00 | 1 | 310 ÷ 3.1 | €100.00 |
| 155.00 | 5 | 775 ÷ 3.1 | €250.00 |
| 93.00 | 10 | 930 ÷ 3.1 | €300.00 |

**Conversion Rate**: 0.3225806451612903 (stored to 10 decimals, displayed to 2)

## Testing Checklist

- [ ] PLN item with unit_price=310, qty=1 → line net = €100.00
- [ ] Client-side totals match server `order_totals` view (within 0.01)
- [ ] Client from Company A cannot access Company B orders
- [ ] Client cannot change order status beyond 'submitted'
- [ ] Proforma PDF generates with correct totals
- [ ] Warehouse flow updates order status correctly
- [ ] No auto-shipping added for PLN items

## RLS Policies

Row Level Security is enabled on all tables. Key policies:

- **Clients**: Can only view/edit own company's orders in 'draft' status
- **Admins**: Full access to all orders and companies
- **Warehouse**: Read access to orders in processing statuses, can update tasks
- **System**: Edge Functions can create audit logs and notifications

## File Structure

```
importfrompoland-app/
├── app/                    # Next.js App Router
│   ├── login/             # Authentication
│   ├── onboarding/        # Company setup
│   ├── orders/            # Client order views
│   │   ├── new/          # Order builder
│   │   └── [id]/         # Order detail
│   ├── admin/             # Admin interface
│   │   └── orders/       # Order management
│   ├── warehouse/         # Warehouse queue
│   └── api/               # API routes
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── OrderLineForm.tsx # Line item editor
│   ├── TotalsPanel.tsx   # Order totals display
│   ├── StatusBadge.tsx   # Status indicator
│   ├── FileUploader.tsx  # File upload
│   └── PDFLink.tsx       # PDF download link
├── lib/                   # Utilities
│   ├── supabase/         # Supabase clients
│   ├── constants.ts      # App constants
│   └── utils.ts          # Helper functions
├── supabase/
│   ├── migrations/       # Database schema
│   └── functions/        # Edge Functions
└── scripts/
    └── seed.ts           # Database seed script
```

## Edge Functions

All sensitive operations use Edge Functions with service role access:

- `submit-order` - Locks draft, assigns number, changes status
- `generate-proforma` - Creates proforma invoice with PDF
- `finalize-invoice` - Creates final invoice
- `record-payment` - Records payment, auto-confirms if full
- `advance-warehouse` - Updates warehouse task status
- `create-shipment` - Creates shipment, marks dispatched

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Set environment variables
4. Deploy

### Environment Variables for Production

```
NEXT_PUBLIC_SUPABASE_URL=your-production-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-production-anon-key
```

## Future Enhancements (Post-MVP)

- Company-level pricing rules
- Reverse charge VAT logic
- Multi-user companies with roles
- Carrier API integration (tracking webhooks)
- In-app messaging per order
- Export to CSV/XLSX
- Email notifications
- Advanced reporting dashboard
- Mobile app

## Support

For issues or questions:
1. Check this README
2. Review Supabase logs for Edge Functions
3. Check browser console for client errors
4. Review RLS policies if permissions issues

## License

Proprietary - All rights reserved

---

**Built with ❤️ for ImportFromPoland**


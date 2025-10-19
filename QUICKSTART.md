# Quick Start Guide

Get the ImportFromPoland App running locally in 10 minutes.

## Prerequisites

- Node.js 18+ installed
- Supabase account (free tier is fine)
- Git

## 1. Install Dependencies

```bash
cd importfrompoland-app
npm install
```

## 2. Setup Supabase

### Create Project
1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Choose organization and region
4. Set database password
5. Wait for provisioning (~2 min)

### Get Credentials
1. Go to Project Settings → API
2. Copy `Project URL` and `anon public` key

## 3. Configure Environment

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
```

## 4. Setup Database

### Run Migrations

Go to Supabase Dashboard → SQL Editor → "New Query"

Copy and run these files in order:

1. `supabase/migrations/20240101000000_initial_schema.sql`
2. `supabase/migrations/20240101000001_views_and_functions.sql`
3. `supabase/migrations/20240101000002_rls_policies.sql`

### Create Storage Buckets

Go to Storage → "New Bucket" and create:
- `attachments` (private)
- `documents` (private)
- `labels` (private)

## 5. Deploy Edge Functions

Install Supabase CLI:

```bash
npm install -g supabase
```

Login and link:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

Get service role key from Project Settings → API → `service_role` key

Set secret:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Deploy functions:

```bash
cd supabase/functions
supabase functions deploy submit-order
supabase functions deploy generate-proforma
supabase functions deploy finalize-invoice
supabase functions deploy record-payment
supabase functions deploy advance-warehouse
supabase functions deploy create-shipment
```

## 6. Seed Data (Optional)

Add service role key to `.env.local`:

```bash
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Run seed:

```bash
npm run seed
```

This creates test users:
- Admin: `admin@importfrompoland.com` / `admin123`
- Warehouse: `warehouse@importfrompoland.com` / `warehouse123`
- Client: `client@demo.com` / `client123`

## 7. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 8. Test the App

### As Client
1. Login with `client@demo.com` / `client123`
2. View dashboard (should see sample order)
3. Create new order
4. Add item: 310 PLN → should show €100.00
5. Submit order

### As Admin
1. Logout, login with `admin@importfrompoland.com` / `admin123`
2. View all orders
3. Click on order
4. Generate proforma invoice
5. Change status to "confirmed"

### As Warehouse
1. Logout, login with `warehouse@importfrompoland.com` / `warehouse123`
2. View warehouse queue
3. Update item status (picking → picked → packed)
4. Create shipment

## Troubleshooting

### "Invalid API key"
- Check `.env.local` has correct URL and anon key
- Restart dev server after changing env vars

### "Function not found"
- Verify Edge Functions are deployed
- Check function names match exactly
- Check Supabase logs for deployment errors

### "Permission denied" errors
- Verify RLS policies were created (migration 3)
- Check user role in profiles table
- Ensure user has company_id set (for clients)

### Database connection errors
- Check Supabase project is active
- Verify URL in `.env.local`
- Check database password is correct

### Edge Function errors
- Check Supabase Functions logs
- Verify service role key is set in secrets
- Ensure CORS is configured

## Next Steps

- Read [README.md](README.md) for full documentation
- Review [TESTING.md](TESTING.md) for acceptance criteria
- Check [DEPLOYMENT.md](DEPLOYMENT.md) for production setup

## Common Commands

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Run production build locally
npm run start

# Seed database
npm run seed

# Deploy Edge Function
supabase functions deploy function-name

# View function logs
supabase functions logs function-name
```

## Default Ports

- Next.js: http://localhost:3000
- Supabase Studio: http://localhost:54323 (if using local Supabase)
- Supabase API: http://localhost:54321 (if using local Supabase)

## Support

- Check [README.md](README.md) for detailed docs
- Review Supabase logs for errors
- Check browser console for client errors

---

**Happy Coding! 🚀**


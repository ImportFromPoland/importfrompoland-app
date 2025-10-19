# Deployment Guide

This guide covers deploying the ImportFromPoland App to production.

## Prerequisites

- Supabase production project created
- Vercel account (or preferred hosting)
- Domain name (optional)

## Step 1: Supabase Production Setup

### 1.1 Create Production Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Choose a region close to your users (e.g., EU for Ireland)
4. Set a strong database password
5. Wait for project provisioning (~2 minutes)

### 1.2 Run Database Migrations

In your Supabase Dashboard SQL Editor, run these migrations in order:

```sql
-- 1. Initial schema (tables, enums, indexes)
-- Copy and paste: supabase/migrations/20240101000000_initial_schema.sql

-- 2. Views and functions
-- Copy and paste: supabase/migrations/20240101000001_views_and_functions.sql

-- 3. RLS policies
-- Copy and paste: supabase/migrations/20240101000002_rls_policies.sql
```

### 1.3 Create Storage Buckets

In Supabase Dashboard → Storage:

1. Create bucket: `attachments`
   - Public: OFF
   - File size limit: 10MB
   - Allowed MIME types: `image/*,application/pdf`

2. Create bucket: `documents`
   - Public: OFF
   - File size limit: 10MB
   - Allowed MIME types: `text/html,application/pdf`

3. Create bucket: `labels`
   - Public: OFF
   - File size limit: 5MB
   - Allowed MIME types: `application/pdf`

### 1.4 Deploy Edge Functions

Install Supabase CLI:

```bash
npm install -g supabase
```

Login and link project:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

Deploy all Edge Functions:

```bash
cd supabase/functions

supabase functions deploy submit-order
supabase functions deploy generate-proforma
supabase functions deploy finalize-invoice
supabase functions deploy record-payment
supabase functions deploy advance-warehouse
supabase functions deploy create-shipment
```

Set secrets for Edge Functions:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### 1.5 Configure Authentication

In Supabase Dashboard → Authentication → Settings:

1. **Site URL**: Set to your production URL (e.g., `https://app.importfrompoland.ie`)
2. **Redirect URLs**: Add:
   - `https://app.importfrompoland.ie/**`
   - `https://app.importfrompoland.ie/onboarding`
3. **Email Auth**: Enable
4. **Email Templates**: Customize confirmation and magic link emails

## Step 2: Vercel Deployment

### 2.1 Connect Repository

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Choose Next.js framework preset

### 2.2 Configure Environment Variables

Add these environment variables in Vercel:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

**Important**: DO NOT add `SUPABASE_SERVICE_ROLE_KEY` to Vercel. It should only exist in Edge Functions.

### 2.3 Deploy

Click "Deploy" and wait for build to complete (~2-3 minutes).

### 2.4 Custom Domain (Optional)

1. In Vercel → Settings → Domains
2. Add your custom domain
3. Configure DNS records as instructed
4. Wait for SSL certificate provisioning

## Step 3: Post-Deployment Setup

### 3.1 Create Admin User

Use Supabase Dashboard → Authentication → Users:

1. Click "Add user" → "Create new user"
2. Email: `admin@yourcompany.com`
3. Password: Generate strong password
4. Auto Confirm: YES

Then in SQL Editor:

```sql
UPDATE profiles
SET role = 'admin', full_name = 'Admin User'
WHERE email = 'admin@yourcompany.com';
```

### 3.2 Create Warehouse User

Repeat the same process for warehouse user:

```sql
UPDATE profiles
SET role = 'warehouse', full_name = 'Warehouse Staff'
WHERE email = 'warehouse@yourcompany.com';
```

### 3.3 Test Core Flows

1. **Client Flow**:
   - Sign up new client
   - Complete onboarding
   - Create order with PLN items
   - Verify conversion (310 PLN = €100)
   - Submit order

2. **Admin Flow**:
   - Login as admin
   - View submitted order
   - Move to "in_review"
   - Generate proforma
   - Download PDF

3. **Warehouse Flow**:
   - Login as warehouse
   - View order in queue
   - Update picking status
   - Create shipment

## Step 4: Monitoring & Maintenance

### 4.1 Enable Supabase Logs

In Supabase Dashboard → Logs:

- Monitor Edge Functions logs
- Check for errors
- Set up alerts for critical errors

### 4.2 Database Backups

Supabase automatically backs up your database daily. To download a backup:

1. Settings → Database → Database backups
2. Download latest backup
3. Store securely

### 4.3 Vercel Analytics

Enable Vercel Analytics:

1. Vercel Dashboard → Analytics
2. Enable Web Analytics
3. Monitor page views and performance

## Step 5: Security Checklist

- [ ] All RLS policies are enabled
- [ ] Service role key is ONLY in Edge Functions
- [ ] Storage buckets are private
- [ ] Email confirmations are enabled
- [ ] Strong admin passwords are set
- [ ] HTTPS is enforced
- [ ] CORS is properly configured
- [ ] API rate limiting is considered

## Rollback Procedure

If you need to rollback:

### For Frontend (Vercel)

1. Go to Vercel → Deployments
2. Find previous working deployment
3. Click "..." → "Promote to Production"

### For Database

1. Never rollback migrations in production
2. Instead, create a new migration to undo changes
3. Test thoroughly in staging first

### For Edge Functions

```bash
# Redeploy previous version
supabase functions deploy function-name --version previous_version
```

## Production URLs

- **Frontend**: https://app.importfrompoland.ie (or your Vercel URL)
- **Supabase**: https://your-project.supabase.co
- **Edge Functions**: https://your-project.supabase.co/functions/v1/

## Troubleshooting

### Issue: "Network Error" on submit

- Check Edge Functions logs in Supabase
- Verify CORS settings
- Ensure service role key is set in Edge Functions secrets

### Issue: RLS policy errors

- Check user role in profiles table
- Verify company_id is set for clients
- Review RLS policies in Supabase Dashboard

### Issue: File upload fails

- Check storage bucket exists
- Verify bucket policies allow inserts
- Check file size limits

## Support Contacts

- Supabase Support: support@supabase.io
- Vercel Support: support@vercel.com

---

**Last Updated**: 2024-01-01


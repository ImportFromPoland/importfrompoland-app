# Superadmin Setup Guide

## Step 1: Sign Up with Your Admin Email

1. Go to http://localhost:3000/login
2. Click "Don't have an account? Sign up"
3. Sign up with: **m.nowak@importfrompoland.com**
4. Set a strong password
5. Complete the onboarding form (this creates your profile)

## Step 2: Promote Your Account to Superadmin

1. Go to Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: **importfrompoland-app**
3. Go to **SQL Editor** (left sidebar)
4. Click **"New Query"**
5. Paste this SQL:

```sql
-- Find your user ID by email and promote to staff_admin
UPDATE profiles 
SET role = 'staff_admin'
WHERE id = (
  SELECT id 
  FROM auth.users 
  WHERE email = 'm.nowak@importfrompoland.com'
);

-- Verify the update
SELECT p.id, u.email, p.full_name, p.role, p.created_at
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE u.email = 'm.nowak@importfrompoland.com';
```

6. Click **"Run"** (or press F5)
7. You should see your profile with `role = 'staff_admin'`

## Step 3: Access Admin Interface

1. **Sign out** and **sign back in** to refresh your session
2. You'll be automatically redirected to `/admin/orders`
3. You can now:
   - View and edit all orders
   - Manage users and assign roles
   - Access warehouse features
   - Full admin capabilities

## Step 4: Create Additional Admin/Warehouse Users

From the admin interface:
1. Ask users to sign up normally (they'll be `client` by default)
2. Go to **Admin → Users** in your admin dashboard
3. Find their account and promote them to:
   - **admin** - Sales & admin staff (can manage orders, view reports)
   - **warehouse** - Warehouse staff (picking, packing, dispatch)
   - **staff_admin** - Superadmin (can manage users and all settings)

## Security Notes

✅ **Clients cannot self-promote** - RLS policies prevent privilege escalation
✅ **Only staff_admin can manage users** - Regular admins cannot promote users
✅ **All role changes are audited** - Track who changed what
✅ **Superadmin credentials never in code** - Only in database

## Resetting Your Password

If you forget your password:
1. Go to login page
2. Click "Forgot your password?"
3. Enter m.nowak@importfrompoland.com
4. Check email for reset link
5. Set new password

---

**You're all set!** You now have full control of the system. 🚀


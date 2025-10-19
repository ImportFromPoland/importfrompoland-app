# Check Your Profile

## Run this query instead:

```sql
-- Check all profiles (doesn't need auth context)
SELECT 
  u.email,
  p.id,
  p.role,
  p.company_id,
  c.name as company_name
FROM profiles p
JOIN auth.users u ON u.id = p.id
LEFT JOIN companies c ON c.id = p.company_id
WHERE u.email = 'm.nowak@importfrompoland.com';
```

This should show your profile info.

**What should it show:**
- `role` = `staff_admin`
- Your email
- A company_id (UUID)
- Company name

**If role is NOT `staff_admin`**, run:

```sql
UPDATE profiles 
SET role = 'staff_admin'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'm.nowak@importfrompoland.com'
);
```

Then verify:
```sql
SELECT email, role 
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE u.email = 'm.nowak@importfrompoland.com';
```


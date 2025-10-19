# 🚨 URGENT: Run This Migration Now!

## Problem
Your basket totals are **WRONG** because the database is still using old calculations that add VAT on top of gross prices.

## Solution
Run the SQL migration to fix the calculations.

## Steps

### 1. Open Supabase Dashboard
- Go to: https://supabase.com/dashboard
- Select your project: **importfrompoland**

### 2. Open SQL Editor
- Click **"SQL Editor"** in the left sidebar
- Click **"New query"** button

### 3. Copy the Migration SQL
- Open this file: `C:\Users\micha\importfrompoland-app\supabase\migrations\20240101000011_fix_gross_to_net_calculation.sql`
- Select ALL contents (Ctrl+A)
- Copy (Ctrl+C)

### 4. Paste and Run
- Paste into the Supabase SQL Editor (Ctrl+V)
- Click the green **"Run"** button (or press Ctrl+Enter)
- Wait for "Success. No rows returned" message

### 5. Refresh Your App
- Go back to your app at http://localhost:3000
- Press F5 to refresh
- Check that totals now calculate correctly

## How to Verify It's Fixed

### Before (WRONG):
```
Client enters: 310 PLN
Shows: €100 EUR
Database calculates:
  - Net: €100 (WRONG - this is gross!)
  - VAT 23%: €23 (WRONG - adds VAT on top!)
  - Total: €123 (WRONG!)
```

### After (CORRECT):
```
Client enters: 310 PLN
Shows: €100 EUR
Database calculates:
  - Gross: €100
  - Net: €81.30 (correctly removes VAT)
  - VAT 23%: €18.70 (correct VAT amount)
  - Total: €100.00 (correct!)
```

## Troubleshooting

### If you get an error about "already exists":
The views might already exist. Try running this first:
```sql
DROP VIEW IF EXISTS order_item_totals CASCADE;
DROP VIEW IF EXISTS order_totals CASCADE;
```
Then run the full migration.

### If totals still look wrong after migration:
1. Hard refresh your browser (Ctrl+F5)
2. Check browser console for errors (F12)
3. Try logging out and back in
4. Clear browser cache

## Need Help?
If the migration fails, send me:
1. The error message from Supabase
2. A screenshot of the SQL Editor


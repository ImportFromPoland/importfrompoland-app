-- Fix RLS policies for tours table to allow admin operations

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Tours are viewable by everyone" ON tours;

-- Create comprehensive RLS policies for tours

-- Allow everyone to view active, non-archived tours
CREATE POLICY "Tours are viewable by everyone" ON tours
  FOR SELECT USING (is_active = true AND is_archived = false);

-- Allow authenticated users to insert tours (for admin)
CREATE POLICY "Tours can be created by authenticated users" ON tours
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update tours (for admin)
CREATE POLICY "Tours can be updated by authenticated users" ON tours
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Allow authenticated users to delete tours (for admin)
CREATE POLICY "Tours can be deleted by authenticated users" ON tours
  FOR DELETE USING (auth.role() = 'authenticated');

-- Allow authenticated users to view all tours (for admin)
CREATE POLICY "Tours are viewable by authenticated users" ON tours
  FOR SELECT USING (auth.role() = 'authenticated');

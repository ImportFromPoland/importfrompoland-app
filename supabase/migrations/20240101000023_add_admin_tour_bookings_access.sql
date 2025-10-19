-- Add admin access to tour_bookings table

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Tour bookings are viewable by company" ON tour_bookings;
DROP POLICY IF EXISTS "Tour bookings can be created by authenticated users" ON tour_bookings;
DROP POLICY IF EXISTS "Tour bookings can be updated by company" ON tour_bookings;

-- Drop any existing admin policies to avoid conflicts
DROP POLICY IF EXISTS "admin_view_all_tour_bookings" ON tour_bookings;
DROP POLICY IF EXISTS "company_view_own_tour_bookings" ON tour_bookings;
DROP POLICY IF EXISTS "create_tour_bookings" ON tour_bookings;
DROP POLICY IF EXISTS "admin_update_all_tour_bookings" ON tour_bookings;
DROP POLICY IF EXISTS "company_update_own_tour_bookings" ON tour_bookings;
DROP POLICY IF EXISTS "admin_delete_tour_bookings" ON tour_bookings;

-- Create comprehensive policies for tour_bookings

-- Allow admins to see all tour bookings
CREATE POLICY "admin_view_all_tour_bookings" ON tour_bookings FOR SELECT TO authenticated
USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff_admin'));

-- Allow companies to see their own tour bookings
CREATE POLICY "company_view_own_tour_bookings" ON tour_bookings FOR SELECT TO authenticated
USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Allow authenticated users to create tour bookings
CREATE POLICY "create_tour_bookings" ON tour_bookings FOR INSERT TO authenticated
WITH CHECK (auth.role() = 'authenticated');

-- Allow admins to update all tour bookings
CREATE POLICY "admin_update_all_tour_bookings" ON tour_bookings FOR UPDATE TO authenticated
USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff_admin'));

-- Allow companies to update their own tour bookings
CREATE POLICY "company_update_own_tour_bookings" ON tour_bookings FOR UPDATE TO authenticated
USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Allow admins to delete tour bookings
CREATE POLICY "admin_delete_tour_bookings" ON tour_bookings FOR DELETE TO authenticated
USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff_admin'));

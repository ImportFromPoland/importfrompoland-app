"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import { Shield, Users as UsersIcon } from "lucide-react";
import SuperadminDeleteButton from "@/components/SuperadminDeleteButton";

const ROLE_COLORS: Record<string, string> = {
  client: "bg-gray-100 text-gray-800",
  admin: "bg-blue-100 text-blue-800",
  warehouse: "bg-purple-100 text-purple-800",
  staff_admin: "bg-red-100 text-red-800",
};

const ROLE_LABELS: Record<string, string> = {
  client: "Client",
  admin: "Administrator",
  warehouse: "Warehouse Staff",
  staff_admin: "Superadmin",
};

export default function AdminUsersPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user?.id)
        .single();

      setCurrentUser(profile);

      // Get all users with their profiles and companies
      const { data: profiles } = await supabase
        .from("profiles")
        .select(`
          *,
          company:companies(name)
        `)
        .order("created_at", { ascending: false });

      // Use email directly from profiles table (it already has email column)
      setUsers(profiles || []);
    } catch (error) {
      console.error("Error loading users:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    // Prevent superadmins from demoting themselves
    if (userId === currentUser?.id && currentUser?.role === "staff_admin" && newRole !== "staff_admin") {
      alert("You cannot demote yourself from Superadmin role");
      return;
    }

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role: newRole })
        .eq("id", userId);

      if (error) throw error;

      // Update local state
      setUsers(
        users.map((user) =>
          user.id === userId ? { ...user, role: newRole } : user
        )
      );
    } catch (error: any) {
      alert("Error updating role: " + error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        Loading...
      </div>
    );
  }

  const clientCount = users.filter((u) => u.role === "client").length;
  const adminCount = users.filter((u) => u.role === "admin").length;
  const warehouseCount = users.filter((u) => u.role === "warehouse").length;
  const staffAdminCount = users.filter((u) => u.role === "staff_admin").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">User Management</h1>
        <p className="text-muted-foreground">
          Manage user roles and permissions
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clients</CardTitle>
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clientCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Staff</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {adminCount + warehouseCount}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Superadmins</CardTitle>
            <Shield className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{staffAdminCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">
                        {user.full_name || "-"}
                        {user.id === currentUser?.id && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            You
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.company?.name || "-"}</TableCell>
                      <TableCell>
                        <Badge className={ROLE_COLORS[user.role]}>
                          {ROLE_LABELS[user.role]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          Active
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(user.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Select
                            value={user.role}
                            onValueChange={(newRole) => updateUserRole(user.id, newRole)}
                            disabled={
                              user.id === currentUser?.id &&
                              currentUser?.role === "staff_admin"
                            }
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="client">Client</SelectItem>
                              <SelectItem value="admin">Administrator</SelectItem>
                              <SelectItem value="warehouse">Warehouse</SelectItem>
                              <SelectItem value="staff_admin">Superadmin</SelectItem>
                            </SelectContent>
                          </Select>
                          {currentUser?.role === "staff_admin" && user.role === "client" && (
                            <SuperadminDeleteButton
                              itemId={user.company_id}
                              itemType="client"
                              onDelete={() => loadUsers()}
                            />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Help Text */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Shield className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-blue-900 mb-2">Role Permissions:</p>
              <ul className="space-y-1 text-blue-800">
                <li><strong>Client:</strong> Can create baskets, submit orders, view own orders</li>
                <li><strong>Administrator:</strong> Can view and edit all orders, manage invoices</li>
                <li><strong>Warehouse Staff:</strong> Can access warehouse queue, picking, packing features</li>
                <li><strong>Superadmin:</strong> Full access including user management</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


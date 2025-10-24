"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsForm() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [profileData, setProfileData] = useState({
    full_name: "",
    email: "",
  });

  const [companyData, setCompanyData] = useState({
    name: "",
    vat_number: "",
    address_line1: "",
    address_line2: "",
    city: "",
    postal_code: "",
    country: "Ireland",
    phone: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      // Get profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("*, company:companies(*)")
        .eq("id", user.id)
        .single();

      if (profile) {
        setProfileData({
          full_name: profile.full_name || "",
          email: profile.email || "",
        });

        if (profile.company) {
          setCompanyData({
            name: profile.company.name || "",
            vat_number: profile.company.vat_number || "",
            address_line1: profile.company.address_line1 || "",
            address_line2: profile.company.address_line2 || "",
            city: profile.company.city || "",
            postal_code: profile.company.postal_code || "",
            country: profile.company.country || "Ireland",
            phone: profile.company.phone || "",
          });
        }
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Not authenticated");

      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: profileData.full_name,
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // Get company_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      // Update company
      if (profile?.company_id) {
        const { error: companyError } = await supabase
          .from("companies")
          .update({
            name: companyData.name || "Private Client",
            vat_number: companyData.vat_number,
            address_line1: companyData.address_line1,
            address_line2: companyData.address_line2,
            city: companyData.city,
            postal_code: companyData.postal_code,
            country: companyData.country,
            phone: companyData.phone,
          })
          .eq("id", profile.company_id);

        if (companyError) throw companyError;
      }

      setMessage("Settings saved successfully!");
      setTimeout(() => setMessage(""), 3000);
    } catch (error: any) {
      setMessage("Error: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p>Loading settings...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name</Label>
            <Input
              id="full_name"
              value={profileData.full_name}
              onChange={(e) =>
                setProfileData({ ...profileData, full_name: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={profileData.email}
              disabled
              className="bg-gray-100"
            />
            <p className="text-xs text-muted-foreground">
              Email cannot be changed
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Company Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="company_name">
                Company Name (optional for private clients)
              </Label>
              <Input
                id="company_name"
                value={companyData.name}
                onChange={(e) =>
                  setCompanyData({ ...companyData, name: e.target.value })
                }
                placeholder="Leave blank if ordering as individual"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vat_number">VAT Number</Label>
              <Input
                id="vat_number"
                value={companyData.vat_number}
                onChange={(e) =>
                  setCompanyData({ ...companyData, vat_number: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={companyData.phone}
                onChange={(e) =>
                  setCompanyData({ ...companyData, phone: e.target.value })
                }
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="address_line1">Address Line 1</Label>
              <Input
                id="address_line1"
                value={companyData.address_line1}
                onChange={(e) =>
                  setCompanyData({
                    ...companyData,
                    address_line1: e.target.value,
                  })
                }
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="address_line2">Address Line 2</Label>
              <Input
                id="address_line2"
                value={companyData.address_line2}
                onChange={(e) =>
                  setCompanyData({
                    ...companyData,
                    address_line2: e.target.value,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={companyData.city}
                onChange={(e) =>
                  setCompanyData({ ...companyData, city: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="postal_code">Postal Code</Label>
              <Input
                id="postal_code"
                value={companyData.postal_code}
                onChange={(e) =>
                  setCompanyData({
                    ...companyData,
                    postal_code: e.target.value,
                  })
                }
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={companyData.country}
                onChange={(e) =>
                  setCompanyData({ ...companyData, country: e.target.value })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {message && (
        <div
          className={`p-3 rounded ${
            message.includes("Error")
              ? "bg-red-50 text-red-600"
              : "bg-green-50 text-green-600"
          }`}
        >
          {message}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? "Saving..." : "Save Changes"}
      </Button>
    </form>
  );
}



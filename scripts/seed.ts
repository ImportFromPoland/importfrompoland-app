// Seed script for ImportFromPoland App
// Creates demo users, companies, and sample data

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials. Please set environment variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function seed() {
  console.log("🌱 Starting seed...");

  try {
    // Create admin user
    console.log("Creating admin user...");
    const { data: adminAuth, error: adminAuthError } = await supabase.auth.admin.createUser({
      email: "admin@importfrompoland.com",
      password: "admin123",
      email_confirm: true,
    });

    if (adminAuthError) {
      console.error("Error creating admin user:", adminAuthError);
    } else {
      // Create admin profile
      await supabase.from("profiles").insert({
        id: adminAuth.user.id,
        email: "admin@importfrompoland.com",
        full_name: "Admin User",
        role: "admin",
      });
      console.log("✓ Admin user created: admin@importfrompoland.com / admin123");
    }

    // Create warehouse user
    console.log("Creating warehouse user...");
    const { data: warehouseAuth, error: warehouseAuthError } =
      await supabase.auth.admin.createUser({
        email: "warehouse@importfrompoland.com",
        password: "warehouse123",
        email_confirm: true,
      });

    if (warehouseAuthError) {
      console.error("Error creating warehouse user:", warehouseAuthError);
    } else {
      await supabase.from("profiles").insert({
        id: warehouseAuth.user.id,
        email: "warehouse@importfrompoland.com",
        full_name: "Warehouse Staff",
        role: "warehouse",
      });
      console.log("✓ Warehouse user created: warehouse@importfrompoland.com / warehouse123");
    }

    // Create demo company
    console.log("Creating demo company...");
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .insert({
        name: "Demo Imports Ltd",
        vat_number: "IE1234567T",
        address_line1: "123 Main Street",
        city: "Dublin",
        postal_code: "D01 ABC1",
        country: "Ireland",
        phone: "+353 1 234 5678",
      })
      .select()
      .single();

    if (companyError) {
      console.error("Error creating company:", companyError);
    } else {
      console.log("✓ Demo company created:", company.name);

      // Create demo client user
      console.log("Creating demo client user...");
      const { data: clientAuth, error: clientAuthError } =
        await supabase.auth.admin.createUser({
          email: "client@demo.com",
          password: "client123",
          email_confirm: true,
        });

      if (clientAuthError) {
        console.error("Error creating client user:", clientAuthError);
      } else {
        await supabase.from("profiles").insert({
          id: clientAuth.user.id,
          email: "client@demo.com",
          full_name: "Demo Client",
          role: "client",
          company_id: company.id,
        });
        console.log("✓ Client user created: client@demo.com / client123");

        // Create sample draft order
        console.log("Creating sample draft order...");
        const { data: order, error: orderError } = await supabase
          .from("orders")
          .insert({
            company_id: company.id,
            created_by: clientAuth.user.id,
            status: "draft",
            currency: "EUR",
            vat_rate: 23.0,
            shipping_cost: 0,
            client_notes: "Sample order for testing",
          })
          .select()
          .single();

        if (orderError) {
          console.error("Error creating order:", orderError);
        } else {
          // Add sample order items
          await supabase.from("order_items").insert([
            {
              order_id: order.id,
              line_number: 1,
              product_name: "Polish Pottery Set",
              website_url: "https://example.com/pottery",
              supplier_name: "Ceramika Artystyczna",
              unit_price: 310.0,
              quantity: 2,
              currency: "PLN",
              notes: "Blue pattern",
            },
            {
              order_id: order.id,
              line_number: 2,
              product_name: "Wooden Toys",
              website_url: "https://example.com/toys",
              supplier_name: "Polish Crafts",
              unit_price: 155.0,
              quantity: 5,
              currency: "PLN",
              notes: "Assorted designs",
            },
            {
              order_id: order.id,
              line_number: 3,
              product_name: "Shipping Box",
              supplier_name: "Local Supplier",
              unit_price: 5.0,
              quantity: 10,
              currency: "EUR",
            },
          ]);
          console.log("✓ Sample order created with 3 items");
        }
      }
    }

    // Create storage buckets
    console.log("\nCreating storage buckets...");
    const buckets = ["attachments", "documents", "labels"];

    for (const bucket of buckets) {
      const { error } = await supabase.storage.createBucket(bucket, {
        public: false,
        fileSizeLimit: 10485760, // 10MB
      });

      if (error && !error.message.includes("already exists")) {
        console.error(`Error creating bucket ${bucket}:`, error);
      } else {
        console.log(`✓ Bucket '${bucket}' ready`);
      }
    }

    console.log("\n✅ Seed completed successfully!");
    console.log("\nTest Users:");
    console.log("  Admin:     admin@importfrompoland.com / admin123");
    console.log("  Warehouse: warehouse@importfrompoland.com / warehouse123");
    console.log("  Client:    client@demo.com / client123");
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  }
}

seed();


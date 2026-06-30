// Deletes screenshot attachments 14+ days after order delivery.
// Invoke daily via cron with header: x-cron-secret: <CRON_SECRET>

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function parseStoragePath(attachmentUrl: string): { bucket: string; path: string } | null {
  const trimmed = attachmentUrl.trim();
  const slash = trimmed.indexOf("/");
  if (slash <= 0) return null;
  return {
    bucket: trimmed.slice(0, slash),
    path: trimmed.slice(slash + 1),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const cronSecret = Deno.env.get("CRON_SECRET");
    const provided = req.headers.get("x-cron-secret");
    if (cronSecret && provided !== cronSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: rows, error } = await supabase.rpc("get_order_item_attachments_to_purge");
    if (error) throw error;

    let deleted = 0;
    let cleared = 0;
    const errors: string[] = [];

    for (const row of rows || []) {
      const parsed = parseStoragePath(row.attachment_url);
      if (parsed) {
        const { error: removeError } = await supabase.storage
          .from(parsed.bucket)
          .remove([parsed.path]);
        if (removeError) {
          errors.push(`${row.item_id}: ${removeError.message}`);
        } else {
          deleted += 1;
        }
      }

      const { error: clearError } = await supabase.rpc("clear_order_item_attachment", {
        p_item_id: row.item_id,
      });
      if (clearError) {
        errors.push(`clear ${row.item_id}: ${clearError.message}`);
      } else {
        cleared += 1;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        candidates: rows?.length ?? 0,
        files_deleted: deleted,
        rows_cleared: cleared,
        errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

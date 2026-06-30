import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export async function uploadOrderAttachment(
  supabase: SupabaseClient,
  file: File,
  userId?: string
): Promise<string> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Please upload a JPEG, PNG, or WebP image.");
  }

  if (file.size > MAX_BYTES) {
    throw new Error("Image must be smaller than 10 MB.");
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const safeExt = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext) ? ext : "png";
  const prefix = userId ? `${userId}/` : "";
  const filePath = `${prefix}${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`;

  const { error } = await supabase.storage.from("attachments").upload(filePath, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) throw error;

  return `attachments/${filePath}`;
}

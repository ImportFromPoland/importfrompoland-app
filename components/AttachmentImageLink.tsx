"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ImageIcon } from "lucide-react";

interface AttachmentImageLinkProps {
  attachmentUrl: string;
  label?: string;
  thumbnail?: boolean;
}

export function AttachmentImageLink({
  attachmentUrl,
  label = "Screenshot",
  thumbnail = false,
}: AttachmentImageLinkProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (!attachmentUrl) return;

    const load = async () => {
      setLoading(true);
      try {
        const parts = attachmentUrl.split("/");
        const bucket = parts[0];
        const path = parts.slice(1).join("/");

        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrl(path, 3600);

        if (error) throw error;
        setSignedUrl(data.signedUrl);
      } catch (error) {
        console.error("Error loading attachment:", error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [attachmentUrl, supabase]);

  if (!attachmentUrl) return <span className="text-muted-foreground">-</span>;

  if (loading || !signedUrl) {
    return <span className="text-xs text-muted-foreground">…</span>;
  }

  if (thumbnail) {
    return (
      <a href={signedUrl} target="_blank" rel="noopener noreferrer" title={label}>
        <img
          src={signedUrl}
          alt={label}
          className="h-12 w-12 object-cover rounded border hover:opacity-90"
        />
      </a>
    );
  }

  return (
    <a
      href={signedUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
    >
      <ImageIcon className="h-3.5 w-3.5" />
      {label}
    </a>
  );
}

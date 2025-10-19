"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";

interface PDFLinkProps {
  pdfUrl: string;
  label?: string;
}

export function PDFLink({ pdfUrl, label = "Download PDF" }: PDFLinkProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (!pdfUrl) return;

    const getSignedUrl = async () => {
      setLoading(true);
      try {
        // Extract bucket and path from URL
        const parts = pdfUrl.split("/");
        const bucket = parts[0];
        const path = parts.slice(1).join("/");

        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrl(path, 3600); // 1 hour expiry

        if (error) throw error;
        setSignedUrl(data.signedUrl);
      } catch (error) {
        console.error("Error getting signed URL:", error);
      } finally {
        setLoading(false);
      }
    };

    getSignedUrl();
  }, [pdfUrl, supabase]);

  if (!pdfUrl) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={loading || !signedUrl}
      asChild={!!signedUrl}
    >
      {signedUrl ? (
        <a href={signedUrl} target="_blank" rel="noopener noreferrer">
          <FileText className="h-4 w-4 mr-2" />
          {label}
          <Download className="h-4 w-4 ml-2" />
        </a>
      ) : (
        <>
          <FileText className="h-4 w-4 mr-2" />
          {loading ? "Loading..." : label}
        </>
      )}
    </Button>
  );
}


"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  appendScreenshotNotes,
  buildReviewNotes,
  parseOcrText,
  recognizeImageText,
} from "@/lib/screenshot-ocr";
import { uploadOrderAttachment } from "@/lib/upload-order-attachment";
import type { OrderLineData } from "@/components/OrderLineForm";
import { Camera, ClipboardPaste, ImagePlus, Loader2, X } from "lucide-react";

export interface ScreenshotApplyPayload {
  unit_price?: number;
  website_url?: string;
  supplier_name?: string;
  product_name?: string;
  notes?: string;
  attachment_url: string;
}

interface ScreenshotLineCaptureProps {
  variant?: "banner" | "inline";
  onApply: (payload: ScreenshotApplyPayload) => void;
  enableGlobalPaste?: boolean;
  existingAttachmentUrl?: string;
  onClearAttachment?: () => void;
}

function clipboardItemToFile(item: DataTransferItem): Promise<File | null> {
  return new Promise((resolve) => {
    const file = item.getAsFile();
    resolve(file);
  });
}

async function fileFromClipboard(
  clipboardData: DataTransfer | null
): Promise<File | null> {
  if (!clipboardData) return null;

  const items = Array.from(clipboardData.items);
  const imageItem = items.find((item) => item.type.startsWith("image/"));
  if (!imageItem) return null;

  return clipboardItemToFile(imageItem);
}

export function ScreenshotLineCapture({
  variant = "banner",
  onApply,
  enableGlobalPaste = variant === "banner",
  existingAttachmentUrl,
  onClearAttachment,
}: ScreenshotLineCaptureProps) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const processImageFile = useCallback(
    async (file: File) => {
      setProcessing(true);
      setStatus("Reading screenshot…");

      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(file));

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        const rawText = await recognizeImageText(file);
        const parsed = parseOcrText(rawText);
        const reviewNotes = buildReviewNotes(parsed);

        setStatus("Uploading image…");
        const attachment_url = await uploadOrderAttachment(
          supabase,
          file,
          user?.id
        );

        const payload: ScreenshotApplyPayload = {
          attachment_url,
          notes: reviewNotes,
        };

        if (parsed.unit_price !== null) {
          payload.unit_price = parsed.unit_price;
        }
        if (parsed.website_url) {
          payload.website_url = parsed.website_url;
        }
        if (parsed.supplier_name) {
          payload.supplier_name = parsed.supplier_name;
        }
        if (parsed.product_name) {
          payload.product_name = parsed.product_name;
        }

        onApply(payload);
        const parts: string[] = [];
        if (parsed.unit_price !== null) {
          parts.push(`price ${parsed.unit_price.toFixed(2)} PLN`);
        }
        if (parsed.website_url) {
          parts.push("link detected");
        }
        setStatus(
          parts.length > 0
            ? `Added — detected ${parts.join(" and ")}. Check fields and add product name if needed.`
            : "Added — please enter price and product name; admin will verify from screenshot."
        );
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to process image";
        setStatus(`Error: ${message}`);
      } finally {
        setProcessing(false);
      }
    },
    [onApply, previewUrl, supabase]
  );

  const handlePaste = useCallback(
    async (event: ClipboardEvent) => {
      if (processing) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const file = await fileFromClipboard(event.clipboardData);
      if (!file) return;

      event.preventDefault();
      await processImageFile(file);
    },
    [processImageFile, processing]
  );

  useEffect(() => {
    if (!enableGlobalPaste) return;
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [enableGlobalPaste, handlePaste]);

  const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) await processImageFile(file);
  };

  const onPasteZone = async (event: React.ClipboardEvent) => {
    event.preventDefault();
    const file = await fileFromClipboard(event.clipboardData);
    if (file) await processImageFile(file);
  };

  if (variant === "inline") {
    return (
      <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture={isMobile ? "environment" : undefined}
            className="hidden"
            onChange={onFileChange}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={processing}
            onClick={() => fileInputRef.current?.click()}
          >
            {processing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : isMobile ? (
              <Camera className="h-4 w-4 mr-2" />
            ) : (
              <ImagePlus className="h-4 w-4 mr-2" />
            )}
            {isMobile ? "Photo of screen" : "Upload screenshot"}
          </Button>
          {existingAttachmentUrl && (
            <span className="text-xs text-green-700">Screenshot attached</span>
          )}
          {existingAttachmentUrl && onClearAttachment && (
            <Button type="button" variant="ghost" size="sm" onClick={onClearAttachment}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        {status && <p className="text-xs text-muted-foreground">{status}</p>}
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 p-4 space-y-3"
      onPaste={onPasteZone}
      tabIndex={0}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="font-medium text-sm">
            {isMobile
              ? "Add from a photo of the shop screen"
              : "Add from screenshot (paste or upload)"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {isMobile
              ? "Take a clear photo of the product page. We detect the price when possible and save the image for admin verification."
              : "Copy a screenshot (Win+Shift+S / Cmd+Shift+4), then press Ctrl+V here — or upload an image. Fill in the product name yourself."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture={isMobile ? "environment" : undefined}
            className="hidden"
            onChange={onFileChange}
          />
          {!isMobile && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={processing}
              className="hidden sm:inline-flex"
            >
              <ClipboardPaste className="h-4 w-4 mr-2" />
              Ctrl+V to paste
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            disabled={processing}
            onClick={() => fileInputRef.current?.click()}
          >
            {processing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : isMobile ? (
              <Camera className="h-4 w-4 mr-2" />
            ) : (
              <ImagePlus className="h-4 w-4 mr-2" />
            )}
            {processing
              ? "Processing…"
              : isMobile
                ? "Take photo"
                : "Choose image"}
          </Button>
        </div>
      </div>

      {previewUrl && (
        <img
          src={previewUrl}
          alt="Screenshot preview"
          className="max-h-32 rounded border object-contain bg-white"
        />
      )}

      {status && (
        <p
          className={`text-sm ${status.startsWith("Error") ? "text-red-600" : "text-muted-foreground"}`}
        >
          {status}
        </p>
      )}
    </div>
  );
}

export function applyScreenshotPayload(
  line: OrderLineData,
  payload: ScreenshotApplyPayload
): OrderLineData {
  return {
    ...line,
    unit_price: payload.unit_price ?? line.unit_price,
    website_url: payload.website_url || line.website_url,
    supplier_name: payload.supplier_name || line.supplier_name,
    original_supplier_name: payload.supplier_name || line.original_supplier_name,
    product_name: payload.product_name || line.product_name,
    attachment_url: payload.attachment_url,
    notes: payload.notes
      ? appendScreenshotNotes(line.notes, payload.notes)
      : line.notes,
  };
}

export function createLineFromScreenshot(
  lineNumber: number,
  payload: ScreenshotApplyPayload
): OrderLineData {
  return {
    line_number: lineNumber,
    product_name: payload.product_name || "",
    website_url: payload.website_url || "",
    supplier_name: payload.supplier_name || "",
    original_supplier_name: payload.supplier_name || "",
    unit_price: payload.unit_price ?? 0,
    quantity: 1,
    currency: "PLN",
    unit_of_measure: "unit",
    discount_percent: 0,
    notes: payload.notes || "[Screenshot] Attached for reference.",
    attachment_url: payload.attachment_url,
  };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  appendScreenshotNotes,
  buildReviewNotes,
  parseOcrText,
  recognizeImageText,
  type OcrParseResult,
} from "@/lib/screenshot-ocr";
import { uploadOrderAttachment } from "@/lib/upload-order-attachment";
import type { OrderLineData } from "@/components/OrderLineForm";
import { AttachmentImageLink } from "@/components/AttachmentImageLink";
import { Camera, ClipboardPaste, ImagePlus, Loader2, X } from "lucide-react";

export interface ScreenshotApplyPayload {
  unit_price: number;
  quantity: number;
  product_name: string;
  website_url?: string;
  supplier_name?: string;
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

interface PendingScreenshot {
  file: File;
  previewUrl: string;
  parsed: OcrParseResult;
  reviewNotes: string;
}

function clipboardItemToFile(item: DataTransferItem): Promise<File | null> {
  return new Promise((resolve) => {
    resolve(item.getAsFile());
  });
}

async function fileFromClipboard(
  clipboardData: DataTransfer | null
): Promise<File | null> {
  if (!clipboardData) return null;
  const imageItem = Array.from(clipboardData.items).find((item) =>
    item.type.startsWith("image/")
  );
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
  const [isMobile, setIsMobile] = useState(false);
  const [pending, setPending] = useState<PendingScreenshot | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [productName, setProductName] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setIsMobile(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  const resetConfirmForm = (data: PendingScreenshot) => {
    setProductName("");
    setUnitPrice(
      data.parsed.unit_price !== null ? data.parsed.unit_price.toFixed(2) : ""
    );
    setQuantity("1");
    setWebsiteUrl(data.parsed.website_url || "");
    setSupplierName(data.parsed.supplier_name || "");
  };

  const closeConfirm = () => {
    setConfirmOpen(false);
    if (pending) {
      URL.revokeObjectURL(pending.previewUrl);
      setPending(null);
    }
  };

  const processImageFile = useCallback(async (file: File) => {
    setProcessing(true);
    setStatus("Reading screenshot…");

    try {
      const rawText = await recognizeImageText(file);
      const parsed = parseOcrText(rawText);
      const reviewNotes = buildReviewNotes(parsed);
      const previewUrl = URL.createObjectURL(file);

      const draft: PendingScreenshot = { file, previewUrl, parsed, reviewNotes };
      setPending(draft);
      resetConfirmForm(draft);
      setConfirmOpen(true);
      setStatus("");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to process image";
      setStatus(`Error: ${message}`);
    } finally {
      setProcessing(false);
    }
  }, []);

  const handleConfirmAdd = async () => {
    if (!pending) return;

    const name = productName.trim();
    const price = parseFloat(unitPrice.replace(",", "."));
    const qty = parseFloat(quantity.replace(",", "."));

    if (!name) {
      alert("Please enter a product description.");
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      alert("Please enter a valid price in PLN (gross per unit).");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      alert("Please enter a valid quantity.");
      return;
    }

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const attachment_url = await uploadOrderAttachment(
        supabase,
        pending.file,
        user?.id
      );

      onApply({
        product_name: name,
        unit_price: Math.round(price * 100) / 100,
        quantity: qty,
        website_url: websiteUrl.trim(),
        supplier_name: supplierName.trim(),
        attachment_url,
        notes: pending.reviewNotes,
      });

      setStatus("Item added — review the line in your basket.");
      closeConfirm();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to save";
      alert("Error: " + message);
    } finally {
      setSaving(false);
    }
  };

  const handlePaste = useCallback(
    async (event: ClipboardEvent) => {
      if (processing || confirmOpen) return;
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
    [processImageFile, processing, confirmOpen]
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
    if (confirmOpen) return;
    event.preventDefault();
    const file = await fileFromClipboard(event.clipboardData);
    if (file) await processImageFile(file);
  };

  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      capture={isMobile ? "environment" : undefined}
      className="hidden"
      onChange={onFileChange}
    />
  );

  const confirmDialog = (
    <Dialog
      open={confirmOpen}
      onOpenChange={(open) => {
        if (!open) closeConfirm();
      }}
    >
      <DialogContent className="max-w-md sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Confirm product from screenshot</DialogTitle>
          <DialogDescription>
            Check the detected price and add your own product description. The screenshot is saved for admin verification.
          </DialogDescription>
        </DialogHeader>

        {pending && (
          <div className="space-y-4">
            <img
              src={pending.previewUrl}
              alt="Screenshot preview"
              className="w-full max-h-36 object-contain rounded border bg-white"
            />

            <div className="space-y-2">
              <Label htmlFor="screenshot_product_name">Product description *</Label>
              <Textarea
                id="screenshot_product_name"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g. Gypsum board 2600×1200 mm"
                rows={2}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="screenshot_price">
                  Detected price (PLN, gross / unit) *
                </Label>
                <Input
                  id="screenshot_price"
                  type="text"
                  inputMode="decimal"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="screenshot_qty">Quantity *</Label>
                <Input
                  id="screenshot_qty"
                  type="number"
                  min="0.01"
                  step="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="screenshot_url">Website URL (optional)</Label>
              <Input
                id="screenshot_url"
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="screenshot_supplier">Supplier (optional)</Label>
              <Input
                id="screenshot_supplier"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Store name"
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={closeConfirm} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirmAdd} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              "Add to basket"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (variant === "inline") {
    return (
      <>
        <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {fileInput}
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
              <AttachmentImageLink attachmentUrl={existingAttachmentUrl} thumbnail />
            )}
            {existingAttachmentUrl && onClearAttachment && (
              <Button type="button" variant="ghost" size="sm" onClick={onClearAttachment}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {status && <p className="text-xs text-muted-foreground">{status}</p>}
        </div>
        {confirmDialog}
      </>
    );
  }

  return (
    <>
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
                ? "Take a photo, then confirm the price and write the product description yourself."
                : "Paste a screenshot (Ctrl+V) or choose an image — then confirm price, quantity, and description."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {fileInput}
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
              {processing ? "Processing…" : isMobile ? "Take photo" : "Choose image"}
            </Button>
          </div>
        </div>
        {status && (
          <p
            className={`text-sm ${status.startsWith("Error") ? "text-red-600" : "text-muted-foreground"}`}
          >
            {status}
          </p>
        )}
      </div>
      {confirmDialog}
    </>
  );
}

export function applyScreenshotPayload(
  line: OrderLineData,
  payload: ScreenshotApplyPayload
): OrderLineData {
  return {
    ...line,
    product_name: payload.product_name,
    unit_price: payload.unit_price,
    quantity: payload.quantity,
    website_url: payload.website_url || line.website_url,
    supplier_name: payload.supplier_name || line.supplier_name,
    original_supplier_name: payload.supplier_name || line.original_supplier_name,
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
    product_name: payload.product_name,
    website_url: payload.website_url || "",
    supplier_name: payload.supplier_name || "",
    original_supplier_name: payload.supplier_name || "",
    unit_price: payload.unit_price,
    quantity: payload.quantity,
    currency: "PLN",
    unit_of_measure: "unit",
    discount_percent: 0,
    notes: payload.notes || "[Screenshot] Attached for reference.",
    attachment_url: payload.attachment_url,
  };
}

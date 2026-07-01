"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { PDFLink } from "@/components/PDFLink";
import { Logo } from "@/components/Logo";
import { formatDate, formatCurrency, orderLineGrossEURDisplay, orderLineUnitGrossEURDisplay } from "@/lib/utils";
import { TotalsPanel } from "@/components/TotalsPanel";
import { BankTransferDiscountOption } from "@/components/BankTransferDiscountOption";
import {
  computeGrossEurBeforeVolumeDiscount,
  getVolumeDiscountBreakdown,
  getVolumeDiscountPercent,
} from "@/lib/volume-discount";
import { submitClientOrder } from "@/lib/submit-client-order";
import { Send, Edit2, Check, X, FileText, RotateCcw, ExternalLink } from "lucide-react";
import { AttachmentImageLink } from "@/components/AttachmentImageLink";

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [totals, setTotals] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const [editingName, setEditingName] = useState(false);
  const [basketName, setBasketName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [prefersBankTransfer, setPrefersBankTransfer] = useState(false);
  const [savingPaymentPref, setSavingPaymentPref] = useState(false);

  useEffect(() => {
    loadData();
  }, [params.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // Get order with items
      const { data: orderData } = await supabase
        .from("orders")
        .select(`
          *,
          company:companies(*),
          created_by_profile:profiles!created_by(full_name, email),
          items:order_items(*),
          invoices(*),
          shipments(*)
        `)
        .eq("id", params.id)
        .single();

      if (!orderData) {
        router.push("/");
        return;
      }

      // Sort items by line_number ascending (chronological order)
      if (orderData.items && orderData.items.length > 0) {
        orderData.items.sort((a: any, b: any) => 
          (a.line_number || 0) - (b.line_number || 0)
        );
      }

      setOrder(orderData);
      setBasketName(orderData.client_notes || "");
      setPrefersBankTransfer(orderData.prefers_bank_transfer || false);

      // Get order totals
      const { data: totalsData } = await supabase
        .from("order_totals")
        .select("*")
        .eq("order_id", params.id)
        .single();

      setTotals(totalsData);

      // Get audit logs
      const { data: logsData } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("order_id", params.id)
        .order("created_at", { ascending: false });

      setAuditLogs(logsData || []);
    } catch (error) {
      console.error("Error loading order:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveBasketName = async () => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({ client_notes: basketName })
        .eq("id", order.id);

      if (error) throw error;

      setOrder({ ...order, client_notes: basketName });
      setEditingName(false);
    } catch (error: any) {
      alert("Error saving name: " + error.message);
    }
  };

  const draftVolumeDiscount = useMemo(() => {
    if (!order?.items || order.status !== "draft") {
      return { percent: order?.discount_percent || 0, label: null as string | null };
    }
    const eligibleItems = order.items.filter(
      (item: any) => item.product_name && item.unit_price > 0
    );
    const grossBeforeDiscount = computeGrossEurBeforeVolumeDiscount(
      eligibleItems,
      order.vat_rate,
      order.shipping_cost || 0,
      order.currency
    );
    const percent = getVolumeDiscountPercent(grossBeforeDiscount, prefersBankTransfer);
    const breakdown = getVolumeDiscountBreakdown(grossBeforeDiscount, prefersBankTransfer);
    const parts: string[] = [];
    if (breakdown.volumePercent > 0 && breakdown.tierLabel) {
      parts.push(`order ${breakdown.tierLabel}`);
    }
    if (breakdown.bankBonus > 0) {
      parts.push("bank transfer");
    }
    return { percent, label: parts.length > 0 ? parts.join(" + ") : null };
  }, [order, prefersBankTransfer]);

  useEffect(() => {
    async function syncDraftDiscount() {
      if (!order || order.status !== "draft" || !order.items?.length) return;

      const eligibleItems = order.items.filter(
        (item: any) => item.product_name && item.unit_price > 0
      );
      const grossBeforeDiscount = computeGrossEurBeforeVolumeDiscount(
        eligibleItems,
        order.vat_rate,
        order.shipping_cost || 0,
        order.currency
      );
      const discountPercent = getVolumeDiscountPercent(
        grossBeforeDiscount,
        order.prefers_bank_transfer || false
      );
      if (discountPercent === (order.discount_percent || 0)) return;

      const { error } = await supabase
        .from("orders")
        .update({ discount_percent: discountPercent })
        .eq("id", order.id);

      if (error) return;

      setOrder({ ...order, discount_percent: discountPercent });

      const { data: totalsData } = await supabase
        .from("order_totals")
        .select("*")
        .eq("order_id", order.id)
        .single();
      if (totalsData) setTotals(totalsData);
    }

    syncDraftDiscount();
  }, [
    order?.id,
    order?.status,
    order?.items,
    order?.vat_rate,
    order?.shipping_cost,
    order?.prefers_bank_transfer,
    order?.discount_percent,
  ]);

  const savePaymentPreference = async (checked: boolean) => {
    if (!order || order.status !== "draft") return;

    setSavingPaymentPref(true);
    try {
      const eligibleItems = (order.items || []).filter(
        (item: any) => item.product_name && item.unit_price > 0
      );
      const grossBeforeDiscount = computeGrossEurBeforeVolumeDiscount(
        eligibleItems,
        order.vat_rate,
        order.shipping_cost || 0,
        order.currency
      );
      const discountPercent = getVolumeDiscountPercent(grossBeforeDiscount, checked);

      const { error } = await supabase
        .from("orders")
        .update({
          prefers_bank_transfer: checked,
          discount_percent: discountPercent,
          ...(checked ? { payment_link_url: null } : {}),
        })
        .eq("id", order.id);

      if (error) throw error;

      setPrefersBankTransfer(checked);
      setOrder({
        ...order,
        prefers_bank_transfer: checked,
        discount_percent: discountPercent,
        payment_link_url: checked ? null : order.payment_link_url,
      });

      const { data: totalsData } = await supabase
        .from("order_totals")
        .select("*")
        .eq("order_id", order.id)
        .single();
      if (totalsData) setTotals(totalsData);
    } catch (error: any) {
      alert("Error saving payment preference: " + error.message);
    } finally {
      setSavingPaymentPref(false);
    }
  };

  const submitOrder = async () => {
    if (!order) return;
    
    if (!order.items || order.items.length === 0) {
      alert("Cannot submit an empty order. Please add items first.");
      return;
    }

    setSubmitting(true);
    try {
      const eligibleItems = (order.items || []).filter(
        (item: any) => item.product_name && item.unit_price > 0
      );
      const grossBeforeDiscount = computeGrossEurBeforeVolumeDiscount(
        eligibleItems,
        order.vat_rate,
        order.shipping_cost || 0,
        order.currency
      );
      const discountPercent = getVolumeDiscountPercent(
        grossBeforeDiscount,
        prefersBankTransfer
      );

      await submitClientOrder(supabase, order.id, {
        discountPercent,
        prefersBankTransfer,
      });

      alert("Thank you for submitting your order. Our admin team will confirm the details and will confirm your order shortly.");
      
      router.push("/");
      router.refresh();
    } catch (error: any) {
      alert("Error submitting order: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const revertToBasket = async () => {
    if (!order) return;
    
    if (!confirm("Are you sure you want to revert this order back to basket? You will be able to edit it again.")) {
      return;
    }

    setReverting(true);
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          status: "draft",
          submitted_at: null,
        })
        .eq("id", order.id);

      if (error) throw error;

      alert("Order has been reverted to basket. You can now edit it.");
      
      // Reload data to reflect the change
      loadData();
      router.refresh();
    } catch (error: any) {
      alert("Error reverting order: " + error.message);
    } finally {
      setReverting(false);
    }
  };

  const downloadPDF = async () => {
    try {
      // Dynamic import to avoid SSR issues with react-pdf
      const { pdf } = await import('@react-pdf/renderer');
      const { OrderPDF } = await import('@/components/OrderPDF');
      const React = await import('react');

      // Generate PDF
      const blob = await pdf(
        React.createElement(OrderPDF, {
          order,
          company: order.company,
          items: order.items,
          totals,
          createdByProfile: order.created_by_profile,
        }) as any
      ).toBlob();

      // Download PDF
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Order_${order.number || 'Basket'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('PDF generation error:', error);
      alert("Error generating PDF: " + error.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Order not found
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Logo width={200} height={80} linkToDashboard={true} />
              <Link href="/">
                <Button variant="outline" size="sm">
                  ← Back
                </Button>
              </Link>
              <div>
                {order.status === 'draft' && !editingName ? (
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold">
                      {basketName || "My Basket"}
                    </h1>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingName(true)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : order.status === 'draft' && editingName ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={basketName}
                      onChange={(e) => setBasketName(e.target.value)}
                      placeholder="My Basket"
                      className="text-xl font-bold max-w-xs"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={saveBasketName}
                    >
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setBasketName(order.client_notes || "");
                        setEditingName(false);
                      }}
                    >
                      <X className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                ) : (
                  <h1 className="text-2xl font-bold">
                    {order.number || "My Basket"}
                  </h1>
                )}
                <p className="text-sm text-muted-foreground">
                  {order.company.name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={order.status} />
              {order.status === 'submitted' && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={revertToBasket}
                  disabled={reverting}
                  className="text-blue-600 hover:text-blue-700"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  {reverting ? "Reverting..." : "Revert to Basket"}
                </Button>
              )}
              {order.status !== 'draft' && order.status !== 'submitted' && (
                <Button size="sm" variant="outline" onClick={downloadPDF}>
                  <FileText className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              )}
              {order.status === 'draft' && (
                <Link href={`/orders/${order.id}/edit`}>
                  <Button size="sm" variant="outline">
                    Edit Basket
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Order Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">#</th>
                          <th className="text-center p-2 w-14">Photo</th>
                          <th className="text-left p-2">Product</th>
                          <th className="text-right p-2">Unit Price (EUR)</th>
                          <th className="text-right p-2">Qty</th>
                          <th className="text-right p-2">Total (EUR)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items.map((item: any) => {
                          const lineTotalEUR = orderLineGrossEURDisplay(item, order);
                          const unitPriceEUR = orderLineUnitGrossEURDisplay(item, order);
                          
                          return (
                            <tr key={item.id} className="border-b">
                              <td className="p-2">{item.line_number}</td>
                              <td className="p-2 text-center">
                                {item.attachment_url ? (
                                  <AttachmentImageLink
                                    attachmentUrl={item.attachment_url}
                                    thumbnail
                                    label="Screenshot"
                                  />
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </td>
                              <td className="p-2">
                                <div>
                                  <p className="font-medium">{item.product_name}</p>
                                  {(item.original_supplier_name || item.supplier_name) && (
                                    <p className="text-xs text-muted-foreground">
                                      {item.original_supplier_name || item.supplier_name}
                                    </p>
                                  )}
                                  {item.website_url && (
                                    <a
                                      href={item.website_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-blue-600 hover:underline"
                                    >
                                      View Product
                                    </a>
                                  )}
                                </div>
                              </td>
                              <td className="text-right p-2">
                                {formatCurrency(unitPriceEUR, 'EUR')}
                              </td>
                              <td className="text-right p-2">
                                {item.quantity} {item.unit_of_measure === 'm2' ? 'm²' : 'pcs'}
                              </td>
                              <td className="text-right p-2 font-medium">
                                {formatCurrency(lineTotalEUR, 'EUR')}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {order.invoices && order.invoices.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Invoices</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {order.invoices.map((invoice: any) => (
                      <div
                        key={invoice.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded"
                      >
                        <div>
                          <p className="font-medium">{invoice.invoice_number}</p>
                          <p className="text-sm text-muted-foreground">
                            {invoice.type === "proforma" ? "Proforma" : "Final"} Invoice
                          </p>
                          <p className="text-sm">
                            {formatCurrency(invoice.grand_total, order.currency)}
                          </p>
                        </div>
                        {invoice.pdf_url && <PDFLink pdfUrl={invoice.pdf_url} />}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {order.shipments && order.shipments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Shipments</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {order.shipments.map((shipment: any) => (
                      <div key={shipment.id} className="p-3 bg-gray-50 rounded">
                        <p className="font-medium">{shipment.carrier}</p>
                        {shipment.tracking_number && (
                          <p className="text-sm">
                            Tracking: {shipment.tracking_number}
                          </p>
                        )}
                        {shipment.shipped_at && (
                          <p className="text-xs text-muted-foreground">
                            Shipped: {formatDate(shipment.shipped_at)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Order Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Order Received */}
                  <div className="flex gap-3">
                    <div className={`flex-shrink-0 w-3 h-3 mt-2 rounded-full ${
                      ['submitted', 'confirmed', 'paid', 'partially_packed', 'packed', 'ready_to_ship', 'dispatched', 'delivered'].includes(order.status) 
                        ? 'bg-green-500' 
                        : 'bg-gray-300'
                    }`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Order Received</p>
                      <p className="text-xs text-muted-foreground">
                        {['submitted', 'confirmed', 'paid', 'partially_packed', 'packed', 'ready_to_ship', 'dispatched', 'delivered'].includes(order.status) 
                          ? (order.submitted_at ? formatDate(order.submitted_at) : 'Completed')
                          : 'Pending'
                        }
                      </p>
                    </div>
                  </div>

                  {/* Order Confirmed */}
                  <div className="flex gap-3">
                    <div className={`flex-shrink-0 w-3 h-3 mt-2 rounded-full ${
                      ['confirmed', 'paid', 'partially_packed', 'packed', 'ready_to_ship', 'dispatched', 'delivered'].includes(order.status) 
                        ? 'bg-green-500' 
                        : 'bg-gray-300'
                    }`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Order Confirmed</p>
                      <p className="text-xs text-muted-foreground">
                        {['confirmed', 'paid', 'partially_packed', 'packed', 'ready_to_ship', 'dispatched', 'delivered'].includes(order.status) 
                          ? (order.confirmed_at ? formatDate(order.confirmed_at) : 'Completed')
                          : 'Pending'
                        }
                      </p>
                    </div>
                  </div>

                  {/* Payment Received */}
                  <div className="flex gap-3">
                    <div className={`flex-shrink-0 w-3 h-3 mt-2 rounded-full ${
                      ['paid', 'partially_packed', 'packed', 'ready_to_ship', 'dispatched', 'delivered'].includes(order.status) 
                        ? 'bg-green-500' 
                        : 'bg-gray-300'
                    }`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Payment Received</p>
                      <p className="text-xs text-muted-foreground">
                        {['paid', 'partially_packed', 'packed', 'ready_to_ship', 'dispatched', 'delivered'].includes(order.status) 
                          ? (order.paid_at ? formatDate(order.paid_at) : 'Completed')
                          : 'Pending'
                        }
                      </p>
                    </div>
                  </div>

                  {/* Order Complete */}
                  <div className="flex gap-3">
                    <div className={`flex-shrink-0 w-3 h-3 mt-2 rounded-full ${
                      ['packed', 'ready_to_ship', 'dispatched', 'delivered'].includes(order.status) 
                        ? 'bg-green-500' 
                        : 'bg-gray-300'
                    }`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Order Complete</p>
                      <p className="text-xs text-muted-foreground">
                        {['packed', 'ready_to_ship', 'dispatched', 'delivered'].includes(order.status) 
                          ? (order.complete_at ? formatDate(order.complete_at) : 'Completed')
                          : 'Pending'
                        }
                      </p>
                    </div>
                  </div>

                  {/* Order Dispatched */}
                  <div className="flex gap-3">
                    <div className={`flex-shrink-0 w-3 h-3 mt-2 rounded-full ${
                      ['dispatched', 'delivered'].includes(order.status) 
                        ? 'bg-green-500' 
                        : 'bg-gray-300'
                    }`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Order Dispatched</p>
                      <p className="text-xs text-muted-foreground">
                        {['dispatched', 'delivered'].includes(order.status) 
                          ? (order.dispatched_at ? formatDate(order.dispatched_at) : 'Completed')
                          : 'Pending'
                        }
                      </p>
                    </div>
                  </div>

                  {/* Planned Delivery */}
                  {order.planned_delivery_date && (
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-3 h-3 mt-2 rounded-full bg-blue-500" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Planned Delivery</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(order.planned_delivery_date)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Order Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Order Number</p>
                  <p className="font-medium">{order.number || "Not assigned"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="font-medium">{formatDate(order.created_at)}</p>
                </div>
                {order.submitted_at && (
                  <div>
                    <p className="text-sm text-muted-foreground">Submitted</p>
                    <p className="font-medium">{formatDate(order.submitted_at)}</p>
                  </div>
                )}
                {order.confirmed_at && (
                  <div>
                    <p className="text-sm text-muted-foreground">Confirmed</p>
                    <p className="font-medium">{formatDate(order.confirmed_at)}</p>
                  </div>
                )}
                {order.client_notes && order.status !== 'draft' && (
                  <div>
                    <p className="text-sm text-muted-foreground">Order Notes</p>
                    <p className="text-sm">{order.client_notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {totals && (
              <>
                {order.status === "draft" && (
                  <BankTransferDiscountOption
                    checked={prefersBankTransfer}
                    onCheckedChange={savePaymentPreference}
                    disabled={savingPaymentPref}
                  />
                )}
                <TotalsPanel
                  itemsNet={totals.items_net_before_header ?? totals.items_net ?? 0}
                  vatRate={order.vat_rate}
                  vatAmount={totals.vat_amount || 0}
                  itemsGross={totals.items_gross || 0}
                  shippingCost={order.shipping_cost}
                  headerDiscountPercent={
                    order.status === "draft"
                      ? draftVolumeDiscount.percent
                      : order.discount_percent || 0
                  }
                  headerMarkupPercent={order.markup_percent || 0}
                  grandTotal={totals.grand_total || 0}
                  currency={order.currency}
                  clientView={true}
                  volumeDiscountLabel={
                    order.status === "draft" ? draftVolumeDiscount.label : null
                  }
                />
              </>
            )}

            {order.payment_link_url &&
              !order.prefers_bank_transfer &&
              ["confirmed", "paid", "partially_packed", "packed", "partially_dispatched", "dispatched", "partially_delivered", "delivered"].includes(
                order.status
              ) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Pay Online</CardTitle>
                </CardHeader>
                <CardContent>
                  <a
                    href={order.payment_link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-primary font-medium hover:underline"
                  >
                    Open payment link
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </CardContent>
              </Card>
            )}

            {order.prefers_bank_transfer &&
              ["confirmed", "paid", "partially_packed", "packed", "partially_dispatched", "dispatched", "partially_delivered", "delivered"].includes(
                order.status
              ) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Bank Transfer</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p>Bank: PKO Bank Polski</p>
                  <p>IBAN: PL 77 1020 2313 0000 3602 1175 9752</p>
                  <p>BIC/SWIFT: BPKOPLPW</p>
                  <p className="font-medium pt-2">
                    Reference: {order.number}
                  </p>
                </CardContent>
              </Card>
            )}

            {order.status === 'draft' && (
              <Button
                onClick={submitOrder}
                disabled={submitting || !order.items || order.items.length === 0}
                className="w-full"
                size="lg"
              >
                <Send className="h-4 w-4 mr-2" />
                {submitting ? "Submitting..." : "Submit Order"}
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}


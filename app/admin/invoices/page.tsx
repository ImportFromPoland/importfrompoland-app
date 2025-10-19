import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

export default function AdminInvoicesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Invoice Management</h1>
        <p className="text-muted-foreground">
          Manage proforma invoices, final invoices, and payments
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <FileText className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">Coming Soon</h3>
          <p className="text-muted-foreground text-center max-w-md">
            Invoice management features will be available here. This will include
            proforma invoice generation, final invoicing, payment tracking, and
            financial reporting.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}


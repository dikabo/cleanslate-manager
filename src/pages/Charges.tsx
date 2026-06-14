import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { DateFilterControls } from "@/components/reports/DateFilterControls";
import { supabase } from "@/integrations/supabase/client";
import {
  ExpenseAllocationScope,
  ExpenseCategory,
  ExpenseEntry,
} from "@/types";
import { formatPrice } from "@/hooks/useServices";
import { expenseAllocationScopeLabels, expenseCategoryLabels } from "@/lib/expenses";
import { uploadWithRetry } from "@/lib/image-utils";
import {
  formatReportDateLabel,
  getDefaultExportFilename,
  getPresetDateFilter,
  getRangeForQuery,
  ReportDateFilter,
} from "@/lib/reporting";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Banknote,
  Calculator,
  Download,
  ExternalLink,
  FileUp,
  MoreVertical,
  Paperclip,
  Pencil,
  Plus,
  Receipt,
  Smartphone,
  Trash2,
  Wallet,
  X,
} from "lucide-react";

// ─── Form State ───────────────────────────────────────────────
type ExpenseFormState = {
  designation: string;
  category: ExpenseCategory;
  subcategory: string;
  allocationScope: ExpenseAllocationScope;
  quantity: string;
  unit: string;
  unitPrice: string;
  amount: string;
  expenseDate: string;
  supplier: string;
  paymentMethod: string;
  notes: string;
};

const defaultFormState: ExpenseFormState = {
  designation: "",
  category: "variable",
  subcategory: "",
  allocationScope: "period",
  quantity: "",
  unit: "",
  unitPrice: "",
  amount: "",
  expenseDate: new Date().toISOString().slice(0, 10),
  supplier: "",
  paymentMethod: "",
  notes: "",
};

function entryToFormState(entry: ExpenseEntry): ExpenseFormState {
  return {
    designation: entry.designation,
    category: entry.category,
    subcategory: entry.subcategory,
    allocationScope: entry.allocation_scope,
    quantity: entry.quantity != null ? String(entry.quantity) : "",
    unit: entry.unit || "",
    unitPrice: entry.unit_price != null ? String(entry.unit_price) : "",
    amount: String(entry.amount),
    expenseDate: entry.expense_date,
    supplier: entry.supplier || "",
    paymentMethod: entry.payment_method || "",
    notes: entry.notes || "",
  };
}

// ── Helper: compute the amount from quantity × unitPrice ──
function computeAmount(quantity: string, unitPrice: string): string {
  const q = parseFloat(quantity);
  const p = parseFloat(unitPrice);
  if (!isNaN(q) && !isNaN(p) && q > 0 && p > 0) {
    return String(q * p);
  }
  return "";
}

// ─── Shared Expense Form (used by Create & Edit dialogs) ──────
function ExpenseFormFields({
  form,
  setForm,
  computedAmount,
  effectiveAmount,
  invoiceFile,
  invoicePreview,
  fileInputRef,
  onFileSelect,
  onRemoveFile,
  existingInvoiceUrl,
}: {
  form: ExpenseFormState;
  setForm: React.Dispatch<React.SetStateAction<ExpenseFormState>>;
  computedAmount: string;
  effectiveAmount: string;
  invoiceFile: File | null;
  invoicePreview: string | null;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: () => void;
  existingInvoiceUrl?: string | null;
}) {
  const [subcategoryOpen, setSubcategoryOpen] = useState(false);
  const subcategoryInputRef = useRef<HTMLInputElement>(null);

  const { data: existingSubcategories = [] } = useQuery({
    queryKey: ["expense-subcategories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_entries")
        .select("subcategory")
        .order("subcategory");
      if (error) throw error;
      const unique = [...new Set((data || []).map((d: { subcategory: string }) => d.subcategory).filter(Boolean))];
      return unique as string[];
    },
  });

  const filteredSubcategories = useMemo(() => {
    if (!form.subcategory) return existingSubcategories;
    const search = form.subcategory.toLowerCase();
    return existingSubcategories.filter((s) => s.toLowerCase().includes(search));
  }, [existingSubcategories, form.subcategory]);

  const updateForm = (patch: Partial<ExpenseFormState>) => {
    setForm((current) => ({ ...current, ...patch }));
  };

  const handleQuantityChange = (value: string) => {
    const newComputed = computeAmount(value, form.unitPrice);
    if (form.amount === "" || form.amount === computeAmount(form.quantity, form.unitPrice)) {
      setForm((current) => ({
        ...current,
        quantity: value,
        amount: newComputed,
      }));
    } else {
      updateForm({ quantity: value });
    }
  };

  const handleUnitPriceChange = (value: string) => {
    const newComputed = computeAmount(form.quantity, value);
    if (form.amount === "" || form.amount === computeAmount(form.quantity, form.unitPrice)) {
      setForm((current) => ({
        ...current,
        unitPrice: value,
        amount: newComputed,
      }));
    } else {
      updateForm({ unitPrice: value });
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Désignation</Label>
          <Input
            value={form.designation}
            onChange={(event) => updateForm({ designation: event.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Catégorie</Label>
          <Select
            value={form.category}
            onValueChange={(value) => updateForm({ category: value as ExpenseCategory })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="variable">Charge variable</SelectItem>
              <SelectItem value="fixed">Charge fixe</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2 relative">
          <Label>Sous-catégorie</Label>
          <Input
            ref={subcategoryInputRef}
            value={form.subcategory}
            onChange={(event) => {
              updateForm({ subcategory: event.target.value });
              setSubcategoryOpen(true);
            }}
            onFocus={() => setSubcategoryOpen(true)}
            onBlur={() => {
              setTimeout(() => setSubcategoryOpen(false), 150);
            }}
            placeholder="Taper ou choisir..."
            required
            autoComplete="off"
          />
          {subcategoryOpen && filteredSubcategories.length > 0 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto">
              {filteredSubcategories.map((sub) => (
                <button
                  key={sub}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors first:rounded-t-lg last:rounded-b-lg"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    updateForm({ subcategory: sub });
                    setSubcategoryOpen(false);
                    subcategoryInputRef.current?.blur();
                  }}
                >
                  {sub}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label>Affectation</Label>
          <Select
            value={form.allocationScope}
            onValueChange={(value) => updateForm({ allocationScope: value as ExpenseAllocationScope })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="period">Période</SelectItem>
              <SelectItem value="month">Mois</SelectItem>
              <SelectItem value="week">Semaine</SelectItem>
              <SelectItem value="day">Journée</SelectItem>
              <SelectItem value="order">Commande</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label>Quantité</Label>
          <Input
            type="number"
            min={0}
            value={form.quantity}
            onChange={(event) => handleQuantityChange(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Unité</Label>
          <Input value={form.unit} onChange={(event) => updateForm({ unit: event.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Prix unitaire</Label>
          <Input
            type="number"
            min={0}
            value={form.unitPrice}
            onChange={(event) => handleUnitPriceChange(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Montant</Label>
          <Input
            type="number"
            min={0}
            value={effectiveAmount}
            onChange={(event) => updateForm({ amount: event.target.value })}
            className={effectiveAmount !== "" && effectiveAmount === computedAmount ? "bg-emerald-50 border-emerald-200" : ""}
          />
          {effectiveAmount !== "" && effectiveAmount === computedAmount && (
            <p className="text-[10px] text-emerald-600 flex items-center gap-1">
              <Calculator className="h-3 w-3" />
              Calculé automatiquement
            </p>
          )}
        </div>
      </div>

      {/* Auto-calculation preview */}
      {form.quantity && form.unitPrice && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <Calculator className="h-4 w-4 text-slate-500" />
            <span className="text-slate-600">
              {form.quantity} × {formatPrice(Number(form.unitPrice))} ={" "}
              <strong className="text-slate-900">{formatPrice(Number(form.quantity) * Number(form.unitPrice))}</strong>
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Date</Label>
          <Input type="date" value={form.expenseDate} onChange={(event) => updateForm({ expenseDate: event.target.value })} required />
        </div>
        <div className="space-y-2">
          <Label>Mode de paiement</Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => updateForm({ paymentMethod: form.paymentMethod === "cash" ? "" : "cash" })}
              className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border-2 transition-all text-sm ${
                form.paymentMethod === "cash"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-border hover:border-emerald-300"
              }`}
            >
              <Banknote className="h-4 w-4" />
              <span className="font-medium text-xs">Cash</span>
            </button>
            <button
              type="button"
              onClick={() => updateForm({ paymentMethod: form.paymentMethod === "mobile_money" ? "" : "mobile_money" })}
              className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border-2 transition-all text-sm ${
                form.paymentMethod === "mobile_money"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-border hover:border-emerald-300"
              }`}
            >
              <Smartphone className="h-4 w-4" />
              <span className="font-medium text-xs">Mobile Money</span>
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Fournisseur</Label>
          <Input value={form.supplier} onChange={(event) => updateForm({ supplier: event.target.value })} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Notes</Label>
        <Input value={form.notes} onChange={(event) => updateForm({ notes: event.target.value })} />
      </div>

      {/* Invoice / Receipt Attachment */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Paperclip className="h-4 w-4" />
          Facture fournisseur (image ou PDF)
        </Label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          onChange={onFileSelect}
          className="hidden"
        />

        {/* Show existing invoice link when editing and no new file selected */}
        {!invoiceFile && existingInvoiceUrl && (
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
            <div className="h-12 w-12 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center">
              <Receipt className="h-5 w-5 text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Facture existante</p>
              <button
                type="button"
                className="text-xs text-primary hover:underline flex items-center gap-1"
                onClick={() => window.open(existingInvoiceUrl, "_blank")}
              >
                <ExternalLink className="h-3 w-3" />
                Voir la facture
              </button>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              Remplacer
            </Button>
          </div>
        )}

        {!invoiceFile && !existingInvoiceUrl && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-border rounded-lg hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer group"
          >
            <div className="p-3 rounded-full bg-muted group-hover:bg-primary/10 transition-colors">
              <FileUp className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                Cliquer pour joindre la facture
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Image (JPG, PNG) ou PDF — Max 10 Mo
              </p>
            </div>
          </button>
        )}

        {invoiceFile && (
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
            {invoicePreview ? (
              <img
                src={invoicePreview}
                alt="Aperçu facture"
                className="h-16 w-16 rounded-md object-cover border"
              />
            ) : (
              <div className="h-16 w-16 rounded-md bg-red-50 border border-red-200 flex items-center justify-center">
                <Receipt className="h-6 w-6 text-red-500" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{invoiceFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {(invoiceFile.size / 1024).toFixed(0)} Ko
                {invoiceFile.type === "application/pdf" ? " • PDF" : " • Image"}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onRemoveFile}
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Shared hook for invoice file handling ────────────────────
function useInvoiceFile() {
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [invoicePreview, setInvoicePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Format non supporté. Utilisez une image (JPG, PNG) ou un PDF.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Fichier trop volumineux (max 10 Mo).");
      return;
    }

    setInvoiceFile(file);

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setInvoicePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setInvoicePreview(null);
    }
  };

  const removeFile = () => {
    setInvoiceFile(null);
    setInvoicePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const reset = () => {
    setInvoiceFile(null);
    setInvoicePreview(null);
  };

  return { invoiceFile, invoicePreview, fileInputRef, handleFileSelect, removeFile, reset };
}

// ─── Upload invoice helper ───────────────────────────────────
async function uploadInvoiceIfNeeded(file: File | null): Promise<string | null> {
  if (!file) return null;
  toast.info("Envoi de la facture en cours...", { id: "invoice-upload" });
  const ext = file.name.split(".").pop() || "jpg";
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const path = `charges/${uniqueId}.${ext}`;
  const url = await uploadWithRetry(supabase, "order-photos", path, file, 3, 45000);
  toast.dismiss("invoice-upload");
  return url;
}

// ─── Invalidate all expense-related queries ──────────────────
function invalidateExpenseQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["expense-entries"] });
  queryClient.invalidateQueries({ queryKey: ["expense-subcategories"] });
  queryClient.invalidateQueries({ queryKey: ["report-summary"] });
}

// ─── Create Expense Dialog ───────────────────────────────────
function CreateExpenseDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ExpenseFormState>(defaultFormState);
  const { invoiceFile, invoicePreview, fileInputRef, handleFileSelect, removeFile, reset: resetFile } = useInvoiceFile();

  const computedAmount = useMemo(
    () => computeAmount(form.quantity, form.unitPrice),
    [form.quantity, form.unitPrice]
  );
  const effectiveAmount = form.amount !== "" ? form.amount : computedAmount;

  const createMutation = useMutation({
    mutationFn: async () => {
      const quantity = form.quantity ? Number(form.quantity) : null;
      const unitPrice = form.unitPrice ? Number(form.unitPrice) : null;
      const amount =
        effectiveAmount !== ""
          ? Number(effectiveAmount)
          : quantity !== null && unitPrice !== null
            ? quantity * unitPrice
            : 0;

      const invoiceUrl = await uploadInvoiceIfNeeded(invoiceFile);

      const { error } = await supabase.from("expense_entries").insert({
        designation: form.designation,
        category: form.category,
        subcategory: form.subcategory,
        allocation_scope: form.allocationScope,
        quantity,
        unit: form.unit || null,
        unit_price: unitPrice,
        amount,
        expense_date: form.expenseDate,
        supplier: form.supplier || null,
        payment_method: form.paymentMethod || null,
        notes: form.notes || null,
        invoice_url: invoiceUrl,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      invalidateExpenseQueries(queryClient);
      toast.success("Charge enregistrée avec succès");
      setForm(defaultFormState);
      resetFile();
      setOpen(false);
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle charge
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajouter une charge</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            createMutation.mutate();
          }}
        >
          <ExpenseFormFields
            form={form}
            setForm={setForm}
            computedAmount={computedAmount}
            effectiveAmount={effectiveAmount}
            invoiceFile={invoiceFile}
            invoicePreview={invoicePreview}
            fileInputRef={fileInputRef}
            onFileSelect={handleFileSelect}
            onRemoveFile={removeFile}
          />
          <Button type="submit" className="w-full" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Enregistrement..." : "Enregistrer la charge"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Expense Dialog ─────────────────────────────────────
function EditExpenseDialog({
  entry,
  open,
  onOpenChange,
}: {
  entry: ExpenseEntry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ExpenseFormState>(() => entryToFormState(entry));
  const { invoiceFile, invoicePreview, fileInputRef, handleFileSelect, removeFile, reset: resetFile } = useInvoiceFile();

  // Reset form when entry changes (dialog re-opens with different entry)
  const [trackedId, setTrackedId] = useState(entry.id);
  if (entry.id !== trackedId) {
    setTrackedId(entry.id);
    setForm(entryToFormState(entry));
    resetFile();
  }

  const computedAmount = useMemo(
    () => computeAmount(form.quantity, form.unitPrice),
    [form.quantity, form.unitPrice]
  );
  const effectiveAmount = form.amount !== "" ? form.amount : computedAmount;

  const updateMutation = useMutation({
    mutationFn: async () => {
      const quantity = form.quantity ? Number(form.quantity) : null;
      const unitPrice = form.unitPrice ? Number(form.unitPrice) : null;
      const amount =
        effectiveAmount !== ""
          ? Number(effectiveAmount)
          : quantity !== null && unitPrice !== null
            ? quantity * unitPrice
            : 0;

      // Upload new invoice if provided, otherwise keep existing
      let invoiceUrl: string | null | undefined;
      if (invoiceFile) {
        invoiceUrl = await uploadInvoiceIfNeeded(invoiceFile);
      }

      const updatePayload: Record<string, unknown> = {
        designation: form.designation,
        category: form.category,
        subcategory: form.subcategory,
        allocation_scope: form.allocationScope,
        quantity,
        unit: form.unit || null,
        unit_price: unitPrice,
        amount,
        expense_date: form.expenseDate,
        supplier: form.supplier || null,
        payment_method: form.paymentMethod || null,
        notes: form.notes || null,
      };

      // Only update invoice_url if a new file was uploaded
      if (invoiceUrl !== undefined) {
        updatePayload.invoice_url = invoiceUrl;
      }

      const { error } = await supabase
        .from("expense_entries")
        .update(updatePayload)
        .eq("id", entry.id);

      if (error) throw error;
    },
    onSuccess: () => {
      invalidateExpenseQueries(queryClient);
      toast.success("Charge modifiée avec succès");
      resetFile();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier la charge</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            updateMutation.mutate();
          }}
        >
          <ExpenseFormFields
            form={form}
            setForm={setForm}
            computedAmount={computedAmount}
            effectiveAmount={effectiveAmount}
            invoiceFile={invoiceFile}
            invoicePreview={invoicePreview}
            fileInputRef={fileInputRef}
            onFileSelect={handleFileSelect}
            onRemoveFile={removeFile}
            existingInvoiceUrl={entry.invoice_url}
          />
          <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Enregistrement..." : "Enregistrer les modifications"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Confirmation Dialog ──────────────────────────────
function DeleteExpenseDialog({
  entry,
  open,
  onOpenChange,
}: {
  entry: ExpenseEntry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("expense_entries")
        .delete()
        .eq("id", entry.id);

      if (error) throw error;
    },
    onSuccess: () => {
      invalidateExpenseQueries(queryClient);
      toast.success("Charge supprimée");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer cette charge ?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="block mb-2">
              Vous allez supprimer définitivement la charge suivante :
            </span>
            <span className="block font-semibold text-foreground">
              {entry.designation}
            </span>
            <span className="block text-sm">
              {entry.expense_date} — {formatPrice(entry.amount)}
            </span>
            <span className="block mt-2 text-destructive font-medium">
              Cette action est irréversible.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              deleteMutation.mutate();
            }}
            disabled={deleteMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteMutation.isPending ? "Suppression..." : "Supprimer"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Row Actions Menu ────────────────────────────────────────
function ExpenseRowActions({ entry }: { entry: ExpenseEntry }) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
            <span className="sr-only">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            Modifier
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setDeleteOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditExpenseDialog entry={entry} open={editOpen} onOpenChange={setEditOpen} />
      <DeleteExpenseDialog entry={entry} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </>
  );
}

// ─── Main Page ───────────────────────────────────────────────
function exportExpensesToCSV(entries: ExpenseEntry[], categoryFilter: "all" | ExpenseCategory) {
  const headers = [
    "Date",
    "Designation",
    "Categorie",
    "Sous-categorie",
    "Quantite",
    "Unite",
    "Prix unitaire",
    "Affectation",
    "Montant",
    "Fournisseur",
    "Methode de paiement",
    "Notes",
    "Facture",
  ];

  const rows = entries.map((entry) => [
    entry.expense_date,
    entry.designation,
    expenseCategoryLabels[entry.category],
    entry.subcategory || "",
    entry.quantity || "",
    entry.unit || "",
    entry.unit_price || "",
    expenseAllocationScopeLabels[entry.allocation_scope],
    entry.amount || 0,
    entry.supplier || "",
    entry.payment_method || "",
    entry.notes || "",
    entry.invoice_url || "",
  ]);

  const suffix = categoryFilter === "all" ? "toutes" : categoryFilter;
  downloadCSV(headers, rows, getDefaultExportFilename(`charges_${suffix}`));
  toast.success(`${rows.length} charges exportees`);
}

function downloadCSV(headers: string[], rows: (string | number | boolean | null | undefined)[][], filename: string) {
  const BOM = "\uFEFF";
  const csvContent =
    BOM +
    headers.join(";") +
    "\n" +
    rows.map((row) => row.map(escapeCSV).join(";")).join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeCSV(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(";") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export default function Charges() {
  const [categoryFilter, setCategoryFilter] = useState<"all" | ExpenseCategory>("all");
  const [dateFilter, setDateFilter] = useState<ReportDateFilter>(getPresetDateFilter("thisMonth"));
  const { startIso, endIso } = getRangeForQuery(dateFilter);
  const startDate = startIso.slice(0, 10);
  const endDate = endIso.slice(0, 10);

  const { data: entries = [], error, isLoading } = useQuery({
    queryKey: ["expense-entries", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_entries")
        .select("*")
        .gte("expense_date", startDate)
        .lte("expense_date", endDate)
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ExpenseEntry[];
    },
  });

  const filteredEntries = entries.filter((entry) =>
    categoryFilter === "all" ? true : entry.category === categoryFilter
  );

  const summary = useMemo(() => {
    return filteredEntries.reduce(
      (acc, entry) => {
        acc.total += entry.amount || 0;
        if (entry.category === "fixed") acc.fixed += entry.amount || 0;
        if (entry.category === "variable") acc.variable += entry.amount || 0;
        return acc;
      },
      { total: 0, fixed: 0, variable: 0 }
    );
  }, [filteredEntries]);

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Charges</h1>
            <p className="text-muted-foreground mt-1">
              Saisie libre des charges fixes et variables pour le suivi de rentabilité.
            </p>
          </div>
          <CreateExpenseDialog />
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Chargement des charges impossible</AlertTitle>
            <AlertDescription>
              Vérifiez que les scripts SQL des charges ont bien été exécutés dans Supabase.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Perimetre des charges</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatReportDateLabel(dateFilter)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => exportExpensesToCSV(filteredEntries, categoryFilter)}
                  disabled={isLoading || filteredEntries.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exporter les charges
                </Button>
              </div>
              <DateFilterControls value={dateFilter} onChange={setDateFilter} />
              <Tabs
                value={categoryFilter}
                onValueChange={(value) => setCategoryFilter(value as "all" | ExpenseCategory)}
              >
                <TabsList>
                  <TabsTrigger value="all">Toutes</TabsTrigger>
                  <TabsTrigger value="variable">Variables</TabsTrigger>
                  <TabsTrigger value="fixed">Fixes</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-full bg-primary/10">
                  <Wallet className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xl font-bold">{formatPrice(summary.total)}</p>
                  <p className="text-xs text-muted-foreground">Total affiché</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-full bg-amber-100">
                  <Receipt className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xl font-bold">{formatPrice(summary.variable)}</p>
                  <p className="text-xs text-muted-foreground">Variables</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-full bg-blue-100">
                  <Calculator className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xl font-bold">{formatPrice(summary.fixed)}</p>
                  <p className="text-xs text-muted-foreground">Fixes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Dernières écritures</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Chargement des charges...</p>
            ) : filteredEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune charge enregistrée pour le moment.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Désignation</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead className="text-center">Qté</TableHead>
                    <TableHead className="text-right">P.U.</TableHead>
                    <TableHead>Affectation</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead className="text-center">Facture</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap">{entry.expense_date}</TableCell>
                      <TableCell>
                        <div className="font-medium">{entry.designation}</div>
                        <div className="text-xs text-muted-foreground">{entry.subcategory}</div>
                        {entry.supplier && (
                          <div className="text-xs text-muted-foreground">Fournisseur: {entry.supplier}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={entry.category === "fixed" ? "secondary" : "outline"}>
                          {expenseCategoryLabels[entry.category]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {entry.quantity ? `${entry.quantity}${entry.unit ? ` ${entry.unit}` : ""}` : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {entry.unit_price ? formatPrice(entry.unit_price) : "—"}
                      </TableCell>
                      <TableCell>{expenseAllocationScopeLabels[entry.allocation_scope]}</TableCell>
                      <TableCell className="text-right font-medium">{formatPrice(entry.amount)}</TableCell>
                      <TableCell className="text-center">
                        {entry.invoice_url ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => window.open(entry.invoice_url!, "_blank")}
                            title="Voir la facture"
                          >
                            <ExternalLink className="h-4 w-4 text-primary" />
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <ExpenseRowActions entry={entry} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

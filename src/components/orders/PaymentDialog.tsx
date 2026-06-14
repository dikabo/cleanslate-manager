import { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    PaymentType,
    PaymentMethod,
    paymentTypeLabels,
    paymentMethodLabels,
} from "@/types";
import { useRecordPayment } from "@/hooks/usePayments";
import { formatPrice } from "@/hooks/useServices";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
    Banknote,
    Smartphone,
    CreditCard,
    ArrowRightLeft,
    CheckCircle,
} from "lucide-react";

interface PaymentDialogProps {
    open: boolean;
    onClose: () => void;
    orderId: string;
    totalAmount: number;
    paidAmount: number;
    suggestedType?: PaymentType;
    suggestedAmount?: number;
}

const methodIcons: Record<PaymentMethod, React.ReactNode> = {
    cash: <Banknote className="h-5 w-5" />,
    mobile_money: <Smartphone className="h-5 w-5" />,
    card: <CreditCard className="h-5 w-5" />,
    transfer: <ArrowRightLeft className="h-5 w-5" />,
};

export function PaymentDialog({
    open,
    onClose,
    orderId,
    totalAmount,
    paidAmount,
    suggestedType,
    suggestedAmount,
}: PaymentDialogProps) {
    const isMobile = useIsMobile();
    const remaining = Math.max(0, totalAmount - paidAmount);
    const defaultType = suggestedType || (paidAmount === 0 ? "advance" : "balance");
    const defaultAmount =
        defaultType === "advance"
            ? Math.min(Math.round(totalAmount * 0.5), remaining)
            : remaining;

    const [paymentType, setPaymentType] = useState<PaymentType>(defaultType);
    const [amount, setAmount] = useState<number>(defaultAmount);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
    const [reference, setReference] = useState("");
    const [notes, setNotes] = useState("");

    const recordPayment = useRecordPayment();

    useEffect(() => {
        if (!open) return;

        const refreshedType = suggestedType || (paidAmount === 0 ? "advance" : "balance");
        const remainingAmount = Math.max(0, totalAmount - paidAmount);
        const refreshedAmount = suggestedAmount !== undefined
            ? Math.max(0, Math.min(suggestedAmount, remainingAmount))
            : refreshedType === "advance"
                ? Math.min(Math.round(totalAmount * 0.5), remainingAmount)
                : remainingAmount;

        setPaymentType(refreshedType);
        setAmount(refreshedAmount);
    }, [open, suggestedType, suggestedAmount, paidAmount, totalAmount]);

    const handleSubmit = () => {
        if (amount <= 0) return;
        if (amount > remaining) {
            setAmount(remaining);
            return;
        }
        recordPayment.mutate(
            {
                orderId,
                amount,
                paymentType,
                paymentMethod,
                reference: reference || undefined,
                notes: notes || undefined,
            },
            {
                onSuccess: () => {
                    onClose();
                },
            }
        );
    };

    const newPaidAmount = paidAmount + amount;
    const isFullPayment = newPaidAmount >= totalAmount;

    const paymentFields = (
        <div className="flex-1 space-y-5 overflow-y-auto py-2 pr-1">
            <div className="grid grid-cols-2 gap-3">
                {(["advance", "balance"] as PaymentType[]).map((type) => (
                    <button
                        key={type}
                        onClick={() => {
                            setPaymentType(type);
                            if (type === "advance") {
                                setAmount(Math.min(Math.round(totalAmount * 0.5), remaining));
                            } else {
                                setAmount(remaining);
                            }
                        }}
                        className={cn(
                            "rounded-lg border-2 p-3 text-left transition-all",
                            paymentType === type
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/50"
                        )}
                    >
                        <p className="font-medium text-sm">{paymentTypeLabels[type]}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            {type === "advance"
                                ? `Suggestion: ${formatPrice(Math.min(Math.round(totalAmount * 0.5), remaining))}`
                                : `Restant: ${formatPrice(remaining)}`}
                        </p>
                    </button>
                ))}
            </div>

            <div className="space-y-2">
                <Label>Montant (FCFA)</Label>
                <Input
                    type="number"
                    min={0}
                    max={remaining}
                    value={amount}
                    onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setAmount(Math.max(0, Math.min(val, remaining)));
                    }}
                    placeholder="Montant du paiement"
                    className="text-lg font-semibold"
                />
                {paymentType === "advance" && (
                    <div className="flex gap-2">
                        {[25, 50, 75, 100].map((pct) => (
                            <Button
                                key={pct}
                                variant="outline"
                                size="sm"
                                className="flex-1 text-xs"
                                onClick={() => setAmount(Math.min(Math.round(totalAmount * pct / 100), remaining))}
                            >
                                {pct}%
                            </Button>
                        ))}
                    </div>
                )}
            </div>

            <div className="space-y-2">
                <Label>Methode de paiement</Label>
                <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(paymentMethodLabels) as PaymentMethod[]).map(
                        (method) => (
                            <button
                                key={method}
                                onClick={() => setPaymentMethod(method)}
                                className={cn(
                                    "flex items-center gap-2 rounded-lg border-2 p-3 text-sm transition-all",
                                    paymentMethod === method
                                        ? "border-primary bg-primary/5"
                                        : "border-border hover:border-primary/50"
                                )}
                            >
                                {methodIcons[method]}
                                <span className="font-medium">
                                    {paymentMethodLabels[method]}
                                </span>
                            </button>
                        )
                    )}
                </div>
            </div>

            {paymentMethod !== "cash" && (
                <div className="space-y-2">
                    <Label>Reference de transaction</Label>
                    <Input
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        placeholder="No transaction, reference..."
                    />
                </div>
            )}

            <div className="space-y-2">
                <Label>Notes (optionnel)</Label>
                <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notes sur le paiement..."
                    rows={2}
                />
            </div>

            <div className="space-y-2 rounded-lg bg-muted/50 p-4">
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total commande</span>
                    <span className="font-medium">{formatPrice(totalAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Deja paye</span>
                    <span className="font-medium">{formatPrice(paidAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Ce paiement</span>
                    <span className="font-semibold text-primary">
                        +{formatPrice(amount)}
                    </span>
                </div>
                <div className="flex justify-between border-t pt-2 text-sm">
                    <span className="font-semibold">Reste a payer apres</span>
                    <span
                        className={cn(
                            "font-bold",
                            isFullPayment ? "text-emerald-600" : "text-amber-600"
                        )}
                    >
                        {isFullPayment ? (
                            <span className="flex items-center gap-1">
                                <CheckCircle className="h-4 w-4" />
                                Solde
                            </span>
                        ) : (
                            formatPrice(Math.max(0, totalAmount - newPaidAmount))
                        )}
                    </span>
                </div>
            </div>
        </div>
    );

    const actionButtons = (
        <div className="border-t bg-background pt-4">
            <div className="flex flex-col gap-3 sm:flex-row">
                <Button variant="outline" onClick={onClose} className="flex-1">
                    Annuler
                </Button>
                <Button
                    onClick={handleSubmit}
                    disabled={amount <= 0 || amount > remaining || remaining <= 0 || recordPayment.isPending}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                    {recordPayment.isPending
                        ? "Enregistrement..."
                        : `Encaisser ${formatPrice(amount)}`}
                </Button>
            </div>
        </div>
    );

    if (isMobile) {
        return (
            <Drawer open={open} onOpenChange={onClose}>
                <DrawerContent className="flex max-h-[90dvh] flex-col">
                    <DrawerHeader className="text-left">
                        <DrawerTitle className="flex items-center gap-2">
                            <Banknote className="h-5 w-5 text-primary" />
                            Enregistrer un paiement
                        </DrawerTitle>
                    </DrawerHeader>
                    <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
                        {paymentFields}
                        {actionButtons}
                    </div>
                </DrawerContent>
            </Drawer>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="flex max-h-[90dvh] flex-col sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Banknote className="h-5 w-5 text-primary" />
                        Enregistrer un paiement
                    </DialogTitle>
                </DialogHeader>
                {paymentFields}
                {actionButtons}
            </DialogContent>
        </Dialog>
    );
}

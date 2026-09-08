"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/client-api";
import type { FeeDTO, FeeType } from "@/lib/types";
import { FormDialog, formatCurrency } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const FEE_TYPES: FeeType[] = ["TUITION", "ADMISSION", "EXAM", "TRANSPORT", "LIBRARY", "OTHER"];

/**
 * Edit an existing invoice. Previously the only way to correct a mistyped
 * amount was to delete the fee — which cascades away its payment history.
 *
 * The student is intentionally not editable: re-pointing an invoice that
 * already has payments recorded against it would misattribute money.
 */
export function FeeEditDialog({
  fee,
  onOpenChange,
}: {
  fee: FeeDTO;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(fee.title);
  const [type, setType] = useState<FeeType>(fee.type);
  const [amount, setAmount] = useState(String(fee.amount));
  const [dueDate, setDueDate] = useState(fee.dueDate.slice(0, 10));

  const mutation = useMutation({
    mutationFn: () =>
      api.put(`/api/fees/${fee.id}`, {
        title: title.trim(),
        type,
        amount: Number(amount),
        dueDate,
      }),
    onSuccess: () => {
      toast.success("Fee updated");
      void queryClient.invalidateQueries({ queryKey: ["fees"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const belowPaid = Number(amount) < fee.paidAmount;
  const valid = title.trim() && Number(amount) > 0 && dueDate && !belowPaid;

  return (
    <FormDialog
      open
      onOpenChange={onOpenChange}
      title="Edit fee"
      description={`${fee.studentName} · ${fee.studentCode}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) {
          toast.error(
            belowPaid
              ? `Amount cannot be below the ${formatCurrency(fee.paidAmount)} already paid`
              : "Fill in the title, a positive amount and a due date"
          );
          return;
        }
        mutation.mutate();
      }}
      submitting={mutation.isPending}
      submitLabel="Save changes"
    >
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="fee-edit-title">Title *</Label>
          <Input
            id="fee-edit-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Term 2 tuition"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as FeeType)}>
              <SelectTrigger className="w-full" aria-label="Fee type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FEE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.charAt(0) + t.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="fee-edit-due">Due date *</Label>
            <Input
              id="fee-edit-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="fee-edit-amount">Amount (৳) *</Label>
          <Input
            id="fee-edit-amount"
            type="number"
            min={fee.paidAmount || 0.01}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={belowPaid}
          />
          {fee.paidAmount > 0 ? (
            <p className={belowPaid ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
              {formatCurrency(fee.paidAmount)} already paid — the amount cannot go below this.
            </p>
          ) : null}
        </div>
      </div>
    </FormDialog>
  );
}

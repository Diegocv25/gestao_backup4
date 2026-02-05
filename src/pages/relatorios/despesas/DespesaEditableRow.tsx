import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { safeNumber } from "@/pages/relatorios/relatorios-utils";

export type FormaPagamento = "pix" | "dinheiro" | "cartao";

export type DespesaRow = {
  id: string;
  descricao: string;
  valor: number;
  pago_em?: string | null;
  forma_pagamento?: FormaPagamento | null;
};

export function DespesaEditableRow({
  row,
  onSave,
  onDuplicate,
  onDelete,
  onMarkPaid,
  onUnmarkPaid,
}: {
  row: DespesaRow;
  onSave: (row: DespesaRow) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMarkPaid: (b: { id: string; pago_em: string; forma_pagamento: FormaPagamento }) => void;
  onUnmarkPaid: (id: string) => void;
}) {
  const [descricao, setDescricao] = useState(row.descricao);
  const [valor, setValor] = useState(String(row.valor));

  const pago = !!row.pago_em;

  const defaultDate = useMemo(() => {
    const d = new Date();
    // yyyy-MM-dd
    return d.toISOString().slice(0, 10);
  }, []);

  const [pagoEmDate, setPagoEmDate] = useState(defaultDate);
  const [forma, setForma] = useState<FormaPagamento>("dinheiro");

  return (
    <TableRow>
      <TableCell>
        <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: energia, aluguel, marketing…" />
      </TableCell>

      <TableCell className="text-right">
        <Input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" />
      </TableCell>

      <TableCell className="text-right">
        <div className="flex justify-end gap-2 flex-wrap">
          <Button type="button" variant="secondary" onClick={() => onSave({ ...row, descricao, valor: safeNumber(valor.replace(",", ".")) })}>
            Salvar
          </Button>
          <Button type="button" variant="outline" onClick={onDuplicate}>
            Duplicar
          </Button>

          {pago ? (
            <Button type="button" variant="outline" onClick={() => onUnmarkPaid(row.id)}>
              Desmarcar pago
            </Button>
          ) : (
            <Dialog>
              <DialogTrigger asChild>
                <Button type="button" variant="outline">
                  Marcar pago
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Marcar despesa como paga</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Data de pagamento</Label>
                    <Input type="date" value={pagoEmDate} onChange={(e) => setPagoEmDate(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Forma</Label>
                    <Select value={forma} onValueChange={(v) => setForma(v as FormaPagamento)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pix">Pix</SelectItem>
                        <SelectItem value="dinheiro">Dinheiro</SelectItem>
                        <SelectItem value="cartao">Cartão</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    onClick={() => {
                      const pagoEmIso = `${pagoEmDate}T00:00:00.000Z`;
                      onMarkPaid({ id: row.id, pago_em: pagoEmIso, forma_pagamento: forma });
                    }}
                  >
                    Confirmar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          <Button type="button" variant="destructive" onClick={onDelete}>
            Remover
          </Button>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {pago ? `Pago em ${String(row.pago_em).slice(0, 10)} (${row.forma_pagamento ?? "-"})` : "Não pago"}
        </div>
      </TableCell>
    </TableRow>
  );
}

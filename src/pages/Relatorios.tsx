import { useMemo, useState } from "react";
import { format, startOfMonth } from "date-fns";

import RelatoriosComparativos from "@/pages/relatorios/RelatoriosComparativos";
import RelatoriosDespesas from "@/pages/relatorios/RelatoriosDespesas";
import RelatoriosPorFuncionario from "@/pages/relatorios/RelatoriosPorFuncionario";
import RelatoriosConcluidosPorDiaSemana from "@/pages/relatorios/RelatoriosConcluidosPorDiaSemana";
import RelatoriosProdutos from "@/pages/relatorios/RelatoriosProdutos";
import RelatoriosFluxoCaixa from "@/pages/relatorios/RelatoriosFluxoCaixa";

export default function RelatoriosPage() {
  const hoje = useMemo(() => new Date(), []);

  // Período principal (controla tudo)
  const [inicio, setInicio] = useState(() => format(startOfMonth(hoje), "yyyy-MM-dd"));
  const [fim, setFim] = useState(() => format(hoje, "yyyy-MM-dd"));

  // Competência para despesas/folha (mensal)
  const [competencia, setCompetencia] = useState(() => format(hoje, "yyyy-MM"));

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Relatórios</h1>
        <p className="text-sm text-muted-foreground">
          Comparativos por período, desempenho por funcionário e fechamento com despesas.
        </p>
      </header>

      <RelatoriosComparativos inicio={inicio} fim={fim} onChangeInicio={setInicio} onChangeFim={setFim} />

      <RelatoriosConcluidosPorDiaSemana inicio={inicio} fim={fim} />

      <RelatoriosPorFuncionario inicio={inicio} fim={fim} />

      <RelatoriosFluxoCaixa inicio={inicio} fim={fim} />

      <RelatoriosDespesas competencia={competencia} onChangeCompetencia={setCompetencia} inicio={inicio} fim={fim} />

      <RelatoriosProdutos inicio={inicio} fim={fim} />
    </div>
  );
}

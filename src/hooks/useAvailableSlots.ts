 import { useQuery } from "@tanstack/react-query";
 import { addDays, format, getDay, startOfDay } from "date-fns";
 import { supabase } from "@/integrations/supabase/client";
 import { buildAvailableSlots } from "@/lib/scheduling";
 
 type UseAvailableSlotsParams = {
   funcionarioId: string | null;
   data: string | null;
   serviceDurationMinutes: number | null;
   salaoId?: string | null; // Apenas para portal
   excludeAgendamentoId?: string | null; // Em edição, excluir o próprio agendamento
   usePortalRpc?: boolean; // Se true, usa RPC security definer para portal
 };
 
 /**
  * Hook unificado para buscar slots disponíveis.
  * Usado tanto no sistema de gestão quanto no portal do cliente.
  * Garante que a lógica de cálculo de horários disponíveis é idêntica em ambos.
  */
 export function useAvailableSlots(params: UseAvailableSlotsParams) {
   const { funcionarioId, data, serviceDurationMinutes, salaoId, excludeAgendamentoId, usePortalRpc } = params;
 
   return useQuery({
     queryKey: [
       usePortalRpc ? "portal-slots" : "slots-disponiveis",
      salaoId ?? null,
       funcionarioId,
       data,
       serviceDurationMinutes,
       excludeAgendamentoId,
     ],
     enabled: !!funcionarioId && !!data && !!serviceDurationMinutes,
      queryFn: async () => {
       if (!funcionarioId || !data || !serviceDurationMinutes) return [];
 
       const day = new Date(`${data}T00:00:00`);
       const dow = getDay(day);
 
       // 1. Buscar horário de trabalho do funcionário no dia da semana
       let horario: { inicio: string; fim: string; almoco_inicio: string | null; almoco_fim: string | null } | null = null;
 
       if (usePortalRpc && salaoId) {
         // Portal: usa RPC SECURITY DEFINER para evitar problemas de RLS
         const sb = supabase as any;
         const { data: horarios, error: horErr } = await sb.rpc("portal_horarios_funcionario_public", {
           _salao_id: salaoId,
           _funcionario_id: funcionarioId,
         });
         if (horErr) throw horErr;
 
         const rows = (horarios ?? []) as any[];
         horario = rows.find((r: any) => Number(r.dia_semana) === dow) ?? null;
       } else {
         // Sistema: query direta com RLS
         const { data: horarioData, error: horErr } = await supabase
           .from("horarios_funcionario")
           .select("inicio,fim,almoco_inicio,almoco_fim")
           .eq("funcionario_id", funcionarioId)
           .eq("dia_semana", dow)
           .maybeSingle();
         if (horErr) throw horErr;
         horario = horarioData;
       }
 
       // Se não houver horário configurado para este dia, retorna vazio
       if (!horario) return [];
 
        // 2. Buscar agendamentos já ocupados no dia
        let busy: any[] = [];
        if (usePortalRpc && salaoId) {
          // Portal: precisa enxergar agendamentos de outros clientes sem vazar dados sensíveis.
          // Usa RPC SECURITY DEFINER que retorna apenas {id, data_hora_inicio, total_duracao_minutos}.
          const sb = supabase as any;
          const { data: busyData, error: busyErr } = await sb.rpc("portal_agendamentos_ocupados_public", {
            _salao_id: salaoId,
            _funcionario_id: funcionarioId,
            _dia: data,
          });
          if (busyErr) throw busyErr;
          busy = (busyData ?? []) as any[];
        } else {
          // Sistema: query direta com RLS
          const start = startOfDay(day);
          const next = addDays(start, 1);

          const { data: busyData, error: busyErr } = await supabase
            .from("agendamentos")
            .select("id,data_hora_inicio,total_duracao_minutos")
            .eq("funcionario_id", funcionarioId)
            .gte("data_hora_inicio", start.toISOString())
            .lt("data_hora_inicio", next.toISOString())
            .neq("status", "cancelado");
          if (busyErr) throw busyErr;
          busy = (busyData ?? []) as any[];
        }
 
       // 3. Mapear agendamentos ocupados para formato { start, durationMinutes }
       let busyMapped = (busy ?? []).map((b: any) => ({
         id: String(b.id),
         start: format(new Date(b.data_hora_inicio), "HH:mm"),
         durationMinutes: Number(b.total_duracao_minutos),
       }));
 
       // Em edição: excluir o próprio agendamento dos horários ocupados
       if (excludeAgendamentoId) {
         busyMapped = busyMapped.filter((b) => b.id !== excludeAgendamentoId);
       }
 
       // 4. Calcular slots disponíveis
       return buildAvailableSlots({
         workStart: String(horario.inicio),
         workEnd: String(horario.fim),
         lunchStart: horario.almoco_inicio ?? null,
         lunchEnd: horario.almoco_fim ?? null,
         slotStepMinutes: 30,
         serviceDurationMinutes: serviceDurationMinutes,
         busy: busyMapped.map((b) => ({ start: b.start, durationMinutes: b.durationMinutes })),
       });
     },
   });
 }
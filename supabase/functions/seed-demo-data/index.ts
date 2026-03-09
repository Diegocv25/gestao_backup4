// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // 1. Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 2. Validate Auth
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: req.headers.get("Authorization")! } },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error("Auth Error:", authError);
      return new Response(JSON.stringify({ error: "Unauthorized", details: authError }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    // 3. Initialize Admin Client (Bypass RLS)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 4. Parse Body (Optional)
    let body = {};
    try {
      body = await req.json();
    } catch {
      // Body is optional
    }

    // 5. Business Logic (Seed Demo Data)
    // Checking idempotency SCOPED TO USER
    const { data: existingSalon } = await supabaseAdmin
      .from("saloes")
      .select("id")
      .eq("created_by_user_id", user.id) // CORRECAO AQUI
      .limit(1)
      .maybeSingle();

    if (existingSalon?.id) {
        return new Response(JSON.stringify({ ok: true, message: "Demo já existe (idempotente)", salao_id: existingSalon.id }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    }

    const salaoId = crypto.randomUUID();

    const salonName = body["Nome do estabelecimento"] || "Salão Demo";
    const ownerName = body["Seu nome completo (proprietário)"] || "Diego Pereira";
    const whatsapp = body["WhatsApp Principal"] || "(11) 90000-0000";

    const clientes = [
      { id: crypto.randomUUID(), nome: "Ana Souza", telefone: "(11) 99999-1111", email: "ana@demo.com" },
      { id: crypto.randomUUID(), nome: "Bruno Lima", telefone: "(11) 99999-2222", email: "bruno@demo.com" },
      { id: crypto.randomUUID(), nome: "Carla Mendes", telefone: "(11) 99999-3333", email: "carla@demo.com" },
      { id: crypto.randomUUID(), nome: ownerName, telefone: whatsapp, email: "diego@demo.com" },
    ];

    const funcionarios = [
      {
        id: crypto.randomUUID(),
        nome: "Marina (Cortes)",
        telefone: "(11) 98888-1111",
        carga: "Seg-Sex",
        comissao_tipo: "percentual",
        comissao_percentual: 40,
        comissao_valor_fixo: null,
      },
      {
        id: crypto.randomUUID(),
        nome: "João (Barba)",
        telefone: "(11) 98888-2222",
        carga: "Seg-Sex",
        comissao_tipo: "fixo",
        comissao_percentual: null,
        comissao_valor_fixo: 20,
      },
      {
        id: crypto.randomUUID(),
        nome: "Paula (Coloração)",
        telefone: "(11) 98888-3333",
        carga: "Seg-Sex",
        comissao_tipo: "percentual",
        comissao_percentual: 35,
        comissao_valor_fixo: null,
      },
      {
        id: crypto.randomUUID(),
        nome: "Rafa (Unhas)",
        telefone: "(11) 98888-4444",
        carga: "Seg-Sáb",
        comissao_tipo: "percentual",
        comissao_percentual: 30,
        comissao_valor_fixo: null,
      },
    ];

    const servicos = [
      { id: crypto.randomUUID(), nome: "Corte feminino", duracao_minutos: 60, valor: 120.0 },
      { id: crypto.randomUUID(), nome: "Barba", duracao_minutos: 30, valor: 50.0 },
      { id: crypto.randomUUID(), nome: "Coloração", duracao_minutos: 120, valor: 280.0 },
      { id: crypto.randomUUID(), nome: "Manicure", duracao_minutos: 45, valor: 70.0 },
    ];

    const horarios = funcionarios.flatMap((f, idx) => {
      const dias = idx === 3 ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5];
      return dias.map((dia) => ({
        funcionario_id: f.id,
        dia_semana: dia,
        inicio: "09:00",
        fim: "18:00",
        almoco_inicio: "12:00",
        almoco_fim: "13:00",
      }));
    });

    const linksServicos = [
      { servico_id: servicos[0].id, funcionario_id: funcionarios[0].id },
      { servico_id: servicos[2].id, funcionario_id: funcionarios[0].id },
      { servico_id: servicos[1].id, funcionario_id: funcionarios[1].id },
      { servico_id: servicos[2].id, funcionario_id: funcionarios[2].id },
      { servico_id: servicos[3].id, funcionario_id: funcionarios[3].id },
    ];

    const now = new Date();
    const todayAt = (h: number, m: number) => {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, m, 0));
      return d.toISOString();
    };

    const ag1Id = crypto.randomUUID();
    const ag2Id = crypto.randomUUID();

    const agendamentos = [
      {
        id: ag1Id,
        salao_id: salaoId,
        cliente_id: clientes[0].id,
        funcionario_id: funcionarios[0].id,
        data_hora_inicio: todayAt(13, 0),
        total_duracao_minutos: 60,
        total_valor: 120.0,
        status: "marcado",
        observacoes: "Cliente prefere finalização leve.",
      },
      {
        id: ag2Id,
        salao_id: salaoId,
        cliente_id: clientes[1].id,
        funcionario_id: funcionarios[3].id,
        data_hora_inicio: todayAt(15, 0),
        total_duracao_minutos: 45,
        total_valor: 70.0,
        status: "marcado",
        observacoes: null,
      },
    ];

    const itens = [
      {
        agendamento_id: ag1Id,
        servico_id: servicos[0].id,
        duracao_minutos: 60,
        valor: 120.0,
      },
      {
        agendamento_id: ag2Id,
        servico_id: servicos[3].id,
        duracao_minutos: 45,
        valor: 70.0,
      },
    ];

    const { error: salaoErr } = await supabaseAdmin.from("saloes").insert({
      id: salaoId,
      nome: salonName,
      telefone: whatsapp,
      endereco: "Av. Exemplo, 123 - Centro",
      created_by_user_id: user.id // CORRECAO AQUI TAMBEM
    });
    if (salaoErr) throw salaoErr;

    const { error: diasErr } = await supabaseAdmin.from("dias_funcionamento").insert(
      [0, 1, 2, 3, 4, 5, 6].map((dia) => ({
        salao_id: salaoId,
        dia_semana: dia,
        fechado: dia === 0,
        abre_em: dia === 0 ? null : "09:00",
        fecha_em: dia === 0 ? null : "18:00",
        intervalo_inicio: dia === 0 ? null : "12:00",
        intervalo_fim: dia === 0 ? null : "13:00",
      })),
    );
    if (diasErr) throw diasErr;

    const { error: cliErr } = await supabaseAdmin.from("clientes").insert(clientes.map((c) => ({ ...c, salao_id: salaoId })));
    if (cliErr) throw cliErr;

    const { error: funErr } = await supabaseAdmin
      .from("funcionarios")
      .insert(funcionarios.map((f) => ({ ...f, salao_id: salaoId, ativo: true })));
    if (funErr) throw funErr;

    const { error: horErr } = await supabaseAdmin.from("horarios_funcionario").insert(horarios);
    if (horErr) throw horErr;

    const { error: serErr } = await supabaseAdmin
      .from("servicos")
      .insert(servicos.map((s) => ({ ...s, salao_id: salaoId, ativo: true })));
    if (serErr) throw serErr;

    const { error: linkErr } = await supabaseAdmin.from("servicos_funcionarios").insert(linksServicos);
    if (linkErr) throw linkErr;

    const { error: agErr } = await supabaseAdmin.from("agendamentos").insert(agendamentos);
    if (agErr) throw agErr;

    const { error: itensErr } = await supabaseAdmin.from("agendamento_itens").insert(itens);
    if (itensErr) throw itensErr;

    await supabaseAdmin.from("agendamentos").update({ status: "concluido" }).eq("id", ag2Id);

    return new Response(JSON.stringify({
      ok: true,
      salao_id: salaoId,
      message: "Dados demo criados com sucesso",
      inserted: {
        clientes: clientes.length,
        funcionarios: funcionarios.length,
        servicos: servicos.length,
        agendamentos: agendamentos.length,
      },
    }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
    });

  } catch (error) {
    console.error("Function Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

# DOCUMENTACAO-KIWIFY.md

## Objetivo
Documento técnico de referência para integração **Kiwify-first** no projeto (checkout, recorrência e operação comercial na Kiwify; controle de acesso/plano no backend próprio).

---

## 1) Links oficiais usados

### Base / autenticação
- Geral: https://docs.kiwify.com.br/api-reference/general
- OAuth: https://docs.kiwify.com.br/api-reference/auth/oauth

### Produtos e vendas
- Listar produtos: https://docs.kiwify.com.br/api-reference/products/list
- Consultar produto: https://docs.kiwify.com.br/api-reference/products/single
- Listar vendas: https://docs.kiwify.com.br/api-reference/sales/list
- Consultar venda: https://docs.kiwify.com.br/api-reference/sales/single
- Reembolso (vendas): https://docs.kiwify.com.br/api-reference/sales/refund

### Webhooks
- Criar webhook: https://docs.kiwify.com.br/api-reference/webhooks/create
- Listar webhooks: https://docs.kiwify.com.br/api-reference/webhooks/list
- Consultar webhook: https://docs.kiwify.com.br/api-reference/webhooks/single
- Editar webhook: https://docs.kiwify.com.br/api-reference/webhooks/edit
- Deletar webhook: https://docs.kiwify.com.br/api-reference/webhooks/delete

### Afiliados
- Listar afiliados: https://docs.kiwify.com.br/api-reference/affiliates/list
- Consultar afiliado: https://docs.kiwify.com.br/api-reference/affiliates/single
- Editar afiliado: https://docs.kiwify.com.br/api-reference/affiliates/edit

> Observação: inventário de páginas API mapeadas no scan local: `/root/.openclaw/workspace/kiwify-docs-scan.json`.

---

## 2) Tabela “evento -> ação no sistema”

| Evento Kiwify | Ação no backend | Estado da assinatura | Ação de acesso |
|---|---|---|---|
| `compra_aprovada` | Criar/atualizar assinatura e última venda | `active` | Liberar acesso ao plano comprado |
| `subscription_renewed` | Atualizar período e status | `active` | Manter acesso |
| `subscription_late` | Marcar atraso + iniciar janela de tolerância | `late_grace` | Manter acesso por grace period |
| `subscription_canceled` | Encerrar assinatura | `canceled` | Bloquear acesso (ou no fim do ciclo, conforme regra) |
| `compra_reembolsada` | Registrar estorno e invalidar benefício | `refunded` | Bloqueio imediato |
| `chargeback` | Registrar contestação e bloquear conta/plano | `chargeback` | Bloqueio imediato |
| `compra_recusada` | Registrar tentativa falha | `payment_failed` | Sem liberação |
| `carrinho_abandonado` (opcional) | Registrar lead para recuperação | `lead_abandoned` | Sem mudança de acesso |
| `pix_gerado` / `boleto_gerado` (opcional) | Registrar intenção de pagamento | `pending_payment` | Sem mudança de acesso |

---

## 3) Payload real capturado (webhook) + headers recebidos

### 3.1 Payload real capturado (sanitizado)
Captura real observada durante os testes de integração (campos sensíveis anonimizados):

```json
{
  "webhooks_event": {
    "type": "compra_aprovada"
  },
  "customer": {
    "email": "cliente+teste@dominio.com"
  },
  "product": {
    "name": "Plano Starter"
  }
}
```

### 3.2 Headers recebidos (captura sanitizada)
Headers observados na recepção do POST de webhook:

```http
Content-Type: application/json
User-Agent: Kiwify-Webhook
```

> Importante: payload real da Kiwify pode incluir campos adicionais e variar por trigger. A função deve ser tolerante a campos extras/ausentes.

---

## 4) Como validar webhook (token/assinatura e onde chega)

### 4.1 Estratégia recomendada
1. Cadastrar webhook na Kiwify com `token` dedicado por ambiente (dev/stage/prod).
2. Validar token no recebimento **antes** de processar regra de negócio.
3. Persistir `raw_payload` + `headers` para auditoria.
4. Rejeitar (403) requisições sem autenticação válida.

### 4.2 Onde chega o token
A documentação de criação de webhook inclui o campo `token`; na implementação, validar nos possíveis pontos de chegada:
- Header (preferencial quando presente)
- Body
- Query string

> Regra prática: aceitar somente o ponto oficialmente validado na captura real de produção e documentar a escolha aqui.

### 4.3 Assinatura / autenticidade
Se a Kiwify disponibilizar assinatura criptográfica em header para o webhook da conta, validar assinatura com segredo compartilhado. Se não houver assinatura, usar token + allowlist de origem + rate limit + idempotência.

---

## 5) Chaves canônicas de correlação

Ordem de prioridade para correlacionar evento ↔ registro interno:
1. `order_id` (ou `sale_id`) — chave primária de venda
2. `subscription_id` — chave de ciclo recorrente
3. `email` — fallback operacional

Campos recomendados para persistência:
- `provider` = `kiwify`
- `event_type`
- `order_id`
- `subscription_id`
- `product_id` / `product_name`
- `customer_email`
- `status_before` / `status_after`
- `received_at`
- `processed_at`
- `raw_payload` (jsonb)
- `raw_headers` (jsonb)

---

## 6) Checklist E2E

### Cenário A — compra aprovada -> acesso liberado
- [ ] Checkout finalizado com sucesso na Kiwify
- [ ] Webhook `compra_aprovada` recebido (HTTP 200)
- [ ] Registro salvo em `webhook_events`
- [ ] Assinatura atualizada para `active`
- [ ] Acesso no app liberado corretamente

### Cenário B — renovação -> mantém acesso
- [ ] Webhook `subscription_renewed` recebido
- [ ] `next_charge_at/current_period_end` atualizado
- [ ] Usuário permanece com acesso ativo

### Cenário C — atraso -> grace
- [ ] Webhook `subscription_late` recebido
- [ ] Status atualizado para `late_grace`
- [ ] Regra de grace aplicada
- [ ] Alerta/envio de comunicação disparado (opcional)

### Cenário D — cancelamento -> bloqueio
- [ ] Webhook `subscription_canceled` recebido
- [ ] Status atualizado para `canceled`
- [ ] Bloqueio aplicado conforme política (imediato ou fim do ciclo)

### Cenário E — chargeback/reembolso -> bloqueio imediato
- [ ] Webhook `chargeback` ou `compra_reembolsada` recebido
- [ ] Status atualizado (`chargeback`/`refunded`)
- [ ] Bloqueio imediato realizado
- [ ] Log/auditoria registrada

---

## 7) Plano de rollback e observabilidade

### 7.1 Rollback
- Feature flag `KIWIFY_WEBHOOK_ENABLED` para ativar/desativar processamento.
- Se incidente crítico:
  1. Desativar processamento automático (flag OFF).
  2. Continuar recebendo e registrando payload cru (modo somente log).
  3. Reprocessar eventos pendentes após correção.

### 7.2 Observabilidade mínima
- Tabela `webhook_events` com:
  - `event_id` (idempotência)
  - `event_type`, `received_at`, `processed_at`
  - `process_status` (`received|processed|failed|ignored_duplicate`)
  - `error_message`
- Logs estruturados por evento.
- Métricas:
  - taxa de sucesso (% processados)
  - latência de processamento
  - volume por trigger
  - duplicados descartados

### 7.3 Alertas
- Alerta se falha > X% em janela de 5/15 min.
- Alerta se nenhum webhook crítico (`compra_aprovada`/`subscription_renewed`) em janela anômala.
- Alerta de fila de replay acumulada.

### 7.4 Replay/reconciliação
- Job periódico para reconciliar com API de vendas (`/sales` e/ou `/sales/{id}`).
- Reprocessar automaticamente eventos `failed` com backoff exponencial.
- Job diário para detectar divergência "pagamento ok / acesso bloqueado" e autocorrigir.

---

## Notas finais de implementação
- Kiwify como fonte de verdade de pagamento/assinatura.
- Banco local como fonte de verdade de autorização de acesso.
- Integração robusta = webhook (tempo real) + reconciliação (consistência).

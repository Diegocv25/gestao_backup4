# Plano por fases — Desacoplamento total do Lovable (gestao_backup4)

## Objetivo
Remover dependências técnicas e operacionais do Lovable, deixar o projeto 100% autônomo (build/deploy local + Vercel), e finalizar com validações de produção.

## Fase 1 — Remoção técnica crítica (build/runtime)
- Remover `lovable-tagger` do projeto.
- Limpar `vite.config.ts` para não depender de plugin do Lovable.
- Ajustar metadados em `index.html` que apontam para `lovable.dev`.
- Rodar build e validar que compila sem regressão.

**Critério de pronto:** projeto builda sem `lovable-tagger` e sem URLs do `lovable.dev` no HTML principal.

## Fase 2 — Limpeza de conteúdo e documentação
- Remover/reescrever referências do Lovable em READMEs e docs operacionais.
- Revisar comentários/códigos herdados com menções da plataforma.
- Definir instrução única de fluxo: local + GitHub + Vercel.

**Critério de pronto:** nenhuma instrução operacional depende de Lovable.

## Fase 3 — Higiene de repositório
- Tratar artefatos temporários (`supabase/.temp/`, patches soltos etc.) sem quebrar o fluxo atual.
- Revisar `.gitignore` e manter o repositório limpo.
- Garantir commits atômicos por fase.

**Critério de pronto:** `git status` limpo (exceto arquivos conscientemente mantidos).

## Fase 4 — Deploy e validação em produção
- Deploy Vercel com token.
- Smoke test das rotas principais (login, áreas críticas, integrações principais).
- Conferir metadados, favicon e branding final.

**Critério de pronto:** produção atualizada, funcional e sem “rastros Lovable”.

## Fase 5 — Ajustes finais guiados por uso real
- Microajustes de UI/UX e performance.
- Pequenos fixes pós-publicação.
- Fechamento com checklist final de aceite.

---

## Execução adotada
Vou executar em ordem, com commits pequenos por fase, e te atualizo com:
1) o que foi feito,
2) hash do commit,
3) status de deploy.

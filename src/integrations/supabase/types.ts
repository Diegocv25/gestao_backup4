export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      agendamento_itens: {
        Row: {
          agendamento_id: string
          created_at: string
          duracao_minutos: number
          id: string
          servico_id: string
          valor: number
        }
        Insert: {
          agendamento_id: string
          created_at?: string
          duracao_minutos: number
          id?: string
          servico_id: string
          valor: number
        }
        Update: {
          agendamento_id?: string
          created_at?: string
          duracao_minutos?: number
          id?: string
          servico_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "agendamento_itens_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamento_itens_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      agendamentos: {
        Row: {
          cliente_id: string
          created_at: string
          data_hora_inicio: string
          funcionario_id: string
          id: string
          observacoes: string | null
          salao_id: string
          status: Database["public"]["Enums"]["agendamento_status"]
          total_duracao_minutos: number
          total_valor: number
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          data_hora_inicio: string
          funcionario_id: string
          id?: string
          observacoes?: string | null
          salao_id: string
          status?: Database["public"]["Enums"]["agendamento_status"]
          total_duracao_minutos: number
          total_valor: number
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          data_hora_inicio?: string
          funcionario_id?: string
          id?: string
          observacoes?: string | null
          salao_id?: string
          status?: Database["public"]["Enums"]["agendamento_status"]
          total_duracao_minutos?: number
          total_valor?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_salao_id_fkey"
            columns: ["salao_id"]
            isOneToOne: false
            referencedRelation: "saloes"
            referencedColumns: ["id"]
          },
        ]
      }
      avisos_semanais: {
        Row: {
          created_at: string
          dom: string | null
          geral: string | null
          id: string
          qua: string | null
          qui: string | null
          sab: string | null
          salao_id: string
          seg: string | null
          sex: string | null
          ter: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          dom?: string | null
          geral?: string | null
          id?: string
          qua?: string | null
          qui?: string | null
          sab?: string | null
          salao_id: string
          seg?: string | null
          sex?: string | null
          ter?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          dom?: string | null
          geral?: string | null
          id?: string
          qua?: string | null
          qui?: string | null
          sab?: string | null
          salao_id?: string
          seg?: string | null
          sex?: string | null
          ter?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          auth_user_id: string | null
          created_at: string
          data_nascimento: string | null
          email: string | null
          id: string
          nome: string
          observacoes: string | null
          portal_account_id: string | null
          salao_id: string
          telefone: string | null
          ultima_visita: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          portal_account_id?: string | null
          salao_id: string
          telefone?: string | null
          ultima_visita?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          portal_account_id?: string | null
          salao_id?: string
          telefone?: string | null
          ultima_visita?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_portal_account_id_fkey"
            columns: ["portal_account_id"]
            isOneToOne: false
            referencedRelation: "portal_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_salao_id_fkey"
            columns: ["salao_id"]
            isOneToOne: false
            referencedRelation: "saloes"
            referencedColumns: ["id"]
          },
        ]
      }
      comissoes: {
        Row: {
          agendamento_id: string
          base_valor: number
          created_at: string
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          funcionario_id: string
          id: string
          pago_em: string | null
          salao_id: string
          taxa_percentual: number | null
          valor_calculado: number
          valor_fixo: number | null
        }
        Insert: {
          agendamento_id: string
          base_valor: number
          created_at?: string
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          funcionario_id: string
          id?: string
          pago_em?: string | null
          salao_id: string
          taxa_percentual?: number | null
          valor_calculado: number
          valor_fixo?: number | null
        }
        Update: {
          agendamento_id?: string
          base_valor?: number
          created_at?: string
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          funcionario_id?: string
          id?: string
          pago_em?: string | null
          salao_id?: string
          taxa_percentual?: number | null
          valor_calculado?: number
          valor_fixo?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "comissoes_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: true
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_salao_id_fkey"
            columns: ["salao_id"]
            isOneToOne: false
            referencedRelation: "saloes"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas_variaveis: {
        Row: {
          competencia: string
          created_at: string
          descricao: string
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          id: string
          pago_em: string | null
          salao_id: string
          updated_at: string
          valor: number
        }
        Insert: {
          competencia: string
          created_at?: string
          descricao: string
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          pago_em?: string | null
          salao_id: string
          updated_at?: string
          valor?: number
        }
        Update: {
          competencia?: string
          created_at?: string
          descricao?: string
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          pago_em?: string | null
          salao_id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      dias_funcionamento: {
        Row: {
          abre_em: string | null
          created_at: string
          dia_semana: number
          fecha_em: string | null
          fechado: boolean
          id: string
          intervalo_fim: string | null
          intervalo_inicio: string | null
          salao_id: string
          updated_at: string
        }
        Insert: {
          abre_em?: string | null
          created_at?: string
          dia_semana: number
          fecha_em?: string | null
          fechado?: boolean
          id?: string
          intervalo_fim?: string | null
          intervalo_inicio?: string | null
          salao_id: string
          updated_at?: string
        }
        Update: {
          abre_em?: string | null
          created_at?: string
          dia_semana?: number
          fecha_em?: string | null
          fechado?: boolean
          id?: string
          intervalo_fim?: string | null
          intervalo_inicio?: string | null
          salao_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dias_funcionamento_salao_id_fkey"
            columns: ["salao_id"]
            isOneToOne: false
            referencedRelation: "saloes"
            referencedColumns: ["id"]
          },
        ]
      }
      folha_salarial_mensal: {
        Row: {
          competencia: string
          created_at: string
          id: string
          salao_id: string
          updated_at: string
          valor: number
        }
        Insert: {
          competencia: string
          created_at?: string
          id?: string
          salao_id: string
          updated_at?: string
          valor?: number
        }
        Update: {
          competencia?: string
          created_at?: string
          id?: string
          salao_id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      funcionarios: {
        Row: {
          ativo: boolean
          auth_user_id: string | null
          carga: string | null
          comissao_percentual: number | null
          comissao_tipo: Database["public"]["Enums"]["comissao_tipo"]
          comissao_valor_fixo: number | null
          created_at: string
          data_admissao: string | null
          data_inatividade: string | null
          email: string | null
          id: string
          nome: string
          recebe_salario_fixo: boolean
          salao_id: string
          salario_fixo_mensal: number
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          auth_user_id?: string | null
          carga?: string | null
          comissao_percentual?: number | null
          comissao_tipo?: Database["public"]["Enums"]["comissao_tipo"]
          comissao_valor_fixo?: number | null
          created_at?: string
          data_admissao?: string | null
          data_inatividade?: string | null
          email?: string | null
          id?: string
          nome: string
          recebe_salario_fixo?: boolean
          salao_id: string
          salario_fixo_mensal?: number
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          auth_user_id?: string | null
          carga?: string | null
          comissao_percentual?: number | null
          comissao_tipo?: Database["public"]["Enums"]["comissao_tipo"]
          comissao_valor_fixo?: number | null
          created_at?: string
          data_admissao?: string | null
          data_inatividade?: string | null
          email?: string | null
          id?: string
          nome?: string
          recebe_salario_fixo?: boolean
          salao_id?: string
          salario_fixo_mensal?: number
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "funcionarios_salao_id_fkey"
            columns: ["salao_id"]
            isOneToOne: false
            referencedRelation: "saloes"
            referencedColumns: ["id"]
          },
        ]
      }
      horarios_funcionario: {
        Row: {
          almoco_fim: string | null
          almoco_inicio: string | null
          created_at: string
          dia_semana: number
          fim: string
          funcionario_id: string
          id: string
          inicio: string
          updated_at: string
        }
        Insert: {
          almoco_fim?: string | null
          almoco_inicio?: string | null
          created_at?: string
          dia_semana: number
          fim: string
          funcionario_id: string
          id?: string
          inicio: string
          updated_at?: string
        }
        Update: {
          almoco_fim?: string | null
          almoco_inicio?: string | null
          created_at?: string
          dia_semana?: number
          fim?: string
          funcionario_id?: string
          id?: string
          inicio?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "horarios_funcionario_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacoes_estoque: {
        Row: {
          created_at: string
          funcionario_id: string | null
          id: string
          observacao: string | null
          produto_id: string
          quantidade: number
          salao_id: string
          tipo: string
        }
        Insert: {
          created_at?: string
          funcionario_id?: string | null
          id?: string
          observacao?: string | null
          produto_id: string
          quantidade: number
          salao_id: string
          tipo: string
        }
        Update: {
          created_at?: string
          funcionario_id?: string | null
          id?: string
          observacao?: string | null
          produto_id?: string
          quantidade?: number
          salao_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_estoque_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_estoque_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_estoque_salao_id_fkey"
            columns: ["salao_id"]
            isOneToOne: false
            referencedRelation: "saloes"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos_salarios: {
        Row: {
          competencia: string
          created_at: string
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"]
          funcionario_id: string
          id: string
          pago_em: string
          salao_id: string
          updated_at: string
          valor: number
        }
        Insert: {
          competencia: string
          created_at?: string
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"]
          funcionario_id: string
          id?: string
          pago_em?: string
          salao_id: string
          updated_at?: string
          valor?: number
        }
        Update: {
          competencia?: string
          created_at?: string
          forma_pagamento?: Database["public"]["Enums"]["forma_pagamento"]
          funcionario_id?: string
          id?: string
          pago_em?: string
          salao_id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      portal_accounts: {
        Row: {
          created_at: string
          email: string
          email_normalized: string | null
          id: string
          password_hash: string
          salao_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          email_normalized?: string | null
          id?: string
          password_hash: string
          salao_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          email_normalized?: string | null
          id?: string
          password_hash?: string
          salao_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_accounts_salao_id_fkey"
            columns: ["salao_id"]
            isOneToOne: false
            referencedRelation: "saloes"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_password_resets: {
        Row: {
          created_at: string
          email: string
          email_normalized: string | null
          expires_at: string
          id: string
          reset_token_hash: string
          salao_id: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          email_normalized?: string | null
          expires_at: string
          id?: string
          reset_token_hash: string
          salao_id: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          email_normalized?: string | null
          expires_at?: string
          id?: string
          reset_token_hash?: string
          salao_id?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_password_resets_salao_id_fkey"
            columns: ["salao_id"]
            isOneToOne: false
            referencedRelation: "saloes"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          portal_account_id: string
          revoked_at: string | null
          salao_id: string
          session_token_hash: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          portal_account_id: string
          revoked_at?: string | null
          salao_id: string
          session_token_hash: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          portal_account_id?: string
          revoked_at?: string | null
          salao_id?: string
          session_token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_sessions_portal_account_id_fkey"
            columns: ["portal_account_id"]
            isOneToOne: false
            referencedRelation: "portal_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_sessions_salao_id_fkey"
            columns: ["salao_id"]
            isOneToOne: false
            referencedRelation: "saloes"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          ativo: boolean
          categoria: string | null
          created_at: string
          comissao_valor_fixo: number
          custo_medio: number
          estoque_atual: number
          estoque_minimo: number
          id: string
          nome: string
          preco_venda: number
          salao_id: string
          unidade: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          comissao_valor_fixo?: number
          custo_medio?: number
          estoque_atual?: number
          estoque_minimo?: number
          id?: string
          nome: string
          preco_venda?: number
          salao_id: string
          unidade?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          comissao_valor_fixo?: number
          custo_medio?: number
          estoque_atual?: number
          estoque_minimo?: number
          id?: string
          nome?: string
          preco_venda?: number
          salao_id?: string
          unidade?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produtos_salao_id_fkey"
            columns: ["salao_id"]
            isOneToOne: false
            referencedRelation: "saloes"
            referencedColumns: ["id"]
          },
        ]
      }
      recebimentos: {
        Row: {
          agendamento_id: string | null
          created_at: string
          forma: Database["public"]["Enums"]["forma_pagamento"]
          id: string
          salao_id: string
          valor: number
          venda_produto_id: string | null
        }
        Insert: {
          agendamento_id?: string | null
          created_at?: string
          forma: Database["public"]["Enums"]["forma_pagamento"]
          id?: string
          salao_id: string
          valor?: number
          venda_produto_id?: string | null
        }
        Update: {
          agendamento_id?: string | null
          created_at?: string
          forma?: Database["public"]["Enums"]["forma_pagamento"]
          id?: string
          salao_id?: string
          valor?: number
          venda_produto_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recebimentos_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: true
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimentos_venda_produto_id_fkey"
            columns: ["venda_produto_id"]
            isOneToOne: false
            referencedRelation: "vendas_produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      saloes: {
        Row: {
          agendamento_antecedencia_horas: number
          agendamento_antecedencia_modo: string
          created_at: string
          created_by_user_id: string | null
          endereco: string | null
          id: string
          logo_url: string | null
          nome: string
          public_booking_token: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          agendamento_antecedencia_horas?: number
          agendamento_antecedencia_modo?: string
          created_at?: string
          created_by_user_id?: string | null
          endereco?: string | null
          id?: string
          logo_url?: string | null
          nome: string
          public_booking_token?: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          agendamento_antecedencia_horas?: number
          agendamento_antecedencia_modo?: string
          created_at?: string
          created_by_user_id?: string | null
          endereco?: string | null
          id?: string
          logo_url?: string | null
          nome?: string
          public_booking_token?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      servicos: {
        Row: {
          ativo: boolean
          created_at: string
          duracao_minutos: number
          id: string
          nome: string
          salao_id: string
          updated_at: string
          valor: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          duracao_minutos: number
          id?: string
          nome: string
          salao_id: string
          updated_at?: string
          valor: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          duracao_minutos?: number
          id?: string
          nome?: string
          salao_id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "servicos_salao_id_fkey"
            columns: ["salao_id"]
            isOneToOne: false
            referencedRelation: "saloes"
            referencedColumns: ["id"]
          },
        ]
      }
      servicos_funcionarios: {
        Row: {
          created_at: string
          funcionario_id: string
          id: string
          servico_id: string
        }
        Insert: {
          created_at?: string
          funcionario_id: string
          id?: string
          servico_id: string
        }
        Update: {
          created_at?: string
          funcionario_id?: string
          id?: string
          servico_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "servicos_funcionarios_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicos_funcionarios_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          salao_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          salao_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          salao_id?: string
          user_id?: string
        }
        Relationships: []
      }
      vendas_produtos: {
        Row: {
          cliente_nome: string | null
          comissao_funcionario: number
          created_at: string
          custo_unitario: number
          forma_pagamento: string | null
          funcionario_id: string
          id: string
          lucro_bruto: number
          preco_unitario: number
          produto_id: string
          quantidade: number
          salao_id: string
          total_custo: number
          total_venda: number
        }
        Insert: {
          cliente_nome?: string | null
          comissao_funcionario?: number
          created_at?: string
          custo_unitario: number
          forma_pagamento?: string | null
          funcionario_id: string
          id?: string
          lucro_bruto: number
          preco_unitario: number
          produto_id: string
          quantidade: number
          salao_id: string
          total_custo: number
          total_venda: number
        }
        Update: {
          cliente_nome?: string | null
          comissao_funcionario?: number
          created_at?: string
          custo_unitario?: number
          forma_pagamento?: string | null
          funcionario_id?: string
          id?: string
          lucro_bruto?: number
          preco_unitario?: number
          produto_id?: string
          quantidade?: number
          salao_id?: string
          total_custo?: number
          total_venda?: number
        }
        Relationships: [
          {
            foreignKeyName: "vendas_produtos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_produtos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_produtos_salao_id_fkey"
            columns: ["salao_id"]
            isOneToOne: false
            referencedRelation: "saloes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_bootstrap_first_admin: {
        Args: { _user_id: string }
        Returns: boolean
      }
      clientes_nomes_current_salao: {
        Args: never
        Returns: {
          id: string
          nome: string
        }[]
      }
      clientes_profissional_list: {
        Args: never
        Returns: {
          id: string
          nome: string
        }[]
      }
      current_salao_id: { Args: never; Returns: string }
      funcionarios_public_by_ids: {
        Args: { _ids: string[] }
        Returns: {
          id: string
          nome: string
        }[]
      }
      has_customer_access: { Args: { _salao_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role_in_current_salao: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      portal_agendamentos_ocupados_public: {
        Args: { _dia: string; _funcionario_id: string; _salao_id: string }
        Returns: {
          data_hora_inicio: string
          id: string
          total_duracao_minutos: number
        }[]
      }
      portal_cancel_agendamento: {
        Args: { _agendamento_id: string }
        Returns: {
          id: string
          status: Database["public"]["Enums"]["agendamento_status"]
        }[]
      }
      portal_find_cliente_by_email: {
        Args: { _email: string; _salao_id: string }
        Returns: {
          id: string
          nome: string
        }[]
      }
      portal_horarios_funcionario_public: {
        Args: { _funcionario_id: string; _salao_id: string }
        Returns: {
          almoco_fim: string
          almoco_inicio: string
          dia_semana: number
          fim: string
          inicio: string
        }[]
      }
      portal_link_cliente_by_email: {
        Args: { _email: string; _salao_id: string; _user_id: string }
        Returns: string
      }
      portal_salao_by_token: {
        Args: { _token: string }
        Returns: {
          agendamento_antecedencia_horas: number
          agendamento_antecedencia_modo: string
          id: string
          logo_url: string
          nome: string
        }[]
      }
    }
    Enums: {
      agendamento_status: "marcado" | "confirmado" | "concluido" | "cancelado"
      app_role:
        | "admin"
        | "staff"
        | "customer"
        | "gerente"
        | "profissional"
        | "recepcionista"
      comissao_tipo: "percentual" | "fixo"
      forma_pagamento: "pix" | "dinheiro" | "cartao"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      agendamento_status: ["marcado", "confirmado", "concluido", "cancelado"],
      app_role: [
        "admin",
        "staff",
        "customer",
        "gerente",
        "profissional",
        "recepcionista",
      ],
      comissao_tipo: ["percentual", "fixo"],
      forma_pagamento: ["pix", "dinheiro", "cartao"],
    },
  },
} as const

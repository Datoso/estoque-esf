import Dexie, { type Table } from 'dexie';

export interface Categoria { id: number; nome: string; ordem: number }

export interface Produto {
  id: number;
  categoria_id: number | null;
  tipo: 'insumo' | 'vacina';
  nome: string;
  principio_ativo: string | null;
  unidade_medida: string;
  preco_custo: number;
  doses_por_frasco: number | null;
  prazo_apos_abertura_h: number | null;
}

export interface Lote {
  id: number;
  produto_id: number;
  numero: string;
  validade: string; // AAAA-MM-DD
  status: 'liberado' | 'quarentena' | 'bloqueado';
  custo_unitario: number | null;
}

/** Saldo por lote como o servidor conhece (já inclui tudo o que foi confirmado). */
export interface SaldoServidor { lote_id: number; saldo: number }

export interface Parametro {
  produto_id: number;
  estoque_minimo: number;
  tempo_reposicao_dias: number;
  cmm_manual: number | null;
  favorito: boolean;
  cmm: number; // consumo médio mensal (view consumo_mensal)
}

export interface Pedido { id: number; numero: number; status: string; criado_em: string }
export interface PedidoItem { id: number; pedido_id: number; produto_id: number; qtd_sugerida: number; qtd_pedida: number; qtd_recebida: number }
export interface Embalagem { id: number; produto_id: number; nome: string; fator_conversao: number }
export interface Configuracao { margem_seguranca_meses: number; periodo_cobertura_meses: number; semaforo_amarelo_dias: number; semaforo_vermelho_dias: number }

/** Movimentação criada no aparelho e ainda não confirmada pelo servidor. */
export interface MovPendente {
  id: string; // UUID gerado no aparelho (chave idempotente no servidor)
  grupo: string; // uma baixa pode usar vários lotes (FEFO); o grupo permite desfazer tudo junto
  unidade_id: number;
  lote_id: number;
  tipo: 'saida' | 'entrada' | 'perda' | 'estorno';
  quantidade: number; // negativa para saída
  motivo: string | null;
  excecao_fefo: boolean;
  ref_estorno_id: string | null;
  usuario_id: string;
  dispositivo_id: string;
  seq_local: number;
  criado_em_dispositivo: string;
  status: 'pendente' | 'enviado' | 'erro';
  erro?: string;
}

/** Histórico local das baixas confirmadas, para permitir "desfazer" depois de sincronizar. */
export interface MovConfirmada { id: string; grupo: string; lote_id: number; quantidade: number; criado_em_dispositivo: string; usuario_id: string }

export interface Meta { chave: string; valor: unknown }

class BancoLocal extends Dexie {
  categorias!: Table<Categoria, number>;
  produtos!: Table<Produto, number>;
  lotes!: Table<Lote, number>;
  saldos!: Table<SaldoServidor, number>;
  parametros!: Table<Parametro, number>;
  fila!: Table<MovPendente, string>;
  confirmadas!: Table<MovConfirmada, string>;
  pedidos!: Table<Pedido, number>;
  pedidoItens!: Table<PedidoItem, number>;
  embalagens!: Table<Embalagem, number>;
  meta!: Table<Meta, string>;

  constructor() {
    super('estoque-esf');
    this.version(1).stores({
      categorias: 'id',
      produtos: 'id, categoria_id, tipo',
      lotes: 'id, produto_id, validade',
      saldos: 'lote_id',
      parametros: 'produto_id',
      fila: 'id, seq_local, status, grupo',
      confirmadas: 'id, grupo',
      meta: 'chave'
    });
    this.version(2).stores({
      pedidos: 'id, numero, status',
      pedidoItens: 'id, pedido_id, produto_id',
      embalagens: 'id, produto_id'
    });
  }
}

export const db = new BancoLocal();

export async function lerMeta<T>(chave: string): Promise<T | undefined> {
  const m = await db.meta.get(chave);
  return m?.valor as T | undefined;
}

export async function gravarMeta(chave: string, valor: unknown): Promise<void> {
  await db.meta.put({ chave, valor });
}

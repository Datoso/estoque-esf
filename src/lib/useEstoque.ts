import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Configuracao, type Pedido, type PedidoItem } from './db';
import { diasAte, entraNaReposicao, faixa, lotesFefo, pontoPedido, quantidadeSugerida, saldosPorLote, type Faixa, type LoteSaldo } from './estoque';

export interface ItemEstoque {
  id: number;
  nome: string;
  tipo: 'insumo' | 'vacina';
  unidade: string;
  categoriaId: number | null;
  categoria: string;
  disponivel: number;
  minimo: number;
  favorito: boolean;
  repor: boolean;
  pior: Faixa;
  custo: number;
  lotes: LoteSaldo[]; // todos com saldo > 0
  fefo: LoteSaldo[]; // utilizáveis, em ordem
  cmm: number;
  ponto: number;
  transito: number;
  sugerida: number;
  embalagem: { nome: string; fator: number } | null;
}

export interface PedidoVis extends Pedido { itens: (PedidoItem & { nome: string; unidade: string })[] }

export interface Estoque {
  carregado: boolean;
  itens: ItemEstoque[];
  categorias: { id: number; nome: string }[];
  pendentes: number;
  comErro: number;
  pedidos: PedidoVis[];
  config: Configuracao;
}

const CONFIG_PADRAO: Configuracao = { margem_seguranca_meses: 0.5, periodo_cobertura_meses: 2, semaforo_amarelo_dias: 60, semaforo_vermelho_dias: 30 };

export function useEstoque(): Estoque {
  const dados = useLiveQuery(async () => {
    const [categorias, produtos, lotes, saldos, parametros, fila, pedidos, pedidoItens, embalagens, cfg] = await Promise.all([
      db.categorias.orderBy('id').toArray(),
      db.produtos.toArray(),
      db.lotes.toArray(),
      db.saldos.toArray(),
      db.parametros.toArray(),
      db.fila.toArray(),
      db.pedidos.orderBy('numero').reverse().toArray(),
      db.pedidoItens.toArray(),
      db.embalagens.toArray(),
      db.meta.get('configuracao')
    ]);
    return { categorias, produtos, lotes, saldos, parametros, fila, pedidos, pedidoItens, embalagens, config: (cfg?.valor as Configuracao | undefined) ?? CONFIG_PADRAO };
  }, []);

  if (!dados) return { carregado: false, itens: [], categorias: [], pendentes: 0, comErro: 0, pedidos: [], config: CONFIG_PADRAO };

  const { categorias, produtos, lotes, saldos, parametros, fila, pedidos, pedidoItens, embalagens, config } = dados;
  const abertos = new Set(pedidos.filter(p => p.status !== 'recebido' && p.status !== 'cancelado').map(p => p.id));
  const transitoPor = new Map<number, number>();
  for (const i of pedidoItens) if (abertos.has(i.pedido_id)) transitoPor.set(i.produto_id, (transitoPor.get(i.produto_id) ?? 0) + Math.max(0, i.qtd_pedida - i.qtd_recebida));
  const embPor = new Map(embalagens.map(e => [e.produto_id, { nome: e.nome, fator: e.fator_conversao }]));
  const saldo = saldosPorLote(saldos, fila);
  const nomeCat = new Map(categorias.map(c => [c.id, c.nome]));
  const ordemCat = new Map(categorias.map(c => [c.id, c.ordem]));
  const param = new Map(parametros.map(p => [p.produto_id, p]));

  const itens: ItemEstoque[] = produtos.map(p => {
    const ls: LoteSaldo[] = lotes
      .filter(l => l.produto_id === p.id)
      .map(l => ({ id: l.id, produto_id: l.produto_id, numero: l.numero, validade: l.validade, status: l.status, saldo: saldo.get(l.id) ?? 0 }))
      .filter(l => l.saldo > 0)
      .sort((a, b) => (a.validade < b.validade ? -1 : 1));
    const fefo = lotesFefo(ls);
    const disponivel = fefo.reduce((s, l) => s + l.saldo, 0);
    const pr = param.get(p.id);
    const pior = ls.length ? faixa(Math.min(...ls.map(l => diasAte(l.validade))), config.semaforo_amarelo_dias, config.semaforo_vermelho_dias) : 'verde';
    const cmm = pr?.cmm ?? 0;
    const ponto = pontoPedido(cmm, pr?.tempo_reposicao_dias ?? 15, config.margem_seguranca_meses, pr?.estoque_minimo ?? 0);
    const transito = transitoPor.get(p.id) ?? 0;
    const embalagem = embPor.get(p.id) ?? null;
    return {
      id: p.id,
      nome: p.nome,
      tipo: p.tipo,
      unidade: p.unidade_medida,
      categoriaId: p.categoria_id,
      categoria: (p.categoria_id && nomeCat.get(p.categoria_id)) || 'Sem categoria',
      disponivel,
      minimo: pr?.estoque_minimo ?? 0,
      favorito: pr?.favorito ?? false,
      repor: entraNaReposicao(disponivel, transito, ponto),
      pior,
      custo: p.preco_custo,
      lotes: ls,
      fefo,
      cmm,
      ponto,
      transito,
      sugerida: quantidadeSugerida(cmm, config.periodo_cobertura_meses, disponivel, transito, embalagem?.fator ?? 1),
      embalagem
    };
  }).sort((a, b) => ((ordemCat.get(a.categoriaId ?? -1) ?? 99) - (ordemCat.get(b.categoriaId ?? -1) ?? 99)) || a.nome.localeCompare(b.nome, 'pt'));

  return {
    carregado: true,
    itens,
    categorias: categorias.sort((a, b) => a.ordem - b.ordem).map(c => ({ id: c.id, nome: c.nome })),
    pendentes: fila.filter(m => m.status === 'pendente').length,
    comErro: fila.filter(m => m.status === 'erro').length,
    pedidos: pedidos.map(p => ({
      ...p,
      itens: pedidoItens.filter(i => i.pedido_id === p.id).map(i => {
        const prod = produtos.find(x => x.id === i.produto_id);
        return { ...i, nome: prod?.nome ?? 'Produto', unidade: prod?.unidade_medida ?? '' };
      })
    })),
    config
  };
}

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { diasAte, faixa, lotesFefo, precisaRepor, saldosPorLote, type Faixa, type LoteSaldo } from './estoque';

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
}

export interface Estoque {
  carregado: boolean;
  itens: ItemEstoque[];
  categorias: { id: number; nome: string }[];
  pendentes: number;
  comErro: number;
}

export function useEstoque(): Estoque {
  const dados = useLiveQuery(async () => {
    const [categorias, produtos, lotes, saldos, parametros, fila] = await Promise.all([
      db.categorias.orderBy('id').toArray(),
      db.produtos.toArray(),
      db.lotes.toArray(),
      db.saldos.toArray(),
      db.parametros.toArray(),
      db.fila.toArray()
    ]);
    return { categorias, produtos, lotes, saldos, parametros, fila };
  }, []);

  if (!dados) return { carregado: false, itens: [], categorias: [], pendentes: 0, comErro: 0 };

  const { categorias, produtos, lotes, saldos, parametros, fila } = dados;
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
    const pior = ls.length ? faixa(Math.min(...ls.map(l => diasAte(l.validade)))) : 'verde';
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
      repor: precisaRepor(disponivel, pr?.estoque_minimo ?? 0),
      pior,
      custo: p.preco_custo,
      lotes: ls,
      fefo
    };
  }).sort((a, b) => ((ordemCat.get(a.categoriaId ?? -1) ?? 99) - (ordemCat.get(b.categoriaId ?? -1) ?? 99)) || a.nome.localeCompare(b.nome, 'pt'));

  return {
    carregado: true,
    itens,
    categorias: categorias.sort((a, b) => a.ordem - b.ordem).map(c => ({ id: c.id, nome: c.nome })),
    pendentes: fila.filter(m => m.status === 'pendente').length,
    comErro: fila.filter(m => m.status === 'erro').length
  };
}

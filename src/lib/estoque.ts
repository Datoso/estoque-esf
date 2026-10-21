/** Regras de estoque puras (sem banco, sem rede) — cobertas por testes em estoque.test.ts. */

export type Faixa = 'vencido' | 'vermelho' | 'amarelo' | 'verde';

export interface LoteSaldo { id: number; produto_id: number; numero: string; validade: string; status: string; saldo: number }

export const HOJE_ISO = () => new Date().toLocaleDateString('sv-SE'); // AAAA-MM-DD no fuso do aparelho

/** Dias entre hoje e a validade. Validade é o último dia de uso: no dia seguinte já está vencido. */
export function diasAte(validade: string, hoje: string = HOJE_ISO()): number {
  return Math.round((Date.parse(validade + 'T00:00:00Z') - Date.parse(hoje + 'T00:00:00Z')) / 864e5);
}

export function faixa(dias: number, amarelo = 60, vermelho = 30): Faixa {
  if (dias < 0) return 'vencido';
  if (dias <= vermelho) return 'vermelho';
  if (dias <= amarelo) return 'amarelo';
  return 'verde';
}

/** RN03: saldo = o que o servidor confirmou + o que ainda está na fila do aparelho. */
export function saldosPorLote(
  servidor: { lote_id: number; saldo: number }[],
  pendentes: { lote_id: number; quantidade: number }[]
): Map<number, number> {
  const m = new Map<number, number>();
  for (const s of servidor) m.set(s.lote_id, (m.get(s.lote_id) ?? 0) + s.saldo);
  for (const p of pendentes) m.set(p.lote_id, (m.get(p.lote_id) ?? 0) + p.quantidade);
  return m;
}

/** Lotes utilizáveis de um produto, na ordem FEFO (vence primeiro, sai primeiro). RN01, RN08. */
export function lotesFefo(lotes: LoteSaldo[], hoje: string = HOJE_ISO()): LoteSaldo[] {
  return lotes
    .filter(l => l.status === 'liberado' && l.saldo > 0 && diasAte(l.validade, hoje) >= 0)
    .sort((a, b) => (a.validade === b.validade ? a.id - b.id : a.validade < b.validade ? -1 : 1));
}

export interface ParteBaixa { lote_id: number; quantidade: number }

/** Divide uma baixa entre os lotes pelo FEFO. Lança erro se faltar saldo utilizável. */
export function planejarBaixa(lotesOrdenados: LoteSaldo[], qtd: number): ParteBaixa[] {
  if (!Number.isInteger(qtd) || qtd <= 0) throw new Error('Quantidade inválida');
  const total = lotesOrdenados.reduce((s, l) => s + l.saldo, 0);
  if (qtd > total) throw new Error(`Saldo insuficiente: há ${total} disponível`);
  const partes: ParteBaixa[] = [];
  let falta = qtd;
  for (const l of lotesOrdenados) {
    if (falta <= 0) break;
    const usa = Math.min(falta, l.saldo);
    partes.push({ lote_id: l.id, quantidade: usa });
    falta -= usa;
  }
  return partes;
}

/** Item precisa de reposição quando o disponível chega ao estoque mínimo (MVP, antes do CMM). */
export function precisaRepor(disponivel: number, estoqueMinimo: number): boolean {
  return estoqueMinimo > 0 && disponivel <= estoqueMinimo;
}

export function normalizar(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Busca tolerante: ignora acento e caixa; aceita até 1 letra errada em palavras de 5+ letras. */
export function casaBusca(texto: string, termo: string): boolean {
  const t = normalizar(texto);
  const q = normalizar(termo.trim());
  if (!q) return true;
  if (t.includes(q)) return true;
  if (q.length < 5) return false;
  return t.split(/\s+/).some(p => distancia(p.slice(0, q.length), q) <= 1);
}

function distancia(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

export function formatarData(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

export function formatarNumero(n: number): string {
  return n.toLocaleString('pt-BR');
}

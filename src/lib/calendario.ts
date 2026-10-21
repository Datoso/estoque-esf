/** Regras puras do calendário (sem banco, sem rede). Datas sempre como string 'AAAA-MM-DD'. */

export type TipoEvento = 'venc' | 'camp' | 'pedido' | 'dia';

export interface EventoCal { data: string; tipo: TipoEvento; titulo: string; sub: string }

export interface ItemCal { nome: string; unidade: string; lotes: { numero: string; validade: string; saldo: number }[] }
export interface PedidoCal { numero: number; status: string; criado_em: string; itens: { nome: string; qtd_pedida: number; qtd_recebida: number; unidade: string }[] }
export interface CampanhaCal { nome: string; tipo?: string; publico_alvo?: string | null; inicio: string; fim: string; meta?: number | null }
export interface AgendaCal { data: string; titulo: string; tipo: string; descricao?: string | null }

export const ROTULO_TIPO: Record<TipoEvento, string> = {
  venc: 'Vencimento',
  camp: 'Campanha',
  pedido: 'Pedido',
  dia: 'Agenda da equipe'
};

/** Ordem de prioridade dos pontinhos e da lista do dia. */
const ORDEM: Record<TipoEvento, number> = { venc: 0, dia: 1, camp: 2, pedido: 3 };

const STATUS_PEDIDO: Record<string, string> = { enviado: 'Enviado', atendido: 'Atendido', parcial: 'Parcial', recebido: 'Recebido' };

export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const DIAS_SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

const pad = (n: number) => String(n).padStart(2, '0');
const fmtNum = (n: number) => n.toLocaleString('pt-BR');

export function isoDe(ano: number, mes: number, dia: number): string {
  return `${ano}-${pad(mes)}-${pad(dia)}`;
}

/** Converte um ISO com hora (ex.: criado_em) para o dia local 'AAAA-MM-DD'. Strings já curtas passam direto. */
export function diaLocal(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  return isoDe(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function diasNoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/** 0 = domingo. */
export function diaDaSemana(iso: string): number {
  return new Date(iso + 'T00:00:00Z').getUTCDay();
}

export function somarDias(iso: string, n: number): string {
  const d = new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5);
  return isoDe(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function somarMeses(ano: number, mes: number, n: number): { ano: number; mes: number } {
  const t = ano * 12 + (mes - 1) + n;
  return { ano: Math.floor(t / 12), mes: (t % 12 + 12) % 12 + 1 };
}

/** "Sábado, 24 de outubro" (acrescenta o ano se diferente de anoRef). */
export function dataPorExtenso(iso: string, anoRef?: number): string {
  const [a, m, d] = iso.split('-').map(Number);
  const base = `${DIAS_SEMANA[diaDaSemana(iso)]}, ${d} de ${MESES[m - 1]}`;
  return anoRef !== undefined && anoRef !== a ? `${base} de ${a}` : base;
}

/** "24 out" */
export function dataCurta(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MESES[m - 1].slice(0, 3)}`;
}

export function nomeDoMes(ano: number, mes: number): string {
  const n = MESES[mes - 1];
  return `${n[0].toUpperCase()}${n.slice(1)} de ${ano}`;
}

export function montarEventos({ itens, pedidos, campanhas, eventos }: {
  itens: ItemCal[];
  pedidos: PedidoCal[];
  campanhas: CampanhaCal[];
  eventos: AgendaCal[];
}): EventoCal[] {
  const out: EventoCal[] = [];

  for (const it of itens)
    for (const l of it.lotes) {
      if (!(l.saldo > 0)) continue;
      out.push({ data: l.validade, tipo: 'venc', titulo: `Vence: ${it.nome}`, sub: `Lote ${l.numero} · ${fmtNum(l.saldo)} ${it.unidade}` });
    }

  for (const p of pedidos) {
    const status = STATUS_PEDIDO[p.status] ?? p.status;
    const itensTxt = p.itens.map(i => `${i.nome} (${fmtNum(i.qtd_pedida)} ${i.unidade})`).join(', ');
    out.push({
      data: diaLocal(p.criado_em),
      tipo: 'pedido',
      titulo: `Pedido #${pad3(p.numero)} ao almoxarifado`,
      sub: itensTxt ? `${status} · ${itensTxt}` : status
    });
  }

  for (const c of campanhas) {
    const publico = c.publico_alvo ? ` · ${c.publico_alvo}` : '';
    out.push({ data: c.inicio, tipo: 'camp', titulo: `Início: ${c.nome}`, sub: `Campanha até ${br(c.fim)}${publico}` });
    if (c.fim !== c.inicio) out.push({ data: c.fim, tipo: 'camp', titulo: `Fim: ${c.nome}`, sub: `Último dia da campanha${publico}` });
  }

  for (const e of eventos) {
    const rotulo = e.tipo === 'dia_d' ? 'Dia D' : e.tipo === 'equipe' ? 'Equipe' : 'Agenda';
    out.push({ data: e.data, tipo: 'dia', titulo: e.titulo, sub: e.descricao ? `${rotulo} · ${e.descricao}` : rotulo });
  }

  return ordenar(out);
}

function pad3(n: number) { return String(n).padStart(3, '0'); }
function br(iso: string) { const [a, m, d] = iso.split('-'); return `${d}/${m}/${a}`; }

function ordenar(ev: EventoCal[]): EventoCal[] {
  return [...ev].sort((a, b) =>
    a.data !== b.data ? (a.data < b.data ? -1 : 1) : ORDEM[a.tipo] - ORDEM[b.tipo] || a.titulo.localeCompare(b.titulo, 'pt-BR'));
}

/** Semanas do mês (domingo primeiro). Células fora do mês são null. Sempre múltiplo de 7. */
export function gradeDoMes(ano: number, mes: number): (string | null)[][] {
  const primeiro = isoDe(ano, mes, 1);
  const vazios = diaDaSemana(primeiro);
  const total = diasNoMes(ano, mes);
  const cel: (string | null)[] = Array(vazios).fill(null);
  for (let d = 1; d <= total; d++) cel.push(isoDe(ano, mes, d));
  while (cel.length % 7) cel.push(null);
  const semanas: (string | null)[][] = [];
  for (let i = 0; i < cel.length; i += 7) semanas.push(cel.slice(i, i + 7));
  return semanas;
}

/** Eventos de um dia + "Em andamento" para campanhas que cobrem o dia (sem contar início e fim). */
export function eventosDoDia(eventos: EventoCal[], campanhas: CampanhaCal[], iso: string): EventoCal[] {
  const doDia = eventos.filter(e => e.data === iso);
  const andamento: EventoCal[] = campanhas
    .filter(c => c.inicio < iso && iso < c.fim)
    .map(c => ({ data: iso, tipo: 'camp', titulo: `Em andamento: ${c.nome}`, sub: `Campanha de ${br(c.inicio)} a ${br(c.fim)}` }));
  return ordenar([...doDia, ...andamento]);
}

/** Tipos distintos presentes em cada dia (para os pontinhos), na ordem de prioridade. */
export function tiposPorDia(eventos: EventoCal[], campanhas: CampanhaCal[] = []): Map<string, TipoEvento[]> {
  const m = new Map<string, Set<TipoEvento>>();
  const add = (d: string, t: TipoEvento) => { if (!m.has(d)) m.set(d, new Set()); m.get(d)!.add(t); };
  for (const e of eventos) add(e.data, e.tipo);
  for (const c of campanhas) for (let d = somarDias(c.inicio, 1), n = 0; d < c.fim && n < 400; d = somarDias(d, 1), n++) add(d, 'camp');
  const out = new Map<string, TipoEvento[]>();
  for (const [d, s] of m) out.set(d, [...s].sort((a, b) => ORDEM[a] - ORDEM[b]));
  return out;
}

/** Eventos de hoje até hoje+dias (inclusive), ordenados, no máximo `limite`. */
export function proximos(eventos: EventoCal[], hojeIso: string, dias = 30, limite = 8): EventoCal[] {
  const ate = somarDias(hojeIso, dias);
  return ordenar(eventos.filter(e => e.data >= hojeIso && e.data <= ate)).slice(0, limite);
}

import { describe, expect, it } from 'vitest';
import { dataPorExtenso, eventosDoDia, gradeDoMes, montarEventos, nomeDoMes, proximos, somarMeses, tiposPorDia } from './calendario';

const campanhas = [{ nome: 'Influenza', publico_alvo: 'Idosos', inicio: '2026-10-10', fim: '2026-10-31' }];
const base = montarEventos({
  itens: [
    { nome: 'Seringa 3 ml', unidade: 'un', lotes: [{ numero: 'A1', validade: '2026-10-24', saldo: 1200 }, { numero: 'Z', validade: '2026-10-25', saldo: 0 }] },
    { nome: 'Gaze', unidade: 'pct', lotes: [{ numero: 'G9', validade: '2027-03-01', saldo: 4 }] }
  ],
  pedidos: [{ numero: 7, status: 'parcial', criado_em: '2026-10-05T12:00:00', itens: [{ nome: 'Gaze', qtd_pedida: 10, qtd_recebida: 4, unidade: 'pct' }] }],
  campanhas,
  eventos: [{ data: '2026-10-24', titulo: 'Dia D da Influenza', tipo: 'dia_d', descricao: null }]
});

describe('gradeDoMes', () => {
  it('outubro/2026 começa numa quinta e fecha em múltiplo de 7', () => {
    const g = gradeDoMes(2026, 10);
    expect(g[0].slice(0, 4)).toEqual([null, null, null, null]);
    expect(g[0][4]).toBe('2026-10-01');
    expect(g.flat().length % 7).toBe(0);
    expect(g.flat().filter(Boolean)).toHaveLength(31);
    expect(g.at(-1)!.includes('2026-10-31')).toBe(true);
  });
  it('fevereiro: 28 dias em 2026 e 29 em 2028', () => {
    const f26 = gradeDoMes(2026, 2);
    expect(f26.flat().filter(Boolean)).toHaveLength(28);
    expect(f26).toHaveLength(4); // 1/2/2026 é domingo: 4 semanas exatas
    expect(f26[0][0]).toBe('2026-02-01');
    expect(gradeDoMes(2028, 2).flat().filter(Boolean)).toHaveLength(29);
  });
});

describe('montarEventos', () => {
  it('gera vencimentos só de lotes com saldo, pedido, início/fim de campanha e agenda', () => {
    expect(base.filter(e => e.tipo === 'venc')).toHaveLength(2);
    expect(base.find(e => e.tipo === 'venc')).toMatchObject({ data: '2026-10-24', titulo: 'Vence: Seringa 3 ml', sub: 'Lote A1 · 1.200 un' });
    expect(base.find(e => e.tipo === 'pedido')).toMatchObject({ data: '2026-10-05', titulo: 'Pedido #007 ao almoxarifado' });
    expect(base.find(e => e.tipo === 'pedido')!.sub).toContain('Parcial');
    expect(base.filter(e => e.tipo === 'camp').map(e => e.data)).toEqual(['2026-10-10', '2026-10-31']);
    expect(base.find(e => e.tipo === 'dia')!.sub).toBe('Dia D');
  });
});

describe('eventosDoDia', () => {
  it('junta eventos do dia com campanha em andamento', () => {
    const d = eventosDoDia(base, campanhas, '2026-10-24');
    expect(d.map(e => e.tipo)).toEqual(['venc', 'dia', 'camp']);
    expect(d[2].titulo).toBe('Em andamento: Influenza');
  });
  it('não marca "em andamento" no início nem no fim', () => {
    expect(eventosDoDia(base, campanhas, '2026-10-10').some(e => e.titulo.startsWith('Em andamento'))).toBe(false);
    expect(eventosDoDia(base, campanhas, '2026-10-31').some(e => e.titulo.startsWith('Em andamento'))).toBe(false);
    expect(eventosDoDia(base, campanhas, '2026-11-02')).toEqual([]);
  });
  it('tiposPorDia inclui pontinho de campanha nos dias intermediários', () => {
    const t = tiposPorDia(base, campanhas);
    expect(t.get('2026-10-24')).toEqual(['venc', 'dia', 'camp']);
    expect(t.get('2026-10-15')).toEqual(['camp']);
  });
});

describe('proximos', () => {
  it('filtra janela de 30 dias, ordena e limita', () => {
    const p = proximos(base, '2026-10-21');
    expect(p.map(e => e.data)).toEqual(['2026-10-24', '2026-10-24', '2026-10-31']);
    expect(proximos(base, '2026-10-01', 30, 2)).toHaveLength(2);
    expect(proximos(base, '2026-10-01', 30, 2)[0].tipo).toBe('pedido');
  });
});

describe('formatação', () => {
  it('datas por extenso e navegação de mês', () => {
    expect(dataPorExtenso('2026-10-24')).toBe('Sábado, 24 de outubro');
    expect(dataPorExtenso('2027-01-01', 2026)).toBe('Sexta-feira, 1 de janeiro de 2027');
    expect(nomeDoMes(2026, 10)).toBe('Outubro de 2026');
    expect(somarMeses(2026, 12, 1)).toEqual({ ano: 2027, mes: 1 });
    expect(somarMeses(2026, 1, -1)).toEqual({ ano: 2025, mes: 12 });
  });
});

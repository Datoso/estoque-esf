import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, type Produto } from './db';
import type { Perfil } from './sync';
import {
  descartarSobra, dosesDaVacina, dosesRestantes, foraDaFaixa, formatarDuracao, planoDose, registrarAplicacao, registrarLeitura,
  statusCampanha, validarLeitura, venceFrascoEm
} from './vacinas';

const perfil: Perfil = { user_id: 'u1', unidade_id: 1, unidade_nome: 'ESF Centro', perfil: 'tecnico', nome: 'Teste' };
const vacina = (id: number, nome: string, dpf: number, prazoH: number | null): Produto => ({
  id, categoria_id: null, tipo: 'vacina', nome, principio_ativo: null, unidade_medida: 'dose', preco_custo: 0, doses_por_frasco: dpf, prazo_apos_abertura_h: prazoH
});
const T0 = new Date('2026-10-21T08:00:00Z');
const escolha = { dose: 'Dose anual', grupo: 'Idoso (60+)', campanha_id: null };

beforeEach(async () => {
  await db.delete();
  await db.open();
  await db.produtos.bulkAdd([vacina(1, 'Influenza trivalente', 10, 6), vacina(2, 'HPV4', 1, null)]);
  await db.lotes.bulkAdd([
    { id: 100, produto_id: 1, numero: 'FLU-B', validade: '2099-06-01', status: 'liberado', custo_unitario: null },
    { id: 101, produto_id: 1, numero: 'FLU-A', validade: '2099-01-01', status: 'liberado', custo_unitario: null },
    { id: 200, produto_id: 2, numero: 'HPV-1', validade: '2099-01-01', status: 'liberado', custo_unitario: null }
  ]);
  await db.saldos.bulkAdd([{ lote_id: 100, saldo: 20 }, { lote_id: 101, saldo: 20 }, { lote_id: 200, saldo: 5 }]);
});

describe('frasco multidose (RN10)', () => {
  it('1ª dose abre frasco do lote FEFO e gera uma saída de doses_por_frasco', async () => {
    const r = await registrarAplicacao(perfil, 1, escolha, T0);
    const fila = await db.fila.toArray();
    expect(fila).toHaveLength(1);
    expect(fila[0]).toMatchObject({ lote_id: 101, tipo: 'saida', quantidade: -10 });
    const frascos = await db.frascos.toArray();
    expect(frascos).toHaveLength(1);
    expect(frascos[0]).toMatchObject({ lote_id: 101, doses_iniciais: 10, encerrado_em: null });
    expect(r.aplicacao.frasco_id).toBe(frascos[0].id);
    expect(r.restantes).toBe(9);
  });

  it('2ª dose sai do frasco aberto sem nova saída de estoque', async () => {
    await registrarAplicacao(perfil, 1, escolha, T0);
    const r = await registrarAplicacao(perfil, 1, escolha, new Date(T0.getTime() + 10 * 60e3));
    expect(await db.fila.count()).toBe(1);
    expect(await db.frascos.count()).toBe(1);
    expect(r.abriu).toBeNull();
    expect(r.restantes).toBe(8);
    const [f] = await db.frascos.toArray();
    expect(dosesRestantes(f, await db.aplicacoes.toArray())).toBe(8);
  });

  it('frasco vencido vira perda técnica e abre outro', async () => {
    await registrarAplicacao(perfil, 1, escolha, T0);
    await registrarAplicacao(perfil, 1, escolha, new Date(T0.getTime() + 60e3));
    const depois = new Date(T0.getTime() + 7 * 3600e3); // prazo de 6 h
    const r = await registrarAplicacao(perfil, 1, escolha, depois);
    expect(r.encerrados).toHaveLength(1);
    expect(r.encerrados[0]).toMatchObject({ motivo: 'prazo_vencido', perdidas: 8 });
    const frascos = await db.frascos.toArray();
    const velho = frascos.find(f => f.encerrado_em)!;
    expect(velho).toMatchObject({ motivo_encerramento: 'prazo_vencido', doses_perdidas: 8 });
    expect(frascos.filter(f => !f.encerrado_em)).toHaveLength(1);
    expect(await db.fila.count()).toBe(2); // segundo frasco saiu do estoque
  });

  it('frasco esgotado é encerrado na última dose', async () => {
    for (let i = 0; i < 10; i++) await registrarAplicacao(perfil, 1, escolha, new Date(T0.getTime() + i * 60e3));
    const [f] = await db.frascos.toArray();
    expect(f).toMatchObject({ motivo_encerramento: 'esgotado', doses_perdidas: 0 });
  });

  it('descartar sobra encerra com as doses restantes como perda', async () => {
    const r = await registrarAplicacao(perfil, 1, escolha, T0);
    const perdidas = await descartarSobra(perfil, r.abriu!.id, new Date(T0.getTime() + 3600e3));
    expect(perdidas).toBe(9);
    expect(await db.frascos.get(r.abriu!.id)).toMatchObject({ motivo_encerramento: 'descartado', doses_perdidas: 9 });
  });

  it('vacFila em ordem: abrir_frasco antes da aplicação; encerrar antes do novo frasco', async () => {
    await registrarAplicacao(perfil, 1, escolha, T0);
    await registrarAplicacao(perfil, 1, escolha, new Date(T0.getTime() + 7 * 3600e3));
    const ops = await db.vacFila.orderBy('seq').toArray();
    expect(ops.map(o => o.tipo)).toEqual(['abrir_frasco', 'aplicacao', 'encerrar_frasco', 'abrir_frasco', 'aplicacao']);
    const seqs = ops.map(o => o.seq);
    expect([...seqs].sort((a, b) => a - b)).toEqual(seqs);
    expect(new Set(seqs).size).toBe(seqs.length);
  });
});

describe('unidose', () => {
  it('cada aplicação gera saída de 1 dose do lote FEFO, sem frasco', async () => {
    const r = await registrarAplicacao(perfil, 2, { dose: 'Dose única', grupo: '5 a 19 anos', campanha_id: null }, T0);
    const fila = await db.fila.toArray();
    expect(fila).toHaveLength(1);
    expect(fila[0]).toMatchObject({ lote_id: 200, quantidade: -1, tipo: 'saida' });
    expect(r.aplicacao.frasco_id).toBeNull();
    expect(await db.frascos.count()).toBe(0);
  });

  it('sem saldo recusa a dose', async () => {
    await db.saldos.put({ lote_id: 200, saldo: 0 });
    await expect(registrarAplicacao(perfil, 2, { dose: 'Dose única', grupo: 'Gestante', campanha_id: null }, T0)).rejects.toThrow(/Sem doses/);
  });
});

describe('regras puras', () => {
  it('restantes = iniciais − aplicações do frasco', () => {
    const f = { id: 'f1', doses_iniciais: 5 };
    expect(dosesRestantes(f, [{ frasco_id: 'f1' }, { frasco_id: 'f2' }, { frasco_id: 'f1' }, { frasco_id: null }])).toBe(3);
    expect(dosesRestantes(f, Array(7).fill({ frasco_id: 'f1' }))).toBe(0);
  });

  it('plano: abrir frasco quando não há ativo; usar o ativo quando válido', () => {
    const p = { doses_por_frasco: 10, prazo_apos_abertura_h: 6 };
    const lote = { id: 1, produto_id: 1, numero: 'A', validade: '2099-01-01', status: 'liberado', saldo: 30 };
    expect(planoDose(p, [lote], null, 0, null, T0.getTime())).toMatchObject({ modo: 'abrir', doses: 10 });
    const f = { id: 'x', produto_id: 1, lote_id: 1, aberto_em: T0.toISOString(), doses_iniciais: 10, encerrado_em: null, motivo_encerramento: null, doses_perdidas: 0 };
    expect(planoDose(p, [lote], f, 4, '2099-01-01', T0.getTime() + 3600e3)).toMatchObject({ modo: 'frasco', restantes: 4 });
    expect(venceFrascoEm(f, 6, '2099-01-01')).toBe(T0.getTime() + 6 * 3600e3);
  });

  it('leitura fora da faixa 2–8 °C é detectada', () => {
    expect(foraDaFaixa({ atual: 5, minima: 3.2, maxima: 7.8 })).toBe(false);
    expect(foraDaFaixa({ atual: 5, minima: 1.5, maxima: 7 })).toBe(true);
    expect(foraDaFaixa({ atual: 8.4, minima: 4, maxima: 9 })).toBe(true);
    expect(validarLeitura(5, 6, 7)).toMatch(/mínima/);
    expect(validarLeitura(null, 2, 3)).toMatch(/Preencha/);
    expect(validarLeitura(5, 3, 7)).toBeNull();
  });

  it('registrar leitura grava local e na fila', async () => {
    const l = await registrarLeitura(perfil, { atual: 9.04, minima: 4, maxima: 9.5 }, T0);
    expect(l.atual).toBe(9);
    expect(foraDaFaixa(l)).toBe(true);
    expect((await db.vacFila.toArray()).map(o => o.tipo)).toEqual(['leitura']);
    await expect(registrarLeitura(perfil, { atual: 3, minima: 4, maxima: 5 })).rejects.toThrow();
  });

  it('doses por vacina, status de campanha e duração', () => {
    expect(dosesDaVacina('Vacina Influenza trivalente')).toEqual(['Dose anual', '1ª dose', '2ª dose']);
    expect(dosesDaVacina('Tríplice viral (SCR)')).toEqual(['1ª dose', '2ª dose']);
    expect(dosesDaVacina('Pneumocócica 23')).toEqual(['Dose única', 'Reforço']);
    expect(statusCampanha({ inicio: '2026-10-01', fim: '2026-10-31' }, '2026-10-21')).toBe('andamento');
    expect(statusCampanha({ inicio: '2026-11-01', fim: '2026-11-30' }, '2026-10-21')).toBe('agendada');
    expect(formatarDuracao(2 * 3600e3 + 10 * 60e3)).toBe('2 h 10 min');
  });
});

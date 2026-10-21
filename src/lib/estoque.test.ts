import { describe, expect, it } from 'vitest';
import { casaBusca, diasAte, faixa, lotesFefo, planejarBaixa, precisaRepor, saldosPorLote, type LoteSaldo } from './estoque';

const HOJE = '2026-10-20';
const lote = (id: number, validade: string, saldo: number, status = 'liberado'): LoteSaldo =>
  ({ id, produto_id: 1, numero: 'L' + id, validade, status, saldo });

describe('validade e semáforo', () => {
  it('conta dias até a validade', () => {
    expect(diasAte('2026-10-20', HOJE)).toBe(0);
    expect(diasAte('2026-11-19', HOJE)).toBe(30);
    expect(diasAte('2026-10-19', HOJE)).toBe(-1);
  });
  it('classifica nas faixas padrão (60 e 30 dias)', () => {
    expect(faixa(-1)).toBe('vencido');
    expect(faixa(0)).toBe('vermelho');
    expect(faixa(30)).toBe('vermelho');
    expect(faixa(31)).toBe('amarelo');
    expect(faixa(60)).toBe('amarelo');
    expect(faixa(61)).toBe('verde');
  });
});

describe('saldo derivado (RN03)', () => {
  it('soma servidor e fila do aparelho', () => {
    const m = saldosPorLote([{ lote_id: 1, saldo: 10 }, { lote_id: 2, saldo: 5 }], [{ lote_id: 1, quantidade: -3 }, { lote_id: 3, quantidade: 7 }]);
    expect(m.get(1)).toBe(7);
    expect(m.get(2)).toBe(5);
    expect(m.get(3)).toBe(7);
  });
});

describe('FEFO (RN01, RN08)', () => {
  it('ordena pela validade e ignora vencido, bloqueado e zerado', () => {
    const r = lotesFefo([
      lote(1, '2027-05-01', 10),
      lote(2, '2026-10-19', 10), // vencido
      lote(3, '2026-11-01', 0), // zerado
      lote(4, '2026-12-01', 5, 'bloqueado'),
      lote(5, '2026-11-15', 4)
    ], HOJE);
    expect(r.map(l => l.id)).toEqual([5, 1]);
  });
  it('divide a baixa entre lotes começando pelo que vence primeiro', () => {
    const r = planejarBaixa([lote(5, '2026-11-15', 4), lote(1, '2027-05-01', 10)], 6);
    expect(r).toEqual([{ lote_id: 5, quantidade: 4 }, { lote_id: 1, quantidade: 2 }]);
  });
  it('recusa quantidade maior que o disponível', () => {
    expect(() => planejarBaixa([lote(1, '2027-01-01', 3)], 4)).toThrow('Saldo insuficiente');
  });
  it('recusa quantidade zero ou fracionada', () => {
    expect(() => planejarBaixa([lote(1, '2027-01-01', 3)], 0)).toThrow();
    expect(() => planejarBaixa([lote(1, '2027-01-01', 3)], 1.5)).toThrow();
  });
});

describe('reposição e busca', () => {
  it('pede reposição no mínimo ou abaixo', () => {
    expect(precisaRepor(80, 80)).toBe(true);
    expect(precisaRepor(81, 80)).toBe(false);
    expect(precisaRepor(0, 0)).toBe(false);
  });
  it('busca sem acento e com 1 erro de digitação', () => {
    expect(casaBusca('Álcool 70% 1 L', 'alcool')).toBe(true);
    expect(casaBusca('Dipirona 500 mg/ml amp.', 'dipiroma')).toBe(true);
    expect(casaBusca('Seringa 5 ml', 'luva')).toBe(false);
  });
});

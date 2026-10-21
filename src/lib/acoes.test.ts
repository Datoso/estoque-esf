import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { desfazerBaixa, registrarBaixa } from './acoes';
import { saldosPorLote, type LoteSaldo } from './estoque';
import type { Perfil } from './sync';

const perfil: Perfil = { user_id: 'u1', unidade_id: 1, unidade_nome: 'ESF Centro', perfil: 'tecnico', nome: 'Teste' };
const lotes: LoteSaldo[] = [
  { id: 10, produto_id: 1, numero: 'A', validade: '2099-01-01', status: 'liberado', saldo: 4 },
  { id: 11, produto_id: 1, numero: 'B', validade: '2099-06-01', status: 'liberado', saldo: 10 }
];

beforeEach(async () => { await db.delete(); await db.open(); });

describe('baixa offline e desfazer', () => {
  it('grava na fila dividindo por lote, com UUID e sequência crescente', async () => {
    await registrarBaixa(perfil, lotes, 6);
    const fila = await db.fila.orderBy('seq_local').toArray();
    expect(fila.map(m => [m.lote_id, m.quantidade])).toEqual([[10, -4], [11, -2]]);
    expect(new Set(fila.map(m => m.id)).size).toBe(2);
    expect(fila[1].seq_local).toBeGreaterThan(fila[0].seq_local);
    const s = saldosPorLote([{ lote_id: 10, saldo: 4 }, { lote_id: 11, saldo: 10 }], fila);
    expect([s.get(10), s.get(11)]).toEqual([0, 8]);
  });

  it('desfazer antes de enviar só cancela no aparelho', async () => {
    const g = await registrarBaixa(perfil, lotes, 2);
    expect(await desfazerBaixa(perfil, g)).toBe('cancelada');
    expect(await db.fila.count()).toBe(0);
  });

  it('desfazer depois de enviado gera estorno positivo ligado à baixa original', async () => {
    const g = await registrarBaixa(perfil, lotes, 2);
    const [m] = await db.fila.toArray();
    await db.fila.update(m.id, { status: 'enviado' });
    expect(await desfazerBaixa(perfil, g)).toBe('estornada');
    const estorno = (await db.fila.toArray()).find(x => x.tipo === 'estorno')!;
    expect(estorno.quantidade).toBe(2);
    expect(estorno.ref_estorno_id).toBe(m.id);
  });
});

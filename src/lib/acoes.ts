import { db, type MovPendente } from './db';
import { planejarBaixa, type LoteSaldo } from './estoque';
import { dispositivoId, proximaSequencia, type Perfil } from './sync';

async function novaMov(perfil: Perfil, grupo: string, base: Pick<MovPendente, 'lote_id' | 'tipo' | 'quantidade' | 'motivo' | 'ref_estorno_id'> & { excecao_fefo?: boolean }): Promise<MovPendente> {
  return {
    id: crypto.randomUUID(),
    grupo,
    unidade_id: perfil.unidade_id,
    lote_id: base.lote_id,
    tipo: base.tipo,
    quantidade: base.quantidade,
    motivo: base.motivo,
    excecao_fefo: base.excecao_fefo ?? false,
    ref_estorno_id: base.ref_estorno_id,
    usuario_id: perfil.user_id,
    dispositivo_id: await dispositivoId(),
    seq_local: await proximaSequencia(),
    criado_em_dispositivo: new Date().toISOString(),
    status: 'pendente'
  };
}

/** Baixa pelo FEFO. Grava só no aparelho; a sincronização envia depois (RF26). Devolve o grupo para desfazer. */
export async function registrarBaixa(perfil: Perfil, lotesFefo: LoteSaldo[], quantidade: number): Promise<string> {
  const partes = planejarBaixa(lotesFefo, quantidade);
  const grupo = crypto.randomUUID();
  const movs: MovPendente[] = [];
  for (const p of partes) {
    movs.push(await novaMov(perfil, grupo, { lote_id: p.lote_id, tipo: 'saida', quantidade: -p.quantidade, motivo: 'Uso no atendimento', ref_estorno_id: null }));
  }
  await db.fila.bulkAdd(movs);
  return grupo;
}

const JANELA_DESFAZER_MS = 5 * 60 * 1000;

/**
 * RF10: desfaz a última baixa do próprio usuário neste aparelho em até 5 minutos.
 * Se ainda não saiu do aparelho, cancela; se já foi ao servidor, registra estorno (RN02: nada é apagado lá).
 */
export async function desfazerBaixa(perfil: Perfil, grupo: string): Promise<'cancelada' | 'estornada' | 'expirada'> {
  const naFila = await db.fila.where('grupo').equals(grupo).toArray();
  const confirmadas = await db.confirmadas.where('grupo').equals(grupo).toArray();
  const primeira = [...naFila, ...confirmadas].sort((a, b) => a.criado_em_dispositivo.localeCompare(b.criado_em_dispositivo))[0];
  if (!primeira || Date.now() - Date.parse(primeira.criado_em_dispositivo) > JANELA_DESFAZER_MS) return 'expirada';

  const aindaLocais = naFila.filter(m => m.status === 'pendente');
  const jaEnviadas = [...naFila.filter(m => m.status !== 'pendente'), ...confirmadas];

  if (jaEnviadas.length === 0) {
    await db.fila.bulkDelete(aindaLocais.map(m => m.id));
    return 'cancelada';
  }
  const grupoEstorno = crypto.randomUUID();
  const estornos: MovPendente[] = [];
  for (const m of [...aindaLocais, ...jaEnviadas]) {
    estornos.push(await novaMov(perfil, grupoEstorno, { lote_id: m.lote_id, tipo: 'estorno', quantidade: -m.quantidade, motivo: 'Baixa desfeita', ref_estorno_id: m.id }));
  }
  await db.fila.bulkAdd(estornos);
  await db.confirmadas.bulkDelete(confirmadas.map(m => m.id));
  return 'estornada';
}

/** Perda de lote vencido para descarte (RF11/RF17). Fica marcada para aprovação na próxima etapa (RF50). */
export async function registrarPerdaVencido(perfil: Perfil, lote: LoteSaldo): Promise<void> {
  if (lote.saldo <= 0) return;
  const grupo = crypto.randomUUID();
  await db.fila.add(await novaMov(perfil, grupo, { lote_id: lote.id, tipo: 'perda', quantidade: -lote.saldo, motivo: 'Vencido · descarte', ref_estorno_id: null }));
}

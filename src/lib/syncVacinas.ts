/**
 * Sincronização da vacinação (frascos abertos, doses aplicadas, leituras de temperatura).
 * Chamado por sync.ts depois de enviar a fila de estoque e antes de baixar os cadastros.
 * Nunca lança: falha aqui não pode impedir o resto da sincronização.
 */
import { db, gravarMeta, type FrascoAberto, type LeituraTemperatura, type VacOp } from './db';
import { supabase } from './supabase';
import type { AplicacaoLocal } from './vacinas';

const ehErroDeRede = (msg: string) => /fetch|network|Failed|timeout|offline/i.test(msg);

async function enviarOp(op: VacOp): Promise<{ message: string } | null> {
  const p = op.payload;
  switch (op.tipo) {
    case 'abrir_frasco': {
      const { error } = await supabase.from('frasco_aberto').upsert(
        { id: p.id, unidade_id: p.unidade_id, lote_id: p.lote_id, produto_id: p.produto_id, aberto_em: p.aberto_em, doses_iniciais: p.doses_iniciais },
        { onConflict: 'id', ignoreDuplicates: true }
      );
      return error;
    }
    case 'encerrar_frasco': {
      // Só encerra se ainda estiver aberto: não sobrescreve um encerramento feito em outro aparelho
      const { error } = await supabase.from('frasco_aberto')
        .update({ encerrado_em: p.encerrado_em, motivo_encerramento: p.motivo_encerramento, doses_perdidas: p.doses_perdidas })
        .eq('id', p.id as string)
        .is('encerrado_em', null);
      return error;
    }
    case 'aplicacao': {
      const { error } = await supabase.from('aplicacao_vacina').upsert(
        { id: p.id, unidade_id: p.unidade_id, produto_id: p.produto_id, lote_id: p.lote_id, frasco_id: p.frasco_id, dose: p.dose, grupo: p.grupo, campanha_id: p.campanha_id, dispositivo_id: p.dispositivo_id, criado_em_dispositivo: p.criado_em_dispositivo },
        { onConflict: 'id', ignoreDuplicates: true }
      );
      return error;
    }
    case 'leitura': {
      const { error } = await supabase.from('leitura_temperatura').upsert(
        { id: p.id, unidade_id: p.unidade_id, atual: p.atual, minima: p.minima, maxima: p.maxima, lida_em: p.lida_em },
        { onConflict: 'id', ignoreDuplicates: true }
      );
      return error;
    }
  }
}

/** Envia a fila de vacinação na ordem em que aconteceu (seq). */
export async function enviarFilaVacinas(): Promise<{ enviados: number; erros: number }> {
  const ops = await db.vacFila.where('status').equals('pendente').sortBy('seq');
  let enviados = 0;
  let erros = 0;
  for (const op of ops) {
    let error: { message: string } | null;
    try {
      error = await enviarOp(op);
    } catch (e) {
      error = { message: (e as Error).message || 'network' };
    }
    if (error) {
      if (ehErroDeRede(error.message)) break; // sem internet: tenta na próxima
      await db.vacFila.update(op.id, { status: 'erro', erro: error.message });
      erros++;
      continue;
    }
    await db.transaction('rw', [db.vacFila, db.aplicacoes, db.leituras], async () => {
      if (op.tipo === 'aplicacao') await db.aplicacoes.update(op.payload.id as string, { enviado: true });
      if (op.tipo === 'leitura') await db.leituras.update(op.payload.id as string, { enviado: true });
      await db.vacFila.delete(op.id);
    });
    enviados++;
  }
  return { enviados, erros };
}

type FrascoServidor = FrascoAberto;
const CAMPOS_FRASCO = 'id, produto_id, lote_id, aberto_em, doses_iniciais, encerrado_em, motivo_encerramento, doses_perdidas';
const CAMPOS_APLIC = 'id, produto_id, lote_id, frasco_id, dose, grupo, campanha_id, dispositivo_id, criado_em_dispositivo';

/** Baixa frascos ativos, histórico recente e a lista de vacinas por campanha, sem apagar o que está pendente. */
export async function puxarVacinas(unidadeId: number): Promise<void> {
  const fila = await db.vacFila.toArray();
  const comPendencia = new Set(fila.filter(o => o.tipo === 'abrir_frasco' || o.tipo === 'encerrar_frasco').map(o => o.payload.id as string));
  const locaisAtivos = (await db.frascos.toArray()).filter(f => !f.encerrado_em && !comPendencia.has(f.id)).map(f => f.id);
  const desde = new Date(Date.now() - 30 * 864e5).toISOString();

  const [ativos, conferir, perdas, aplic, leit, campVac] = await Promise.all([
    supabase.from('frasco_aberto').select(CAMPOS_FRASCO).eq('unidade_id', unidadeId).is('encerrado_em', null),
    locaisAtivos.length ? supabase.from('frasco_aberto').select(CAMPOS_FRASCO).in('id', locaisAtivos) : Promise.resolve({ data: [] as FrascoServidor[], error: null }),
    supabase.from('frasco_aberto').select(CAMPOS_FRASCO).eq('unidade_id', unidadeId).gt('doses_perdidas', 0).gte('encerrado_em', desde).order('encerrado_em', { ascending: false }).limit(30),
    supabase.from('aplicacao_vacina').select(CAMPOS_APLIC).eq('unidade_id', unidadeId).order('criado_em_dispositivo', { ascending: false }).limit(30),
    supabase.from('leitura_temperatura').select('id, atual, minima, maxima, lida_em').eq('unidade_id', unidadeId).order('lida_em', { ascending: false }).limit(10),
    supabase.from('campanha_vacina').select('campanha_id, produto_id')
  ]);
  const erro = ativos.error ?? conferir.error ?? perdas.error ?? aplic.error ?? leit.error;
  if (erro) throw new Error(erro.message);

  // Doses de frascos ativos abertos em outros aparelhos: necessárias para contar as restantes
  const idsAtivos = (ativos.data ?? []).map(f => f.id as string);
  const doFrasco = idsAtivos.length
    ? await supabase.from('aplicacao_vacina').select(CAMPOS_APLIC).in('frasco_id', idsAtivos)
    : { data: [] as AplicacaoLocal[], error: null };
  if (doFrasco.error) throw new Error(doFrasco.error.message);

  const frascos = new Map<string, FrascoServidor>();
  for (const f of [...(perdas.data ?? []), ...(conferir.data ?? []), ...(ativos.data ?? [])] as FrascoServidor[]) frascos.set(f.id, f);
  const aplicacoes = [...(aplic.data ?? []), ...(doFrasco.data ?? [])] as AplicacaoLocal[];

  await db.transaction('rw', [db.frascos, db.aplicacoes, db.leituras, db.vacFila], async () => {
    // Recalcula a pendência dentro da transação (pode ter surgido uma ação nova)
    const pend = new Set((await db.vacFila.toArray()).map(o => o.payload.id as string));
    for (const f of frascos.values()) {
      if (pend.has(f.id)) continue;
      await db.frascos.put({ ...f, doses_iniciais: Number(f.doses_iniciais), doses_perdidas: Number(f.doses_perdidas ?? 0) });
    }
    for (const a of aplicacoes) {
      if (await db.aplicacoes.get(a.id)) continue; // a cópia local é a mesma (imutável)
      await db.aplicacoes.put({ ...a, enviado: true });
    }
    for (const l of (leit.data ?? []) as Omit<LeituraTemperatura, 'enviado'>[]) {
      if (await db.leituras.get(l.id)) continue;
      await db.leituras.put({ id: l.id, atual: Number(l.atual), minima: Number(l.minima), maxima: Number(l.maxima), lida_em: l.lida_em, enviado: true });
    }
  });
  if (!campVac.error) await gravarMeta('campanha_vacinas', campVac.data ?? []);
}

export async function sincronizarVacinas(unidadeId: number): Promise<void> {
  try {
    const { erros } = await enviarFilaVacinas();
    await gravarMeta('vac_erros_envio', erros);
    await puxarVacinas(unidadeId);
    await gravarMeta('vac_ultima_sync', new Date().toISOString());
  } catch (e) {
    // Não trava o restante da sincronização de estoque; a tela mostra o que ficou pendente
    await gravarMeta('vac_ultimo_erro', (e as Error).message);
  }
}

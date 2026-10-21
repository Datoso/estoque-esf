import { db, gravarMeta, lerMeta, type MovPendente } from './db';
import { supabase } from './supabase';

export interface Perfil { user_id: string; unidade_id: number; unidade_nome: string; perfil: string; nome: string }

/** Identificador estável deste aparelho (RNF16: ordem por aparelho + sequência local). */
export async function dispositivoId(): Promise<string> {
  let id = await lerMeta<string>('dispositivo_id');
  if (!id) {
    id = crypto.randomUUID();
    await gravarMeta('dispositivo_id', id);
  }
  return id;
}

export async function proximaSequencia(): Promise<number> {
  return db.transaction('rw', db.meta, async () => {
    const atual = (await lerMeta<number>('seq_local')) ?? 0;
    await gravarMeta('seq_local', atual + 1);
    return atual + 1;
  });
}

/** Perfil do usuário logado. Guardado no aparelho para funcionar sem internet. */
export async function carregarPerfil(userId: string, nome: string): Promise<Perfil | null> {
  if (navigator.onLine) {
    const { data, error } = await supabase
      .from('usuario_perfil')
      .select('perfil, unidade_id, unidade:unidade_id ( nome )')
      .eq('user_id', userId)
      .not('unidade_id', 'is', null)
      .limit(1);
    if (!error && data && data.length) {
      const linha = data[0] as unknown as { perfil: string; unidade_id: number; unidade: { nome: string } | null };
      const perfil: Perfil = { user_id: userId, unidade_id: linha.unidade_id, unidade_nome: linha.unidade?.nome ?? 'Unidade', perfil: linha.perfil, nome };
      await gravarMeta('perfil', perfil);
      return perfil;
    }
  }
  const salvo = await lerMeta<Perfil>('perfil');
  return salvo && salvo.user_id === userId ? salvo : null;
}

/** Envia a fila em ordem. O id (UUID) torna o envio idempotente: reenviar não duplica a baixa. */
export async function enviarFila(): Promise<{ enviados: number; erros: number }> {
  const pendentes = await db.fila.where('status').equals('pendente').sortBy('seq_local');
  let enviados = 0;
  let erros = 0;
  for (let i = 0; i < pendentes.length; i += 50) {
    const lote = pendentes.slice(i, i + 50);
    const linhas = lote.map(paraServidor);
    const { error } = await supabase.from('movimentacao').upsert(linhas, { onConflict: 'id', ignoreDuplicates: true });
    if (error) {
      // Erro de rede: para e tenta depois. Erro de regra (RLS/validação): marca para revisão sem travar a fila.
      if (/fetch|network|Failed/i.test(error.message)) break;
      for (const m of lote) await db.fila.update(m.id, { status: 'erro', erro: error.message });
      erros += lote.length;
      continue;
    }
    // Fica na fila como "enviado" até o saldo novo do servidor chegar (evita contar em dobro ou piscar)
    await db.transaction('rw', db.fila, db.confirmadas, async () => {
      for (const m of lote) {
        await db.fila.update(m.id, { status: 'enviado' });
        if (m.tipo === 'saida') {
          await db.confirmadas.put({ id: m.id, grupo: m.grupo, lote_id: m.lote_id, quantidade: m.quantidade, criado_em_dispositivo: m.criado_em_dispositivo, usuario_id: m.usuario_id });
        }
      }
    });
    enviados += lote.length;
  }
  return { enviados, erros };
}

function paraServidor(m: MovPendente) {
  return {
    id: m.id,
    unidade_id: m.unidade_id,
    lote_id: m.lote_id,
    tipo: m.tipo,
    quantidade: m.quantidade,
    motivo: m.motivo,
    excecao_fefo: m.excecao_fefo,
    ref_estorno_id: m.ref_estorno_id,
    usuario_id: m.usuario_id,
    dispositivo_id: m.dispositivo_id,
    seq_local: m.seq_local,
    criado_em_dispositivo: m.criado_em_dispositivo
  };
}

/** Baixa cadastros e saldos da unidade e troca a cópia local. */
export async function puxarDados(unidadeId: number): Promise<void> {
  const [cat, prod, lot, sal, par] = await Promise.all([
    supabase.from('categoria').select('id, nome, ordem'),
    supabase.from('produto').select('id, categoria_id, tipo, nome, principio_ativo, unidade_medida, preco_custo, doses_por_frasco, prazo_apos_abertura_h').eq('ativo', true),
    supabase.from('lote').select('id, produto_id, numero, validade, status, custo_unitario'),
    supabase.from('saldo_lote').select('lote_id, saldo').eq('unidade_id', unidadeId),
    supabase.from('parametro_estoque').select('produto_id, estoque_minimo, tempo_reposicao_dias, cmm_manual, favorito').eq('unidade_id', unidadeId)
  ]);
  const erro = cat.error ?? prod.error ?? lot.error ?? sal.error ?? par.error;
  if (erro) throw new Error(erro.message);
  await db.transaction('rw', [db.categorias, db.produtos, db.lotes, db.saldos, db.parametros, db.fila], async () => {
    // O saldo do servidor já inclui o que foi enviado: tira da fila na mesma transação
    await db.fila.where('status').equals('enviado').delete();
    await Promise.all([db.categorias.clear(), db.produtos.clear(), db.lotes.clear(), db.saldos.clear(), db.parametros.clear()]);
    await db.categorias.bulkPut(cat.data ?? []);
    await db.produtos.bulkPut((prod.data ?? []).map(p => ({ ...p, preco_custo: Number(p.preco_custo) })));
    await db.lotes.bulkPut((lot.data ?? []).map(l => ({ ...l, custo_unitario: l.custo_unitario == null ? null : Number(l.custo_unitario) })));
    await db.saldos.bulkPut(sal.data ?? []);
    await db.parametros.bulkPut((par.data ?? []).map(p => ({ ...p, cmm_manual: p.cmm_manual == null ? null : Number(p.cmm_manual) })));
  });
  await gravarMeta('ultima_sincronizacao', new Date().toISOString());
}

let emAndamento: Promise<void> | null = null;

/** Envia primeiro e depois baixa, para o saldo do servidor já incluir o que acabou de subir. */
export function sincronizar(unidadeId: number): Promise<void> {
  if (!navigator.onLine) return Promise.resolve();
  if (!emAndamento) {
    emAndamento = (async () => {
      try {
        await enviarFila();
        await puxarDados(unidadeId);
      } finally {
        emAndamento = null;
      }
    })();
  }
  return emAndamento;
}

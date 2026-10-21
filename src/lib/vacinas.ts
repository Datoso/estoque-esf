/**
 * Módulo de vacinação: regras puras (testadas em vacinas.test.ts) e ações offline.
 * Tudo grava primeiro no aparelho (db.frascos / db.aplicacoes / db.leituras + db.vacFila);
 * as saídas de estoque (frasco aberto ou dose unitária) entram na fila comum (db.fila).
 * Nenhum dado do paciente é guardado aqui (RN12): o registro nominal fica no e-SUS APS.
 */
import { db, type AplicacaoVacina, type Campanha, type FrascoAberto, type LeituraTemperatura, type MovPendente, type Produto, type VacOp } from './db';
import { lotesFefo, normalizar, saldosPorLote, type LoteSaldo } from './estoque';
import { dispositivoId, proximaSequencia, type Perfil } from './sync';

/* ---------------------------------------------------------------- Regras puras */

export const GRUPOS = ['Criança (< 5 anos)', '5 a 19 anos', 'Adulto (20 a 59)', 'Idoso (60+)', 'Gestante', 'Trabalhador da saúde'] as const;

const DOSES: { chaves: string[]; doses: string[] }[] = [
  { chaves: ['influenza', 'gripe'], doses: ['Dose anual', '1ª dose', '2ª dose'] },
  { chaves: ['triplice viral', 'scr'], doses: ['1ª dose', '2ª dose'] },
  { chaves: ['febre amarela'], doses: ['Dose única', 'Reforço'] },
  { chaves: ['hepatite b'], doses: ['1ª dose', '2ª dose', '3ª dose'] },
  { chaves: ['dupla adulto', 'dt '], doses: ['1ª dose', '2ª dose', '3ª dose', 'Reforço'] },
  { chaves: ['hpv'], doses: ['Dose única'] }
];

/** Opções de dose conforme a vacina (pelo nome do produto). */
export function dosesDaVacina(nome: string): string[] {
  const n = normalizar(nome) + ' ';
  return DOSES.find(d => d.chaves.some(c => n.includes(c)))?.doses ?? ['Dose única', 'Reforço'];
}

/** Uma aplicação local pode carregar o aparelho de origem (para contar "doses deste aparelho"). */
export type AplicacaoLocal = AplicacaoVacina & { dispositivo_id?: string };

/** Doses restantes = doses iniciais − aplicações ligadas ao frasco. */
export function dosesRestantes(frasco: Pick<FrascoAberto, 'id' | 'doses_iniciais'>, aplicacoes: Pick<AplicacaoVacina, 'frasco_id'>[]): number {
  const usadas = aplicacoes.filter(a => a.frasco_id === frasco.id).length;
  return Math.max(0, frasco.doses_iniciais - usadas);
}

/**
 * Momento (ms) em que o frasco deixa de poder ser usado: aberto_em + prazo após abertura,
 * limitado ao último dia de validade do lote. Null = sem prazo cadastrado e sem validade.
 */
export function venceFrascoEm(frasco: Pick<FrascoAberto, 'aberto_em'>, prazoH: number | null, validadeLote?: string | null): number | null {
  const porPrazo = prazoH && prazoH > 0 ? Date.parse(frasco.aberto_em) + prazoH * 3600e3 : null;
  const porLote = validadeLote ? new Date(validadeLote + 'T23:59:59').getTime() : null;
  if (porPrazo == null) return porLote;
  if (porLote == null) return porPrazo;
  return Math.min(porPrazo, porLote);
}

export function frascoVencido(frasco: Pick<FrascoAberto, 'aberto_em'>, prazoH: number | null, validadeLote: string | null | undefined, agora: number): boolean {
  const v = venceFrascoEm(frasco, prazoH, validadeLote);
  return v != null && agora >= v;
}

/** "2 h 10 min", "45 min", "3 dias e 4 h" */
export function formatarDuracao(ms: number): string {
  const min = Math.max(0, Math.floor(ms / 60000));
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  if (d > 0) return h ? `${d} ${d === 1 ? 'dia' : 'dias'} e ${h} h` : `${d} ${d === 1 ? 'dia' : 'dias'}`;
  if (h > 0) return m ? `${h} h ${m} min` : `${h} h`;
  return `${m} min`;
}

/** "usar em até 6 horas" / "usar em até 28 dias" */
export function formatarPrazo(prazoH: number | null): string {
  if (!prazoH || prazoH <= 0) return 'sem prazo cadastrado após abertura';
  if (prazoH >= 48 && prazoH % 24 === 0) return `usar em até ${prazoH / 24} dias`;
  return `usar em até ${prazoH} ${prazoH === 1 ? 'hora' : 'horas'}`;
}

export type Encerramento = { frasco: FrascoAberto; motivo: 'esgotado' | 'prazo_vencido' | 'descartado'; perdidas: number };

export type PlanoDose =
  | { modo: 'unidose'; lote: LoteSaldo }
  | { modo: 'frasco'; frasco: FrascoAberto; restantes: number; encerrar?: undefined }
  | { modo: 'abrir'; lote: LoteSaldo; doses: number; encerrar?: Encerramento }
  | { modo: 'sem_estoque'; encerrar?: Encerramento };

/**
 * RN10: de onde sai a próxima dose.
 * - unidose: 1 dose do lote FEFO;
 * - multidose: do frasco ativo válido; se não houver (ou venceu/esgotou), abre um frasco do lote FEFO.
 */
export function planoDose(
  produto: Pick<Produto, 'doses_por_frasco' | 'prazo_apos_abertura_h'>,
  fefo: LoteSaldo[],
  ativo: FrascoAberto | null,
  restantes: number,
  validadeLoteAtivo: string | null | undefined,
  agora: number
): PlanoDose {
  const dpf = produto.doses_por_frasco ?? 1;
  if (dpf <= 1) return fefo[0] ? { modo: 'unidose', lote: fefo[0] } : { modo: 'sem_estoque' };
  let encerrar: Encerramento | undefined;
  if (ativo) {
    if (frascoVencido(ativo, produto.prazo_apos_abertura_h, validadeLoteAtivo, agora)) encerrar = { frasco: ativo, motivo: 'prazo_vencido', perdidas: restantes };
    else if (restantes <= 0) encerrar = { frasco: ativo, motivo: 'esgotado', perdidas: 0 };
    else return { modo: 'frasco', frasco: ativo, restantes };
  }
  const lote = fefo[0];
  if (!lote) return { modo: 'sem_estoque', encerrar };
  return { modo: 'abrir', lote, doses: Math.min(dpf, lote.saldo), encerrar };
}

/** RN11: fora de 2–8 °C em qualquer das medidas. */
export function foraDaFaixa(l: Pick<LeituraTemperatura, 'atual' | 'minima' | 'maxima'>): boolean {
  return l.atual < 2 || l.atual > 8 || l.minima < 2 || l.maxima > 8;
}

/** Valida o formulário de temperatura. Devolve a mensagem de erro ou null. */
export function validarLeitura(atual: number | null, minima: number | null, maxima: number | null): string | null {
  if (atual == null || minima == null || maxima == null || [atual, minima, maxima].some(n => !Number.isFinite(n))) return 'Preencha as três temperaturas.';
  if ([atual, minima, maxima].some(n => n < -50 || n > 60)) return 'Confira os valores: temperatura fora do que o termômetro mede.';
  if (minima > atual || atual > maxima) return 'A mínima não pode ser maior que a atual, nem a atual maior que a máxima.';
  return null;
}

export type StatusCampanha = 'andamento' | 'agendada' | 'encerrada';
export function statusCampanha(c: Pick<Campanha, 'inicio' | 'fim'>, hoje: string): StatusCampanha {
  if (hoje < c.inicio) return 'agendada';
  if (hoje > c.fim) return 'encerrada';
  return 'andamento';
}

export interface CampanhaVacina { campanha_id: number; produto_id: number }

/** Vacinas cobertas pela campanha. Sem a lista (ainda não sincronizada), campanha de vacinação cobre todas (null). */
export function vacinasDaCampanha(c: Pick<Campanha, 'id' | 'tipo'>, mapa: CampanhaVacina[]): number[] | null {
  const ids = mapa.filter(m => m.campanha_id === c.id).map(m => m.produto_id);
  if (ids.length) return ids;
  return normalizar(c.tipo ?? '').includes('vacin') ? null : [];
}

export function campanhaCobre(c: Pick<Campanha, 'id' | 'tipo'>, mapa: CampanhaVacina[], produtoId: number): boolean {
  const ids = vacinasDaCampanha(c, mapa);
  return ids === null || ids.includes(produtoId);
}

/* ---------------------------------------------------------------- Ações (gravam no aparelho) */

async function novaOp(tipo: VacOp['tipo'], payload: Record<string, unknown>): Promise<VacOp> {
  return { id: crypto.randomUUID(), seq: await proximaSequencia(), tipo, payload, status: 'pendente' };
}

async function saidaEstoque(perfil: Perfil, loteId: number, doses: number, motivo: string, quando: string): Promise<MovPendente> {
  const grupo = crypto.randomUUID();
  return {
    id: crypto.randomUUID(),
    grupo,
    unidade_id: perfil.unidade_id,
    lote_id: loteId,
    tipo: 'saida',
    quantidade: -doses,
    motivo,
    excecao_fefo: false,
    ref_estorno_id: null,
    usuario_id: perfil.user_id,
    dispositivo_id: await dispositivoId(),
    seq_local: await proximaSequencia(),
    criado_em_dispositivo: quando,
    status: 'pendente'
  };
}

async function encerrarFrasco(perfil: Perfil, e: Encerramento, quando: string): Promise<void> {
  await db.frascos.update(e.frasco.id, { encerrado_em: quando, motivo_encerramento: e.motivo, doses_perdidas: e.perdidas });
  await db.vacFila.add(await novaOp('encerrar_frasco', { id: e.frasco.id, unidade_id: perfil.unidade_id, encerrado_em: quando, motivo_encerramento: e.motivo, doses_perdidas: e.perdidas }));
}

/** Lotes FEFO do produto com o saldo do servidor + fila do aparelho (mesma conta do useEstoque). */
async function fefoDoProduto(produtoId: number): Promise<LoteSaldo[]> {
  const [lotes, saldos, fila] = await Promise.all([db.lotes.where('produto_id').equals(produtoId).toArray(), db.saldos.toArray(), db.fila.toArray()]);
  const s = saldosPorLote(saldos, fila);
  return lotesFefo(lotes.map(l => ({ id: l.id, produto_id: l.produto_id, numero: l.numero, validade: l.validade, status: l.status, saldo: s.get(l.id) ?? 0 })));
}

/** Frasco ativo (não encerrado) do produto neste aparelho. */
export async function frascoAtivo(produtoId: number): Promise<FrascoAberto | null> {
  const fs = await db.frascos.where('produto_id').equals(produtoId).toArray();
  return fs.filter(f => !f.encerrado_em).sort((a, b) => b.aberto_em.localeCompare(a.aberto_em))[0] ?? null;
}

export interface EscolhaDose { dose: string; grupo: string; campanha_id: number | null }
export interface ResultadoDose { aplicacao: AplicacaoLocal; abriu: FrascoAberto | null; encerrados: Encerramento[]; restantes: number | null; lote: string }

/** Registra uma dose aplicada (RN10). Abre/encerra frascos e gera a saída de estoque quando preciso. */
export async function registrarAplicacao(perfil: Perfil, produtoId: number, escolha: EscolhaDose, agora: Date = new Date()): Promise<ResultadoDose> {
  if (!escolha.dose || !escolha.grupo) throw new Error('Escolha a dose e o grupo.');
  const r = await db.transaction('rw', [db.produtos, db.lotes, db.saldos, db.fila, db.frascos, db.aplicacoes, db.vacFila, db.meta], async (): Promise<ResultadoDose | { erro: string }> => {
    const produto = await db.produtos.get(produtoId);
    if (!produto || produto.tipo !== 'vacina') throw new Error('Vacina não encontrada.');
    const quando = agora.toISOString();
    const fefo = await fefoDoProduto(produtoId);
    const ativo = await frascoAtivo(produtoId);
    const restAtivo = ativo ? dosesRestantes(ativo, await db.aplicacoes.where('produto_id').equals(produtoId).toArray()) : 0;
    const loteAtivo = ativo ? await db.lotes.get(ativo.lote_id) : undefined;
    const plano = planoDose(produto, fefo, ativo, restAtivo, loteAtivo?.validade, agora.getTime());
    const encerrados: Encerramento[] = [];

    if (plano.modo !== 'unidose' && plano.modo !== 'frasco' && plano.encerrar) {
      await encerrarFrasco(perfil, plano.encerrar, quando);
      encerrados.push(plano.encerrar);
    }
    if (plano.modo === 'sem_estoque') {
      // O encerramento do frasco vencido/esgotado fica gravado mesmo sem outro frasco para abrir
      if (encerrados.length) return { erro: `Frasco aberto encerrado (${encerrados[0].motivo === 'prazo_vencido' ? `prazo vencido, ${encerrados[0].perdidas} doses de perda técnica` : 'esgotado'}) e não há outro frasco desta vacina no estoque.` };
      throw new Error('Sem doses disponíveis desta vacina.');
    }

    let frasco: FrascoAberto | null = null;
    let abriu: FrascoAberto | null = null;
    let loteId: number;
    let loteNumero: string;
    if (plano.modo === 'unidose') {
      loteId = plano.lote.id;
      loteNumero = plano.lote.numero;
      await db.fila.add(await saidaEstoque(perfil, loteId, 1, 'Vacina aplicada (dose unitária)', quando));
    } else if (plano.modo === 'abrir') {
      loteId = plano.lote.id;
      loteNumero = plano.lote.numero;
      // O frasco inteiro sai do estoque fechado (uma movimentação); as doses passam a sair do frasco
      await db.fila.add(await saidaEstoque(perfil, loteId, plano.doses, 'Abertura de frasco multidose', quando));
      frasco = { id: crypto.randomUUID(), produto_id: produtoId, lote_id: loteId, aberto_em: quando, doses_iniciais: plano.doses, encerrado_em: null, motivo_encerramento: null, doses_perdidas: 0 };
      await db.frascos.add(frasco);
      await db.vacFila.add(await novaOp('abrir_frasco', { id: frasco.id, unidade_id: perfil.unidade_id, lote_id: loteId, produto_id: produtoId, aberto_em: quando, doses_iniciais: plano.doses }));
      abriu = frasco;
    } else {
      frasco = plano.frasco;
      loteId = frasco.lote_id;
      loteNumero = loteAtivo?.numero ?? String(loteId);
    }

    const disp = await dispositivoId();
    const aplicacao: AplicacaoLocal = {
      id: crypto.randomUUID(), produto_id: produtoId, lote_id: loteId, frasco_id: frasco?.id ?? null,
      dose: escolha.dose, grupo: escolha.grupo, campanha_id: escolha.campanha_id, criado_em_dispositivo: quando, enviado: false, dispositivo_id: disp
    };
    await db.aplicacoes.add(aplicacao);
    await db.vacFila.add(await novaOp('aplicacao', {
      id: aplicacao.id, unidade_id: perfil.unidade_id, produto_id: produtoId, lote_id: loteId, frasco_id: aplicacao.frasco_id,
      dose: aplicacao.dose, grupo: aplicacao.grupo, campanha_id: aplicacao.campanha_id, dispositivo_id: disp, criado_em_dispositivo: quando
    }));

    let restantes: number | null = null;
    if (frasco) {
      restantes = (plano.modo === 'frasco' ? plano.restantes : frasco.doses_iniciais) - 1;
      if (restantes <= 0) {
        const fim: Encerramento = { frasco, motivo: 'esgotado', perdidas: 0 };
        await encerrarFrasco(perfil, fim, quando);
        encerrados.push(fim);
      }
    }
    return { aplicacao, abriu, encerrados, restantes, lote: loteNumero };
  });
  if ('erro' in r) throw new Error(r.erro);
  return r;
}

/** "Descartar sobra": encerra o frasco ativo; a sobra vira perda técnica (prazo vencido ou descarte). */
export async function descartarSobra(perfil: Perfil, frascoId: string, agora: Date = new Date()): Promise<number> {
  return db.transaction('rw', [db.produtos, db.lotes, db.frascos, db.aplicacoes, db.vacFila, db.meta], async () => {
    const frasco = await db.frascos.get(frascoId);
    if (!frasco || frasco.encerrado_em) throw new Error('Este frasco já foi encerrado.');
    const [produto, lote, apls] = await Promise.all([db.produtos.get(frasco.produto_id), db.lotes.get(frasco.lote_id), db.aplicacoes.where('produto_id').equals(frasco.produto_id).toArray()]);
    const perdidas = dosesRestantes(frasco, apls);
    const vencido = frascoVencido(frasco, produto?.prazo_apos_abertura_h ?? null, lote?.validade, agora.getTime());
    await encerrarFrasco(perfil, { frasco, motivo: vencido ? 'prazo_vencido' : 'descartado', perdidas }, agora.toISOString());
    return perdidas;
  });
}

/** RN11: leitura da geladeira de vacinas. Devolve se ficou fora da faixa. */
export async function registrarLeitura(perfil: Perfil, v: { atual: number; minima: number; maxima: number }, agora: Date = new Date()): Promise<LeituraTemperatura> {
  const erro = validarLeitura(v.atual, v.minima, v.maxima);
  if (erro) throw new Error(erro);
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const leitura: LeituraTemperatura = { id: crypto.randomUUID(), atual: r1(v.atual), minima: r1(v.minima), maxima: r1(v.maxima), lida_em: agora.toISOString(), enviado: false };
  await db.transaction('rw', [db.leituras, db.vacFila, db.meta], async () => {
    await db.leituras.add(leitura);
    await db.vacFila.add(await novaOp('leitura', { id: leitura.id, unidade_id: perfil.unidade_id, atual: leitura.atual, minima: leitura.minima, maxima: leitura.maxima, lida_em: leitura.lida_em }));
  });
  return leitura;
}

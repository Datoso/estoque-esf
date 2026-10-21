import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Campanha, type FrascoAberto, type LeituraTemperatura, type Lote, type Produto } from '../lib/db';
import { diasAte, faixa, formatarData, formatarNumero, HOJE_ISO, type Faixa } from '../lib/estoque';
import type { Perfil } from '../lib/sync';
import type { Estoque, ItemEstoque } from '../lib/useEstoque';
import {
  campanhaCobre, descartarSobra, dosesDaVacina, dosesRestantes, foraDaFaixa, formatarDuracao, formatarPrazo, GRUPOS, planoDose,
  registrarAplicacao, registrarLeitura, statusCampanha, vacinasDaCampanha, validarLeitura, venceFrascoEm,
  type AplicacaoLocal, type CampanhaVacina, type PlanoDose, type StatusCampanha
} from '../lib/vacinas';

type Aba = 'aplicar' | 'estoque' | 'campanhas' | 'frio';
const ABAS: { id: Aba; nome: string }[] = [
  { id: 'aplicar', nome: 'Aplicar' },
  { id: 'estoque', nome: 'Estoque' },
  { id: 'campanhas', nome: 'Campanhas' },
  { id: 'frio', nome: 'Rede de frio' }
];
const COR: Record<Faixa, string> = { vencido: 'var(--vencido)', vermelho: 'var(--vermelho)', amarelo: 'var(--amarelo)', verde: 'var(--verde)' };
const ROTULO_STATUS: Record<StatusCampanha, string> = { andamento: 'Em andamento', agendada: 'Agendada', encerrada: 'Encerrada' };
const MOTIVO: Record<string, string> = { prazo_vencido: 'Prazo após abertura vencido', descartado: 'Sobra descartada', esgotado: 'Esgotado' };
const DUAS_HORAS = 2 * 3600e3;

function dataHora(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
const plural = (n: number, um: string, varios: string) => `${formatarNumero(n)} ${n === 1 ? um : varios}`;

/** Situação de cada vacina: estoque fechado + frasco aberto. */
interface VacinaVis {
  item: ItemEstoque;
  produto: Produto;
  dpf: number;
  ativo: FrascoAberto | null;
  restantes: number;
  loteAtivo: Lote | undefined;
  venceEm: number | null;
  vencido: boolean;
  disponiveis: number;
}

export function Vacinas({ perfil, estoque, avisar, sincronizar }: { perfil: Perfil; estoque: Estoque; avisar: (msg: string) => void; sincronizar: () => void }) {
  const [aba, setAba] = useState<Aba>('aplicar');
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setAgora(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const dados = useLiveQuery(async () => {
    const [produtos, lotes, frascos, aplicacoes, leituras, campanhas, campVac, disp, fila] = await Promise.all([
      db.produtos.where('tipo').equals('vacina').toArray(),
      db.lotes.toArray(),
      db.frascos.toArray(),
      db.aplicacoes.toArray() as Promise<AplicacaoLocal[]>,
      db.leituras.orderBy('lida_em').reverse().toArray(),
      db.campanhas.toArray(),
      db.meta.get('campanha_vacinas'),
      db.meta.get('dispositivo_id'),
      db.vacFila.toArray()
    ]);
    return {
      produtos, lotes, frascos, aplicacoes, leituras, campanhas,
      campVac: (campVac?.valor as CampanhaVacina[] | undefined) ?? [],
      disp: (disp?.valor as string | undefined) ?? null,
      pendentes: fila.filter(o => o.status === 'pendente').length,
      comErro: fila.filter(o => o.status === 'erro').length
    };
  }, []);

  // Escolhas da aba Aplicar (ficam aqui para a aba Campanhas poder pré-selecionar)
  const [vacSel, setVacSel] = useState<number | null>(null);
  const [dose, setDose] = useState('');
  const [grupo, setGrupo] = useState('');
  const [campSel, setCampSel] = useState<number | null>(null);
  const [gravando, setGravando] = useState(false);

  const hoje = HOJE_ISO();
  const prodPor = useMemo(() => new Map((dados?.produtos ?? []).map(p => [p.id, p])), [dados?.produtos]);
  const lotePor = useMemo(() => new Map((dados?.lotes ?? []).map(l => [l.id, l])), [dados?.lotes]);
  const campPor = useMemo(() => new Map((dados?.campanhas ?? []).map(c => [c.id, c])), [dados?.campanhas]);

  const vacinas: VacinaVis[] = useMemo(() => {
    if (!dados) return [];
    return estoque.itens.filter(i => i.tipo === 'vacina' && prodPor.has(i.id)).map(item => {
      const produto = prodPor.get(item.id)!;
      const ativo = dados.frascos.filter(f => f.produto_id === item.id && !f.encerrado_em).sort((a, b) => b.aberto_em.localeCompare(a.aberto_em))[0] ?? null;
      const restantes = ativo ? dosesRestantes(ativo, dados.aplicacoes) : 0;
      const loteAtivo = ativo ? lotePor.get(ativo.lote_id) : undefined;
      const venceEm = ativo ? venceFrascoEm(ativo, produto.prazo_apos_abertura_h, loteAtivo?.validade) : null;
      const vencido = venceEm != null && agora >= venceEm;
      return { item, produto, dpf: produto.doses_por_frasco ?? 1, ativo, restantes, loteAtivo, venceEm, vencido, disponiveis: item.disponivel + (ativo && !vencido ? restantes : 0) };
    });
  }, [dados, estoque.itens, prodPor, lotePor, agora]);

  if (!dados) return <p className="sutil">Carregando…</p>;

  const ultima: LeituraTemperatura | undefined = dados.leituras[0];
  const alertaFrio = !!ultima && foraDaFaixa(ultima);
  const campanhasAtivasDa = (produtoId: number) =>
    dados.campanhas.filter(c => statusCampanha(c, hoje) === 'andamento' && campanhaCobre(c, dados.campVac, produtoId)).sort((a, b) => a.inicio.localeCompare(b.inicio));

  function escolherVacina(id: number, campanha?: number | null) {
    const p = prodPor.get(id);
    setVacSel(id);
    setDose(p ? dosesDaVacina(p.nome)[0] : '');
    const ativas = campanhasAtivasDa(id);
    // Mantém a campanha já escolhida (ex.: vindo da aba Campanhas) se ela cobre esta vacina; senão, a primeira ativa
    setCampSel(campanha !== undefined ? campanha : campSel != null && ativas.some(c => c.id === campSel) ? campSel : ativas[0]?.id ?? null);
  }

  function depoisDaAcao(msg: string) {
    avisar(msg);
    if (navigator.onLine) sincronizar();
  }

  async function registrarDose(v: VacinaVis) {
    if (gravando) return;
    setGravando(true);
    try {
      const r = await registrarAplicacao(perfil, v.item.id, { dose, grupo, campanha_id: campSel });
      const partes = [`Dose de ${v.item.nome} registrada`];
      const perda = r.encerrados.find(e => e.motivo === 'prazo_vencido');
      if (perda) partes.push(`frasco vencido encerrado (${plural(perda.perdidas, 'dose perdida', 'doses perdidas')})`);
      if (r.abriu) partes.push(`frasco novo do lote ${r.lote} aberto`);
      if (r.restantes != null) partes.push(r.restantes > 0 ? `restam ${r.restantes} no frasco` : 'frasco esgotado');
      else partes.push(`lote ${r.lote}`);
      depoisDaAcao(partes.join(' · '));
    } catch (e) {
      avisar((e as Error).message);
    } finally {
      setGravando(false);
    }
  }

  async function descartar(v: VacinaVis) {
    if (!v.ativo) return;
    const txt = v.vencido
      ? `Encerrar o frasco vencido de ${v.item.nome}? ${plural(v.restantes, 'dose restante vira', 'doses restantes viram')} perda técnica.`
      : `Descartar a sobra do frasco aberto de ${v.item.nome}? ${plural(v.restantes, 'dose restante vira', 'doses restantes viram')} perda técnica.`;
    if (!window.confirm(txt)) return;
    try {
      const n = await descartarSobra(perfil, v.ativo.id);
      depoisDaAcao(`Frasco encerrado · ${plural(n, 'dose registrada', 'doses registradas')} como perda técnica`);
    } catch (e) {
      avisar((e as Error).message);
    }
  }

  return (
    <>
      <h2 className="titulo">Vacinação</h2>
      <div className="vac-abas" role="tablist" aria-label="Seções da vacinação">
        {ABAS.map(a => (
          <button key={a.id} role="tab" id={`vac-aba-${a.id}`} aria-selected={aba === a.id} aria-controls="vac-painel" className="vac-aba" onClick={() => setAba(a.id)}>
            {a.nome}
            {a.id === 'frio' && alertaFrio && <span className="vac-ponto-alerta" role="img" aria-label="alerta de temperatura" />}
          </button>
        ))}
      </div>
      {(dados.pendentes > 0 || dados.comErro > 0) && (
        <p className="sutil">
          {dados.pendentes > 0 && `${plural(dados.pendentes, 'registro de vacinação aguardando envio', 'registros de vacinação aguardando envio')}. `}
          {dados.comErro > 0 && <b style={{ color: 'var(--vermelho)' }}>{plural(dados.comErro, 'registro recusado pelo servidor', 'registros recusados pelo servidor')}: avise a coordenação.</b>}
        </p>
      )}

      <div id="vac-painel" role="tabpanel" aria-labelledby={`vac-aba-${aba}`} className="vac-painel">
        {aba === 'aplicar' && (
          <Aplicar
            vacinas={vacinas} vacSel={vacSel} escolherVacina={escolherVacina}
            dose={dose} setDose={setDose} grupo={grupo} setGrupo={setGrupo} campSel={campSel} setCampSel={setCampSel}
            campanhas={vacSel != null ? campanhasAtivasDa(vacSel) : []} agora={agora} gravando={gravando} registrar={registrarDose}
            historico={[...dados.aplicacoes].sort((a, b) => b.criado_em_dispositivo.localeCompare(a.criado_em_dispositivo)).slice(0, 10)}
            nomeProduto={id => prodPor.get(id)?.nome ?? 'Vacina'} numeroLote={id => lotePor.get(id)?.numero ?? '—'} nomeCampanha={id => (id != null && campPor.get(id)?.nome) || 'Rotina'}
          />
        )}
        {aba === 'estoque' && (
          <EstoqueVac vacinas={vacinas} agora={agora} descartar={descartar} config={estoque.config}
            perdas={dados.frascos.filter(f => f.encerrado_em && f.doses_perdidas > 0).sort((a, b) => (b.encerrado_em ?? '').localeCompare(a.encerrado_em ?? ''))}
            nomeProduto={id => prodPor.get(id)?.nome ?? 'Vacina'} numeroLote={id => lotePor.get(id)?.numero ?? '—'}
          />
        )}
        {aba === 'campanhas' && (
          <Campanhas campanhas={dados.campanhas} campVac={dados.campVac} hoje={hoje} nomeProduto={id => prodPor.get(id)?.nome ?? 'Vacina'}
            contar={id => dados.aplicacoes.filter(a => a.campanha_id === id && (!a.dispositivo_id || a.dispositivo_id === dados.disp)).length}
            registrar={c => {
              const ids = vacinasDaCampanha(c, dados.campVac);
              const unica = ids && ids.length === 1 && prodPor.has(ids[0]) ? ids[0] : null;
              if (unica != null) escolherVacina(unica, c.id);
              else { setVacSel(null); setCampSel(c.id); }
              setAba('aplicar');
            }}
          />
        )}
        {aba === 'frio' && <RedeFrio leituras={dados.leituras} registrar={async v => {
          try {
            const l = await registrarLeitura(perfil, v);
            depoisDaAcao(foraDaFaixa(l) ? 'Leitura registrada · FORA da faixa de 2 a 8 °C' : 'Leitura registrada · dentro da faixa');
            return true;
          } catch (e) {
            avisar((e as Error).message);
            return false;
          }
        }} />}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ Aplicar */

function Aplicar(p: {
  vacinas: VacinaVis[]; vacSel: number | null; escolherVacina: (id: number) => void;
  dose: string; setDose: (d: string) => void; grupo: string; setGrupo: (g: string) => void;
  campSel: number | null; setCampSel: (c: number | null) => void; campanhas: Campanha[];
  agora: number; gravando: boolean; registrar: (v: VacinaVis) => void;
  historico: AplicacaoLocal[]; nomeProduto: (id: number) => string; numeroLote: (id: number) => string; nomeCampanha: (id: number | null) => string;
}) {
  const v = p.vacinas.find(x => x.item.id === p.vacSel) ?? null;
  const plano = v ? planoDose(v.produto, v.item.fefo, v.ativo, v.restantes, v.loteAtivo?.validade, p.agora) : null;
  const pode = !!v && !!p.dose && !!p.grupo && plano?.modo !== 'sem_estoque' && !p.gravando;

  return (
    <>
      <p className="vac-nota">Controle de estoque e produção da unidade. O registro nominal de cada pessoa vacinada continua no e-SUS APS.</p>

      <section className="secao" aria-labelledby="vac-escolha">
        <p className="rotulo" id="vac-escolha">Vacina</p>
        {p.vacinas.length === 0 ? (
          <p className="sutil">Nenhuma vacina cadastrada para esta unidade. Sincronize quando houver internet.</p>
        ) : (
          <div className="grade">
            {p.vacinas.map(x => (
              <button key={x.item.id} className="tile vac-tile" aria-pressed={p.vacSel === x.item.id} onClick={() => p.escolherVacina(x.item.id)}>
                <strong>{x.item.nome}</strong>
                <span>{x.disponiveis > 0 ? plural(x.disponiveis, 'dose', 'doses') : 'Sem estoque'}</span>
                {x.dpf > 1 && x.ativo && !x.vencido && <small className="vac-tile-sub">frasco aberto: {x.restantes} {x.restantes === 1 ? "dose" : "doses"}</small>}{x.dpf > 1 && x.ativo && x.vencido && <small className="vac-tile-sub" style={{ color: "var(--vermelho)" }}>frasco aberto vencido</small>}
              </button>
            ))}
          </div>
        )}
      </section>

      {v && (
        <div className="cartao vac-form">
          <Chips rotulo="Dose" opcoes={dosesDaVacina(v.item.nome).map(d => ({ id: d, nome: d }))} valor={p.dose} escolher={d => p.setDose(d)} />
          <Chips rotulo="Grupo" opcoes={GRUPOS.map(g => ({ id: g, nome: g }))} valor={p.grupo} escolher={g => p.setGrupo(g)} />
          <Chips rotulo="Campanha" opcoes={[{ id: 'rotina', nome: 'Rotina' }, ...p.campanhas.map(c => ({ id: String(c.id), nome: c.nome }))]}
            valor={p.campSel == null ? 'rotina' : String(p.campSel)} escolher={c => p.setCampSel(c === 'rotina' ? null : Number(c))} />
          {plano && <Origem plano={plano} v={v} />}
          {!p.grupo && <p className="sutil">Escolha o grupo para registrar.</p>}
          <button className="btn" disabled={!pode} onClick={() => p.registrar(v)}>{p.gravando ? 'Registrando…' : 'Registrar dose aplicada'}</button>
        </div>
      )}

      <section className="secao" aria-labelledby="vac-hist">
        <div className="secao-topo"><p className="rotulo" id="vac-hist">Últimas doses registradas</p></div>
        {p.historico.length === 0 && <p className="sutil">Nenhuma dose registrada ainda.</p>}
        {p.historico.map(a => (
          <div key={a.id} className="cartao vac-hist">
            <div className="vac-linha-topo">
              <strong>{p.nomeProduto(a.produto_id)}</strong>
              <time dateTime={a.criado_em_dispositivo}>{dataHora(a.criado_em_dispositivo)}</time>
            </div>
            <small>{a.dose} · {a.grupo} · Lote {p.numeroLote(a.lote_id)} · {p.nomeCampanha(a.campanha_id)}{a.enviado ? '' : ' · aguardando envio'}</small>
          </div>
        ))}
      </section>
    </>
  );
}

function Chips({ rotulo, opcoes, valor, escolher }: { rotulo: string; opcoes: { id: string; nome: string }[]; valor: string; escolher: (id: string) => void }) {
  return (
    <div className="vac-grupo-chips" role="group" aria-label={rotulo}>
      <p className="rotulo" aria-hidden="true">{rotulo}</p>
      <div className="vac-chips">
        {opcoes.map(o => <button key={o.id} type="button" className="chip vac-chip" aria-pressed={valor === o.id} onClick={() => escolher(o.id)}>{o.nome}</button>)}
      </div>
    </div>
  );
}

function Origem({ plano, v }: { plano: PlanoDose; v: VacinaVis }) {
  let txt: string;
  let classe = 'vac-origem';
  switch (plano.modo) {
    case 'frasco':
      txt = `Sai do frasco aberto · lote ${v.loteAtivo?.numero ?? '—'} · ${plural(plano.restantes, 'dose restante', 'doses restantes')}`;
      break;
    case 'abrir':
      txt = `Vai abrir frasco novo do lote ${plano.lote.numero} (${plural(plano.doses, 'dose', 'doses')}) · ${formatarPrazo(v.produto.prazo_apos_abertura_h)}`;
      break;
    case 'unidose':
      txt = `Dose unitária · lote ${plano.lote.numero} · vence ${formatarData(plano.lote.validade)}`;
      break;
    default:
      txt = 'Sem doses disponíveis desta vacina.';
      classe += ' vac-origem-critico';
  }
  const perda = plano.modo !== 'frasco' && plano.modo !== 'unidose' && plano.encerrar?.motivo === 'prazo_vencido' ? plano.encerrar.perdidas : null;
  return (
    <div className={classe}>
      <span>{txt}</span>
      {perda != null && <small>O frasco aberto passou do prazo: {plural(perda, 'dose vira', 'doses viram')} perda técnica ao registrar.</small>}
    </div>
  );
}

/* ------------------------------------------------------------------ Estoque */

function EstoqueVac({ vacinas, agora, descartar, config, perdas, nomeProduto, numeroLote }: {
  vacinas: VacinaVis[]; agora: number; descartar: (v: VacinaVis) => void; config: Estoque['config'];
  perdas: FrascoAberto[]; nomeProduto: (id: number) => string; numeroLote: (id: number) => string;
}) {
  return (
    <>
      {vacinas.length === 0 && <p className="sutil">Nenhuma vacina cadastrada.</p>}
      {vacinas.map(v => {
        const prox = v.item.fefo[0];
        const f: Faixa = prox ? faixa(diasAte(prox.validade), config.semaforo_amarelo_dias, config.semaforo_vermelho_dias) : 'vencido';
        const falta = v.venceEm != null ? v.venceEm - agora : null;
        const estado = !v.ativo ? null : v.vencido ? 'vencido' : falta != null && falta < DUAS_HORAS ? 'logo' : 'ok';
        return (
          <article key={v.item.id} className={`cartao vac-cartao${v.item.repor ? ' vac-repor' : ''}`}>
            <div className="vac-linha-topo">
              <strong>{v.item.nome}</strong>
              {v.item.repor && <span className="tag-repor">Hora de repor</span>}
            </div>
            <div className="trio">
              <span><small>Doses</small><b>{formatarNumero(v.disponiveis)}</b></span>
              {v.dpf > 1
                ? <span><small>Frascos fechados</small><b>{formatarNumero(Math.floor(v.item.disponivel / v.dpf))}</b></span>
                : <span><small>Apresentação</small><b>Unidose</b></span>}
              <span><small>Por frasco</small><b>{v.dpf}</b></span>
            </div>
            <div className="vac-lote">
              <span className="ponto" style={{ background: COR[f] }} aria-hidden="true" />
              <small>{prox ? `Próximo lote ${prox.numero} · vence ${formatarData(prox.validade)}` : 'Sem lote utilizável'}</small>
            </div>
            {v.ativo && (
              <div className={`vac-frasco vac-frasco-${estado}`}>
                <div className="vac-frasco-txt">
                  <b>Frasco aberto · lote {v.loteAtivo?.numero ?? '—'}</b>
                  <small>
                    {plural(v.restantes, 'dose restante', 'doses restantes')} · aberto {dataHora(v.ativo.aberto_em)}
                    {v.venceEm == null ? '' : v.vencido ? ` · prazo vencido há ${formatarDuracao(agora - v.venceEm)}` : ` · vence em ${formatarDuracao(falta!)}`}
                  </small>
                </div>
                <button className="btn-sec" onClick={() => descartar(v)}>{v.vencido ? 'Descartar sobra (perda técnica)' : 'Descartar sobra'}</button>
              </div>
            )}
          </article>
        );
      })}

      <section className="secao" aria-labelledby="vac-perdas">
        <p className="rotulo" id="vac-perdas">Perdas técnicas</p>
        {perdas.length === 0 && <p className="sutil">Nenhuma perda técnica registrada.</p>}
        {perdas.map(f => (
          <div key={f.id} className="cartao">
            <div className="vac-linha-topo">
              <strong>{nomeProduto(f.produto_id)}</strong>
              <b className="vac-perda-num">{plural(f.doses_perdidas, 'dose', 'doses')}</b>
            </div>
            <small>Lote {numeroLote(f.lote_id)} · {MOTIVO[f.motivo_encerramento ?? ''] ?? 'Encerrado'} · {f.encerrado_em ? dataHora(f.encerrado_em) : ''}</small>
          </div>
        ))}
      </section>
      <p className="sutil">Prazos de uso após abertura vêm do cadastro do produto (bula/normas do PNI).</p>
    </>
  );
}

/* ------------------------------------------------------------------ Campanhas */

function Campanhas({ campanhas, campVac, hoje, contar, registrar, nomeProduto }: {
  campanhas: Campanha[]; campVac: CampanhaVacina[]; hoje: string; contar: (id: number) => number; registrar: (c: Campanha) => void; nomeProduto: (id: number) => string;
}) {
  const ordem: Record<StatusCampanha, number> = { andamento: 0, agendada: 1, encerrada: 2 };
  const lista = [...campanhas].sort((a, b) => ordem[statusCampanha(a, hoje)] - ordem[statusCampanha(b, hoje)] || a.inicio.localeCompare(b.inicio));
  if (!lista.length) return <p className="sutil">Nenhuma campanha cadastrada.</p>;
  return (
    <>
      {lista.map(c => {
        const st = statusCampanha(c, hoje);
        const n = contar(c.id);
        const pct = c.meta ? Math.min(100, Math.round((n / c.meta) * 100)) : null;
        const vacs = vacinasDaCampanha(c, campVac);
        return (
          <article key={c.id} className="cartao vac-camp">
            <div className="vac-linha-topo">
              <strong>{c.nome}</strong>
              <span className={`status vac-st-${st}`}>{ROTULO_STATUS[st]}</span>
            </div>
            <small>{formatarData(c.inicio)} a {formatarData(c.fim)}{c.publico_alvo ? ` · ${c.publico_alvo}` : ''}</small>
            {vacs && vacs.length > 0 && <small>Vacinas: {vacs.map(nomeProduto).join(', ')}</small>}
            <div className="vac-progresso">
              <span><b>{formatarNumero(n)}</b>{c.meta ? ` de ${formatarNumero(c.meta)}` : ''} {n === 1 ? 'dose registrada' : 'doses registradas'} neste aparelho</span>
              {pct != null && (
                <div className="vac-barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`Progresso da meta: ${pct}%`}>
                  <i style={{ width: `${pct}%` }} />
                </div>
              )}
            </div>
            {st === 'andamento' && <button className="btn-sec" onClick={() => registrar(c)}>Registrar dose desta campanha</button>}
          </article>
        );
      })}
      <p className="sutil">O total da unidade (todos os aparelhos) ainda não é somado pelo servidor; aqui aparecem as doses registradas neste aparelho.</p>
    </>
  );
}

/* ------------------------------------------------------------------ Rede de frio */

function RedeFrio({ leituras, registrar }: { leituras: LeituraTemperatura[]; registrar: (v: { atual: number; minima: number; maxima: number }) => Promise<boolean> }) {
  const [atual, setAtual] = useState('');
  const [minima, setMinima] = useState('');
  const [maxima, setMaxima] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')));
  const ultima = leituras[0];
  const fora = ultima ? foraDaFaixa(ultima) : false;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const [a, mi, ma] = [num(atual), num(minima), num(maxima)];
    const msg = validarLeitura(a, mi, ma);
    setErro(msg);
    if (msg) return;
    if (await registrar({ atual: a!, minima: mi!, maxima: ma! })) { setAtual(''); setMinima(''); setMaxima(''); }
  }

  return (
    <>
      {ultima ? (
        <div className={`vac-temp ${fora ? 'vac-temp-fora' : 'vac-temp-ok'}`} role={fora ? 'alert' : undefined}>
          <small>Geladeira de vacinas · última leitura {dataHora(ultima.lida_em)}</small>
          <b className="vac-temp-valor">{ultima.atual.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} °C</b>
          <span>Mín {ultima.minima.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} °C · Máx {ultima.maxima.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} °C</span>
          {fora ? (
            <div className="vac-conduta">
              <strong>Temperatura fora da faixa de 2 a 8 °C</strong>
              <ul>
                <li>Não use as vacinas até a avaliação.</li>
                <li>Mantenha a geladeira fechada.</li>
                <li>Comunique a coordenação e a rede de frio municipal.</li>
              </ul>
            </div>
          ) : <strong>Dentro da faixa de 2 a 8 °C</strong>}
        </div>
      ) : <p className="sutil">Nenhuma leitura registrada. Registre a temperatura da geladeira no início e no fim do expediente.</p>}

      <form className="cartao vac-form" onSubmit={enviar} noValidate>
        <p className="rotulo">Nova leitura (°C)</p>
        <div className="vac-temp-campos">
          <div className="campo"><label htmlFor="vac-t-atual">Atual</label><input id="vac-t-atual" type="number" step="0.1" inputMode="decimal" value={atual} onChange={e => setAtual(e.target.value)} /></div>
          <div className="campo"><label htmlFor="vac-t-min">Mínima</label><input id="vac-t-min" type="number" step="0.1" inputMode="decimal" value={minima} onChange={e => setMinima(e.target.value)} /></div>
          <div className="campo"><label htmlFor="vac-t-max">Máxima</label><input id="vac-t-max" type="number" step="0.1" inputMode="decimal" value={maxima} onChange={e => setMaxima(e.target.value)} /></div>
        </div>
        {erro && <p className="erro-txt" role="alert">{erro}</p>}
        <button className="btn" type="submit">Registrar leitura</button>
      </form>

      <section className="secao" aria-labelledby="vac-leituras">
        <p className="rotulo" id="vac-leituras">Leituras recentes</p>
        {leituras.slice(0, 10).map(l => {
          const f = foraDaFaixa(l);
          return (
            <div key={l.id} className="cartao vac-leitura">
              <div className="vac-linha-topo">
                <span>{dataHora(l.lida_em)}</span>
                <span className={`status ${f ? 'vac-fora' : 'vac-ok'}`}>{f ? 'FORA' : 'OK'}</span>
              </div>
              <small>Atual {l.atual.toFixed(1).replace('.', ',')} · Mín {l.minima.toFixed(1).replace('.', ',')} · Máx {l.maxima.toFixed(1).replace('.', ',')} °C{l.enviado ? '' : ' · aguardando envio'}</small>
            </div>
          );
        })}
      </section>
    </>
  );
}

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { HOJE_ISO } from '../lib/estoque';
import type { Estoque } from '../lib/useEstoque';
import {
  dataCurta, dataPorExtenso, eventosDoDia, gradeDoMes, montarEventos, nomeDoMes, proximos, ROTULO_TIPO, somarMeses, tiposPorDia,
  type TipoEvento
} from '../lib/calendario';

const SEMANA = [
  { c: 'D', l: 'Domingo' }, { c: 'S', l: 'Segunda' }, { c: 'T', l: 'Terça' }, { c: 'Q', l: 'Quarta' },
  { c: 'Q', l: 'Quinta' }, { c: 'S', l: 'Sexta' }, { c: 'S', l: 'Sábado' }
];
const TIPOS: TipoEvento[] = ['venc', 'camp', 'pedido', 'dia'];

export function Calendario({ estoque, voltar }: { estoque: Estoque; voltar: () => void }) {
  const hoje = HOJE_ISO();
  const [hAno, hMes] = hoje.split('-').map(Number);
  const [mes, setMes] = useState({ ano: hAno, mes: hMes });
  const [sel, setSel] = useState(hoje);

  const campanhas = useLiveQuery(() => db.campanhas.toArray(), [], []);
  const agenda = useLiveQuery(() => db.eventos.toArray(), [], []);

  const eventos = useMemo(
    () => montarEventos({ itens: estoque.itens, pedidos: estoque.pedidos, campanhas, eventos: agenda }),
    [estoque.itens, estoque.pedidos, campanhas, agenda]
  );
  const tipos = useMemo(() => tiposPorDia(eventos, campanhas), [eventos, campanhas]);
  const semanas = useMemo(() => gradeDoMes(mes.ano, mes.mes), [mes]);
  const doDia = useMemo(() => eventosDoDia(eventos, campanhas, sel), [eventos, campanhas, sel]);
  const prox = useMemo(() => proximos(eventos, hoje), [eventos, hoje]);

  const mudarMes = (n: number) => setMes(m => somarMeses(m.ano, m.mes, n));
  const irHoje = () => { setMes({ ano: hAno, mes: hMes }); setSel(hoje); };
  const contar = (iso: string) => eventosDoDia(eventos, campanhas, iso).length;
  const anterior = somarMeses(mes.ano, mes.mes, -1);
  const seguinte = somarMeses(mes.ano, mes.mes, 1);

  return (
    <>
      <div className="cab-sub">
        <button className="redondo" onClick={voltar} aria-label="Voltar">‹</button>
        <h2 className="titulo cal-titulo">Calendário</h2>
        <button className="pilula" onClick={irHoje}>Hoje</button>
      </div>

      <section className="cartao cal-mes" aria-label="Calendário do mês">
        <div className="cal-nav">
          <button className="cal-seta" onClick={() => mudarMes(-1)} aria-label={`Mês anterior: ${nomeDoMes(anterior.ano, anterior.mes)}`}>‹</button>
          <h3 className="cal-nome-mes" aria-live="polite">{nomeDoMes(mes.ano, mes.mes)}</h3>
          <button className="cal-seta" onClick={() => mudarMes(1)} aria-label={`Próximo mês: ${nomeDoMes(seguinte.ano, seguinte.mes)}`}>›</button>
        </div>
        <div className="cal-grade" role="grid" aria-label={nomeDoMes(mes.ano, mes.mes)}>
          <div className="cal-linha" role="row">
            {SEMANA.map((s, i) => <span key={i} className="cal-sem" role="columnheader" aria-label={s.l}>{s.c}</span>)}
          </div>
          {semanas.map((sem, i) => (
            <div className="cal-linha" role="row" key={i}>
              {sem.map((iso, j) => {
                if (!iso) return <span key={j} className="cal-vazio" role="gridcell" />;
                const t = tipos.get(iso) ?? [];
                const n = t.length ? contar(iso) : 0;
                const cls = ['cal-dia', iso === hoje && 'cal-hoje', iso === sel && 'cal-sel'].filter(Boolean).join(' ');
                return (
                  <span key={j} role="gridcell">
                    <button
                      className={cls}
                      onClick={() => setSel(iso)}
                      aria-pressed={iso === sel}
                      aria-current={iso === hoje ? 'date' : undefined}
                      aria-label={`${dataPorExtenso(iso, hAno)}${iso === hoje ? ', hoje' : ''}: ${n === 0 ? 'nenhum evento' : n === 1 ? '1 evento' : `${n} eventos`}`}
                    >
                      <span className="cal-num">{Number(iso.slice(8))}</span>
                      <span className="cal-pontos" aria-hidden="true">
                        {t.slice(0, 3).map(tp => <i key={tp} className={`cal-ponto cal-${tp}`} />)}
                      </span>
                    </button>
                  </span>
                );
              })}
            </div>
          ))}
        </div>
        <ul className="cal-legenda" aria-label="Legenda">
          {TIPOS.map(tp => <li key={tp}><i className={`cal-ponto cal-${tp}`} aria-hidden="true" />{ROTULO_TIPO[tp]}</li>)}
        </ul>
      </section>

      <section className="secao" aria-live="polite">
        <div className="secao-topo">
          <h3 className="rotulo cal-rotulo">{dataPorExtenso(sel, hAno)}</h3>
          {sel === hoje && <span className="sutil">Hoje</span>}
        </div>
        {doDia.length === 0
          ? <div className="cartao"><small>Nada marcado neste dia.</small></div>
          : (
            <ul className="cal-lista">
              {doDia.map((e, i) => (
                <li key={i} className="cartao cal-ev">
                  <i className={`cal-ponto cal-${e.tipo}`} aria-hidden="true" />
                  <div className="cal-ev-txt">
                    <strong>{e.titulo}</strong>
                    <small>{e.sub}</small>
                  </div>
                  <span className="cal-sr">{ROTULO_TIPO[e.tipo]}</span>
                </li>
              ))}
            </ul>
          )}
      </section>

      <section className="secao">
        <h3 className="rotulo cal-rotulo">Próximos 30 dias</h3>
        {prox.length === 0
          ? <div className="cartao"><small>Nenhum evento nos próximos 30 dias.</small></div>
          : (
            <ul className="cartao cal-prox">
              {prox.map((e, i) => (
                <li key={i}>
                  <button className="cal-prox-item" onClick={() => { const [a, m] = e.data.split('-').map(Number); setMes({ ano: a, mes: m }); setSel(e.data); }}>
                    <span className={`cal-data cal-txt-${e.tipo}`}>{dataCurta(e.data)}</span>
                    <span className="cal-prox-txt">
                      <strong>{e.titulo}</strong>
                      <small>{e.sub}</small>
                    </span>
                    <span className="cal-sr">{ROTULO_TIPO[e.tipo]}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
      </section>
    </>
  );
}

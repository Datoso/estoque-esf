import { useState, type ReactNode } from 'react';
import type { Perfil } from '../lib/sync';
import { TEMAS, temaDaCampanha, type Paleta, type Tema } from '../lib/temas';
import { Abobora, IcAgenda, IcCheck, IcEntrada, IcLua, IcPaleta, IcSair, IcSeta, IcSol, IcSync, IcUsuario, IcVoltar, IcCarrinho, Laco } from '../components/Icones';

interface Props {
  perfil: Perfil;
  tema: string; setTema: (t: string) => void;
  modo: string; setModo: (m: string) => void;
  ultimaSync: string | null; pendentes: number; comErro: number;
  sincronizarAgora: () => void; sair: () => void;
  irRepor: () => void; irEntrada: () => void; irCalendario: () => void; nRepor: number; nAbertos: number;
}

function ItemMenu({ icone, titulo, sub, onClick, badge }: { icone: ReactNode; titulo: string; sub: string; onClick: () => void; badge?: ReactNode }) {
  return (
    <button className="linha menu-item" onClick={onClick}>
      <span className="ic-quad">{icone}</span>
      <span className="meio"><strong>{titulo}</strong><span className="sutil">{sub}</span></span>
      {badge}
      <IcSeta size={18} className="chevron" />
    </button>
  );
}

/** Miniatura do app desenhada com a paleta do tema. */
function Previa({ p, icone }: { p: Paleta; icone?: Tema['icone'] }) {
  return (
    <span className="previa" aria-hidden="true" style={{ background: p.bg, borderColor: p.line }}>
      <span className="pv-topo" style={{ background: p.header, borderColor: p.line }}>
        <span className="pv-txt" style={{ background: p.ink }} />
        <span className="pv-ponto" style={{ background: icone ? p.accent : p.accent2 }} />
      </span>
      <span className="pv-corpo">
        <span className="pv-bloco" style={{ background: p.surface, borderColor: p.line }}>
          <span className="pv-linha" style={{ background: p.ink2 }} />
          <span className="pv-tag" style={{ background: p.accent2 }} />
        </span>
        <span className="pv-bloco" style={{ background: p.surface, borderColor: p.line }}>
          <span className="pv-linha" style={{ background: p.ink2 }} />
        </span>
        <span className="pv-botao" style={{ background: p.accent }} />
      </span>
    </span>
  );
}

function TelaTemas({ tema, setTema, modo, setModo, voltar }: { tema: string; setTema: (t: string) => void; modo: string; setModo: (m: string) => void; voltar: () => void }) {
  const escuro = modo === 'escuro';
  const campanha = TEMAS.find(t => t.id === temaDaCampanha()) ?? TEMAS[0];
  const opcoes: { id: string; nome: string; desc: string; t: Tema }[] = [
    { id: 'campanha', nome: 'Campanha do mês', desc: `Muda sozinho a cada mês · agora: ${campanha.nome}`, t: campanha },
    ...TEMAS.map(t => ({ id: t.id, nome: t.nome, desc: t.desc, t }))
  ];

  return (
    <>
      <div className="cab-sub">
        <button className="redondo" onClick={voltar} aria-label="Voltar"><IcVoltar /></button>
        <h2 className="titulo">Temas e cores</h2>
      </div>

      <section className="secao">
        <p className="rotulo" id="rot-modo">Modo</p>
        <div className="segmento" role="group" aria-labelledby="rot-modo">
          <button aria-pressed={!escuro} onClick={() => setModo('claro')}><IcSol size={18} />Claro</button>
          <button aria-pressed={escuro} onClick={() => setModo('escuro')}><IcLua size={18} />Escuro</button>
        </div>
      </section>

      <section className="secao">
        <p className="rotulo" id="rot-tema">Tema</p>
        <div className="temas" role="group" aria-labelledby="rot-tema">
          {opcoes.map(o => {
            const ativo = tema === o.id;
            return (
              <button key={o.id} className="tema-card" aria-pressed={ativo} onClick={() => setTema(o.id)}>
                <Previa p={escuro ? o.t.escuro : o.t.claro} icone={o.t.icone} />
                <span className="tema-nome">
                  {o.nome}
                  {o.t.icone === 'laco' && o.id !== 'campanha' && <Laco size={16} />}
                  {o.t.icone === 'abobora' && o.id !== 'campanha' && <Abobora size={16} />}
                </span>
                <span className="tema-desc">{o.desc}</span>
                {ativo && <span className="em-uso"><IcCheck size={16} />Em uso</span>}
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}

export function Mais({ perfil, tema, setTema, modo, setModo, ultimaSync, pendentes, comErro, sincronizarAgora, sair, irRepor, irEntrada, irCalendario, nRepor, nAbertos }: Props) {
  const [vendoTemas, setVendoTemas] = useState(false);

  if (vendoTemas) return <TelaTemas tema={tema} setTema={setTema} modo={modo} setModo={setModo} voltar={() => setVendoTemas(false)} />;

  const nomeTema = tema === 'campanha' ? 'Campanha do mês' : TEMAS.find(t => t.id === tema)?.nome ?? 'Padrão';

  return (
    <>
      <h2 className="titulo">Mais</h2>

      <div className="cartao perfil-cartao">
        <span className="ic-quad redondo-ic"><IcUsuario /></span>
        <span className="meio">
          <strong>{perfil.nome}</strong>
          <small>{perfil.unidade_nome} · {perfil.perfil}</small>
        </span>
      </div>

      <section className="secao">
        <p className="rotulo">Agenda</p>
        <ItemMenu icone={<IcAgenda />} titulo="Calendário" sub="Campanhas, vencimentos e entregas" onClick={irCalendario} />
      </section>

      <section className="secao">
        <p className="rotulo">Estoque</p>
        <ItemMenu icone={<IcCarrinho size={22} />} titulo="Reposição" sub="Pedido ao almoxarifado" onClick={irRepor}
          badge={nRepor > 0 && <span className="badge">{nRepor} {nRepor === 1 ? 'item' : 'itens'}</span>} />
        <ItemMenu icone={<IcEntrada />} titulo="Entrada de mercadoria" sub="Receber pedido ou entrada avulsa" onClick={irEntrada}
          badge={nAbertos > 0 && <span className="badge">{nAbertos} a receber</span>} />
      </section>

      <section className="secao">
        <p className="rotulo">Sincronização</p>
        <div className="cartao sync-cartao">
          <small>{ultimaSync ? `Última: ${new Date(ultimaSync).toLocaleString('pt-BR')}` : 'Ainda não sincronizou'}</small>
          <small>{pendentes} {pendentes === 1 ? 'movimentação aguardando envio' : 'movimentações aguardando envio'}{comErro ? ` · ${comErro} com erro (a coordenação revisa)` : ''}</small>
          <button className="btn-sec" onClick={sincronizarAgora}><IcSync size={18} /> Sincronizar agora</button>
        </div>
      </section>

      <section className="secao">
        <p className="rotulo">Aparência</p>
        <ItemMenu icone={<IcPaleta />} titulo="Temas e cores" sub={`${nomeTema} · modo ${modo === 'escuro' ? 'escuro' : 'claro'}`} onClick={() => setVendoTemas(true)} />
      </section>

      <section className="secao">
        <p className="rotulo">Conta</p>
        <button className="linha menu-item" onClick={sair}>
          <span className="ic-quad"><IcSair /></span>
          <span className="meio"><strong>Sair</strong><span className="sutil">{pendentes ? 'Sincronize antes de sair' : 'Encerrar a sessão neste aparelho'}</span></span>
        </button>
      </section>
    </>
  );
}

import type { Perfil } from '../lib/sync';
import { IcSair, IcSync } from '../components/Icones';

interface Props {
  perfil: Perfil;
  tema: string; setTema: (t: string) => void;
  modo: string; setModo: (m: string) => void;
  ultimaSync: string | null; pendentes: number; comErro: number;
  sincronizarAgora: () => void; sair: () => void;
  irRepor: () => void; irEntrada: () => void; irCalendario: () => void; nRepor: number; nAbertos: number;
}

const TEMAS = [
  { id: 'campanha', nome: 'Campanha do mês', desc: 'Outubro Rosa em outubro, padrão nos outros meses' },
  { id: 'padrao', nome: 'Padrão', desc: 'Verde-azulado da saúde' },
  { id: 'rosa', nome: 'Outubro Rosa', desc: 'Prevenção do câncer de mama' }
];

export function Mais({ perfil, tema, setTema, modo, setModo, ultimaSync, pendentes, comErro, sincronizarAgora, sair, irRepor, irEntrada, irCalendario, nRepor, nAbertos }: Props) {
  return (
    <>
      <h2 className="titulo">Mais</h2>
      <div className="cartao">
        <strong>{perfil.nome}</strong>
        <small>{perfil.unidade_nome} · {perfil.perfil}</small>
      </div>

      <section className="secao">
        <p className="rotulo">Estoque</p>
        <button className="linha menu-item" onClick={irRepor}>
          <span className="meio"><strong>Reposição</strong><span className="sutil">Pedido ao almoxarifado</span></span>
          {nRepor > 0 && <span className="badge">{nRepor} {nRepor === 1 ? 'item' : 'itens'}</span>}
        </button>
        <button className="linha menu-item" onClick={irEntrada}>
          <span className="meio"><strong>Entrada de mercadoria</strong><span className="sutil">Receber pedido ou entrada avulsa</span></span>
          {nAbertos > 0 && <span className="badge">{nAbertos} a receber</span>}
        </button>
      </section>

      <section className="secao">
        <p className="rotulo">Sincronização</p>
        <div className="cartao">
          <small>{ultimaSync ? `Última: ${new Date(ultimaSync).toLocaleString('pt-BR')}` : 'Ainda não sincronizou'}</small>
          <small>{pendentes} {pendentes === 1 ? 'movimentação aguardando envio' : 'movimentações aguardando envio'}{comErro ? ` · ${comErro} com erro (a coordenação revisa)` : ''}</small>
          <button className="btn-sec" style={{ marginTop: 6, display: 'inline-flex', gap: 6, alignItems: 'center' }} onClick={sincronizarAgora}><IcSync /> Sincronizar agora</button>
        </div>
      </section>

      <section className="secao">
        <p className="rotulo">Modo</p>
        <div className="chips" role="group" aria-label="Modo de cor">
          <button className="chip" aria-pressed={modo === 'claro'} onClick={() => setModo('claro')}>Claro</button>
          <button className="chip" aria-pressed={modo === 'escuro'} onClick={() => setModo('escuro')}>Escuro</button>
        </div>
      </section>

      <section className="secao">
        <p className="rotulo">Tema</p>
        {TEMAS.map(t => (
          <button key={t.id} className="linha" aria-pressed={tema === t.id} onClick={() => setTema(t.id)} style={tema === t.id ? { border: '2px solid var(--accent)', background: 'var(--soft)' } : undefined}>
            <span className="meio"><strong>{t.nome}</strong><span className="sutil">{t.desc}</span></span>
            {tema === t.id && <b style={{ color: 'var(--accent)', fontSize: 13 }}>Em uso</b>}
          </button>
        ))}
      </section>

      <p className="sutil">Vacinação, painel e calendário entram nas próximas versões, seguindo o protótipo.</p>

      <button className="linha" onClick={sair}><IcSair /><span className="meio"><strong>Sair</strong><span className="sutil">{pendentes ? 'Sincronize antes de sair' : 'Encerrar a sessão neste aparelho'}</span></span></button>
    </>
  );
}

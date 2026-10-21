import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { carregarPerfil, sincronizar, type Perfil } from './lib/sync';
import { db, gravarMeta, lerMeta } from './lib/db';
import { useEstoque, type ItemEstoque } from './lib/useEstoque';
import { aprovarPedido, desfazerBaixa, registrarBaixa, registrarEntrada, registrarPerdaVencido, type DadosEntrada } from './lib/acoes';
import type { LoteSaldo } from './lib/estoque';
import { Login } from './screens/Login';
import { Inicio } from './screens/Inicio';
import { EstoqueTela } from './screens/EstoqueTela';
import { Validades } from './screens/Validades';
import { Mais } from './screens/Mais';
import { Reposicao } from './screens/Reposicao';
import { Entrada } from './screens/Entrada';
import { Calendario } from './screens/Calendario';
import { Vacinas } from './screens/Vacinas';
import { aplicarTema, resolverTema } from './lib/temas';
import { BaixaSheet } from './components/BaixaSheet';
import { IcCaixa, IcCalendario, IcInicio, IcLua, IcMais, IcSol, IcSync, IcVacina, Laco } from './components/Icones';

type Tela = 'inicio' | 'estoque' | 'vacinas' | 'validades' | 'painel' | 'mais' | 'repor' | 'entrada' | 'calendario';
type Toast = { msg: string; desfazer?: string } | null;

function lerPref(chave: string, padrao: string): string {
  try { return localStorage.getItem(chave) ?? padrao; } catch { return padrao; }
}
function gravarPref(chave: string, valor: string) {
  try { localStorage.setItem(chave, valor); } catch { /* sem armazenamento: só nesta sessão */ }
}

export default function App() {
  const [sessao, setSessao] = useState<Session | null | undefined>(undefined);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [semPerfil, setSemPerfil] = useState(false);
  const [tela, setTela] = useState<Tela>('inicio');
  const [online, setOnline] = useState(navigator.onLine);
  const [sincronizando, setSincronizando] = useState(false);
  const [ultimaSync, setUltimaSync] = useState<string | null>(null);
  const [baixa, setBaixa] = useState<ItemEstoque | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [tema, setTemaSt] = useState(() => lerPref('tema', 'campanha'));
  const [modo, setModoSt] = useState(() => lerPref('modo', matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro'));
  const timer = useRef<number>();
  const estoque = useEstoque();
  const mainRef = useRef<HTMLElement>(null);

  const temaAtual = resolverTema(tema);
  const temaEfetivo = temaAtual.id;
  useEffect(() => {
    document.documentElement.dataset.tema = temaEfetivo;
    document.documentElement.dataset.modo = modo;
    aplicarTema(temaAtual, modo === 'escuro');
  }, [temaAtual, temaEfetivo, modo]);

  const avisar = useCallback((msg: string, desfazer?: string) => {
    window.clearTimeout(timer.current);
    setToast({ msg, desfazer });
    timer.current = window.setTimeout(() => setToast(null), 6000);
  }, []);

  // Sessão
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSessao(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // Perfil e unidade
  useEffect(() => {
    if (!sessao) { setPerfil(null); return; }
    const nome = (sessao.user.user_metadata?.nome as string) || sessao.user.email || 'Usuário';
    carregarPerfil(sessao.user.id, nome).then(p => { setPerfil(p); setSemPerfil(!p); });
  }, [sessao]);

  const sincronizarAgora = useCallback(async (silencioso = false) => {
    if (!perfil) return;
    if (!navigator.onLine) { if (!silencioso) avisar('Sem internet · as baixas ficam guardadas no aparelho'); return; }
    setSincronizando(true);
    try {
      await sincronizar(perfil.unidade_id);
      setUltimaSync(await lerMeta<string>('ultima_sincronizacao') ?? null);
      if (!silencioso) avisar('Sincronizado');
    } catch (e) {
      if (!silencioso) avisar('Não foi possível sincronizar: ' + (e as Error).message);
    } finally {
      setSincronizando(false);
    }
  }, [perfil, avisar]);

  // Sincroniza ao abrir, ao reconectar e a cada 5 minutos com o app aberto (RF27)
  useEffect(() => {
    if (!perfil) return;
    lerMeta<string>('ultima_sincronizacao').then(v => setUltimaSync(v ?? null));
    sincronizarAgora(true);
    const on = () => { setOnline(true); sincronizarAgora(true); };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    const id = window.setInterval(() => sincronizarAgora(true), 5 * 60 * 1000);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); window.clearInterval(id); };
  }, [perfil, sincronizarAgora]);

  useEffect(() => { mainRef.current?.scrollTo(0, 0); }, [tela]);

  async function confirmarBaixa(qtd: number) {
    if (!perfil || !baixa) return;
    try {
      const grupo = await registrarBaixa(perfil, baixa.fefo, qtd);
      avisar(`Baixa de ${qtd} ${baixa.unidade} registrada`, grupo);
      setBaixa(null);
      if (navigator.onLine) sincronizarAgora(true);
    } catch (e) {
      avisar((e as Error).message);
    }
  }

  async function desfazer(grupo: string) {
    if (!perfil) return;
    const r = await desfazerBaixa(perfil, grupo);
    avisar(r === 'expirada' ? 'Passou de 5 minutos: peça um ajuste à coordenação' : r === 'cancelada' ? 'Baixa desfeita' : 'Baixa desfeita · estorno registrado');
    if (navigator.onLine) sincronizarAgora(true);
  }

  async function perderVencido(l: LoteSaldo) {
    if (!perfil) return;
    await registrarPerdaVencido(perfil, l);
    avisar('Perda registrada · aguarda aprovação');
    if (navigator.onLine) sincronizarAgora(true);
  }

  async function aprovar(itens: { produto_id: number; qtd_sugerida: number; qtd_pedida: number }[]) {
    if (!perfil) return;
    try {
      const num = await aprovarPedido(perfil, itens);
      await sincronizarAgora(true);
      avisar(`Pedido #${String(num).padStart(3, '0')} enviado ao almoxarifado`);
    } catch (e) {
      avisar((e as Error).message);
    }
  }

  async function receber(d: DadosEntrada) {
    if (!perfil) return;
    const status = await registrarEntrada(perfil, d);
    await sincronizarAgora(true);
    avisar(status === 'recebido' ? 'Entrada registrada · pedido recebido por completo' : status === 'parcial' ? 'Entrada registrada · pedido parcialmente recebido' : 'Entrada registrada');
  }

  async function sair() {
    const pend = await db.fila.where('status').anyOf('pendente', 'erro').count();
    if (pend > 0) { avisar(`Há ${pend} movimentações não enviadas. Sincronize antes de sair.`); return; }
    await supabase.auth.signOut();
    await db.delete();
    await db.open();
    await gravarMeta('dispositivo_id', crypto.randomUUID());
  }

  if (sessao === undefined) return null;
  if (!sessao) return <Login />;
  if (semPerfil) {
    return (
      <div className="login">
        <h1>Sem unidade vinculada</h1>
        <p className="sutil">Seu usuário ainda não tem perfil numa unidade. Peça ao administrador para vincular.</p>
        <button className="btn" onClick={() => supabase.auth.signOut()}>Sair</button>
      </div>
    );
  }
  if (!perfil) return null;

  const pend = estoque.pendentes;
  const syncClasse = estoque.comErro ? 'pilula erro' : online ? 'pilula' : 'pilula offline';
  const syncTxt = !online ? `Offline · ${pend} ${pend === 1 ? 'pendente' : 'pendentes'}` : sincronizando ? 'Sincronizando…' : pend ? `${pend} a enviar` : 'Online';

  const abas: { id: Tela; nome: string; Ic: typeof IcInicio }[] = [
    { id: 'inicio', nome: 'Início', Ic: IcInicio },
    { id: 'estoque', nome: 'Estoque', Ic: IcCaixa },
    { id: 'vacinas', nome: 'Vacinas', Ic: IcVacina },
    { id: 'validades', nome: 'Validades', Ic: IcCalendario },
    { id: 'mais', nome: 'Mais', Ic: IcMais }
  ];

  return (
    <div className="app">
      <header className="topo">
        <div style={{ minWidth: 0 }}>
          <h1>{perfil.unidade_nome}{temaEfetivo === 'rosa' && <Laco />}</h1>
          <p>Estoque · {perfil.nome}</p>
        </div>
        <div className="acoes">
          <button className={syncClasse} onClick={() => sincronizarAgora()} aria-label="Sincronizar agora"><IcSync />{syncTxt}</button>
          <button className="redondo" onClick={() => { const m = modo === 'escuro' ? 'claro' : 'escuro'; setModoSt(m); gravarPref('modo', m); }} aria-label={modo === 'escuro' ? 'Ativar modo claro' : 'Ativar modo escuro'}>
            {modo === 'escuro' ? <IcSol /> : <IcLua />}
          </button>
        </div>
      </header>

      <main ref={mainRef}>
        {!estoque.carregado || (estoque.itens.length === 0 && !ultimaSync) ? (
          <p className="sutil">Carregando o estoque da unidade…</p>
        ) : (
          <>
            {tela === 'inicio' && <Inicio estoque={estoque} abrirBaixa={setBaixa} irValidades={() => setTela('validades')} irEstoque={() => setTela('repor')} />}
            {tela === 'repor' && <Reposicao estoque={estoque} podeAprovar={['coordenador', 'admin'].includes(perfil.perfil)} voltar={() => setTela('mais')} aprovar={aprovar} />}
            {tela === 'entrada' && <Entrada estoque={estoque} voltar={() => setTela('mais')} registrar={receber} />}
            {tela === 'calendario' && <Calendario estoque={estoque} voltar={() => setTela('mais')} />}
            {tela === 'vacinas' && <Vacinas perfil={perfil} estoque={estoque} avisar={avisar} sincronizar={() => sincronizarAgora(true)} />}
            {tela === 'estoque' && <EstoqueTela estoque={estoque} abrirBaixa={setBaixa} />}
            {tela === 'validades' && <Validades estoque={estoque} perderVencido={perderVencido} />}
            {tela === 'mais' && (
              <Mais perfil={perfil} tema={tema} setTema={t => { setTemaSt(t); gravarPref('tema', t); }} modo={modo} setModo={m => { setModoSt(m); gravarPref('modo', m); }}
                ultimaSync={ultimaSync} pendentes={pend} comErro={estoque.comErro} sincronizarAgora={() => sincronizarAgora()} sair={sair}
                irRepor={() => setTela('repor')} irEntrada={() => setTela('entrada')} irCalendario={() => setTela('calendario')}
                nRepor={estoque.itens.filter(i => i.repor).length} nAbertos={estoque.pedidos.filter(p => p.status !== 'recebido').length} />
            )}
          </>
        )}
        {temaEfetivo === 'rosa' && (
          <footer className="rodape-rosa"><Laco size={18} /><b>Outubro Rosa</b><em>Prevenir é proteger</em></footer>
        )}
      </main>

      <nav className="barra" aria-label="Navegação principal">
        {abas.map(({ id, nome, Ic }) => (
          <button key={id} aria-current={tela === id || (id === 'mais' && (tela === 'repor' || tela === 'entrada' || tela === 'calendario')) ? 'page' : undefined} onClick={() => setTela(id)}>
            <span className="pil"><Ic /></span>{nome}
          </button>
        ))}
      </nav>

      {toast && (
        <div className="toast" role="status">
          <span>{toast.msg}</span>
          {toast.desfazer && <button onClick={() => { const g = toast.desfazer!; setToast(null); desfazer(g); }}>Desfazer</button>}
        </div>
      )}
      {baixa && <BaixaSheet item={baixa} confirmar={confirmarBaixa} fechar={() => setBaixa(null)} />}
    </div>
  );
}

import { useState, type FormEvent } from 'react';
import { diasAte, formatarNumero } from '../lib/estoque';
import type { Estoque } from '../lib/useEstoque';
import type { DadosEntrada } from '../lib/acoes';

interface Props { estoque: Estoque; voltar: () => void; registrar: (d: DadosEntrada) => Promise<void> }

const ORIGENS: { id: DadosEntrada['origem']; nome: string }[] = [
  { id: 'almoxarifado', nome: 'Almoxarifado' },
  { id: 'programa_estadual', nome: 'Programa estadual' },
  { id: 'programa_federal', nome: 'Programa federal' },
  { id: 'doacao', nome: 'Doação' }
];

export function Entrada({ estoque, voltar, registrar }: Props) {
  const abertos = estoque.pedidos.filter(p => p.status !== 'recebido');
  const [fonte, setFonte] = useState<number | 'avulsa'>(abertos[0]?.id ?? 'avulsa');
  const [produto, setProduto] = useState<number | null>(null);
  const [lote, setLote] = useState('');
  const [validade, setValidade] = useState('');
  const [qtd, setQtd] = useState('');
  const [emCaixa, setEmCaixa] = useState(false);
  const [origem, setOrigem] = useState<DadosEntrada['origem']>('almoxarifado');
  const [doc, setDoc] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const pedido = fonte === 'avulsa' ? null : estoque.pedidos.find(p => p.id === fonte) ?? null;
  const item = estoque.itens.find(i => i.id === produto) ?? null;
  const n = parseInt(qtd, 10);
  const total = item && n > 0 ? (emCaixa && item.embalagem ? n * item.embalagem.fator : n) : 0;

  function escolher(id: number, sugestao = 0) {
    setProduto(id);
    setQtd(sugestao ? String(sugestao) : '');
    setEmCaixa(false);
    setLote('');
    setValidade('');
    setDoc(pedido ? `Pedido #${String(pedido.numero).padStart(3, '0')}` : '');
    setErro('');
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!item) return;
    if (!lote.trim()) return setErro('Informe o lote.');
    if (!validade) return setErro('Informe a validade.');
    if (diasAte(validade) < 0) return setErro('Validade já vencida: entrada recusada.');
    if (!(total > 0)) return setErro('Informe uma quantidade maior que zero.');
    setEnviando(true);
    setErro('');
    try {
      await registrar({ produto_id: item.id, lote: lote.trim().toUpperCase(), validade, quantidade: total, origem, documento: doc, pedido_id: pedido?.id ?? null });
      setProduto(null);
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <div className="cab-sub">
        <button className="redondo" onClick={voltar} aria-label="Voltar">‹</button>
        <h2 className="titulo">Entrada de mercadoria</h2>
      </div>

      <section className="secao">
        <p className="rotulo">Recebendo</p>
        <div className="chips" role="group" aria-label="Origem da entrada">
          {abertos.map(p => (
            <button key={p.id} className="chip" aria-pressed={fonte === p.id} onClick={() => { setFonte(p.id); setProduto(null); }}>Pedido #{String(p.numero).padStart(3, '0')}</button>
          ))}
          <button className="chip" aria-pressed={fonte === 'avulsa'} onClick={() => { setFonte('avulsa'); setProduto(null); }}>Entrada avulsa</button>
        </div>
      </section>

      <section className="secao">
        <p className="rotulo">{pedido ? 'Itens do pedido' : 'Produto'}</p>
        <div className="grade">
          {pedido
            ? pedido.itens.map(i => {
                const falta = Math.max(0, i.qtd_pedida - i.qtd_recebida);
                return (
                  <button key={i.id} className="tile tile-baixo" disabled={falta === 0} aria-pressed={produto === i.produto_id} onClick={() => escolher(i.produto_id, falta)}
                    style={produto === i.produto_id ? { border: '2px solid var(--accent)' } : undefined}>
                    <strong>{i.nome}</strong>
                    <span>{falta === 0 ? 'Recebido' : `Falta receber ${formatarNumero(falta)} ${i.unidade}`}</span>
                  </button>
                );
              })
            : estoque.itens.map(i => (
                <button key={i.id} className="tile tile-baixo" aria-pressed={produto === i.id} onClick={() => escolher(i.id)}
                  style={produto === i.id ? { border: '2px solid var(--accent)' } : undefined}>
                  <strong>{i.nome}</strong>
                  <span>Saldo {formatarNumero(i.disponivel)} {i.unidade}</span>
                </button>
              ))}
        </div>
      </section>

      {item && (
        <form className="cartao form-entrada" onSubmit={enviar} noValidate>
          <strong style={{ fontSize: 18 }}>{item.nome}</strong>
          <div className="duas">
            <div className="campo">
              <label htmlFor="ent-lote">Lote</label>
              <input id="ent-lote" value={lote} onChange={e => setLote(e.target.value)} placeholder="Ex.: GZ902" autoCapitalize="characters" />
            </div>
            <div className="campo">
              <label htmlFor="ent-val">Validade</label>
              <input id="ent-val" type="date" value={validade} onChange={e => setValidade(e.target.value)} />
            </div>
          </div>
          <div className="campo">
            <label htmlFor="ent-qtd">Quantidade recebida</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input id="ent-qtd" type="number" inputMode="numeric" min={1} value={qtd} onChange={e => setQtd(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
              {item.embalagem && (
                <div className="chips" style={{ margin: 0, padding: 0 }} role="group" aria-label="Unidade da quantidade">
                  <button type="button" className="chip" aria-pressed={!emCaixa} onClick={() => setEmCaixa(false)}>{item.unidade}</button>
                  <button type="button" className="chip" aria-pressed={emCaixa} onClick={() => setEmCaixa(true)}>{item.embalagem.nome} {item.embalagem.fator}</button>
                </div>
              )}
            </div>
            <small className="sutil">{total > 0 ? `Entram ${formatarNumero(total)} ${item.unidade} no estoque` : `O estoque conta sempre na menor unidade (${item.unidade})`}</small>
          </div>
          <div className="campo">
            <span className="rotulo">Origem</span>
            <div className="chips" style={{ margin: 0, padding: 0, flexWrap: 'wrap' }}>
              {ORIGENS.map(o => <button type="button" key={o.id} className="chip" aria-pressed={origem === o.id} onClick={() => setOrigem(o.id)}>{o.nome}</button>)}
            </div>
          </div>
          <div className="campo">
            <label htmlFor="ent-doc">Nº da nota ou guia (opcional)</label>
            <input id="ent-doc" value={doc} onChange={e => setDoc(e.target.value)} />
          </div>
          {erro && <p className="erro-txt" role="alert">{erro}</p>}
          <button className="btn" type="submit" disabled={enviando}>{enviando ? 'Registrando…' : 'Registrar entrada'}</button>
        </form>
      )}
    </>
  );
}

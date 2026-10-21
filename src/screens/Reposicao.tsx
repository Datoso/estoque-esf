import { useState } from 'react';
import { formatarData, formatarNumero } from '../lib/estoque';
import type { Estoque } from '../lib/useEstoque';

interface Props {
  estoque: Estoque;
  podeAprovar: boolean;
  voltar: () => void;
  aprovar: (itens: { produto_id: number; qtd_sugerida: number; qtd_pedida: number }[]) => Promise<void>;
}

const STATUS: Record<string, { txt: string; cls: string }> = {
  enviado: { txt: 'Enviado', cls: 'st-enviado' },
  atendido: { txt: 'Atendido', cls: 'st-enviado' },
  parcial: { txt: 'Parcial', cls: 'st-parcial' },
  recebido: { txt: 'Recebido', cls: 'st-recebido' }
};

export function Reposicao({ estoque, podeAprovar, voltar, aprovar }: Props) {
  const [qtd, setQtd] = useState<Record<number, number>>({});
  const [fora, setFora] = useState<Record<number, boolean>>({});
  const [enviando, setEnviando] = useState(false);

  const lista = estoque.itens.filter(i => i.repor);
  const valor = (id: number, sug: number) => qtd[id] ?? sug;
  const incluidos = lista.filter(i => !fora[i.id] && valor(i.id, i.sugerida) > 0);
  const custo = incluidos.reduce((s, i) => s + valor(i.id, i.sugerida) * i.custo, 0);

  async function enviar() {
    setEnviando(true);
    try {
      await aprovar(incluidos.map(i => ({ produto_id: i.id, qtd_sugerida: i.sugerida, qtd_pedida: valor(i.id, i.sugerida) })));
      setQtd({});
      setFora({});
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <div className="cab-sub">
        <button className="redondo" onClick={voltar} aria-label="Voltar">‹</button>
        <h2 className="titulo">Reposição</h2>
      </div>
      <p className="sutil">
        Itens no ponto de pedido ou abaixo. A sugestão cobre {formatarNumero(estoque.config.periodo_cobertura_meses)} meses de consumo, já descontando o saldo e o que está a caminho.
      </p>

      {lista.length === 0 && <div className="cartao"><small>Nada para repor agora. Todos os itens estão acima do ponto de pedido ou já têm pedido a caminho.</small></div>}

      {lista.map(i => {
        const passo = i.embalagem?.fator ?? (i.cmm >= 50 ? 10 : 1);
        const q = valor(i.id, i.sugerida);
        const off = !!fora[i.id];
        return (
          <div key={i.id} className="cartao" style={{ gap: 10, opacity: off ? 0.55 : 1, borderStyle: off ? 'dashed' : 'solid' }}>
            <div className="secao-topo">
              <strong>{i.nome}</strong>
              <button className="chip" onClick={() => setFora(f => ({ ...f, [i.id]: !off }))}>{off ? 'Incluir' : 'Remover'}</button>
            </div>
            <div className="trio">
              <span><small>Disponível</small><b style={{ color: 'var(--vermelho)' }}>{formatarNumero(i.disponivel)} {i.unidade}</b></span>
              <span><small>Ponto de pedido</small><b>{formatarNumero(i.ponto)} {i.unidade}</b></span>
              <span><small>Consumo/mês</small><b>{formatarNumero(i.cmm)} {i.unidade}</b></span>
            </div>
            {i.transito > 0 && <small>A caminho: {formatarNumero(i.transito)} {i.unidade}</small>}
            {!off && (
              <div className="ajuste">
                <button aria-label="Diminuir" onClick={() => setQtd(s => ({ ...s, [i.id]: Math.max(0, q - passo) }))}>−</button>
                <span><b>{formatarNumero(q)} {i.unidade}</b><small>{i.embalagem ? `${q / i.embalagem.fator} ${i.embalagem.nome} de ${i.embalagem.fator}` : `sugerido: ${formatarNumero(i.sugerida)}`}</small></span>
                <button aria-label="Aumentar" onClick={() => setQtd(s => ({ ...s, [i.id]: q + passo }))}>+</button>
              </div>
            )}
          </div>
        );
      })}

      {lista.length > 0 && (
        <div className="secao">
          <p className="sutil">{incluidos.length} {incluidos.length === 1 ? 'item' : 'itens'} · custo estimado {custo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
          {podeAprovar
            ? <button className="btn" disabled={!incluidos.length || enviando} onClick={enviar}>{enviando ? 'Enviando…' : 'Aprovar e enviar ao almoxarifado'}</button>
            : <p className="sutil"><b>Só a coordenação aprova o pedido.</b> Avise a coordenadora que há itens para repor.</p>}
        </div>
      )}

      {estoque.pedidos.length > 0 && (
        <section className="secao">
          <p className="rotulo">Pedidos dos últimos 60 dias</p>
          {estoque.pedidos.map(p => {
            const st = STATUS[p.status] ?? { txt: p.status, cls: 'st-enviado' };
            return (
              <div key={p.id} className="cartao">
                <div className="secao-topo">
                  <strong>Pedido #{String(p.numero).padStart(3, '0')}</strong>
                  <span className={'status ' + st.cls}>{st.txt}</span>
                </div>
                <small>{formatarData(p.criado_em.slice(0, 10))} · {p.itens.map(i => `${i.nome}: ${formatarNumero(i.qtd_recebida)}/${formatarNumero(i.qtd_pedida)}`).join(' · ')}</small>
              </div>
            );
          })}
        </section>
      )}
    </>
  );
}

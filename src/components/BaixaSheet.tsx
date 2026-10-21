import { useState } from 'react';
import { diasAte, faixa, formatarData, formatarNumero, planejarBaixa } from '../lib/estoque';
import type { ItemEstoque } from '../lib/useEstoque';

const COR = { vencido: 'var(--vencido)', vermelho: 'var(--vermelho)', amarelo: 'var(--amarelo)', verde: 'var(--verde)' } as const;

export function BaixaSheet({ item, confirmar, fechar }: { item: ItemEstoque; confirmar: (qtd: number) => void; fechar: () => void }) {
  const [qtd, setQtd] = useState(1);
  const prim = item.fefo[0];
  const partes = item.disponivel >= qtd ? planejarBaixa(item.fefo, qtd) : [];
  return (
    <div className="veu" onClick={fechar}>
      <div className="folha" role="dialog" aria-modal="true" aria-labelledby="baixa-titulo" onClick={e => e.stopPropagation()}>
        <div>
          <p className="rotulo">Dar baixa</p>
          <h2 id="baixa-titulo">{item.nome}</h2>
          <p className="sutil">Disponível: {formatarNumero(item.disponivel)} {item.unidade}</p>
        </div>
        <div className="lote-info">
          <span className="ponto" style={{ background: prim ? COR[faixa(diasAte(prim.validade))] : 'var(--vencido)' }} aria-hidden="true" />
          <span>{prim ? `Lote ${prim.numero} · vence ${formatarData(prim.validade)} (sai primeiro)` : 'Sem lote disponível'}</span>
        </div>
        <div className="contador">
          <button aria-label="Diminuir quantidade" disabled={qtd <= 1} onClick={() => setQtd(q => Math.max(1, q - 1))}>−</button>
          <span className="valor"><b>{qtd}</b><span className="sutil">{item.unidade}</span></span>
          <button aria-label="Aumentar quantidade" disabled={qtd >= item.disponivel} onClick={() => setQtd(q => Math.min(item.disponivel, q + 1))}>+</button>
        </div>
        {partes.length > 1 && <p className="sutil" style={{ textAlign: 'center' }}>Esta baixa usa {partes.length} lotes, começando pelo que vence primeiro</p>}
        <button className="btn" disabled={item.disponivel === 0} onClick={() => confirmar(qtd)}>Confirmar baixa</button>
        <button className="btn-link" onClick={fechar}>Cancelar</button>
      </div>
    </div>
  );
}

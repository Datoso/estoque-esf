import { useState } from 'react';
import { formatarNumero } from '../lib/estoque';
import type { Estoque, ItemEstoque } from '../lib/useEstoque';

const COR = { vencido: 'var(--vencido)', vermelho: 'var(--vermelho)', amarelo: 'var(--amarelo)', verde: 'var(--verde)' } as const;

export function EstoqueTela({ estoque, abrirBaixa }: { estoque: Estoque; abrirBaixa: (i: ItemEstoque) => void }) {
  const [cat, setCat] = useState<number | 'todas'>('todas');
  const grupos = estoque.categorias
    .filter(c => cat === 'todas' || c.id === cat)
    .map(c => ({ ...c, itens: estoque.itens.filter(i => i.categoriaId === c.id) }))
    .filter(g => g.itens.length);

  return (
    <>
      <div>
        <h2 className="titulo">Estoque da unidade</h2>
        <p className="sutil">Toque num item para dar baixa.</p>
      </div>
      <div className="chips" role="group" aria-label="Filtrar por categoria">
        <button className="chip" aria-pressed={cat === 'todas'} onClick={() => setCat('todas')}>Todas</button>
        {estoque.categorias.map(c => (
          <button key={c.id} className="chip" aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>{c.nome}</button>
        ))}
      </div>
      {grupos.map(g => {
        const nRepor = g.itens.filter(i => i.repor).length;
        return (
          <section key={g.id} className="secao">
            <div className="secao-topo">
              <strong>{g.nome}</strong>
              <span className="sutil" style={{ fontSize: 12 }}>{g.itens.length} {g.itens.length === 1 ? 'item' : 'itens'}{nRepor ? ` · ${nRepor} para repor` : ''}</span>
            </div>
            {g.itens.map(i => (
              <button key={i.id} className="linha" onClick={() => abrirBaixa(i)}>
                <span className="ponto" style={{ background: COR[i.pior] }} aria-hidden="true" />
                <span className="meio">
                  <strong>{i.nome}</strong>
                  {i.repor && <span className="tag-repor">Hora de repor</span>}
                </span>
                <span className="num">{formatarNumero(i.disponivel)} {i.unidade}</span>
              </button>
            ))}
          </section>
        );
      })}
    </>
  );
}

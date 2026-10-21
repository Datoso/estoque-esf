import { diasAte, faixa, formatarData, formatarNumero, type Faixa, type LoteSaldo } from '../lib/estoque';
import type { Estoque } from '../lib/useEstoque';

const GRUPOS: { f: Faixa; nome: string; cor: string }[] = [
  { f: 'vencido', nome: 'Vencidos', cor: 'var(--vencido)' },
  { f: 'vermelho', nome: 'Vencem em até 30 dias', cor: 'var(--vermelho)' },
  { f: 'amarelo', nome: 'Vencem em 31 a 60 dias', cor: 'var(--amarelo)' },
  { f: 'verde', nome: 'Mais de 60 dias', cor: 'var(--verde)' }
];

export function Validades({ estoque, perderVencido }: { estoque: Estoque; perderVencido: (l: LoteSaldo) => void }) {
  const linhas = estoque.itens.flatMap(i => i.lotes.map(l => ({ item: i, lote: l, dias: diasAte(l.validade) })));
  return (
    <>
      <h2 className="titulo">Validades</h2>
      {GRUPOS.map(g => {
        const rows = linhas.filter(r => faixa(r.dias) === g.f).sort((a, b) => a.dias - b.dias);
        if (!rows.length) return null;
        return (
          <section key={g.f} className="secao">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="ponto" style={{ background: g.cor }} aria-hidden="true" />
              <strong>{g.nome}</strong>
              <span className="sutil">({rows.length})</span>
            </div>
            {rows.map(r => (
              <div key={r.lote.id} className="cartao">
                <strong>{r.item.nome}</strong>
                <small>Lote {r.lote.numero} · {formatarNumero(r.lote.saldo)} {r.item.unidade} · vence {formatarData(r.lote.validade)}</small>
                <b style={{ color: g.cor, fontSize: 14 }}>
                  {r.dias < 0 ? `Vencido há ${-r.dias} ${-r.dias === 1 ? 'dia' : 'dias'}` : r.dias === 0 ? 'Vence hoje' : `Vence em ${r.dias} ${r.dias === 1 ? 'dia' : 'dias'}`}
                </b>
                {r.dias < 0 && <button className="btn-sec" style={{ marginTop: 6 }} onClick={() => perderVencido(r.lote)}>Registrar perda para descarte</button>}
              </div>
            ))}
          </section>
        );
      })}
    </>
  );
}

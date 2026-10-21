import { useState } from 'react';
import { casaBusca, diasAte, formatarNumero } from '../lib/estoque';
import type { Estoque, ItemEstoque } from '../lib/useEstoque';
import { IcAmpulheta, IcCarrinho, IcLixeira, IcSeta } from '../components/Icones';

interface Props { estoque: Estoque; abrirBaixa: (item: ItemEstoque) => void; irValidades: () => void; irEstoque: () => void }

export function Inicio({ estoque, abrirBaixa, irValidades, irEstoque }: Props) {
  const [busca, setBusca] = useState('');
  const lista = busca.trim()
    ? estoque.itens.filter(i => casaBusca(i.nome, busca))
    : estoque.itens.filter(i => i.favorito);

  const repor = estoque.itens.filter(i => i.repor).length;
  let vencidos = 0;
  let vencendo = 0;
  for (const i of estoque.itens) for (const l of i.lotes) {
    const d = diasAte(l.validade);
    if (d < 0) vencidos++;
    else if (d <= 30) vencendo++;
  }

  return (
    <>
      <div className="campo">
        <label htmlFor="busca" className="rotulo">Buscar item</label>
        <input id="busca" className="busca" type="search" placeholder="Ex.: luva, dipirona" value={busca} onChange={e => setBusca(e.target.value)} />
      </div>

      <p className="rotulo">{busca.trim() ? 'Resultados' : 'Mais usados'}</p>
      <div className="grade">
        {lista.map(i => (
          <button key={i.id} className={'tile' + (i.repor ? ' repor' : '')} onClick={() => abrirBaixa(i)}>
            <strong>{i.nome}</strong>
            <span>
              {formatarNumero(i.disponivel)} {i.unidade}
              {i.repor && <><br /><b className="tag-repor">Hora de repor</b></>}
            </span>
          </button>
        ))}
      </div>
      {lista.length === 0 && <p className="sutil">Nenhum item encontrado.</p>}

      {(repor > 0 || vencidos > 0 || vencendo > 0) && (
        <section className="secao">
          <p className="rotulo">Avisos</p>
          {repor > 0 && (
            <button className="aviso" onClick={irEstoque}>
              <IcCarrinho className="ic" />
              <span className="txt"><strong>{repor} {repor === 1 ? 'item na hora de repor' : 'itens na hora de repor'}</strong><small>No estoque mínimo ou abaixo</small></span>
              <IcSeta />
            </button>
          )}
          {vencidos > 0 && (
            <button className="aviso critico" onClick={irValidades}>
              <IcLixeira className="ic" />
              <span className="txt"><strong>{vencidos} {vencidos === 1 ? 'lote vencido' : 'lotes vencidos'}</strong><small>Separar e registrar perda para descarte</small></span>
              <IcSeta />
            </button>
          )}
          {vencendo > 0 && (
            <button className="aviso" onClick={irValidades}>
              <IcAmpulheta className="ic" />
              <span className="txt"><strong>{vencendo} {vencendo === 1 ? 'lote vence' : 'lotes vencem'} em até 30 dias</strong><small>Usar primeiro ou remanejar</small></span>
              <IcSeta />
            </button>
          )}
        </section>
      )}
    </>
  );
}

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { diasAte, formatarData, formatarNumero } from '../lib/estoque';
import type { Estoque } from '../lib/useEstoque';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

interface Props { estoque: Estoque; irRepor: () => void; irValidades: () => void; irVacinas: () => void }

export function Painel({ estoque, irRepor, irValidades, irVacinas }: Props) {
  const agora = new Date();
  const mesIso = agora.toLocaleDateString('sv-SE').slice(0, 7);
  const vac = useLiveQuery(async () => {
    const [aplicacoes, frascos] = await Promise.all([db.aplicacoes.toArray(), db.frascos.toArray()]);
    return {
      doses: aplicacoes.filter(a => a.criado_em_dispositivo.slice(0, 7) === mesIso).length,
      perdidas: frascos.filter(f => (f.encerrado_em ?? '').slice(0, 7) === mesIso).reduce((s, f) => s + (f.doses_perdidas ?? 0), 0)
    };
  }, [mesIso]) ?? { doses: 0, perdidas: 0 };

  const insumos = estoque.itens.filter(i => i.tipo === 'insumo');
  const valor = insumos.reduce((s, i) => s + i.disponivel * i.custo, 0);
  const repor = estoque.itens.filter(i => i.repor);
  let vencendo = 0;
  let vencidos = 0;
  for (const i of estoque.itens) for (const l of i.lotes) {
    const d = diasAte(l.validade);
    if (d < 0) vencidos++;
    else if (d <= 30) vencendo++;
  }
  const perdaPct = vac.doses + vac.perdidas > 0 ? (vac.perdidas / (vac.doses + vac.perdidas)) * 100 : 0;

  const kpis = [
    { rot: 'Valor em estoque', val: brl(valor), nota: 'Insumos dentro da validade', cor: 'var(--ink)', ir: undefined },
    { rot: 'Itens para repor', val: String(repor.length), nota: repor.length ? 'Abrir a reposição' : 'Tudo acima do ponto', cor: repor.length ? 'var(--vermelho)' : 'var(--verde)', ir: irRepor },
    { rot: 'Lotes vencendo em 30 dias', val: String(vencendo), nota: vencidos ? `${vencidos} já vencido${vencidos > 1 ? 's' : ''}` : 'Nenhum vencido', cor: vencendo || vencidos ? 'var(--amarelo)' : 'var(--verde)', ir: irValidades },
    { rot: 'Doses de vacina no mês', val: formatarNumero(vac.doses), nota: 'Registradas neste aparelho', cor: 'var(--ink)', ir: irVacinas },
    { rot: 'Perda técnica de vacinas', val: perdaPct.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%', nota: `${vac.perdidas} ${vac.perdidas === 1 ? 'dose' : 'doses'} no mês`, cor: vac.perdidas ? 'var(--amarelo)' : 'var(--verde)', ir: irVacinas },
    { rot: 'Pedidos a receber', val: String(estoque.pedidos.filter(p => p.status !== 'recebido').length), nota: 'Enviados ao almoxarifado', cor: 'var(--ink)', ir: irRepor }
  ];

  const barras = insumos
    .filter(i => i.ponto > 0)
    .map(i => ({ i, razao: i.disponivel / i.ponto }))
    .sort((a, b) => a.razao - b.razao);

  return (
    <>
      <div>
        <h2 className="titulo">Painel da ESF</h2>
        <p className="sutil">{MESES[agora.getMonth()].replace(/^./, c => c.toUpperCase())} de {agora.getFullYear()}</p>
      </div>

      <div className="painel-kpis">
        {kpis.map(k => {
          const conteudo = (
            <>
              <span className="painel-rot">{k.rot}</span>
              <span className="painel-val" style={{ color: k.cor }}>{k.val}</span>
              <span className="painel-nota">{k.nota}</span>
            </>
          );
          return k.ir
            ? <button key={k.rot} className="painel-kpi" onClick={k.ir}>{conteudo}</button>
            : <div key={k.rot} className="painel-kpi">{conteudo}</div>;
        })}
      </div>

      <section className="secao">
        <strong>Saldo em relação ao ponto de pedido</strong>
        <p className="sutil" style={{ fontSize: 13 }}>A marca vertical é o ponto de pedido. Barra vermelha: hora de repor.</p>
        {barras.map(({ i }) => {
          const escala = Math.max(i.disponivel, i.ponto * 2, 1);
          return (
            <div key={i.id} className="painel-barra">
              <div className="secao-topo"><span className="painel-nome">{i.nome}</span><span className="painel-num">{formatarNumero(i.disponivel)} / {formatarNumero(i.ponto)} {i.unidade}</span></div>
              <div className="painel-trilho" role="img" aria-label={`${i.nome}: ${i.disponivel} disponível, ponto de pedido ${i.ponto}`}>
                <div className="painel-cheio" style={{ width: `${Math.max(2, (i.disponivel / escala) * 100)}%`, background: i.disponivel <= i.ponto ? 'var(--vermelho)' : 'var(--accent)' }} />
                <div className="painel-marca" style={{ left: `${(i.ponto / escala) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </section>

      <section className="secao">
        <strong>Pedidos ao almoxarifado</strong>
        {estoque.pedidos.length === 0 && <p className="sutil">Nenhum pedido nos últimos 60 dias.</p>}
        {estoque.pedidos.map(p => (
          <div key={p.id} className="cartao">
            <div className="secao-topo">
              <strong>Pedido #{String(p.numero).padStart(3, '0')}</strong>
              <span className={'status ' + (p.status === 'recebido' ? 'st-recebido' : p.status === 'parcial' ? 'st-parcial' : 'st-enviado')}>{p.status === 'recebido' ? 'Recebido' : p.status === 'parcial' ? 'Parcial' : 'Enviado'}</span>
            </div>
            <small>{formatarData(p.criado_em.slice(0, 10))} · {p.itens.length} {p.itens.length === 1 ? 'item' : 'itens'}</small>
          </div>
        ))}
      </section>
    </>
  );
}

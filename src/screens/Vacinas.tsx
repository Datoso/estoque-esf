import type { Perfil } from '../lib/sync';
import type { Estoque } from '../lib/useEstoque';
export function Vacinas(_p: { perfil: Perfil; estoque: Estoque; avisar: (msg: string) => void; sincronizar: () => void }) {
  return <p className="sutil">Vacinação em construção.</p>;
}

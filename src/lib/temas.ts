/** Paletas desenhadas no protótipo (agente de arte): claro/escuro, com faixa de cabeçalho e cor de apoio. */
export interface Paleta { bg: string; surface: string; line: string; accent: string; soft: string; header: string; accent2: string; ink: string; ink2: string }
export interface Tema { id: string; nome: string; desc: string; claro: Paleta; escuro: Paleta; icone?: 'laco' | 'abobora' }

export const TEMAS: Tema[] = [
  { id: 'padrao', nome: 'Padrão', desc: 'Verde-azulado de saúde, sóbrio e de alto contraste',
    claro: { bg: '#F3F7F6', surface: '#FFFFFF', line: '#D3DFDB', accent: '#0D6A5F', soft: '#DFF1EC', header: '#E6F3EF', accent2: '#2B7BA3', ink: '#10201C', ink2: '#475954' },
    escuro: { bg: '#0D1513', surface: '#16211E', line: '#2A3833', accent: '#5ED0BC', soft: '#123A33', header: '#11201C', accent2: '#7CC4E8', ink: '#E8F1EE', ink2: '#A1B3AD' } },
  { id: 'rosa', nome: 'Outubro Rosa', desc: 'Campanha de prevenção do câncer de mama', icone: 'laco',
    claro: { bg: '#FDF6F9', surface: '#FFFFFF', line: '#F0D3E1', accent: '#B0215C', soft: '#FBE4EE', header: '#FBEDF3', accent2: '#E07FA8', ink: '#2A1220', ink2: '#6A4858' },
    escuro: { bg: '#160D12', surface: '#22161D', line: '#3E2633', accent: '#F47FB0', soft: '#45192F', header: '#1F1219', accent2: '#C77DA0', ink: '#F7E9F0', ink2: '#C3A5B4' } },
  { id: 'halloween', nome: 'Halloween', desc: 'Laranja abóbora e roxo noturno', icone: 'abobora',
    claro: { bg: '#FBF5EE', surface: '#FFFFFF', line: '#E8D6C3', accent: '#B93D0B', soft: '#FFE9D3', header: '#F2ECF7', accent2: '#6B21A8', ink: '#1F1626', ink2: '#594C61' },
    escuro: { bg: '#110D16', surface: '#1C1724', line: '#352B42', accent: '#FB923C', soft: '#3A2414', header: '#1A1124', accent2: '#A78BFA', ink: '#F3ECF7', ink2: '#B3A6BF' } },
  { id: 'lavanda', nome: 'Lavanda', desc: 'Lilás suave com toque de malva',
    claro: { bg: '#F8F6FD', surface: '#FFFFFF', line: '#DDD6F2', accent: '#5F35C4', soft: '#EDE8FC', header: '#F0ECFC', accent2: '#C17BB5', ink: '#1D1830', ink2: '#565070' },
    escuro: { bg: '#131119', surface: '#1D1A27', line: '#332D47', accent: '#C3B3FB', soft: '#2E2652', header: '#191529', accent2: '#E3A8D6', ink: '#EEEBF7', ink2: '#ADA6C4' } },
  { id: 'marinho', nome: 'Marinho', desc: 'Azul-marinho clássico com detalhe dourado',
    claro: { bg: '#F3F6FA', surface: '#FFFFFF', line: '#D2DBE8', accent: '#1C3D8C', soft: '#DFE8F7', header: '#E7EDF7', accent2: '#B88A16', ink: '#0F1A2E', ink2: '#48546D' },
    escuro: { bg: '#0B1120', surface: '#141C2E', line: '#26324A', accent: '#9DC2FF', soft: '#1A2C4F', header: '#0F182E', accent2: '#E3C163', ink: '#E8EEF8', ink2: '#A3B0C6' } },
  { id: 'minimalista', nome: 'Minimalista', desc: 'Preto, branco e nada mais',
    claro: { bg: '#FFFFFF', surface: '#FFFFFF', line: '#E4E4E4', accent: '#111111', soft: '#F1F1F1', header: '#FFFFFF', accent2: '#8A8A8A', ink: '#111111', ink2: '#525252' },
    escuro: { bg: '#0A0A0A', surface: '#141414', line: '#2A2A2A', accent: '#F5F5F5', soft: '#262626', header: '#0A0A0A', accent2: '#737373', ink: '#F5F5F5', ink2: '#A3A3A3' } }
];

/** "Campanha do mês": Outubro Rosa em outubro; nos outros meses, o tema padrão. */
export function temaDaCampanha(d = new Date()): string {
  return d.getMonth() === 9 ? 'rosa' : 'padrao';
}

export function resolverTema(escolha: string): Tema {
  const id = escolha === 'campanha' ? temaDaCampanha() : escolha;
  return TEMAS.find(t => t.id === id) ?? TEMAS[0];
}

/** Aplica a paleta como variáveis CSS no :root. */
export function aplicarTema(tema: Tema, escuro: boolean) {
  const p = escuro ? tema.escuro : tema.claro;
  const r = document.documentElement.style;
  r.setProperty('--bg', p.bg);
  r.setProperty('--surface', p.surface);
  r.setProperty('--line', p.line);
  r.setProperty('--accent', p.accent);
  r.setProperty('--soft', p.soft);
  r.setProperty('--header', p.header);
  r.setProperty('--accent2', p.accent2);
  r.setProperty('--ink', p.ink);
  r.setProperty('--ink2', p.ink2);
  r.setProperty('--accent-ink', escuro ? '#0B0F0E' : '#FFFFFF');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', p.header);
}

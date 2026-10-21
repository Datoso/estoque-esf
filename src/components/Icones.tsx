/**
 * Ícones do Estoque ESF — conjunto de linha 24×24, traço 1.9, pontas e cantos arredondados.
 * Todos herdam a cor do texto (currentColor), exceto Laco e Abobora, que são coloridos pelo tema.
 */
type P = { size?: number; className?: string };
const base = (size = 22) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, focusable: 'false' as const });

/* Barra de navegação */
export const IcInicio = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M3.5 11 12 4l8.5 7" />
    <path d="M5.5 9.4V19a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5V9.4" />
    <path d="M10 20.5V16a2 2 0 0 1 4 0v4.5" />
  </svg>
);
export const IcCaixa = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <rect x="3" y="4.5" width="18" height="4.5" rx="1.4" />
    <path d="M4.5 9v9a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V9" />
    <path d="M10 13h4" />
  </svg>
);
/** Seringa na diagonal: êmbolo, corpo graduado e agulha. */
export const IcVacina = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <g transform="rotate(45 12 12)">
      <path d="M10 2.5h4M12 2.5v3" />
      <path d="M8.5 5.5h7" />
      <rect x="9.6" y="5.5" width="4.8" height="10.5" rx="1" />
      <path d="M9.6 9.2h2M9.6 12.3h2" />
      <path d="M12 16v5" />
    </g>
  </svg>
);
/** Validades: calendário com relógio. */
export const IcValidade = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M20 11V7.5A2.5 2.5 0 0 0 17.5 5h-11A2.5 2.5 0 0 0 4 7.5v10A2.5 2.5 0 0 0 6.5 20H11" />
    <path d="M8 3v4M16 3v4M4 10h16" />
    <circle cx="17" cy="17" r="4.5" />
    <path d="M17 14.9V17l1.4 1.1" />
  </svg>
);
export const IcMais = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="2" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="2" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="2" />
    <circle cx="16.75" cy="16.75" r="3.25" />
  </svg>
);

/* Menu e telas */
export const IcCalendario = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <rect x="4" y="5" width="16" height="15" rx="2.5" />
    <path d="M8 3v4M16 3v4M4 10h16" />
    <path d="M8.5 14h.01M12 14h.01M15.5 14h.01M8.5 17h.01M12 17h.01" strokeWidth="2.4" />
  </svg>
);
export const IcAgenda = IcCalendario;
export const IcPainel = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 20h16" />
    <path d="M7 16.5v-4M12 16.5V6.5M17 16.5v-7" strokeWidth="2.6" />
  </svg>
);
/** Entrada de mercadoria: bandeja com seta entrando. */
export const IcEntrada = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M12 3v8.5M8.5 8 12 11.5 15.5 8" />
    <path d="M4 13.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4.5" />
    <path d="M4 13.5h4l1.5 2.5h5l1.5-2.5h4" />
  </svg>
);
export const IcPaleta = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1 0 1.7-.7 1.7-1.6 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7h2a4.1 4.1 0 0 0 4.1-4.1C20.5 6.8 16.7 3.5 12 3.5z" />
    <circle cx="7.6" cy="11.6" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="9.6" cy="7.6" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="14.4" cy="7.6" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);
export const IcTermometro = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M10 14.3V5.5a2 2 0 0 1 4 0v8.8a4 4 0 1 1-4 0z" />
    <path d="M12 10v6.5" />
    <path d="M16.5 6h2M16.5 9h2" />
  </svg>
);
export const IcFrasco = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <rect x="8" y="3" width="8" height="3.5" rx="1" />
    <path d="M7 10a3.5 3.5 0 0 1 3.5-3.5h3A3.5 3.5 0 0 1 17 10v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z" />
    <path d="M12 11.5v5M9.5 14h5" />
  </svg>
);
export const IcMegafone = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 10.2v3.6a1.2 1.2 0 0 0 1.2 1.2H7l8 4.5V4.5L7 9H5.2A1.2 1.2 0 0 0 4 10.2z" />
    <path d="M7 15l1 4.5h2.5L10 16.2" />
    <path d="M18.5 9.5a3.5 3.5 0 0 1 0 5" />
  </svg>
);
export const IcUsuario = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="8.5" r="3.8" />
    <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
  </svg>
);
export const IcCheck = ({ size = 18, className }: P) => (
  <svg {...base(size)} className={className} strokeWidth={2.4}>
    <path d="M5 12.5 9.5 17 19 7.5" />
  </svg>
);

/* Utilitários */
export const IcSync = ({ size = 16, className }: P) => <svg {...base(size)} className={className}><path d="M20 12a8 8 0 0 1-14.3 4.9M4 12a8 8 0 0 1 14.3-4.9M18.5 3v4.5H14M5.5 21v-4.5H10" /></svg>;
export const IcLua = ({ size = 20, className }: P) => <svg {...base(size)} className={className}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></svg>;
export const IcSol = ({ size = 20, className }: P) => <svg {...base(size)} className={className}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v1.5M12 20v1.5M5.3 5.3l1.1 1.1M17.6 17.6l1.1 1.1M2.5 12H4M20 12h1.5M5.3 18.7l1.1-1.1M17.6 6.4l1.1-1.1" /></svg>;
export const IcCarrinho = ({ size = 24, className }: P) => <svg {...base(size)} className={className}><path d="M3 4h2.5l2 11h10.5l2-8H7" /><circle cx="9.5" cy="19" r="1.5" /><circle cx="17" cy="19" r="1.5" /></svg>;
export const IcLixeira = ({ size = 24, className }: P) => <svg {...base(size)} className={className}><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6" /></svg>;
export const IcAmpulheta = ({ size = 24, className }: P) => <svg {...base(size)} className={className}><path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9" /></svg>;
export const IcSeta = ({ size = 20, className }: P) => <svg {...base(size)} className={className}><path d="M9 6l6 6-6 6" /></svg>;
export const IcVoltar = ({ size = 22, className }: P) => <svg {...base(size)} className={className}><path d="M15 6l-6 6 6 6" /></svg>;
export const IcSair = ({ size = 22, className }: P) => <svg {...base(size)} className={className}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" /></svg>;

/* Ícones de campanha (coloridos pelo tema) */

/** Laço do Outubro Rosa: alça no alto e pontas cruzadas. */
export const Laco = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="Laço rosa" focusable="false" style={{ flex: 'none' }}>
    <path d="M16.6 21.2 10.3 10.9C8.6 8.1 9.6 3.6 12 3.6s3.4 4.5 1.7 7.3L7.4 21.2" fill="none" stroke="var(--accent)" strokeWidth="3.3" strokeLinejoin="round" />
  </svg>
);

/** Abóbora do Halloween: três gomos, cabo e folha. */
export const Abobora = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="Abóbora" focusable="false" style={{ flex: 'none' }}>
    <path d="M12 8.2c0-1.6.4-3 1.6-4.2" fill="none" stroke="var(--verde)" strokeWidth="2" strokeLinecap="round" />
    <path d="M13.4 6.3c1.3-1.9 3.6-2.4 5.4-1.6-.8 1.8-3 2.9-5.4 1.6z" fill="var(--verde)" />
    <ellipse cx="7.9" cy="14.6" rx="5" ry="6" fill="var(--accent)" stroke="rgba(0,0,0,.22)" strokeWidth="1" />
    <ellipse cx="16.1" cy="14.6" rx="5" ry="6" fill="var(--accent)" stroke="rgba(0,0,0,.22)" strokeWidth="1" />
    <ellipse cx="12" cy="14.6" rx="4" ry="6.4" fill="var(--accent)" stroke="rgba(0,0,0,.22)" strokeWidth="1" />
  </svg>
);

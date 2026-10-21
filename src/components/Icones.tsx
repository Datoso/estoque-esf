type P = { size?: number; className?: string };
const base = (size = 22) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true });

export const IcInicio = ({ size, className }: P) => <svg {...base(size)} className={className}><path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1z" /></svg>;
export const IcCaixa = ({ size, className }: P) => <svg {...base(size)} className={className}><path d="M3.5 7.5 12 3.5l8.5 4v9L12 20.5l-8.5-4z" /><path d="M3.5 7.5 12 11.5l8.5-4M12 11.5v9" /></svg>;
export const IcCalendario = ({ size, className }: P) => <svg {...base(size)} className={className}><rect x="4" y="5" width="16" height="15" rx="2.5" /><path d="M8 3v4M16 3v4M4 10h16M9 14h2M13 14h2M9 17h2" /></svg>;
export const IcMais = ({ size, className }: P) => <svg {...base(size)} className={className}><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></svg>;
export const IcSync = ({ size = 16, className }: P) => <svg {...base(size)} className={className}><path d="M20 12a8 8 0 0 1-14.3 4.9M4 12a8 8 0 0 1 14.3-4.9M18.5 3v4.5H14M5.5 21v-4.5H10" /></svg>;
export const IcLua = ({ size = 20, className }: P) => <svg {...base(size)} className={className}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></svg>;
export const IcSol = ({ size = 20, className }: P) => <svg {...base(size)} className={className}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
export const IcCarrinho = ({ size = 24, className }: P) => <svg {...base(size)} className={className}><path d="M3 4h2.5l2 11h10.5l2-8H7" /><circle cx="9.5" cy="19" r="1.5" /><circle cx="17" cy="19" r="1.5" /></svg>;
export const IcLixeira = ({ size = 24, className }: P) => <svg {...base(size)} className={className}><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6" /></svg>;
export const IcAmpulheta = ({ size = 24, className }: P) => <svg {...base(size)} className={className}><path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9" /></svg>;
export const IcSeta = ({ size = 20, className }: P) => <svg {...base(size)} className={className}><path d="M9 6l6 6-6 6" /></svg>;
export const IcSair = ({ size = 22, className }: P) => <svg {...base(size)} className={className}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" /></svg>;
export const Laco = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="Laço rosa">
    <path fill="var(--accent)" d="M12 3c-2 0-3.5 1.6-3.5 3.6 0 1.6.9 3.3 2.2 5.2L6 20.5l2.4.9 3.6-6.4 3.6 6.4 2.4-.9-4.7-8.7c1.3-1.9 2.2-3.6 2.2-5.2C15.5 4.6 14 3 12 3zm0 2c.9 0 1.5.7 1.5 1.6 0 .9-.6 2.1-1.5 3.5-.9-1.4-1.5-2.6-1.5-3.5C10.5 5.7 11.1 5 12 5z" />
  </svg>
);

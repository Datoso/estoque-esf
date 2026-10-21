import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';

export function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    if (!navigator.onLine) {
      setErro('O primeiro acesso precisa de internet. Depois o app funciona offline.');
      return;
    }
    setEnviando(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    setEnviando(false);
    if (error) setErro(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : 'Não foi possível entrar agora. Tente de novo.');
  }

  return (
    <form className="login" onSubmit={entrar}>
      <div>
        <h1>Estoque ESF</h1>
        <p className="sutil">Entre com o usuário da sua unidade.</p>
      </div>
      <div className="campo">
        <label htmlFor="email">E-mail</label>
        <input id="email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} />
      </div>
      <div className="campo">
        <label htmlFor="senha">Senha</label>
        <input id="senha" type="password" autoComplete="current-password" required value={senha} onChange={e => setSenha(e.target.value)} />
      </div>
      {erro && <p className="erro-txt" role="alert">{erro}</p>}
      <button className="btn" type="submit" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
    </form>
  );
}

# Estoque ESF

App de estoque para unidades da Estratégia Saúde da Família, offline-first: funciona sem internet e sincroniza com o Supabase quando há conexão.

Esta é a **versão 0.1** (primeira fatia real da ERS 2.2):

- login por e-mail e senha (Supabase Auth);
- baixa rápida em 3 toques, com lote escolhido pelo FEFO e divisão entre lotes;
- desfazer em até 5 minutos (cancela no aparelho ou gera estorno no servidor);
- estoque por categoria, validades em semáforo e perda de vencidos;
- fila offline em IndexedDB, com UUID e sequência por aparelho (reenvio não duplica);
- sincronização ao abrir, ao reconectar, depois de cada baixa e a cada 5 minutos;
- temas Padrão e Outubro Rosa, modo claro e escuro, PWA instalável.

Reposição, entrada, vacinação, painel e calendário já existem no protótipo e entram nas próximas versões.

## Rodar no seu computador

Precisa de Node.js 20 ou mais novo.

```bash
npm install
npm run dev
```

Abra o endereço que aparecer (normalmente http://localhost:5173). Com `--host`, o terminal também mostra um endereço de rede para abrir no celular na mesma Wi-Fi.

Outros comandos:

```bash
npm test         # testes das regras (FEFO, saldo, semáforo, fila offline)
npm run build    # gera a versão de produção em dist/
npm run preview  # serve a versão de produção (o modo offline do PWA só funciona aqui ou hospedado)
```

## Configuração

O arquivo `.env` já aponta para o projeto Supabase **ESF**:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

A chave é a publicável (pode ficar no app). A segurança está no banco: RLS em todas as tabelas, cada usuário só vê e grava na própria unidade, e movimentações não podem ser editadas nem apagadas.

## Testar o modo offline

1. Entre e espere carregar o estoque.
2. No Chrome, abra as Ferramentas do desenvolvedor › Rede › marque **Offline**.
3. Dê algumas baixas: o indicador mostra "Offline · N pendentes".
4. Desmarque Offline: o app envia sozinho e o contador zera.

## Estrutura

```
src/lib/estoque.ts     regras puras: FEFO, semáforo, saldo derivado, busca
src/lib/db.ts          banco local (Dexie/IndexedDB)
src/lib/sync.ts        envio da fila e cópia dos dados da unidade
src/lib/acoes.ts       baixa, desfazer, perda
src/lib/useEstoque.ts  junta tudo para as telas
src/screens/           Início, Estoque, Validades, Mais, Login
```

## Banco (Supabase)

Migrações aplicadas no projeto ESF: `001_base_organizacao_acesso`, `002_estoque`, `003_vacinacao_agenda`, `004_rls_politicas`, `005_dados_exemplo`, `006_indices_fk`. Os dados são de exemplo (Município Piloto, ESF Centro, ESF Vila Nova, Almoxarifado Central).

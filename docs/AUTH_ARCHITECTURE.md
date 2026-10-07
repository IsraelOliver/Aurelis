# AURELIS — Arquitetura de autenticação (Etapa AUTH 1A)

O AURELIS é um sistema **pessoal e privado, de usuário único**. A autenticação usa **Supabase Auth** no padrão oficial atual para Next.js App Router: `@supabase/ssr`, sessão em cookies e `proxy.ts` do Next.js 16. A autorização é verificada no servidor com `getClaims()`.

## Decisões

| Tema | Decisão |
| --- | --- |
| Provedor | Supabase Auth (`@supabase/supabase-js` 2.117 + `@supabase/ssr` 0.12). Sem NextAuth/Auth.js, Clerk ou Firebase. |
| Usuários | **Um.** Criado manualmente no Supabase. Sign-up público **desativado** e anonymous sign-ins **desativados** no painel do Supabase. Sem tela de cadastro, convite, times, papéis ou recuperação de senha. |
| Chaves | Só `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, públicas por design (identificam o projeto; o acesso é decidido pelo Auth). **Sem `service_role`/secret key, sem senha do banco, sem `DATABASE_URL`.** |
| Banco | **Nenhuma tabela própria**, policy, alteração em `auth.*` nem tabela de perfis. Memória do Smiley virá em etapa própria, com RLS explícita. |
| Sessão | Cookies gerenciados pela biblioteca (`sb-<projeto>-auth-token`). Nada em localStorage ou sessionStorage. Nenhuma leitura manual de cookie. |
| Prova de identidade | `supabase.auth.getClaims()` verifica o JWT (e renova quando perto de expirar). **`getSession()` nunca é usado para autorizar.** |

## Peças

```
src/proxy.ts                 Next.js 16 Proxy (antigo middleware) → updateSession()
src/lib/supabase/env.ts      URL + publishable key (null se ausentes)
src/lib/supabase/client.ts   createBrowserClient (login/logout no navegador)
src/lib/supabase/server.ts   createServerClient com cookies() — novo cliente por request
src/lib/supabase/proxy.ts    updateSession: getClaims() + cookies e cabeçalhos no-cache na resposta
src/lib/auth-core.ts         regras puras: evaluateClaims, respostas 401/503, destinos de redirect, erro de login
src/lib/auth.ts              server-only: verifyAuth, requireAuth (APIs), requirePageAuth (páginas)
```

### Proxy (`src/proxy.ts`)

- **O que faz:** só mantém a sessão viva para o SSR. Chama `getClaims()`, que verifica o token e o renova quando necessário, e devolve **a própria resposta** que o `setAll` montou. Assim os cookies renovados e os cabeçalhos `Cache-Control: private, no-store…`, `Expires: 0` e `Pragma: no-cache` chegam ao navegador.
- **O que não faz:** não autoriza nada. A proteção efetiva fica onde estão os dados: páginas e Route Handlers.
- **Matcher:** cobre tudo, exceto `_next/static`, `_next/image`, `favicon.ico`, imagens, `vendor/` (worker do MapLibre) e `map-styles/` (estilo do mapa).
- **Sem Supabase configurado:** passa direto.

### Autorização

`evaluateClaims()` aceita uma sessão quando:

- `sub` existe;
- `role === "authenticated"`;
- não é anônima.

O resultado contém **apenas o id do usuário**: nenhum token, e-mail ou id de sessão sai do helper.

```ts
// Route Handler — primeira instrução, antes de qualquer upstream
const auth = await requireAuth();
if (!auth.ok) return auth.response; // 401 {"error":"UNAUTHORIZED"} · 503 {"error":"AUTH_UNAVAILABLE"}

// Página privada
await requirePageAuth(); // sem sessão → redirect("/login"); nada é renderizado
```

## Rotas

| Rota | Acesso | Comportamento |
| --- | --- | --- |
| `/` | público | **Temporário:** autenticado → `/app`, senão → `/login`. Reservado para a futura landing/portfolio pública. |
| `/login` | público | Autenticado → `/app`. Senão, a tela AURELIS de acesso autorizado. |
| `/app` | **privado** | O dashboard (Workspace inalterado, apenas movido de `/`). Validado no servidor; sem sessão → `/login`. |
| `/api/**` (13 handlers) | **privado** | `requireAuth()` antes de qualquer upstream: sem sessão → 401, **zero** chamadas a OpenAI, OpenSky, NOAA, NASA, USGS, Open-Meteo ou GFS. |

Os 13 Route Handlers:

- `ai/chat`;
- `air/aircraft`;
- `disasters/eonet`;
- `earthquakes`;
- `space/iss`;
- `space/weather/{aurora, kp, solar-wind/mag, solar-wind/plasma, xray}`;
- `weather/{clouds, clouds/grid, forecast}`.

**Ficam públicos** só os recursos sem dado operacional:

- `/login`;
- os internos do Next.js (`/_next/*`);
- ícones;
- `public/`: estilo do mapa e worker do MapLibre, que o navegador precisa para desenhar o mapa;
- as chamadas do próprio Supabase Auth, feitas pelo navegador direto ao Supabase.

Os tiles do basemap (OpenFreeMap) e as imagens Esri continuam sendo buscados direto pelo navegador, como antes.

**CSRF:**

- Os cookies do Supabase são `SameSite=Lax`, então não são enviados em POST cross-site.
- O `/api/ai/chat` mantém a verificação same-origin + `application/json` da etapa AI 1A.
- Todas as outras APIs são `GET` sem efeitos colaterais.

## Login e logout

- **Login** (`/login`):
  - `signInWithPassword` no cliente do navegador;
  - estados: idle → **AUTHENTICATING...** → sucesso (`router.replace("/app")`) ou **ACCESS DENIED** · "Invalid credentials.";
  - falha de serviço (rede, 429, 5xx) → **AUTH UNAVAILABLE**;
  - senha errada, e-mail inexistente e e-mail não confirmado mostram a mesma mensagem, que nunca revela se a conta existe;
  - a senha fica só no estado do componente durante a tentativa e é limpa em seguida.
- **Logout:**
  - AUTHORIZED · LOG OUT na base da sidebar (sem e-mail ou nome);
  - `signOut()` remove os cookies e a navegação completa para `/login` zera todo o estado do cliente (chat do Smiley, snapshots).

## Falhas e logs

- **Variáveis Supabase ausentes:** o build não quebra. Em runtime, `/login` mostra AUTH UNAVAILABLE e as APIs respondem 503 `AUTH_UNAVAILABLE`.
- **Logs:** só `[AUTH] claims check failed: <nome do erro> status=<n>` para erros inesperados (sessão ausente é o caso normal e não loga). Nunca senha, access/refresh token, cookie ou cabeçalho `Authorization`.

## Testes (AUTH 1A)

- **Unitários (núcleo + helper com cliente Supabase simulado):**
  - `requireAuth` com claims válidas, sem sessão e com JWT inválido;
  - sem `sub`, com `role` errado e anônimo;
  - falha de rede;
  - Supabase não configurado → 503;
  - nenhum token no resultado nem na resposta.
- **Redirects:**
  - `/` → `/login` | `/app`;
  - `/app` sem sessão → `/login`;
  - `/login` autenticado → `/app`.
- **Rotas reais com upstreams simulados:**
  - `/api/ai/chat`, `/api/air/aircraft` e `/api/earthquakes` sem sessão → 401, com **zero** chamadas ao provider OpenAI, `handleChat`, OpenSky e USGS;
  - com sessão → comportamento preservado.
- **Cobertura estática:** os 13 handlers têm `requireAuth()` como primeira instrução.
- **Proxy:** a renovação grava os cookies novos e os cabeçalhos no-cache na resposta; sem renovação, nada é gravado; o proxy nunca redireciona.
- **Navegador:**
  - `/` → `/login`;
  - ACCESS DENIED (requisição de token interceptada localmente);
  - login → `/app`;
  - mapa, SPACE, DISASTERS, WEATHER, AIR e SMILEY funcionando;
  - reload e nova aba mantêm a sessão;
  - `/login` autenticado → `/app`;
  - logout → `/login`;
  - depois do logout, `/app` → `/login` e as APIs → 401.

## Próximos passos (não implementados)

- Landing/portfolio pública em `/`.
- Memória do Smiley em tabelas próprias com RLS.
- Rate limiting de IA.
- Domínio público no Railway, depois do deploy autenticado.

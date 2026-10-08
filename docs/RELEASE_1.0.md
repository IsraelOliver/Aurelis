# AURELIS 1.0 — Release checklist

Marcar um item **somente depois de validado**, no commit candidato ao release e no ambiente indicado.

## Known limitation — AIR / OpenSky

O AURELIS 1.0 inclui o domínio AIR, mas o deployment oficial atual no Railway não consegue alcançar a infraestrutura OpenSky.

- **Evidência observada:** a partir do container do deployment atual no Railway, as conexões TCP com `auth.opensky-network.org:443` e `opensky-network.org:443` terminam em `UND_ERR_CONNECT_TIMEOUT` (Connect Timeout Error), antes de qualquer resposta HTTP. Do ambiente local, os mesmos hosts respondem (HTTP 401 no token endpoint sem credenciais, HTTP 403 no host principal).
- **O que isso não é:** credenciais, payload OAuth, autenticação HTTP, renderer, polling, IPv6 (os hosts não publicam endereços IPv6) ou erro funcional do código.
- **Comportamento no 1.0:** em produção o AIR abre e mostra SOURCE UNAVAILABLE; o restante do aplicativo segue funcional. Em ambientes que alcançam a OpenSky (como o local), o AIR funciona.
- **Próximo passo:** migração de provider / compatibilidade de hospedagem, depois do 1.0 (ver `docs/ROADMAP.md`).

## Produção (Railway)

- [x] **AIR / OpenSky — known hosted limitation validated** (smoke de 2026-10-08: o AIR abre, mostra "AIR SOURCE UNAVAILABLE", a fonte aparece como UNAVAILABLE e o app segue funcionando):
  - implementação validada localmente;
  - diagnóstico no Railway concluído (`UND_ERR_CONNECT_TIMEOUT` para os dois hosts OpenSky);
  - produção mostra SOURCE UNAVAILABLE: o AIR abre, o app não quebra e os outros domínios continuam funcionando (não se exigem aeronaves carregadas no Railway);
  - limitação documentada; migração de provider adiada para depois do 1.0.
- [x] **Satellite funcionando em produção**: imagem Esri carregada no smoke final.
- [x] **Auth funcionando em produção**: `/login`, `/app` protegido, APIs com 401 sem sessão, logout.
- [x] **Smoke mobile em produção** (390×844): header, drawer, bottom sheet, SMILEY em tela cheia, logout.
- [x] **Smoke desktop em produção** (1440×900; GLOBE/FLAT, MAP/SATELLITE, SPACE, ISS, aurora, WEATHER, nuvens, DISASTERS, terremoto, EONET, AIR): sidebar, painéis, controles do mapa, SMILEY lateral.
- [x] **Smoke do SMILEY em produção** (uma pergunta, 398 IN · 18 OUT): uma pergunta simples, streaming e métricas de tokens.
- [x] **Deploy de produção saudável**: serviço Online, 1 réplica, start normal, sem crash loop. Nos logs, além do timeout OpenSky conhecido, só uma resposta truncada isolada da NOAA no X-ray (erro transitório da fonte externa).

## Repositório

- [x] **Auditoria de segredos**: nenhum valor real de chave, token ou cookie no repositório nem no histórico.
- [x] **Auditoria de variáveis** (só nomes): nomes necessários configurados no Railway; `.env.local` ignorado e não versionado.
- [x] **Working tree limpa**, `main` == `origin/main` (pre-flight em `c3253ac`; reconferir no commit candidato).
- [x] `npm run lint`
- [x] `npx tsc --noEmit`
- [x] `npm run build`

## Publicação

- [ ] **Tag `v1.0.0`** no commit validado.
- [ ] **GitHub release** `v1.0.0`.

Depois do release, a próxima etapa é **AURELIS 1.1 — Visual Identity Rework** (ver [`docs/ROADMAP.md`](ROADMAP.md)).

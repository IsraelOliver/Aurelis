# AURELIS 1.0 — Release checklist

Marcar um item **somente depois de validado**, no commit candidato ao release e no ambiente indicado. Nada está marcado ainda: o release ainda não começou a ser validado.

## Produção (Railway)

- [ ] **AIR funcionando em produção.** Bloqueador atual: "OpenSky token endpoint unreachable" no container; diagnóstico de rede pendente.
- [ ] **Satellite funcionando em produção.** Reportado como funcionando após a configuração de referrer do ArcGIS; confirmar no smoke final.
- [ ] **Auth funcionando em produção**: `/login`, `/app` protegido, APIs com 401 sem sessão, logout.
- [ ] **Smoke mobile em produção**: header, drawer, bottom sheet, SMILEY em tela cheia, logout.
- [ ] **Smoke desktop em produção**: sidebar, painéis, controles do mapa, SMILEY lateral.
- [ ] **Smoke do SMILEY em produção**: uma pergunta simples, streaming e métricas de tokens.
- [ ] **Deploy de produção saudável**: build e start sem erro nos logs do Railway.

## Repositório

- [ ] **Auditoria de segredos**: nenhum valor real de chave, token ou cookie no repositório nem no histórico.
- [ ] **Auditoria de variáveis**: nomes necessários configurados no Railway; `.env.local` ignorado e não versionado.
- [ ] **Working tree limpa**, `main` == `origin/main`.
- [ ] `npm run lint`
- [ ] `npx tsc --noEmit`
- [ ] `npm run build`

## Publicação

- [ ] **Tag `v1.0.0`** no commit validado.
- [ ] **GitHub release** `v1.0.0`.

Depois do release, a próxima etapa é **AURELIS 1.1 — Visual Identity Rework** (ver [`docs/ROADMAP.md`](ROADMAP.md)).

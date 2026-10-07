# AURELIS — Roadmap

> **AURELIS is never finished forever. Versions are finished.**

Esta é a ordem oficial das próximas etapas. Cada versão é fechada, validada e publicada antes da seguinte começar. Itens deste documento são **planejamento**: nada abaixo de "CURRENT" está implementado.

---

## CURRENT — AURELIS 1.0

Funcionalidade principal implementada e em `main`:

- domínios SPACE, DISASTERS, WEATHER e AIR;
- SMILEY (inteligência pessoal read-only);
- autenticação privada single-user (Supabase);
- responsividade mobile;
- deploy no Railway.

**Pendências antes do release:**

1. **Resolver AIR/OpenSky no Railway.** Em produção o token endpoint da OpenSky não é alcançado ("token endpoint unreachable"); localmente funciona. O diagnóstico de rede no container está pendente.
2. **Smoke final de produção**: desktop, mobile, SMILEY, auth, AIR e Satellite.
3. **Auditoria final**: segredos, variáveis de ambiente, working tree.
4. **Tag e release `v1.0.0`.**

Checklist detalhado: [`docs/RELEASE_1.0.md`](RELEASE_1.0.md).

---

## POST-1.0

### AURELIS 1.1 — Visual Identity Rework

**Objetivo:** reestruturar a identidade gráfica e a UX para que o AURELIS tenha uma identidade visual mais pessoal e autoral.

**Restrição:** preservar a arquitetura funcional existente (dados, proveniência, auth, SMILEY, renderers). O rework é de identidade e experiência, não de comportamento.

**Áreas:**

- tipografia;
- hierarquia visual;
- iconografia própria;
- pixel art;
- sprites de aeronaves;
- mapas e símbolos;
- painéis;
- WORLD;
- login;
- identidade visual do SMILEY;
- motion;
- visual de proveniência / EvidenceNature;
- refinamento desktop e mobile.

### SMILEY 2A — Persistent Memory

- memória privada no Supabase;
- origem de cada fato: `USER_STATED` / `OBSERVED` / `INFERRED`;
- `confidence` por fato;
- recuperação seletiva (só o relevante para cada pergunta);
- RLS explícita;
- baixo custo de tokens;
- nunca enviar o perfil inteiro sem necessidade.

### SMILEY 2B — Personal Attention Engine

Ativar as seis capacidades preparadas na fundação da AI 1B:

1. personal relevance;
2. why you may care;
3. depth over volume;
4. controlled serendipity;
5. anti-distraction;
6. creative connections.

### INTEL SCOUT

- notícias e desenvolvimentos relevantes;
- proveniência explícita;
- fontes confiáveis;
- deduplicação;
- ranking;
- poucas coisas importantes, não um feed infinito.

### CONTEXT / EVENTS

- eventos científicos;
- astronomia;
- observâncias;
- eventos globais programados.

### SEA

- domínio marítimo;
- somente depois de definir uma fonte com licenciamento confiável.

---

## Later ideas (sem ordem, sem compromisso)

- visualização da magnetosfera;
- naves espaciais adicionais;
- inteligência de astronomia e calendário;
- landing pública / portfolio em `/`;
- modo demo público;
- SMILEY por voz;
- notificações proativas;
- domínio próprio;
- experimentos com IA local.

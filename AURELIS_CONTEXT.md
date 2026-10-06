# AURELIS — Contexto do Projeto

## Visão e escopo (Etapa 5A)

**AURELIS — Personal Global Situational Dashboard.**

> AURELIS é um painel pessoal de consciência situacional global que reúne informações públicas de diferentes fontes em uma única interface, preservando origem, tempo, precisão e proveniência.

- **Objetivo principal**: reunir numa única interface informações globais públicas que normalmente seriam consultadas separadamente em vários sites.
- **Projeto pessoal.** O usuário principal é o próprio criador. Não existe prazo comercial.
- **Não é** (atualmente): produto comercial, SaaS, plataforma empresarial, ferramenta governamental nem concorrente de sistemas profissionais.
- **Objetivo secundário (contexto interno)**: AURELIS também é um experimento pessoal para explorar até onde uma pessoa consegue construir um sistema complexo combinando programação, APIs públicas, internet, ferramentas modernas e assistência de IA.
  - A IA é ferramenta de desenvolvimento: **não é autora nem colaboradora** do projeto.
  - A interface não faz propaganda sobre IA.

### Filosofia central

> **O AURELIS nunca mostra como fato algo que os dados não comprovam.**

Quando disponível, preservar:

- fonte e registro original;
- `observedAt`, `reportedAt` e `ingestedAt`;
- precisão geográfica;
- natureza da evidência (observed / reported / estimated / inferred);
- proveniência;
- confidence, quando houver metodologia (hoje não há: `unknown`).

Outras regras:

- **Relações visuais nunca são inventadas por estética**: só existem com um `EntityRelationship` explícito (`docs/DATA_MODEL.md`).
- **Semântica vem da fonte, não de conhecimento externo.** Unidades, significados e precisões só são afirmados quando a documentação da fonte os sustenta. Exemplo: a velocidade da ISS é exibida como valor bruto com unidade desconhecida, porque a Where The ISS At? não documenta a unidade, mesmo sendo "conhecida" a velocidade orbital da ISS.

### Mapa vs painéis

- **Mapa**: dados com localização geográfica explícita e precisão apropriada.
- **Painéis**: dados cujo valor principal não depende de uma coordenada.
- Não forçar tudo a virar marcador.

| Dado | Onde |
| ---- | ---- |
| USGS earthquakes | mapa |
| ISS | mapa |
| aviões, navios | mapa |
| GeoIP | mapa, marcado como estimado/aproximado |
| índice Kp global | painel |
| fase lunar | painel |
| mercados | painel |
| notícias sem evento geográfico explícito | painel |

### Domínios

WORLD · CYBER · AIR · SEA · WEATHER · DISASTERS · SPACE · MARKETS

- **WORLD** será uma visão agregada futura, não uma fonte.
- **NEWS** é principalmente conteúdo de painel; não precisa virar categoria geográfica principal.
- Na sidebar atual aparecem WORLD, CYBER, AIR, SEA, SPACE, WEATHER e DISASTERS (visuais, sem filtro). MARKETS ainda não tem entrada na interface.

### Câmeras

- **Fora do escopo**: câmeras públicas genéricas. Não criar agregador mundial de CCTV/webcams.
- **Exceção**: mídia oficial associada diretamente a uma Entity relevante (ex.: stream oficial da NASA associado à ISS).

### Polling

> Polling somente quando a natureza e a frequência da fonte justificarem atualização periódica.

Hoje: USGS ~60 s; ISS ~5 s. Fontes futuras podem ter frequências diferentes, ou nenhuma.

### Mobile

- Desktop-first, com intenção real de uso futuro no celular. Não portar agora.
- Evitar componentes novos que dificultem o mobile sem necessidade.
- Direção: desktop = mapa + painel lateral; mobile = mapa + bottom sheet. PWA pode ser considerado no futuro.

### Roadmap (não imutável)

| # | Etapa | Estado |
| - | ----- | ------ |
| 0 | Fundação (shell, basemap, modelo de domínio, proveniência) | concluído |
| 1 | USGS Earthquakes | concluído |
| 2 | SPACE / ISS tracking | concluído |

Próximos passos planejados:

- **SPACE**: ~~câmera oficial da ISS~~ (feito, Etapa 5C); NOAA SWPC; condições astronômicas; poucos satélites selecionados no futuro.
- Depois: **DISASTERS → WEATHER → AIR → NEWS / MARKETS → SEA → CYBER**.

### Conceitos futuros (nenhum implementado)

| Nome | Papel |
| ---- | ----- |
| Tissue | ingestão e normalização |
| Echo | histórico / reconstrução temporal |
| Needle | monitoramento direcionado |
| Rupture | anomalias, **somente** quando existir baseline/metodologia real |
| EON | nome reservado para um núcleo tecnológico, caso ele realmente venha a existir |

### Estado atual

- Next.js (App Router), React, TypeScript, Tailwind CSS e MapLibre GL.
- Basemap próprio AURELIS sobre tiles OpenFreeMap (atribuição sempre visível).
- Modelo de domínio (Entity, Observation, Source, GeoLocation, Relationship) com proveniência.
- **USGS Earthquakes** (M2.5+, 24 h) com Intelligence Panel.
- **SPACE**: a **ISS** (NORAD 25544, Entity `space:norad:25544`) é a primeira Entity móvel, com posição atualizada periodicamente (~5 s) e painel próprio.
- **SPACE WEATHER**: índice planetário **Kp estimado** da NOAA SWPC (terceira fonte), dado global sem Entity e sem mapa, no painel de domínio SPACE; **forecast de aurora OVATION** da NOAA SWPC (quarta fonte), campo modelado em grade de 1°, sem Entity, com layer opcional no mapa.
- Polling controlado por fonte; `SourceHealth` por fonte (SYNCING / FRESH / STALE / UNAVAILABLE) e estado global multi-source (LIVE / PARTIAL / …).

## Stack atual

| Item         | Versão   |
| ------------ | -------- |
| Next.js      | 16.3.8 (App Router, Turbopack) |
| React        | 19.2.8   |
| TypeScript   | 5.9.3    |
| Tailwind CSS | 4.3.3    |
| MapLibre GL  | 6.12.0   |
| ESLint       | 9.39.5 (eslint-config-next) |
| Node / npm   | 24.21.0 / 11.19.0 |

Nenhuma outra dependência de runtime.

## Arquitetura atual

```
src/
  app/
    layout.tsx          # html/body, fontes Geist, metadata
    page.tsx            # composição: Topbar + Workspace
    globals.css         # tokens de cor (dark), estilo dos controles MapLibre
    api/earthquakes/
      route.ts          # API interna: terremotos no modelo AURELIS (cache 60 s)
    api/space/iss/
      route.ts          # API interna: posição da ISS no modelo AURELIS (dedupe 4 s)
    api/space/weather/kp/
      route.ts          # API interna: Kp planetário NOAA SWPC no modelo AURELIS (cache 45 s)
    api/space/weather/aurora/
      route.ts          # API interna: forecast OVATION no modelo AURELIS, só células não-zero (cache 4 min)
  components/
    Workspace.tsx       # client: snapshots + saúde das fontes + PanelTarget (entity | domain); Topbar/Sidebar/Map/Panel/StatusBar
    useSourceSync.ts    # polling controlado e genérico de uma rota interna (setTimeout recursivo)
    layout/
      Topbar.tsx        # marca, busca (visual), indicador LIVE (inativo)
      Sidebar.tsx       # categorias (sem filtro; SPACE abre o painel de domínio) + fontes realmente carregadas
      CategoryIcon.tsx  # ícones SVG inline das categorias
      StatusBar.tsx     # SOURCES / ENTITIES / STATUS reais
    map/
      MapView.tsx       # client wrapper: next/dynamic com ssr:false; estados projectionMode e basemapMode
      SegmentedControl.tsx # controles GLOBE/FLAT e MAP/SATELLITE (uma instância por estado)
      basemap-layer.ts  # troca DARK/SATELLITE dentro do style AURELIS (imagery + overlays, restauração)
      WorldMap.tsx      # instancia o MapLibre (somente no browser)
      earthquake-layer.ts # domínio → GeoJSON source + circle layer + layer de seleção
      iss-layer.ts      # domínio → source/layers da ISS (halo + núcleo + rótulo)
      aurora-layer.ts   # forecast OVATION → custom layer WebGL (textura da grade, interpolação visual, elevação visual no globo; opcional)
    panel/
      primitives.tsx    # moldura e peças comuns do Intelligence Panel
      EarthquakePanel.tsx # painel do terremoto selecionado
      IssPanel.tsx      # painel da ISS selecionada
      SpaceWeatherPanel.tsx # painel de domínio SPACE: Kp estimado + forecast de aurora OVATION (sem Entity)
      KpTrendChart.tsx  # gráfico SVG das últimas 6 h de Kp estimado
      IssCamera.tsx     # seção CAMERA: player oficial da NASA (aberto ao selecionar a ISS, sem autoplay)
  lib/
    categories.ts       # lista de categorias + tipo CategoryId
    format.ts           # formatação: UTC, coordenadas, magnitude, profundidade, tempo relativo
    aurora-grid.ts      # grade OVATION → array 360 × 181 de valores (textura; valores inalterados)
    iss-trail.ts        # trilha recente da ISS: histórico limitado em memória + segmentação (lacunas, antimeridiano)
    iss-interpolation.ts # suavização visual do marcador: interpolação entre posições recebidas (sem extrapolação)
    source-health.ts    # USGS_SYNC / ISS_SYNC / NOAA_KP_SYNC / NOAA_OVATION_SYNC (intervalo + janela), deriveHealth(), aggregateHealth()
    map-config.ts       # URL do basemap, view inicial, URL do worker
    sources/usgs/
      earthquakes.ts    # adapter USGS (server): fetch, validação, normalização
      source.ts         # IntelligenceSource USGS (dados estáticos, importável no cliente)
    sources/nasa/
      iss-media.ts      # NASA_ISS_STREAM: mídia oficial associada à ISS (config, sem API)
    sources/noaa/
      swpc-kp.ts        # adapter NOAA SWPC Kp (server): fetch, validação, normalização, janela 6 h
      ovation.ts        # adapter NOAA SWPC OVATION (server): validação, longitude −180..180, células não-zero
      source.ts         # IntelligenceSources NOAA SWPC Kp e OVATION + URLs dos produtos
    sources/wtia/
      iss.ts            # adapter Where The ISS At? (server): fetch, validação, normalização
      source.ts         # IntelligenceSource WTIA + ISS_ENTITY_ID
  types/                # modelo de domínio (somente tipos) — ver docs/DATA_MODEL.md
    common.ts           # IsoDateTime, ConfidenceLevel
    source.ts           # IntelligenceSource
    location.ts         # GeoLocation (+ precisão)
    entity.ts           # AurelisEntity (núcleo comum)
    observation.ts      # Observation<T> (afirmação de uma fonte)
    relationship.ts     # EntityRelationship
    source-health.ts    # SourceHealth, SourceSyncState, GlobalHealth
    earthquake.ts       # EarthquakeObservationData, EarthquakeFeed (resposta da API)
    space.ts            # IssObservationData, IssFeed (resposta da API)
    space-weather.ts    # PlanetaryKpObservationData, PlanetaryKpFeed (sem entities)
    aurora.ts           # AuroraForecastData, AuroraGridCell, AuroraForecastFeed (sem entities)
    index.ts            # barrel (export type *)
public/
  map-styles/
    aurelis-dark.json   # style cartográfico próprio (MapLibre style spec v8)
scripts/
  copy-maplibre-worker.mjs  # copia o worker do MapLibre para public/vendor/
docs/
  DATA_MODEL.md         # explicação do modelo de dados
  MAP_ARCHITECTURE.md   # provider / style / data layers, cores, atribuição
```

## Decisões tomadas

- **Mapa só no cliente.** `page.tsx` é Server Component; `MapView` é Client Component e carrega `WorldMap` via `next/dynamic` com `ssr: false`, então `maplibre-gl` (que usa `window`/WebGL) nunca roda no servidor.
- **Worker do MapLibre servido de `public/`.** O maplibre-gl v6 é ESM-only e resolve o worker relativo à URL do próprio módulo; após o bundling do Next esse caminho quebra ("Worker failed to load"). Solução: `scripts/copy-maplibre-worker.mjs` copia `maplibre-gl-worker.mjs` e `maplibre-gl-shared.mjs` para `public/vendor/maplibre/` (via `predev`/`prebuild`, sempre na versão instalada) e `WorldMap` chama `setWorkerUrl()`. A pasta está no `.gitignore` e no ignore do ESLint.
- **Container do mapa com `h-full w-full`.** O CSS do MapLibre (fora de `@layer`) impõe `position: relative` no container e vence as utilities do Tailwind v4; por isso não se usa `absolute inset-0` no próprio container.
- **Basemap: style próprio `public/map-styles/aurelis-dark.json` sobre tiles vetoriais da OpenFreeMap** (schema OpenMapTiles, dados OpenStreetMap). Sem chave de API, sem cookies, uso comercial permitido, sem SLA. É o único recurso externo da aplicação, e é base cartográfica, não fonte de dados. Substituiu a CARTO Dark Matter (que tinha limites para uso comercial) na Etapa 4A. Detalhes em `docs/MAP_ARCHITECTURE.md`.
- **Três camadas separadas no mapa:** *map data provider* (OpenFreeMap: geometria), *map style* (AURELIS: aparência, versionado no repo) e *AURELIS data layers* (futuras, adicionadas em runtime sobre o basemap, nunca dentro do style JSON).
- **Atribuição obrigatória sempre visível:** "OpenFreeMap © OpenMapTiles Data from OpenStreetMap", declarada na source do style e exibida pelo `AttributionControl` em modo **não compacto** (o compacto recolhia o texto na primeira interação).
- **Projeção**: desde a Etapa 5E o padrão é **globe** (nativo do MapLibre), com Mercator disponível como FLAT. Ver "Projeção globe" abaixo.
- **Uma única cópia do mundo** (`renderWorldCopies: false` em `INITIAL_VIEW`). Uma entidade nunca deve aparecer duplicada em cópias laterais. Com essa opção, o MapLibre limita o zoom-out para que o mundo cubra a largura do mapa, então não aparecem faixas vazias.

### Identidade visual

Azul-marinho + dourado + ciano. Deve parecer uma ferramenta profissional de monitoramento; nada de gamer, cyberpunk, glow, scanlines, partículas ou grids sobre o mapa.

**Paleta**: definida **apenas** em `src/app/globals.css` (`:root`) e exposta ao Tailwind via `@theme inline`. Componentes não usam hex.

| Token CSS                    | Valor                       | Classe Tailwind        |
| ---------------------------- | --------------------------- | ---------------------- |
| `--aurelis-bg`               | `#04091B`                   | `base`                 |
| `--aurelis-surface`          | `#071126`                   | `surface`              |
| `--aurelis-surface-elevated` | `#0B1732`                   | `elevated`             |
| `--aurelis-blue`             | `#0B2053`                   | `deep`                 |
| `--aurelis-gold`             | `#FEC404`                   | `gold`                 |
| `--aurelis-gold-muted`       | `#EFB001`                   | `gold-muted`           |
| `--aurelis-cyan`             | `#53EAFD`                   | `cyan`                 |
| `--aurelis-text`             | `#EEEEEF`                   | `fg`                   |
| `--aurelis-text-muted`       | `#989BA2`                   | `fg-muted`             |
| `--aurelis-text-subtle`      | `#7A8396` (proposto `#6F7789`) | `fg-subtle`         |
| `--aurelis-border`           | `rgba(152,155,162,0.16)`    | `line`                 |
| `--aurelis-border-strong`    | `rgba(152,155,162,0.30)`    | `line-strong`          |

- `text-subtle` foi clareado: `#6F7789` dava 4.2:1 sobre `surface` (abaixo de AA para texto pequeno); `#7A8396` dá 4.9:1. `border-strong` foi adicionado para hover de bordas.
- Contraste medido (texto/fundo): text ≥ 13.4:1, text-muted ≥ 5.6:1, gold ≥ 9.7:1, cyan ≥ 10.8:1, text-subtle 4.7–5.2:1 sobre base/surface/elevated (4.1:1 sobre `deep`; nesse fundo usa-se `fg`).

**Semântica das cores**
- **Dourado**: identidade da marca (losango ao lado de AURELIS), seleção principal, ação importante. A seleção de categoria está *preparada* (`data-active` → barra dourada + fundo `deep`), mas nenhum item a usa enquanto filtros não existirem.
- **Ciano**: informação, dados, indicadores técnicos e foco (outline global de `:focus-visible` e borda da busca em foco).
- **Branco** (`fg`): texto principal. **Cinzas**: texto secundário, indisponível, sem dados.
- **Azul profundo**: superfícies, seleção discreta, profundidade.
- **Sem cores de severidade** (warning/danger/critical/success) até existirem dados reais.

**Shell**
- Topbar: fundo `base`, AURELIS com tracking largo e versão quase invisível, busca integrada (sem função), LIVE **inativo**: anel cinza vazado (forma + cor + texto `sr-only`), nunca verde.
- Sidebar: `surface`, hover sutil (`elevated`), "—" em vez de contagem; nenhuma categoria aparenta estar ativa.
- Status bar: SOURCES 0 / ENTITIES 0 à esquerda, STATUS NOMINAL à direita, números em cinza (zero não é destacado como atividade).
- `:focus-visible` global fica em `@layer base`, para que componentes possam substituí-lo (a busca usa a borda ciano do container).

**Mapa**
- *(Etapa 3)* Mapa 2D (Mercator); o globo ficou para depois. **Superado na Etapa 5E**: o padrão agora é globe nativo do MapLibre, com FLAT/Mercator disponível.
- **Cores do mapa definidas no style próprio (Etapa 4A).** O filtro CSS provisório da Etapa 3 (`sepia/hue-rotate/saturate/brightness` sobre o canvas) foi **removido**. Não há `filter`, `backdrop-filter` nem `mix-blend-mode` sobre o canvas: futuras camadas de dados aparecem com suas cores reais. (O único `filter` restante é o `invert` dos ícones dos botões de zoom.)
- Basemap discreto: oceano `#04091B` (= `--aurelis-bg`), terra `#0A1530`, fronteiras `#334262`, estradas que só ganham presença ao aproximar, rótulos em cinzas frios da paleta. **Dourado e ciano não aparecem no basemap.** Tabela completa em `docs/MAP_ARCHITECTURE.md`.
- `renderWorldCopies: false` preservado.

### Primeira fonte operacional: USGS Earthquakes (Etapa 4B)

**Feed**: `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson` (GeoJSON Summary, M2.5+, últimas 24 h). Formato: `earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php`. "Updated every minute"; o feed é servido com `Cache-Control: public, max-age=60`.

- As definições de campos foram verificadas no glossário oficial do ComCat (`data/comcat/data-eventterms.php`). Em 2026-10-05 essa URL redireciona para a página do formato, que não traz definições; por isso o texto foi lido no snapshot do Internet Archive de 2026-01-04 da página oficial `data/comcat/index.php`.
- A "Feed Life Cycle Policy" linkada pelo USGS (`/earthquakes/feed/policy.php`) retornava 404 na mesma data.

**Fluxo** (o formato USGS não sai do adapter):

```
USGS GeoJSON ─► lib/sources/usgs/earthquakes.ts (validação + normalização)
             ─► EarthquakeFeed (modelo AURELIS)
             ─► /api/earthquakes (server, cache 60 s)
             ─► Workspace (client, 1 carga) ─► earthquake-layer.ts (GeoJSON source + circle layer)
```

- **Fetch no servidor**, URL fixa no código; nenhum input do cliente chega ao upstream (sem proxy genérico). Timeout de 10 s.
- **Cache**: `unstable_cache` (mecanismo nativo do Next para projetos sem Cache Components; o `use cache` exigiria ligar Cache Components) sobre *fetch + normalização*, `revalidate: 60`. Cachear o resultado normalizado mantém `ingestedAt` igual ao momento real da busca. Como o `unstable_cache` é stale-while-revalidate e continua servindo o último resultado bom enquanto a revalidação falha, a rota busca direto se o resultado em cache tiver mais de 120 s; se essa busca falhar, responde 502. Assim, dado velho nunca é servido como atual.
- **Sem persistência e sem histórico.** Desde a Etapa 4D o cliente sincroniza a cada 60 s (ver "Sincronização e saúde da fonte").
- **IntelligenceSource** `usgs-earthquakes`, `category: "government"`, **`reliability: "unknown"`** (não há metodologia de avaliação; ser órgão governamental não basta).
- **Entity**: `earthquake:usgs:<feature.id>`, `category: "disaster"`, `kind: "earthquake"`, `label = place`. Determinístico. **`firstSeenAt`/`lastSeenAt` ficam ausentes** (Etapa 4C): preenchê-los com o horário do terremoto misturava *horário do evento* (já em `Observation.observedAt`) com *período em que a entidade foi acompanhada*, que só existirá com persistência. **Limitação documentada pelo USGS:** `id` é o "current preferred id" e *pode mudar com o tempo* (`ids` lista os aliases); nesse caso o mesmo evento ganharia outro Entity ID. A reconciliação por `ids` fica para quando houver histórico.
- **Observation**: `usgs:<feature.id>:<updated em ms>`; uma nova versão do registro USGS gera uma nova Observation da mesma Entity. **`nature: "reported"`**: o AURELIS consome um relatório, não observou o evento. `confidence: "unknown"`. `originSourceId` não é usado: `net`/`sources` são redes contribuintes do USGS, não `IntelligenceSource`s do AURELIS. A rede preferida fica em `data.preferredNetwork`.
- **Tempos** (todos ISO 8601 UTC): `properties.time` (origem do evento) → `observedAt`; `properties.updated` → `reportedAt` = **última atualização** do registro no USGS, *não* a primeira publicação; recebimento pelo servidor AURELIS → `ingestedAt`; `metadata.generated` → `metadata.feedGeneratedAt`.
- **Localização**: `precision: "approximate"` (calculada a partir de dados sísmicos, nunca `exact`). Sem `uncertaintyRadiusMeters`: o Summary não traz `horizontalError` (o feed Detail traz).
- **Profundidade ≠ altitude**: o 3º valor das coordenadas vai para `data.depthKm`; `GeoLocation.altitudeMeters` não é usado.
- **`EarthquakeObservationData`**: `magnitude` (null se ausente), `magnitudeType`, `place`, `depthKm`, `status`, `significance` (USGS `sig`), `tsunamiFlag`, `alert` (PAGER), `preferredNetwork`. Ajustes à proposta: `tsunami` virou `tsunamiFlag`, porque o USGS documenta que o flag "não indica se um tsunami existe ou existirá"; `sourceUpdatedAt` foi omitido por ser idêntico a `Observation.reportedAt`.
- **Validação runtime mínima** (sem Zod): payload inteiro inválido (não FeatureCollection, sem `features`) → erro → 502. Registro inválido (sem id, geometria não Point, lat/lon fora da faixa, sem profundidade, `time`/`updated` não numéricos, `mag` não numérico e não null, id duplicado) → descartado e contado em `skippedRecords`. Registro válido com `type` ≠ `"earthquake"` (ex.: pedreira) ou `status: "deleted"` → `excludedRecords` (não é chamado de terremoto). `sourceUrl` só é aceito se for `https://`.
- **Mapa**: source `aurelis-earthquakes-source` + layer `aurelis-earthquakes-layer` (circle), acima do basemap. Sem markers DOM, clustering ou popup. **Círculos em ciano** (`--aurelis-cyan`, lido do CSS em runtime), opacidade 0.55, contorno `--aurelis-bg`. **O tamanho do círculo codifica a magnitude de forma qualitativa** (M2.5 → 3 px, M4.5 → 6, M6.5 → 11, M8 → 16), não proporcional à energia. Sem vermelho e sem escala de perigo; dourado só para o evento selecionado (Etapa 4C).
- **Status bar real** (mapeamento atualizado na Etapa 4D, abaixo). O contador "0/6" da sidebar saiu, porque ficaria enganoso.

### Intelligence Panel e seleção (Etapa 4C)

- **Seleção de entidade**: clique num círculo → `Workspace` guarda `selectedEntityId` → a Entity e sua Observation são localizadas nos dados **já carregados** (sem novo fetch, sem endpoint Detail do USGS). Cursor `pointer` sobre terremotos; sem tooltip. Em sobreposição, vale o círculo de cima (maior magnitude).
- **Destaque dourado**: layer separada `aurelis-earthquakes-selected-layer` sobre a mesma source, filtrada por `entityId` via `map.setFilter` (sempre desenhada acima dos demais; raio +2 px, `--aurelis-gold`). Os outros pontos continuam ciano; ao fechar, o filtro volta a "nenhum".
- **O mapa não é recriado** por seleção: data e seleção são aplicadas à instância existente. Quando o painel abre e o container encolhe, o `ResizeObserver` interno do MapLibre (`trackResize`) chama `map.resize()`; não há chamada manual duplicada.
- **Intelligence Panel**: `<aside>` fixo à direita (360 px), parte do layout (não é modal nem popup). Seções EVENT (magnitude, profundidade, local, coordenadas, precisão, horário do evento, última atualização USGS, status, tsunami flag, alerta, rede) e PROVENANCE (fonte, natureza, **AURELIS confidence**, registro na fonte, ingestão) + link "Open original source" (`sourceUrl` da Observation, nova aba, `rel="noopener noreferrer"`). Campos ausentes → "—". Horários sempre em UTC, sem conversão para fuso local. Valores numéricos exibidos como reportados (coordenadas com 4 casas).
- **Semântica no painel**: confiança é rotulada **AURELIS CONFIDENCE** (não é declaração do USGS). Natureza, confiança, precisão de localização, tsunami flag e alerta nulo têm uma nota textual explicativa, sem depender só de cor. `alert: null` aparece como "—" com a nota "No PAGER alert level in the feed", em vez de "NONE", que poderia ser lido como avaliação do PAGER.
- **Fechar**: botão X (`aria-label="Close intelligence panel"`) ou **Escape**.
- Selecionar um evento não altera SOURCES/ENTITIES/STATUS nem a sidebar (seleção de evento ≠ seleção de categoria).

### Sincronização e saúde da fonte (Etapa 4D)

- **Polling de 60 s** (`USGS_SYNC.pollIntervalMs`) em `useSourceSync` (era `useEarthquakeSync`, generalizado na 5B): busca `/api/earthquakes` → espera terminar → agenda a próxima com `setTimeout`. No máximo uma requisição em andamento e um timer. O navegador nunca chama o USGS: Browser → `/api/earthquakes` → adapter/cache no servidor → USGS. O cache do servidor não mudou.
- **Sem polling duplicado**: o cleanup do efeito marca `stopped`, cancela o timer e aborta a requisição com `AbortController`; no StrictMode (montar → desmontar → montar) a primeira cadeia morre e só uma sobrevive. Verificado: um poll a cada ~60 s (15:23:56, 15:24:56, 15:25:57, 15:26:57…).
- **`SourceHealth`** (`src/types/source-health.ts`) = `"syncing" | "fresh" | "stale" | "unavailable"` + `SourceSyncState` { sourceId, health, lastAttemptAt, lastSuccessAt, lastIngestedAt }. É **estado técnico da integração**, sem relação com `IntelligenceSource.reliability` (avaliação metodológica).
- **Regra** (`deriveHealth`, `src/lib/source-health.ts`):
  - sem snapshot e nenhuma tentativa falhou → **syncing**;
  - sem snapshot e a última tentativa falhou → **unavailable** (não vira syncing nas retentativas);
  - com snapshot e a última tentativa falhou → **stale**;
  - com snapshot, última tentativa ok e idade ≤ janela de freshness da fonte → **fresh**; senão **stale**.
  - Stale **não** vira unavailable com o tempo: havendo snapshot conhecido, é stale.
- **Janela de freshness = 180 s** (e não os 120 s sugeridos): a rota pode servir legitimamente um snapshot com até 120 s (`MAX_AGE_MS`) e o próximo poll chega 60 s depois. Com 120 s, uma integração saudável oscilaria para stale entre polls.
- **Idade do snapshot** medida com o relógio do servidor: no recebimento, idade = header `Date` da resposta − `ingestedAt`; depois soma o tempo decorrido no cliente. Assim, diferenças de relógio entre cliente e servidor não distorcem freshness nem o "UPDATED … AGO".
- **Falha não apaga dados**: em refresh com falha, snapshot, entities, observations, pontos e painel selecionado permanecem; health = stale. Snapshot novo com sucesso substitui o anterior inteiro (sem acumular histórico).
- **Mapeamento na interface**:

| health | Topbar | STATUS | Sidebar (USGS Earthquakes) |
| ------ | ------ | ------ | -------------------------- |
| syncing | ○ SYNCING | SYNCING | ○ SYNCING |
| fresh | **● LIVE** (ciano sólido; title "Continuous synchronization active") | NOMINAL | ● FRESH · UPDATED 34S AGO |
| stale | ○ STALE ("Showing the last known snapshot; it may be out of date") | DEGRADED | ○ STALE · UPDATED 3M AGO |
| unavailable | ○ UNAVAILABLE | DEGRADED | ○ UNAVAILABLE |

  O **LIVE** só aparece ativo quando o polling está ativo **e** health = fresh. Estados inativos usam anel vazado cinza + texto (não só cor). SOURCES/ENTITIES contam o snapshot realmente mantido (unavailable → 0/0; stale → mantém as contagens do último snapshot). O "UPDATED … AGO" é recalculado a cada segundo por um relógio de exibição, sem refazer fetch; o Intelligence Panel continua em UTC absoluto.
- **Seleção por Entity ID** (nunca por Observation ID, que muda a cada `updated` do USGS): se a Entity continua no snapshot novo, o painel permanece aberto e mostra a Observation nova automaticamente; se ela saiu, a seleção é limpa (painel fecha, destaque dourado some).
- **Mapa** nunca recriado nos refreshes: só `setData` na source existente.
- Sem notificações, toasts ou sons para eventos novos.
- *Desde a Etapa 5B, Topbar e STATUS usam o estado **global** agregado (abaixo); a tabela acima vale por fonte, na sidebar.*

### Segunda fonte: ISS — Where The ISS At? (Etapa 5B)

**Primeira Entity móvel.** Fonte: [Where The ISS At?](https://wheretheiss.at/w/developer), endpoint `GET https://api.wheretheiss.at/v1/satellites/25544?units=kilometers`. A documentação confirma: sem autenticação, rate limit de "roughly 1 per second" (headers observados: `X-Rate-Limit-Limit: 350` a cada 5 minutos). O serviço estava operacional em 2026-10-05.

- **Fluxo**: Browser → `/api/space/iss` → adapter (`src/lib/sources/wtia/iss.ts`) → Where The ISS At?. O navegador nunca chama o serviço externo.
- **Cache no servidor**: não usa `unstable_cache`, que é stale-while-revalidate e serviria posições velhas de um objeto a ~7,7 km/s. Usa uma deduplicação mínima no módulo da rota: no máximo 1 chamada externa a cada 4 s, compartilhada por todos os clientes; requisições simultâneas reutilizam a busca em andamento; falhas não ficam guardadas. Teto ≈ 75 chamadas a cada 5 min (limite 350); posição servida com no máximo ~4 s.
- **IntelligenceSource** `wtia-iss` ("Where The ISS At?", `category: "open-data"`, **`reliability: "unknown"`**).
- **Entity** única e persistente: `space:norad:25544`, `category: "space"`, `kind: "space-station"`, `label: "International Space Station"` (NORAD 25544). Nunca é recriada por atualização.
- **Observation** por posição recebida: `wtia:25544:<timestamp>`. Só a mais recente fica no snapshot; a trilha recente (Etapa 5D) é um histórico limitado em memória no cliente, não no snapshot.
- **`nature: "estimated"`**: a posição é calculada orbitalmente pela fonte, não é um fix GPS observado. `confidence: "unknown"`. **`precision: "approximate"`**.
- **Tempos**: `timestamp` (Unix s, instante ao qual a posição se aplica) → `observedAt`. **Sem `reportedAt`**: a API não fornece horário de publicação. `ingestedAt` = recebimento pelo servidor AURELIS.
- **Proveniência reproduzível**: `sourceRecordId: "25544"`; `sourceUrl` = `…/satellites/25544?timestamp=<ts>&units=kilometers`, que devolve exatamente a mesma posição calculada (verificado).
- **`IssObservationData`**: `noradId`, `altitudeKm`, `velocity` (valor bruto) + `velocityUnit: "unknown"`, `visibility` ("daylight"/"eclipsed", valor da fonte).
  - **Corrigido na Etapa 5A**: a 5B chamava o campo de `velocityKph`, com a unidade inferida pela magnitude. A documentação oficial (`/w/developer`, verificada em 2026-10-05) só mostra `velocity` em exemplos; o parâmetro `units` diz apenas "Whether to use miles or kilometers", sem base de tempo; e nem "per hour", "km/h" ou "mph" aparecem nela ou em `/w/about`. Por isso o valor é guardado **bruto** em `velocity`, com `velocityUnit: "unknown"`; o painel não converte nem afirma km/h. **Etapa 5C**: o painel deixou de mostrar o número; VELOCITY aparece como "—" com a nota "Unit not documented by source.", porque sem unidade o valor não é uma métrica interpretável. O valor bruto continua preservado na Observation (proveniência).
  - `altitudeKm` permanece: altitude é distância, e `units` ("miles or kilometers") com `"units": "kilometers"` na resposta documenta a unidade.
  - `footprint` **não foi incluído**: a documentação não define se é diâmetro ou raio. `daynum`, `solar_lat` e `solar_lon` também não, por não terem uso atual.
  - A altitude fica em `data.altitudeKm` (como especificado), não em `GeoLocation.altitudeMeters`.
- **Validação runtime mínima** (sem Zod): objeto, `id === 25544`, `units === "kilometers"`, latitude/longitude na faixa, altitude, velocidade e timestamp numéricos e positivos. Payload inválido ou erro da API (inclui 429) → 502, sem fallback.
- **Frequência**: poll do cliente a cada **5 s** (`ISS_SYNC`), cadeia única. **Janela de freshness 15 s** (≈ 4 s de cache + 5 s de poll + latência ≈ 10 s, com margem).
- **SourceHealth independente**: `useSourceSync` (genérico) roda uma cadeia por fonte; cada uma tem seu `syncing/fresh/stale/unavailable` com o próprio intervalo e janela (`deriveHealth` recebe a janela). USGS manteve 60 s / 180 s.
- **Estado global** (`aggregateHealth`, nesta ordem):

| Condição | Global | Topbar | STATUS |
| -------- | ------ | ------ | ------ |
| todas fresh | live | ● LIVE (ciano) | NOMINAL |
| todas syncing | syncing | ○ SYNCING | SYNCING |
| nenhuma stale/unavailable, alguma ainda syncing | syncing | ○ SYNCING | SYNCING |
| ≥1 fresh e ≥1 stale/unavailable | partial | ○ PARTIAL | DEGRADED |
| nenhuma fresh, ≥1 stale | stale | ○ STALE | DEGRADED |
| resto (só syncing/unavailable, sem snapshot) | unavailable | ○ UNAVAILABLE | DEGRADED |

  O title da Topbar lista o estado de cada fonte (ex.: "USGS Earthquakes: FRESH · Where The ISS At?: STALE"). LIVE só fica ativo com todas as fontes fresh. **SOURCES** = fontes com snapshot utilizável; **ENTITIES** = soma das entidades atuais (terremotos + 1 ISS), nunca observations.
- **Mapa**: source própria `aurelis-iss-source` com uma symbol layer `aurelis-iss-layer` (anel + núcleo + "ISS"; até a 5F eram circle layers de anel/núcleo + symbol de rótulo), acima dos terremotos. Ciano normal, **dourado quando selecionada**. Posição atualizada via `setData`; mapa nunca recriado; sem trilha, sem interpolação, sem footprint visual. Um único handler de clique/cursor consulta as camadas de dados e escolhe a feição de cima.
- **Painéis**: `EarthquakePanel` e `IssPanel` separados, sobre `primitives.tsx` (moldura, linhas, horários UTC, link da fonte); nunca dois ao mesmo tempo. A seleção continua por Entity ID e troca de painel ao clicar em outra fonte. Com a ISS selecionada, posição, altitude, velocidade, `observedAt` e `ingestedAt` se atualizam a cada poll. Se a fonte do item aberto não está fresh, a moldura mostra "SOURCE STALE · showing the last known data…".
- **Falha da ISS**: com snapshot, o ponto e o painel ficam na última posição conhecida e a fonte vira STALE (global PARTIAL se o USGS estiver fresh). Sem snapshot, nenhum ponto é desenhado e a fonte fica UNAVAILABLE.
- Sidebar: categoria **SPACE** (visual, sem filtro) e as duas fontes listadas com estado próprio.
- **Sem histórico persistente, sem órbita, ground track ou footprint, sem outra fonte SPACE.** (A câmera oficial entrou na Etapa 5C e a trilha recente na 5D, abaixo.)

### Câmera oficial da NASA na ISS (Etapa 5C)

**Primeira mídia externa associada a uma Entity.** Não é nova camada geográfica, nova Entity, nova Observation nem nova fonte de telemetria: é mídia oficial ligada à Entity `space:norad:25544`, exibida só no painel da ISS.

- **Stream** (verificado em 2026-10-05):
  - Canal oficial **NASA** no YouTube (`@NASA`, id `UCLA_DiR1FfKNvjuUpBHmylQ`, o mesmo para onde aponta `nasa.gov/live`).
  - Vídeo `awQzjn72bI0`, "Live High-Definition Views from the International Space Station (Official NASA Stream)".
  - Ao vivo e incorporável: oEmbed com `author_name: NASA`, `playability: OK` e `playableInEmbed: true`.
  - Watch URL: `https://www.youtube.com/watch?v=awQzjn72bI0`.
  - Embed: `https://www.youtube-nocookie.com/embed/awQzjn72bI0?rel=0`.
- **Conteúdo, segundo a própria NASA**: câmera externa no módulo Harmony; quando ela fica indisponível, a NASA exibe um loop de vistas gravadas da Terra com a legenda "Previously Recorded". Por isso o AURELIS **nunca** chama o vídeo de "LIVE CAMERA" ou "LIVE VIDEO": a interface diz "ISS camera · Official NASA stream" e avisa "Feed availability varies. NASA may display previously recorded footage when live camera video is unavailable." O título oficial (que contém "Live") fica só na configuração, para proveniência.
- O outro stream oficial da NASA sobre a ISS (`M3HKLzjvKPc`, vistas internas e externas, tela azul na perda de sinal) não foi usado.
- **Configuração**: `src/lib/sources/nasa/iss-media.ts` (`NASA_ISS_STREAM`: provider NASA, platform youtube, videoId, watchUrl, embedUrl, sourceUrl do canal, entityId). Nenhum video ID no componente. Não há framework genérico de mídia.
- **AURELIS não hospeda nem retransmite**: só incorpora o player oficial do YouTube. Sem scraping, download, proxy, YouTube Data API, OAuth, endpoint `/api/youtube`, consulta de status, viewers ou chat.
- **Privacidade / carregamento**: o YouTube é um **serviço externo carregado apenas sob ação do usuário**. Na abertura do app não existe iframe nem requisição ao YouTube. *(Etapa 5C: o player só nascia após VIEW CAMERA; desde a 5D, nasce quando o usuário seleciona a ISS. Ver abaixo.)* O texto avisa "External video provided by NASA via YouTube. It loads only when you open it." Usa o domínio `youtube-nocookie.com`. Não há modal de consentimento nesta etapa.
- **Sem autoplay** e sem áudio automático (sem `autoplay` na URL nem no `allow`). Atributos do iframe:
  - `title`, `loading="lazy"`, `allowFullScreen`;
  - `referrerPolicy="strict-origin-when-cross-origin"`;
  - `allow="encrypted-media; picture-in-picture; fullscreen"`;
  - largura responsiva com `aspect-ratio` 16:9.
- **Ciclo de vida**: estado local `cameraOpen` no `IssPanel`, que é montado por seleção (`key` = Entity ID). Por isso:
  - CLOSE CAMERA remove o iframe do DOM (não só esconde), o que interrompe o player;
  - fechar o painel (X ou Escape) ou selecionar outra Entity desmonta o painel e o iframe some na hora;
  - ao voltar para a ISS, a câmera começa fechada *(regra da 5C; na 5D passou a começar aberta)*.
  - A telemetria continua atualizando com o player aberto, sem recriar o iframe.
- **Independente do SourceHealth**: a mídia NASA não é monitorada programaticamente e não participa de FRESH/STALE/UNAVAILABLE/PARTIAL/LIVE, nem de SOURCES ou ENTITIES (continuam USGS + WTIA; ENTITIES inalterado). Com a WTIA STALE, a seção CAMERA continua disponível e o vídeo não é considerado stale.
- **Layout**: o painel cresce moderadamente (360 → 440 px, limitado a 50vw) só enquanto a câmera está aberta. Não é modal nem fullscreen; o mesmo bloco poderá ir para um bottom sheet no mobile. Em 900 px de largura funciona sem rolagem horizontal, mas o mapa fica estreito (~220 px).
- Mapa sem alteração: nenhum ícone de câmera sobre o planeta.
- **Câmeras públicas genéricas continuam fora do escopo.** Nenhuma outra câmera, NASA TV, Hubble, Tiangong, webcam terrestre, chat, gravação, screenshot, PiP/fullscreen customizados nem status live/offline inferido.

### Trilha recente da ISS e câmera aberta por padrão (Etapa 5D)

**Trilha (recent tracked path).**

- **O que é**: histórico recente das posições que o AURELIS **realmente recebeu** da Where The ISS At? (posições estimadas pela fonte, `nature: "estimated"`). **Não é órbita prevista**: sem TLE, sem propagação orbital, sem satellite.js, sem ground track, sem trajetória futura.
- **Regra do histórico** (`src/lib/iss-trail.ts`): em memória no cliente (`Workspace`), alimentado a cada snapshot bem-sucedido da ISS. Guarda posições com `observedAt` dentro de **10 min** antes da mais recente, no máximo **120 pontos** (10 min a 1 posição a cada 5 s). Posições repetidas ou fora de ordem (a deduplicação de 4 s do servidor pode devolver a mesma) são ignoradas. Nada é persistido nem acumulado além disso (não é o Echo); recarregar a página zera a trilha.
- **STALE**: a janela é relativa à posição mais nova, então, com a WTIA falhando, nada expira e nada é inventado; a trilha fica parada junto com o último marcador. Ao recuperar, volta a acumular.
- **Lacunas**: posições consecutivas a mais de **30 s** (6 polls) não são ligadas, porque o trecho entre elas não foi rastreado (fonte stale, aba em segundo plano, recuperação). A trilha vira vários segmentos.
- **Antimeridiano**: quando duas posições consecutivas diferem mais de 180° em longitude, a latitude de cruzamento é interpolada, o segmento termina em ±180° e o próximo recomeça em ∓180°. Geometria: `MultiLineString`. Nenhuma linha atravessa o mapa (com `renderWorldCopies: false`, os dois lados ficam nas bordas opostas).
- **Mapa**: source `aurelis-iss-trail-source` + layer `aurelis-iss-trail-layer` (linha ciano, opacidade 0.55, 1.5 px, abaixo do marcador). Atualizada com `setData` só quando chega posição nova (geometria memorizada; o relógio de 1 s não a recalcula). **Visível apenas com a ISS selecionada** (marcador dourado + trilha ciano). Não é clicável.
- **Painel**: linha **TRACKED PATH** ("N positions · Recent tracked path since HH:MM:SS UTC, shown on the map. Received positions only; not an orbit prediction.").
- A trilha **não** cria Entity, não conta em ENTITIES e não é fonte separada.

**Câmera aberta por padrão.**

- Ao **selecionar a ISS**, o painel abre com a seção CAMERA **já aberta** e o player oficial da NASA montado (seleção = ação do usuário). Na abertura do app nada do YouTube carrega.
- **Sem autoplay**: nenhum parâmetro de autoplay nem permissão `autoplay` no iframe. O player mostra a capa e o botão de play do próprio YouTube, e o usuário dá play se quiser. O texto diz "External video provided by NASA via YouTube; it does not play automatically." mais o aviso de possível footage gravado. Continua sem afirmar LIVE.
- **Regra de controle**:
  - **HIDE CAMERA** remove o iframe do DOM e vale só para a seleção atual; **SHOW CAMERA** o recria.
  - Trocar de Entity ou fechar o painel (X/Escape) desmonta o painel e o iframe.
  - Voltar a selecionar a ISS reabre com a câmera visível (`IssPanel` é montado por seleção, `cameraOpen` inicia `true`).
- Continua fora de SourceHealth, SOURCES e ENTITIES; nenhum player flutuante no mapa.

### Movimento suave da ISS (Etapa 5D — smooth visual movement)

- **Polling inalterado**: a ISS continua sendo consultada a cada ~5 s. A suavização é **somente visual**, no cliente.
- **Atraso visual intencional de ~5 s** (`VISUAL_DELAY_MS`): o marcador é desenhado no instante `displayTime = agora − 5 s`, na linha do tempo das Observations (`observedAt`). O relógio do cliente é ajustado pela menor diferença observada entre recebimento e `observedAt`, então o desvio de relógio do cliente não afeta o atraso. Não é latência da fonte.
- **Interpolação só entre Observations recebidas** (`src/lib/iss-interpolation.ts`, funções puras): acha as duas posições recebidas que cercam `displayTime`, calcula o progresso por timestamps (limitado a 0–1) e interpola latitude/longitude linearmente. **Sem previsão, sem extrapolação, sem velocidade estimada.**
- **Antimeridiano**: a longitude é interpolada pelo **menor caminho** (179,8° → −179,8° passa por ±180°, não dá a volta no planeta) e normalizada para [−180, 180].
- **Casos de borda**: com uma única posição, ela aparece imediatamente; antes da primeira ou depois da última, o marcador fica nela. Com a **WTIA STALE**, o marcador termina o trecho conhecido e **para na última posição recebida**. Entre posições separadas por lacuna > 30 s (a mesma regra da trilha), o marcador espera na anterior em vez de animar um trecho não rastreado.
- **Domínio intacto**: Entity, Observation, `observedAt`, altitude e o painel continuam usando a Observation **mais recente**. Nenhuma Observation nova é criada. **A trilha não recebe pontos interpolados**: continua só com posições recebidas (10 min / 120 pontos). Ela termina na posição recebida mais recente, que fica ~5 s à frente do marcador.
- **Animação**: um único laço de `requestAnimationFrame` no `WorldMap`, independente da seleção. Atualiza **apenas** a source `aurelis-iss-source` (e só quando a posição muda), sem estado React por frame, sem recriar mapa ou layers. É cancelado no cleanup, então o StrictMode não deixa laços duplicados. O navegador pausa o `requestAnimationFrame` em abas ocultas.
- **Painel**: linha **SMOOTH DISPLAY** ("~5 s visual delay"; "The map marker is drawn about 5 seconds behind, moving between received observations. Values in this panel are the latest observation.").
- Não implementado: previsão orbital, TLE, satellite.js, ground track, órbita, follow mode, zoom automático, visão de satélite.

### Projeção globe (Etapa 5E)

- **`projectionMode: "globe" | "mercator"`** (`ProjectionMode` em `src/lib/map-config.ts`). **Default: `globe`**. Motivos: menos distorção perto dos polos, escala relativa dos continentes mais fiel, coerência com SPACE, preparo para satélite.
- **Separado do basemap**: a projeção não muda o mapa base, que continua **OpenFreeMap + style AURELIS** (sem Esri). No futuro, um `basemapMode` independente (ex.: satellite) vai se combinar com qualquer projeção (globe/mercator × dark/satellite).
- **Implementação**: projeção **nativa** do MapLibre GL JS (`map.setProjection({ type })`), no mesmo mapa; sem Cesium, Three.js ou renderer paralelo. Aplicada no evento `style.load` (sem piscar em Mercator na abertura) e a cada troca. Trocar a projeção não recria o mapa, as sources, as layers nem o estado (seleção, painel, trilha, dados).
- **Controle**: GLOBE / FLAT (desde a 5F via `SegmentedControl`), compacto, no canto superior esquerdo do mapa; FLAT = Mercator atual. Estado de sessão no `MapView`, **não persistido** (sem localStorage).
- **Atmosfera**: `map.setSky` nativo, muito sutil (`sky-color` = `--aurelis-bg`, `horizon-color` = `--aurelis-blue`, `atmosphere-blend` 0.35 no zoom 0 → 0 no zoom 6). Sem estrelas, nuvens nem terminador. Observação: o oceano do style tem a mesma cor do fundo, então o contorno do disco aparece sobretudo pela atmosfera.
- **Interação**: zoom, arrasto (gira o globo) e seleção de features continuam iguais; sem auto-rotação nem animações.
- **`renderWorldCopies: false`** continua valendo para o Mercator e não tem efeito no globo (há só um mundo).
- **Camadas AURELIS**: terremotos, ISS (movimento suave, ~5 s de atraso visual), trilha, seleção dourada, painéis e câmera funcionam igual no globo, acima do basemap. Labels e hierarquia por zoom não mudaram.
- **Trilha e antimeridiano**: a lógica não mudou. A divisão em ±180° (`trailToSegments`) continua necessária para o Mercator (não atravessar o mapa) e, no globo, os dois segmentos se encontram no mesmo ponto da esfera, então a linha aparece contínua. Verificado nas duas projeções.
- Não implementado: Esri/World Imagery, modo satélite, terrain/DEM, prédios 3D, órbita, estrelas, nuvens, terminador dia/noite, auto-rotação.

### Basemap satélite — Esri World Imagery (Etapa 5F)

- **Dois estados independentes**: `projectionMode: "globe" | "mercator"` (default globe) e `basemapMode: "dark" | "satellite"` (`BasemapMode` em `src/lib/map-config.ts`, default **dark**). As quatro combinações funcionam (globe/mercator × dark/satellite). São controles separados, MAP/SATELLITE e GLOBE/FLAT, com estado de sessão no `MapView`, não persistido.
- **DARK** = OpenFreeMap + style AURELIS (comportamento anterior, inalterado e restaurado exatamente ao voltar).
- **SATELLITE** = **Esri World Imagery** + overlays de referência AURELIS (fronteiras e rótulos de lugares) + dados operacionais AURELIS.
- **Método oficial e autenticado**: o **ArcGIS Basemap Styles service v2**, style `arcgis/imagery` (`basemapstyles-api.arcgis.com/.../styles/v2/styles/arcgis/imagery`), consultado com a API key. Do style retornado usa-se **apenas a source raster de World Imagery** (URL dos tiles autenticada `ibasemaps-api.arcgis.com/.../World_Imagery/MapServer/tile/{z}/{y}/{x}` e atribuição, exatamente como o serviço devolve), adicionada como layer raster logo acima do `background`.
  - **Não** se usa `setStyle()` com o style da Esri, que recriaria as layers AURELIS; o AURELIS continua controlando o mapa.
  - **Não** se usa o endpoint legado `server.arcgisonline.com`.
  - **Sem dependência nova**: o plugin `@esri/maplibre-arcgis` aplica o style inteiro.
  - O ArcGIS Static Basemap Tiles service não oferece `arcgis/imagery` (só `arcgis/imagery/labels`).
- **Carregamento**: nada da Esri é requisitado em DARK. O style é consultado só na primeira vez que SATELLITE é selecionado. Ao voltar para DARK a layer fica oculta e o MapLibre para de pedir tiles (verificado: nenhuma requisição nova ao mover o mapa em DARK). Sem cache customizado.
- **Overlays no SATELLITE** (`src/components/map/basemap-layer.ts`):
  - ficam visíveis só as layers `boundary_*` e `place_*` do style AURELIS; preenchimentos, água, vegetação, vias, ferrovias, edifícios etc. ficam ocultos (visibilidade, sem destruir layers);
  - rótulos em `--aurelis-text` com halo `--aurelis-bg` (1.4 px, blur 0.5), para ficarem legíveis sobre oceano, floresta, deserto e neve;
  - fronteiras nacionais em `--aurelis-text-muted` e estaduais em `--aurelis-text-subtle`, finas, mantendo os zooms atuais;
  - os valores originais de visibilidade e pintura são guardados e **restaurados exatamente** em DARK (verificado por comparação).
- **Ordem**: imagery (logo acima do background) < overlays de referência < terremotos < trilha da ISS < ISS (ciano = dados, dourado = selecionado). A ISS (polling, interpolação, atraso visual, trilha, câmera) e o SourceHealth não mudaram.
- **Atribuição**:
  - a Esri exige "Powered by Esri" (com link para esri.com) e a atribuição de dados vinda do serviço; a source raster leva "Powered by Esri · " + a string `attribution` do serviço (hoje "Source: Esri, Vantor, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community"), escapada como texto;
  - o `AttributionControl` do MapLibre mostra só as fontes efetivamente visíveis: no SATELLITE, Esri + OpenFreeMap (as overlays usam OpenMapTiles); no DARK, só OpenFreeMap;
  - tamanho: no SATELLITE a atribuição usa 12 px (recomendação da Esri: 12 px ou mais), via classe `aurelis-basemap-satellite` no container do mapa; no MAP continua com 10 px (OpenFreeMap/OSM).
- **Falha**: se o style da Esri não puder ser obtido, um aviso é registrado no console, o modo volta para DARK e o botão SATELLITE indica a falha no title. Erros de tiles também são registrados uma vez. A Esri **não** tem SourceHealth.
- **API key**: vem de `NEXT_PUBLIC_ARCGIS_API_KEY` (`.env.local`, ignorado pelo Git). O valor **nunca** é documentado nem versionado. Ela é usada pelo navegador por design (autenticação por API key em app público); a segurança vem das **restrições de referrer da credential**, não de ocultar a chave (sem ofuscação nem proxy). A credential deve autorizar `http://localhost:3000/*` em desenvolvimento e, no futuro, o domínio público do AURELIS. Sem chave, o botão SATELLITE fica desabilitado.
- **Esri é provedor de basemap** (infraestrutura visual): **não** é `IntelligenceSource`, **não** conta em SOURCES e **não** participa de SourceHealth.
- Não implementado: Google, MapTiler, terrain/DEM, prédios 3D, nuvens, radar, imagery NASA/Sentinel, labels extras da Esri, time slider, imagery histórica, data de captura, download, cache offline.

### Altitude real da ISS no globo (Etapa 5G)

- **GLOBE**: o marcador da ISS e o rótulo "ISS" são desenhados na **altitude orbital reportada**, em escala real (sem exagero), com o recurso nativo do MapLibre `symbol-height-offset` (metros, layout data-driven `["get", "altitudeMeters"]`). Sem Three.js, Cesium, custom WebGL layer nem dependência nova.
- **Origem**: `altitudeKm` da Observation (WTIA). A conversão `altitudeMeters = altitudeKm × 1000` é só de apresentação (propriedade da feature no mapa); nenhuma altitude nova entra no domínio.
- **Representação**: as antigas circle layers (anel, núcleo) e a symbol de rótulo viraram **uma única symbol layer** `aurelis-iss-layer` (ícone anel + núcleo desenhado em canvas, com o texto "ISS"), porque circle layers não suportam altura. Aparência preservada: ciano normal, dourado selecionada (troca de `icon-image` e `text-color`). Marcador e rótulo sobem juntos.
- **Mesmo instante visual**: os pontos recebidos guardam também `altitudeKm`; `interpolatePosition` interpola latitude, longitude **e altitude** no mesmo `displayTime` (~5 s de atraso). Sem extrapolação: sem próxima Observation, posição e altitude param na última recebida. Nenhuma Observation intermediária é criada.
- **FLAT (mercator)**: `symbol-height-offset` = 0; a ISS continua sobre o mapa. A altitude segue disponível no painel.
- **Trilha**: na 5G continuava na superfície; desde a 5H também fica em altitude orbital no globo (ver seção abaixo).
- **Seleção**: `queryRenderedFeatures` atinge o símbolo elevado normalmente (sem hit-testing customizado); clicar nele seleciona `space:norad:25544`.
- **Oclusão**: com a ISS atrás da Terra, o símbolo não é desenhado (verificado: 0 feições renderizadas com a câmera do lado oposto).
- **Painel**: ALTITUDE continua sendo o valor da Observation mais recente, com a nota "Rendered at reported orbital altitude on globe."
- Funciona em GLOBE + MAP e GLOBE + SATELLITE; a integração Esri não mudou.
- Não implementado: modelo 3D, órbita prevista, TLE, satellite.js, linha vertical, footprint, sombra, iluminação, outros satélites, auto-follow.

### Trilha orbital 3D da ISS no globo (Etapa 5H)

- **GLOBE**: a trilha não é mais ground track. É desenhada **em altitude orbital real**, flutuando acima da esfera e saindo do próprio marcador, por uma **custom layer** do MapLibre (`aurelis-iss-orbit-trail-layer`, `type: "custom"`, `renderingMode: "3d"`, `src/components/map/iss-orbit-trail-layer.ts`). WebGL direto com o código de projeção do próprio MapLibre (`shaderData.vertexShaderPrelude` + `projectTileFor3D(mercator, elevação em metros)`); sem Three.js nem dependência nova.
- **Altitude por ponto**: cada posição recebida guarda o `altitudeKm` da sua Observation; cada vértice usa `altitudeKm × 1000` m (sem altitude fixa).
- **Endpoint**: a trilha usa o mesmo `displayTime` (~5 s de atraso) do marcador: entram só posições recebidas até esse instante, e o último vértice é a posição/altitude interpolada do marcador (`orbitTrailStrips` em `src/lib/iss-trail.ts`). Esse ponto é só visual: não é Observation nem entra no histórico. Sem extrapolação e sem trajetória futura.
- **Oclusão**: depth test 3D contra o planeta; a parte atrás da Terra não aparece (verificado com a câmera do lado oposto).
- **Antimeridiano**: no globo a trilha não é dividida em ±180° (pontos consecutivos ficam próximos na esfera); continua dividida em lacunas > 30 s.
- **Visual**: ciano, linha fina (1 px), opacidade máx. 0.55, ponta mais antiga com fade (mesmo critério da 2D). Dourado só no marcador.
- **FLAT**: continua a trilha 2D sobre o mapa (`aurelis-iss-trail-layer`); a camada 3D não desenha em mercator. Visibilidade: 2D = selecionada && mercator; 3D = selecionada && globe.
- Painel: TRACKED PATH explica "At reported altitude on globe; on the surface on flat map."
- Não implementado: órbita prevista, TLE, satellite.js, linha até o chão, footprint, modelo 3D, outros satélites.

### Terceira fonte: NOAA SWPC — Planetary Kp (Etapa 6A)

- **Fonte oficial**: NOAA Space Weather Prediction Center, produto JSON público `https://services.swpc.noaa.gov/json/planetary_k_index_1m.json` (sem autenticação, sem API key; dados NOAA/NWS em domínio público, sem exigência de atribuição além de não atribuir à NOAA autoria/endosso). Página do produto: `https://www.swpc.noaa.gov/products/planetary-k-index` (atualiza a cada minuto). Formato verificado em 2026-10-06: array de `{ time_tag, kp_index, estimated_kp, kp }`, ~6 h de amostras de 1 min, em ordem crescente.
- **IntelligenceSource** `noaa-swpc-kp` ("NOAA SWPC — Planetary Kp", provider NOAA SWPC, category `government`, **reliability `unknown`**: ser NOAA não define confiabilidade sem metodologia própria).
- **Dado global sem localização**: Kp é um índice planetário. **Sem Entity**, sem `location`, sem `entityId`; nada é desenhado no mapa (nenhuma layer, marcador, polígono, glow, cor de atmosfera ou aurora). Valida a regra **MAP → dados geográficos; PANELS → dados globais/não geográficos**.
- **Observation sem Entity**: `Observation<PlanetaryKpObservationData>` com id `noaa-swpc-kp:<observedAt>`, **nature `estimated`** (a NOAA chama o produto de *Estimated* 3-hour Planetary Kp, derivado em tempo quase real de magnetômetros terrestres), confidence `unknown`, `observedAt` = `time_tag`, sem `reportedAt` (a fonte não dá horário de publicação), `ingestedAt` do servidor, `sourceRecordId` = `time_tag` bruto, `sourceUrl` = endpoint.
- **Campos usados**: `estimated_kp` → `estimatedKp` (exibido). `kp_index` e `kp` (ex.: "2M", "1P") ficam **brutos** em `kpIndex`/`kpCode`, não exibidos: sua derivação não está documentada pela fonte.
- **`time_tag`**:
  - **SOURCE FACT**: `time_tag` = `"YYYY-MM-DDTHH:MM:SS"`, **sem offset/fuso**; o schema do JSON não declara o fuso do campo.
  - **AURELIS NORMALIZATION ASSUMPTION**: os produtos e materiais operacionais da SWPC usam UTC/Universal Time; seguindo essa convenção, o AURELIS **interpreta `time_tag` como UTC** e o normaliza para ISO 8601 com `Z` (`observedAt`), usado para ordenar e exibir. É uma suposição de normalização documentada, **não** uma propriedade explícita do schema. Indício consistente (não prova): a última amostra coincide, em até 1 min, com o `Last-Modified` GMT do arquivo.
  - Defesa: amostra mais de 10 min no futuro é rejeitada (sinal de que a suposição de fuso falhou).
- **Validação mínima** (`src/lib/sources/noaa/swpc-kp.ts`, sem Zod): payload precisa ser array; cada registro precisa de `time_tag` no formato exato e data real, e `estimated_kp` numérico em **0–9** (faixa documentada do Kp). Registros inválidos ou com `time_tag` duplicado são ignorados individualmente (contados em `metadata.recordsRejected`); payload não-array ou sem nenhum registro válido → erro 502.
- **Amostra atual** = Observation válida com **maior `observedAt`** (ordenação por timestamp, nunca pela posição no array): `latestObservationId`.
- **Histórico**: só a janela das **últimas 6 h** relativa à amostra mais recente (≤ ~360 amostras), dentro do snapshot. Sem banco, sem Echo, sem acumulação no cliente.
- **API interna**: Browser → `/api/space/weather/kp` → adapter → NOAA. Cache em módulo de **45 s** (no máximo uma chamada à NOAA a cada 45 s; requisições simultâneas compartilham a chamada; falhas não ficam em cache, então dado velho nunca é servido como atual). O navegador nunca chama a NOAA.
- **Polling/saúde**: `NOAA_KP_SYNC` = poll **60 s** (`useSourceSync`, fetch → espera 60 s → fetch) e freshness **180 s** (≤ 45 s de cache + 60 s de poll + margem, como USGS). SourceHealth própria (syncing/fresh/stale/unavailable) e entra no `aggregateHealth` sem regra especial (NOAA stale + outras fresh → PARTIAL/DEGRADED).
- **SOURCES** passa a contar 3 (USGS, WTIA, NOAA SWPC) quando as três têm snapshot. **ENTITIES não muda**: continua terremotos + ISS (Kp não cria Entity).
- **Painel de domínio**: clicar **SPACE** na sidebar abre o **SpaceWeatherPanel** (`src/components/panel/SpaceWeatherPanel.tsx`). O `Workspace` passou de `selectedEntityId` para `PanelTarget = { type: "entity"; entityId } | { type: "domain"; domain: "space" }`: um painel por vez (SPACE → SpaceWeatherPanel; ISS → IssPanel; terremoto → EarthquakePanel). A linha SPACE da sidebar é um botão (`aria-pressed`, barra dourada quando aberta); as demais categorias continuam inertes.
- **Conteúdo do painel**: PLANETARY Kp com o valor atual grande (dourado) + tag ESTIMATED; notas "Near-real-time planetary Kp estimate from NOAA SWPC." e "Kp ranges from 0 to 9 and represents planetary geomagnetic activity."; TREND · LAST 6 H; PROVENANCE (LATEST ESTIMATE UTC, INGESTED, SOURCE, NATURE ESTIMATED, AURELIS CONFIDENCE UNKNOWN); OPEN ORIGINAL SOURCE → página do produto (nova aba, `noopener noreferrer`).
- **Gráfico** (`KpTrendChart.tsx`, SVG puro, sem biblioteca): Y 0→9 (grades 0/3/6/9), X tempo UTC com marcas a cada 2 h; linha ciano com segmentos retos só entre amostras consecutivas (lacuna > 3 min não é ligada); sem suavização nem amostras intermediárias; ponto mais recente em dourado. Linha tracejada de referência **G1 THRESHOLD · Kp 5** com a legenda "reference threshold from NOAA G scale; not an AURELIS alert". **Nenhum alerta G é exibido** a partir da estimativa; sem rótulos quiet/active/storm; sem cores de severidade.
- Não implementado: forecast Kp, alertas/escalas NOAA, flares, prótons, vento solar, aurora/OVATION, CME, GOES, lua, outras fontes SPACE.

### Quarta fonte: NOAA SWPC — OVATION Aurora (Etapa 6B)

- **Fonte oficial**: NOAA SWPC "Aurora - 30 Minute Forecast" (`https://www.swpc.noaa.gov/products/aurora-30-minute-forecast`), JSON público `https://services.swpc.noaa.gov/json/ovation_aurora_latest.json` (sem autenticação, sem key). A página descreve o produto como *short-term forecast of the location and intensity of the aurora*, baseado no modelo **OVATION** (Prime), com lead time de **30 a 90 min** = tempo de trânsito do vento solar medido em **L1** até a Terra; quando o dado de vento solar falta, o modelo é dirigido pelo Kp e **não há lead time**.
- **Formato verificado (2026-10-06)**: `{ "Observation Time": "…Z", "Forecast Time": "…Z", "Data Format": "[Longitude, Latitude, Aurora]", coordinates: [[lon, lat, aurora], …], type: "MultiPoint" }`; grade global de 1° (360 × 181 = 65 160 pontos), longitude 0..359, latitude −90..90, valores inteiros (0..26 no arquivo verificado). ~0,9 MB.
- **Semântica do terceiro valor: NÃO confirmada.** A documentação só o nomeia "Aurora" e diz que uma estimativa de *viewing probability* **pode ser derivada** assumindo relação linear com a intensidade; isso não prova que o campo seja probabilidade, porcentagem ou unidade física. No AURELIS: **`auroraValue`**, painel "PEAK MODEL VALUE" com nota "unit and scale not documented". Sem máximo imposto (nenhum documentado); sem limiares interpretativos.
- **IntelligenceSource** `noaa-swpc-ovation` ("NOAA SWPC — OVATION Aurora", provider NOAA SWPC, category `government`, reliability `unknown`). Mesmo provider do Kp, mas produto/feed independente: **SourceHealth própria**.
- **Sem Entity** (nada de `aurora:north`, células como entidades etc.). Uma resposta OVATION = **um forecast snapshot** = **uma Observation** (`Observation<AuroraForecastData>`): id `noaa-swpc-ovation:<Forecast Time>`, **nature `forecast`** (novo `EvidenceNature`), confidence `unknown`, sem `entityId`, sem `location`, sem `reportedAt` (a fonte não dá horário de publicação), **`validAt` = Forecast Time**, `ingestedAt` do servidor, `sourceRecordId` = Forecast Time, `sourceUrl` = endpoint "latest".
- **Tempos**: ambos trazem fuso explícito (`Z`), preservados sem suposição; tempo sem fuso é rejeitado. **"Observation Time" não vira `observedAt`**: a página explica o L1/lead time, mas não define esse campo do JSON, e ele **não é uma observação da aurora**. Fica preservado em `data.inputObservationTime` (painel: "SOURCE OBS. TIME", com essa ressalva).
- **Dados** (`AuroraForecastData`): `inputObservationTime`, `forecastTime`, `dataFormat`, `totalGridCells` (células válidas, **zeros incluídos**), `activeGridCells` (valor > 0), `rejectedGridCells`, `peakValue`, `activeCells` (`[lon, lat, auroraValue][]`).
- **Longitude**: 0..359 → −180..180 (`lon > 180 → lon − 360`). Transformação cartográfica da mesma posição, não mudança da informação.
- **Validação mínima** (`src/lib/sources/noaa/ovation.ts`, sem Zod): objeto; Observation/Forecast Time ISO com fuso; `Data Format` exatamente `[Longitude, Latitude, Aurora]` (outra ordem de colunas → erro); `coordinates` array; cada célula com 3 números finitos, lon em [0, 360), lat em [−90, 90], valor ≥ 0; duplicatas descartadas. Células inválidas são descartadas e contadas; payload estruturalmente inválido ou sem células válidas → 502.
- **Transferência**: só as células com valor > 0 são enviadas (~19 mil, ~220 KB, contra ~0,9 MB do arquivo original). Todo ponto válido ausente de `activeCells` tem valor **0** (zero, nunca "missing"); `totalGridCells`/`activeGridCells` registram isso.
- **API interna**: Browser → `/api/space/weather/aurora` → adapter → NOAA. Cache em módulo de **4 min** (uma chamada à NOAA a cada 4 min no máximo; requisições simultâneas compartilham a chamada; falha nunca é guardada como snapshot).
- **Polling/saúde**: `NOAA_OVATION_SYNC` = poll **5 min** (`useSourceSync`) e freshness **20 min** (≤ 4 min de cache + 5 min de poll, com tolerância a atrasos). **Política operacional do AURELIS, não SLA da NOAA** (a frequência de atualização observada, em minutos, também não é SLA). Entra no `aggregateHealth` sem regra especial. **SOURCES** = 4 com as quatro fontes com snapshot; **ENTITIES** continua terremotos + ISS (nenhuma célula conta).
- **Mapa** (`src/components/map/aurora-layer.ts`, `src/lib/aurora-grid.ts`), desde a **6B.1**: uma **custom layer WebGL2** pequena (`aurelis-aurora-layer`, `renderingMode: "3d"`), sem dependência nova. **DATA**: a grade NOAA é copiada sem alteração para uma textura 360 × 181 (`R16F`, um texel por ponto da grade), enviada à GPU **uma vez por forecast**. **VISUALIZATION**: uma malha lon/lat de 1° amostra a textura com **interpolação visual local** entre os 4 pontos vizinhos da grade (filtragem bilinear do hardware com pesos smoothstep: sem linhas da grade, sem overshoot, nunca além de um passo de grade a partir de um ponto não-zero publicado). *Visual interpolation for rendering only; source grid values remain unchanged.* Não cria Observations nem altera `auroraValue`, `peakValue` ou proveniência. Sem splines, ruído, blur ou oval manual; hemisférios norte e sul vêm dos dados, sem espelhamento. **Antimeridiano**: longitude com wrap (`REPEAT`): 359° e 0° são vizinhos, sem costura em ±180°. **Polos**: latitude com `CLAMP_TO_EDGE` (sem wrap através do polo); a malha converge no polo da esfera (sem buraco nem anel). Na 6B a layer era de polígonos 1° × 1° (visual quadriculado).
- **Visual**: paleta inspirada na aparência típica de auroras (tokens `--aurelis-aurora-low` ciano-verde → `--aurelis-aurora` verde → `--aurelis-aurora-high` verde luminoso → `--aurelis-aurora-peak` violeta frio só para valores muito altos); **não** afirma que o modelo prevê a cor física; sem vermelho, arco-íris ou dourado dominante; sem categorias de severidade. Stops só visuais. Opacidade: rampa suave (smoothstep nos valores baixos, máx. 0.62), zero transparente, sem borda rígida entre 0 e > 0.
- **Ordem**: imagery/basemap < **aurora** < fronteiras < rótulos < terremotos < trilha/ISS (custom layer inserida antes da primeira `boundary_*`). **GLOBE**: casca esférica a **`AURORA_VISUAL_ALTITUDE_METERS` = 110 km** acima da superfície — **constante de apresentação**, não dado: a NOAA **não fornece altitude por célula** e o AURELIS **não afirma** que a aurora está a 110 km; serve só para separação visual/legibilidade. Projeção pela matriz de globo do MapLibre (mesma convenção de esfera da trilha 3D da ISS), transição para mercator em zoom alto como `projectTileFor3D`; depth test contra o planeta (some atrás da Terra, acompanha a rotação) **sem escrever no depth buffer** (a casca translúcida não esconde o que é desenhado depois). **FLAT**: sobre a superfície, **sem altitude**. MAP/SATELLITE não tocam a layer nem a textura.
- **Layer opcional**: `auroraVisible` (estado de sessão no `Workspace`, default **false**, não persistido). A textura só é montada/enviada com a layer visível e quando o forecast muda (id); esconder só para de desenhar (snapshot e textura ficam); mostrar de novo não reprocessa. **Sem animação** (nada de pulsação, ondas, ruído, deriva, partículas).
- **Performance**: 6B (polígonos) ≈ 150 ms de tarefa longa + ~2 s até estabilizar; **6B.1** ≈ 60 ms de tarefa longa ao ativar (compilação do shader + upload da textura), **0 ms** ao reexibir; nenhum render React por frame.
- **Observação sobre os dados**: o arquivo verificado tem valores baixos (1–2) em todas as longitudes nas latitudes 0 e −1. Continuam no renderer (não filtrados), mas a rampa de opacidade os deixa quase transparentes — decisão de visualização, não remoção de dados.
- **Painel SPACE** (SpaceWeatherPanel): mantém **PLANETARY Kp** (tag **ESTIMATED**, gráfico, proveniência própria) e ganha **AURORA FORECAST · 30–90 MIN** (tag **FORECAST**, botão SHOW ON MAP / HIDE AURORA, notas da NOAA sobre OVATION e lead time, aviso de que não garante visibilidade — nuvens, luz do dia e condições locais não são considerados —, VALID FOR, SOURCE OBS. TIME, GRID ativas/total, PEAK MODEL VALUE, INGESTED, SOURCE, NATURE, AURELIS CONFIDENCE, link da fonte). Saúde por produto dentro do painel (`PanelShell.sourceHealth` ficou opcional): "Kp SOURCE STALE" / "AURORA SOURCE STALE · Showing the last available forecast."; um produto stale não esconde o outro. Kp ESTIMATED ≠ Aurora FORECAST.
- Não implementado: visibilidade personalizada, localização do usuário, nuvens, nascer/pôr do sol, lua, score de astrofoto, alertas/notificações de aurora, timeline/animação, imagens JPG hemisféricas, viewline experimental, vento solar, Bz, CME.

### Dívida técnica

- **Saúde da fonte** (*Future source health should model explicit states such as fresh, stale and unavailable instead of source-specific cache heuristics.*): **parcialmente resolvida na 4D** no cliente (`SourceHealth`). O servidor ainda usa a heurística de idade de 120 s específica da rota de terremotos; generalizar quando houver a segunda fonte.

### Modelo de dados (detalhes em `docs/DATA_MODEL.md`)

- **Entity ≠ Observation.** `AurelisEntity` é a coisa acompanhada (servidor, avião…); `Observation<T>` é o que uma fonte afirmou sobre ela num momento. A entidade não guarda fatos próprios: o que se sabe vem das observações, cada uma com `nature` (`observed` | `reported` | `estimated` | `inferred`) e `confidence`.
- **Composição, sem entidade universal.** A entidade tem apenas o núcleo comum; atributos e identificadores de domínio (ICAO24, MMSI, IP…) ficarão em estruturas especializadas, criadas quando houver ingestão real. `Observation.data: T` carrega o payload específico.
- **Proveniência.** Toda observação preserva `sourceId`, `originSourceId` (fonte original quando há repasse), `sourceRecordId`, `sourceUrl` e três tempos distintos: `observedAt` (evento), `reportedAt` (publicação pela fonte), `ingestedAt` (chegada ao AURELIS, sempre presente). Tempo ausente fica ausente; nunca é preenchido com `ingestedAt`.
- **Tempo:** strings ISO 8601 em UTC (`IsoDateTime`), sem classes de data.
- **Localização com precisão obrigatória** (`exact` | `approximate` | `city` | `region` | `country` | `unknown`) e raio de incerteza opcional. Um IP geolocalizado numa cidade é `city`, não um ponto exato.
- **Regra de Relationships:** nenhuma linha entre entidades sem um `EntityRelationship` explícito. Proximidade, ordem em array, mesma categoria, mesma fonte ou coincidência temporal nunca geram conexões.
- **IDs são `string`.** No futuro será preciso distinguir ID interno, ID do registro na fonte (`sourceRecordId`) e identificadores naturais; estes ainda não foram modelados.
- **Sem validação em runtime** (sem Zod/Yup) até começar a ingestão de dados externos.
- Ajustes em relação à proposta original: `ConfidenceLevel` e `IsoDateTime` ficam em `common.ts` (compartilhados, sem ciclos de import); `sourceEntityId`/`targetEntityId` viraram `fromEntityId`/`toEntityId` para não confundir "source" (entidade) com `sourceId` (fonte de dados); foram adicionados `Observation.originSourceId`, `GeoLocation.uncertaintyRadiusMeters`, `AurelisEntity.locationObservationId` e `EntityRelationship.evidenceObservationIds` para responder às perguntas de proveniência.
- **Indicador LIVE neutro (cinza).** Nenhuma fonte ao vivo está conectada, então o indicador não usa verde nem animação — seguindo a regra de não representar o que os dados não comprovam. Tooltip: "No live sources connected".
- **Sem biblioteca de ícones.** Seis ícones SVG inline bastam.
- **Tema apenas dark.** Ver "Identidade visual" abaixo.
- **Sidebar oculta abaixo de `md`**; o mapa ocupa a largura toda em telas menores. Sem interface mobile dedicada.
- O projeto foi gerado com `create-next-app` (pasta temporária `aurelis`, pois o npm não aceita maiúsculas no nome do pacote) e movido para cá. `AGENTS.md`/`CLAUDE.md`, gerados pelo Next.js, foram removidos do versionamento e estão no `.gitignore`.

## Funcionalidades implementadas

- Layout de aplicação em tela cheia: Topbar, Sidebar, mapa e Status bar, com identidade visual azul-marinho/dourado/ciano.
- Mapa mundial MapLibre 2D com style próprio AURELIS (tiles OpenFreeMap), pan/zoom, controles de zoom discretos (canto inferior direito), atribuição sempre visível.
- Campo de busca **visual** (sem funcionalidade).
- Categorias WORLD, CYBER, AIR, SEA, WEATHER, DISASTERS com ícones (**placeholder**, sem filtro).
- Status bar com contagens reais de SOURCES/ENTITIES e STATUS SYNCING/NOMINAL/DEGRADED.
- Modelo de domínio em TypeScript (`src/types/`): Source, Location, Entity, Observation, Relationship + `EarthquakeObservationData`.
- **ISS (Where The ISS At?)**: primeira Entity móvel, posição a cada 5 s, painel próprio e saúde da fonte independente; estado global agregado (LIVE/PARTIAL/…).
- **Primeira fonte operacional: USGS Earthquakes M2.5+ / 24 h**, normalizada no servidor (`/api/earthquakes`) e exibida como círculos em ciano no mapa, **sincronizada a cada 60 s** com saúde da fonte (syncing/fresh/stale/unavailable) e indicador LIVE real.
- **Space Weather (NOAA SWPC Planetary Kp)**: terceira fonte, Kp estimado atual + tendência de 6 h no painel de domínio SPACE (clique em SPACE na sidebar); sem Entity e sem mapa.
- **Aurora forecast (NOAA SWPC OVATION)**: quarta fonte, forecast de 30–90 min em grade de 1° como layer opcional no mapa (SHOW ON MAP no painel SPACE) + resumo no painel; nature `forecast`, `validAt`; sem Entity.
- **Seleção de terremoto + Intelligence Panel** (dados e proveniência), destaque dourado do evento selecionado.
- **Hierarquia de rótulos por zoom** no basemap (países → capitais → cidades/estados → detalhes); ver `docs/MAP_ARCHITECTURE.md`.

## Ainda NÃO implementado (deliberadamente)

- Outras fontes (cyber, aviação, marítimo, incêndios, clima…). Outros feeds USGS (All, M1+, M4.5+, Significant) e escolha de magnitude.
- WebSocket/SSE (hoje: polling de 60 s para USGS e NOAA Kp, 5 min para OVATION, 5 s para a ISS). Notificações de eventos novos.
- Persistência e histórico de observações; reconciliação de Entity IDs por `ids` do USGS.
- Clustering, popup, tooltip; endpoint Detail do USGS.
- Outras fontes SPACE (Hubble, Tiangong, CelesTrak…), satellite.js, órbita, ground track, footprint visual, outras câmeras/streams (a única mídia é o stream oficial da NASA da ISS). Clima espacial além do Kp estimado e do forecast OVATION mais recente (forecast de Kp, alertas, flares, vento solar/Bz, viewline, CME, GOES, timeline de aurora).
- Histórico persistente de posições da ISS (Echo); a trilha atual é só memória recente (10 min / 120 pontos).
- Estruturas especializadas para outros domínios (avião, navio, malware…) e identificadores naturais.
- Validação de payload com biblioteca de schema (hoje: validação mínima manual no adapter).
- Preferências de projeção/basemap persistidas.
- Self-hosting dos tiles (a instância pública da OpenFreeMap não tem SLA).
- Sistema de cores de severidade.
- Busca funcional; filtros/seleção de camadas.
- EON Core, Tissue, Echo, Rupture, Needle.
- Banco de dados, Supabase, PostgreSQL, Redis, autenticação, IA, WebSockets, filas, Docker, backend de ingestão, PWA, Tauri.
- Testes automatizados.
- Interface mobile dedicada.

## Comandos

```bash
npm install
npm run dev     # http://localhost:3000
npm run lint
npm run build
npm start
```

## Log

2026-10-05 09:57 | projeto inteiro | Criação inicial: scaffold Next.js 16 + TS + Tailwind 4 + ESLint, MapLibre 6 com basemap escuro, layout Topbar/Sidebar/Map/StatusBar, worker do MapLibre servido de public/. Lint e build sem erros; mapa verificado em dev e produção.
2026-10-05 10:17 | src/types, docs/DATA_MODEL.md | Etapa 2: modelo de domínio inicial (Source, Location, Entity, Observation, Relationship), separação Entity ≠ Observation, campos de proveniência e regra de Relationships documentados. Nenhum dado ou API conectado.
2026-10-05 10:17 | src/lib/map-config.ts | renderWorldCopies: false. Mundo renderizado uma única vez; verificado no navegador.
2026-10-05 11:06 | globals.css, components/layout, MapView | Etapa 3: identidade visual azul-marinho/dourado/ciano com tokens --aurelis-* centralizados; Topbar, Sidebar e Status bar refinadas; LIVE segue inativo; basemap harmonizado por filtro CSS no canvas (provisório); mapa segue 2D, globo adiado. Lint, tsc e build sem erros.
2026-10-05 11:27 | public/map-styles, map-config, WorldMap, globals.css, docs/MAP_ARCHITECTURE.md | Etapa 4A: basemap migrado de CARTO + filtro CSS para style próprio aurelis-dark.json (derivado do "dark" oficial da OpenFreeMap) sobre tiles OpenFreeMap; filtro CSS do canvas removido; atribuição explícita e não compacta; separação provider / style / data layers documentada. Mapa segue 2D, renderWorldCopies false. Nenhuma fonte operacional conectada.
2026-10-05 11:52 | lib/sources/usgs, app/api/earthquakes, types/earthquake.ts, components/Workspace + map/earthquake-layer, StatusBar, Sidebar | Etapa 4B: primeira fonte operacional, USGS Earthquakes M2.5+/24h (GeoJSON Summary). Adapter com validação mínima normaliza para Entity/Observation (nature "reported", confidence/reliability "unknown", localização "approximate", depthKm separado de altitude, time→observedAt, updated→reportedAt). API interna com unstable_cache 60 s e limite de idade de 120 s. Círculos em ciano (tamanho qualitativo por magnitude); SOURCES/ENTITIES/STATUS reais; LIVE inativo; sem polling nem persistência.
2026-10-05 12:07 | aurelis-dark.json, components/panel, Workspace, WorldMap, earthquake-layer, lib/format.ts, adapter USGS | Etapa 4C: hierarquia de rótulos por zoom (estados z4.5, capitais z2.8 acima dos estados, cidades z4/z5.5, vilas z7+, divisas subnacionais com fade z3-6, autoestradas z5.5-6); seleção de terremoto com layer dourada filtrada e Intelligence Panel (dados + proveniência, UTC, Escape/X), sem refetch e sem recriar o mapa; firstSeenAt/lastSeenAt removidos das entidades de terremoto; dívida fresh/stale/unavailable registrada. Sem polling, sem fonte nova.
2026-10-05 12:32 | components/useEarthquakeSync.ts, Workspace, Topbar, Sidebar, StatusBar, types/source-health.ts, lib/source-health.ts, lib/sources/usgs/source.ts | Etapa 4D: polling controlado de 60 s (setTimeout recursivo, AbortController, sem duplicação no StrictMode); SourceHealth syncing/fresh/stale/unavailable (janela de freshness 180 s, idade pelo header Date); último snapshot preservado em falha; LIVE ciano só quando fresh; seleção por Entity ID sobrevive a updates e é limpa quando a entidade sai. Testados start, sucesso, falha temporária, falha na primeira carga, stale por idade, atualização e remoção de entidade, recuperação. Sem histórico, sem nova fonte.
2026-10-05 14:24 | lib/sources/wtia, app/api/space/iss, types/space.ts, components/useSourceSync.ts, map/iss-layer.ts, panel/{primitives,EarthquakePanel,IssPanel}, Workspace, Topbar, StatusBar, Sidebar, categories, lib/source-health.ts | Etapa 5B: segunda fonte, Where The ISS At? (NORAD 25544). Primeira Entity móvel (space:norad:25544), nature estimated, precisão approximate, observedAt = timestamp da fonte, sem reportedAt. Poll de 5 s, janela de 15 s, dedupe de 4 s no servidor. SourceHealth por fonte + estado global agregado (live/partial/stale/unavailable/syncing). Camadas e painel próprios; seleção ciano→dourado. Sem histórico e sem câmera.
2026-10-05 14:45 | AURELIS_CONTEXT.md, README.md, types/space.ts, sources/wtia/iss.ts, panel/IssPanel.tsx | Etapa 5A (executada após a 5B): visão e escopo oficiais (painel pessoal de consciência situacional global; não comercial; experimento pessoal de desenvolvimento assistido por IA, sem a IA como autora), filosofia, mapa vs painéis, domínios, câmeras, roadmap, regra de polling, mobile, conceitos futuros, estado atual. Velocidade da ISS corrigida: `velocityKph` → `velocity` bruto + `velocityUnit: "unknown"` (unidade não documentada pela fonte). Nenhuma outra mudança funcional.
2026-10-05 15:08 | lib/sources/nasa/iss-media.ts, panel/IssCamera.tsx, panel/IssPanel.tsx, panel/primitives.tsx | Etapa 5C: câmera oficial da NASA associada à ISS (YouTube awQzjn72bI0, canal @NASA, embed youtube-nocookie). Primeira mídia externa ligada a uma Entity; iframe criado só após VIEW CAMERA e removido ao fechar câmera/painel ou trocar de Entity; sem autoplay; aviso de possível 'Previously Recorded'; fora do SourceHealth, de SOURCES e de ENTITIES. Velocidade da ISS: painel mostra '—' (unidade não documentada); valor bruto preservado no modelo.
2026-10-05 15:41 | lib/iss-trail.ts, map/iss-layer.ts, WorldMap, MapView, Workspace, panel/IssPanel.tsx, panel/IssCamera.tsx | Etapa 5D: trilha recente da ISS (somente posições recebidas; 10 min / 120 pontos em memória; quebra em lacunas > 30 s; split no antimeridiano com latitude interpolada; MultiLineString; visível só com a ISS selecionada; não é órbita). Câmera da ISS aberta por padrão ao selecionar a ISS, sem autoplay; HIDE/SHOW CAMERA; iframe desmontado ao sair da ISS; fora do SourceHealth.
2026-10-05 15:59 | lib/iss-interpolation.ts, map/WorldMap.tsx, map/iss-layer.ts, map/MapView.tsx, Workspace, panel/IssPanel.tsx | Etapa 5D (smooth movement): marcador da ISS interpolado entre posições recebidas, ~5 s atrás da Observation mais recente; longitude pelo menor caminho no antimeridiano; para na última posição se a fonte fica stale; não anima lacunas > 30 s; polling continua em ~5 s; nenhuma Observation ou ponto de trilha interpolado criado; um só laço de requestAnimationFrame atualizando apenas a source da ISS.
2026-10-05 17:06 | lib/map-config.ts, map/MapView.tsx, map/ProjectionToggle.tsx, map/WorldMap.tsx | Etapa 5E: projeção globe nativa do MapLibre como padrão (projectionMode globe|mercator, separado do basemap); controle GLOBE/FLAT não persistido; atmosfera sutil via setSky; troca de projeção sem recriar mapa/estado; camadas, ISS, trilha (antimeridiano verificado nas duas projeções) e painéis inalterados. Basemap continua OpenFreeMap + style AURELIS; Esri não usada.
2026-10-05 17:16 | lib/esri-imagery.ts, lib/map-config.ts, map/basemap-layer.ts, map/SegmentedControl.tsx, map/MapView.tsx, map/WorldMap.tsx | Etapa 5F: basemapMode dark|satellite independente da projeção; SATELLITE = Esri World Imagery (raster do Basemap Styles v2 arcgis/imagery, autenticado por API key via env, carregado só ao selecionar) + overlays AURELIS (fronteiras, rótulos) restilizados e restaurados exatamente em DARK; atribuição 'Powered by Esri' + fonte de dados do serviço; fallback para DARK em falha; Esri fora de SOURCES/SourceHealth. ProjectionToggle substituído por SegmentedControl.
2026-10-05 17:40 | globals.css, map/MapView.tsx | Revisão final 5F: atribuição em 12 px no SATELLITE (10 px mantidos no MAP); auditoria de tokens sem ocorrências persistidas; chave só em .env.local (ignorado).
2026-10-05 21:20 | map/iss-layer.ts, lib/iss-interpolation.ts, lib/iss-trail.ts, map/WorldMap.tsx, Workspace.tsx, panel/IssPanel.tsx | Etapa 5G: no GLOBE a ISS (marcador + rótulo, agora uma symbol layer) fica na altitude orbital reportada via symbol-height-offset nativo (altitudeKm×1000, escala real); altitude interpolada no mesmo displayTime (~5 s); FLAT sem elevação; trilha continua ground track na superfície; sem previsão orbital.
2026-10-05 21:30 | map/iss-layer.ts | Trilha da ISS: a ponta mais antiga (35% do trajeto) desaparece gradualmente em vez de terminar seca; cada trecho entre pontos recebidos vira uma feature com progress (0 = mais antigo) e line-opacity data-driven. Geometria e regras da trilha inalteradas.
2026-10-05 22:50 | map/iss-orbit-trail-layer.ts, map/iss-layer.ts, lib/iss-trail.ts, map/WorldMap.tsx, panel/IssPanel.tsx | Etapa 5H: no GLOBE a trilha da ISS é uma custom layer 3D (WebGL + projectTileFor3D do MapLibre) em altitude orbital real por ponto, terminando no marcador (mesmo displayTime ~5 s, endpoint visual não persistido), com oclusão por profundidade; FLAT mantém a trilha 2D; sem previsão orbital.
2026-10-06 13:00 | lib/sources/noaa, app/api/space/weather/kp, types/space-weather.ts, lib/source-health.ts, Workspace, layout/Sidebar, panel/SpaceWeatherPanel.tsx, panel/KpTrendChart.tsx | Etapa 6A: terceira fonte, NOAA SWPC Planetary Kp (estimativa quase em tempo real, 1 min). Observation sem Entity e sem localização (nature estimated, confidence unknown, observedAt = time_tag lido como UTC); validação mínima e amostra atual pelo maior observedAt; janela de 6 h no snapshot; cache 45 s, poll 60 s, freshness 180 s. Workspace com PanelTarget (entity | domain); SPACE abre o SpaceWeatherPanel (valor atual + gráfico SVG 6 h + linha de referência G1). Nada no mapa; ENTITIES inalterado; SOURCES 3.
2026-10-06 13:20 | lib/sources/noaa/swpc-kp.ts, AURELIS_CONTEXT.md, docs/DATA_MODEL.md | Correção semântica 6A: UTC do time_tag registrado como suposição de normalização AURELIS (convenção operacional SWPC), não como fato do schema (o campo não traz fuso). Comportamento inalterado.
2026-10-06 14:15 | types/observation.ts, types/aurora.ts, lib/sources/noaa/{ovation,source}.ts, app/api/space/weather/aurora, lib/aurora-grid.ts, map/aurora-layer.ts, map/{WorldMap,MapView}.tsx, Workspace, panel/{SpaceWeatherPanel,primitives}.tsx, lib/source-health.ts, globals.css | Etapa 6B: quarta fonte, NOAA SWPC OVATION aurora (forecast 30–90 min). EvidenceNature ganha 'forecast' e Observation ganha validAt. Uma Observation por snapshot (validAt = Forecast Time; 'Observation Time' preservado em data.inputObservationTime, não como observedAt); valor 'Aurora' sem semântica confirmada → auroraValue; longitude 0..359 → −180..180; só células não-zero transferidas/renderizadas (contagens totais preservadas). Layer opcional de células 1° (sem interpolação, polos limitados, split no antimeridiano) entre basemap e fronteiras; cache 4 min, poll 5 min, freshness 20 min (política AURELIS). Painel SPACE com Kp (ESTIMATED) e Aurora (FORECAST) separados, saúde por produto. SOURCES 4; ENTITIES inalterado.
2026-10-06 14:40 | map/aurora-layer.ts, lib/aurora-grid.ts, map/WorldMap.tsx, panel/SpaceWeatherPanel.tsx, globals.css | Etapa 6B.1: aurora OVATION passa de polígonos 1° para custom layer WebGL2 (grade como textura 360×181, interpolação visual local smoothstep-bilinear com wrap de longitude e clamp nos polos); no GLOBE casca a 110 km (AURORA_VISUAL_ALTITUDE_METERS, constante de apresentação, não altitude NOAA), depth test sem escrita; FLAT sem altitude; paleta aurora (ciano-verde → verde → verde luminoso → violeta frio), rampa de opacidade suave. Dados, Observation e proveniência inalterados; sem animação; ativação ~60 ms (antes ~150 ms + ~2 s).

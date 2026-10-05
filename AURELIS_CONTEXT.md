# AURELIS — Contexto do Projeto

## Objetivo

AURELIS é uma web app desktop-first de inteligência e visualização de dados públicos em tempo real.

Regras fundamentais:

- nunca representar visualmente uma relação que os dados não comprovem;
- diferenciar claramente dados **observados**, **estimados**, **inferidos** e **aproximados**;
- mostrar sempre fonte, horário da observação e nível de confiança, quando existirem;
- priorizar clareza, rastreabilidade e qualidade visual.

Domínios futuros (ainda **não** integrados): cybersecurity, malware/botnets, aviação, atividade marítima, terremotos, incêndios, clima, satélites, infraestrutura, notícias/eventos.

### Arquitetura conceitual futura (apenas nomes, nada implementado)

| Módulo   | Papel previsto                                   |
| -------- | ------------------------------------------------ |
| EON Core | núcleo de processamento/sincronização            |
| Tissue   | ingestão e normalização de dados                 |
| Echo     | histórico e reconstrução temporal                |
| Rupture  | detecção de anomalias                            |
| Needle   | acompanhamento direcionado de entidades/eventos  |

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
  components/
    Workspace.tsx       # client: snapshot + saúde da fonte + seleção; Topbar/Sidebar/Map/Panel/StatusBar
    useEarthquakeSync.ts # polling controlado de /api/earthquakes (setTimeout recursivo, 60 s)
    layout/
      Topbar.tsx        # marca, busca (visual), indicador LIVE (inativo)
      Sidebar.tsx       # categorias (sem filtro) + fontes realmente carregadas
      CategoryIcon.tsx  # ícones SVG inline das categorias
      StatusBar.tsx     # SOURCES / ENTITIES / STATUS reais
    map/
      MapView.tsx       # client wrapper: next/dynamic com ssr:false
      WorldMap.tsx      # instancia o MapLibre (somente no browser)
      earthquake-layer.ts # domínio → GeoJSON source + circle layer + layer de seleção
    panel/
      IntelligencePanel.tsx # painel fixo à direita: dados + proveniência da entidade selecionada
  lib/
    categories.ts       # lista de categorias + tipo CategoryId
    format.ts           # formatação: UTC, coordenadas, magnitude, profundidade, tempo relativo
    source-health.ts    # POLL_INTERVAL_MS, FRESHNESS_WINDOW_MS, deriveHealth()
    map-config.ts       # URL do basemap, view inicial, URL do worker
    sources/usgs/
      earthquakes.ts    # adapter USGS (server): fetch, validação, normalização
      source.ts         # IntelligenceSource USGS (dados estáticos, importável no cliente)
  types/                # modelo de domínio (somente tipos) — ver docs/DATA_MODEL.md
    common.ts           # IsoDateTime, ConfidenceLevel
    source.ts           # IntelligenceSource
    location.ts         # GeoLocation (+ precisão)
    entity.ts           # AurelisEntity (núcleo comum)
    observation.ts      # Observation<T> (afirmação de uma fonte)
    relationship.ts     # EntityRelationship
    source-health.ts    # SourceHealth, SourceSyncState
    earthquake.ts       # EarthquakeObservationData, EarthquakeFeed (resposta da API)
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
- **Projeção Mercator** (padrão do MapLibre). Globo pode ser avaliado depois.
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
- **Continua 2D (Mercator).** Globo 3D adiado para uma etapa futura, como modo alternativo; nenhum botão ou biblioteca de globo.
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

- **Polling de 60 s** (`POLL_INTERVAL_MS`) em `useEarthquakeSync`: busca `/api/earthquakes` → espera terminar → agenda a próxima com `setTimeout`. No máximo uma requisição em andamento e um timer. O navegador nunca chama o USGS: Browser → `/api/earthquakes` → adapter/cache no servidor → USGS. O cache do servidor não mudou.
- **Sem polling duplicado**: o cleanup do efeito marca `stopped`, cancela o timer e aborta a requisição com `AbortController`; no StrictMode (montar → desmontar → montar) a primeira cadeia morre e só uma sobrevive. Verificado: um poll a cada ~60 s (15:23:56, 15:24:56, 15:25:57, 15:26:57…).
- **`SourceHealth`** (`src/types/source-health.ts`) = `"syncing" | "fresh" | "stale" | "unavailable"` + `SourceSyncState` { sourceId, health, lastAttemptAt, lastSuccessAt, lastIngestedAt }. É **estado técnico da integração**, sem relação com `IntelligenceSource.reliability` (avaliação metodológica).
- **Regra** (`deriveHealth`, `src/lib/source-health.ts`):
  - sem snapshot e nenhuma tentativa falhou → **syncing**;
  - sem snapshot e a última tentativa falhou → **unavailable** (não vira syncing nas retentativas);
  - com snapshot e a última tentativa falhou → **stale**;
  - com snapshot, última tentativa ok e idade ≤ `FRESHNESS_WINDOW_MS` → **fresh**; senão **stale**.
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
- Sem notificações, toasts ou sons para eventos novos. **Nenhuma segunda fonte**.

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
- O projeto foi gerado com `create-next-app` (pasta temporária `aurelis`, pois o npm não aceita maiúsculas no nome do pacote) e movido para cá. `AGENTS.md`/`CLAUDE.md` são gerados pelo Next.js e mantidos.

## Funcionalidades implementadas

- Layout de aplicação em tela cheia: Topbar, Sidebar, mapa e Status bar, com identidade visual azul-marinho/dourado/ciano.
- Mapa mundial MapLibre 2D com style próprio AURELIS (tiles OpenFreeMap), pan/zoom, controles de zoom discretos (canto inferior direito), atribuição sempre visível.
- Campo de busca **visual** (sem funcionalidade).
- Categorias WORLD, CYBER, AIR, SEA, WEATHER, DISASTERS com ícones (**placeholder**, sem filtro).
- Status bar com contagens reais de SOURCES/ENTITIES e STATUS SYNCING/NOMINAL/DEGRADED.
- Modelo de domínio em TypeScript (`src/types/`): Source, Location, Entity, Observation, Relationship + `EarthquakeObservationData`.
- **Primeira fonte operacional: USGS Earthquakes M2.5+ / 24 h**, normalizada no servidor (`/api/earthquakes`) e exibida como círculos em ciano no mapa, **sincronizada a cada 60 s** com saúde da fonte (syncing/fresh/stale/unavailable) e indicador LIVE real.
- **Seleção de terremoto + Intelligence Panel** (dados e proveniência), destaque dourado do evento selecionado.
- **Hierarquia de rótulos por zoom** no basemap (países → capitais → cidades/estados → detalhes); ver `docs/MAP_ARCHITECTURE.md`.

## Ainda NÃO implementado (deliberadamente)

- Outras fontes (cyber, aviação, marítimo, incêndios, clima…). Outros feeds USGS (All, M1+, M4.5+, Significant) e escolha de magnitude.
- WebSocket/SSE (hoje: polling de 60 s). Notificações de eventos novos.
- Persistência e histórico de observações; reconciliação de Entity IDs por `ids` do USGS.
- Clustering, popup, tooltip; endpoint Detail do USGS.
- Nenhuma fonte nova nas Etapas 4C e 4D (continua só USGS Earthquakes).
- Estruturas especializadas para outros domínios (avião, navio, malware…) e identificadores naturais.
- Validação de payload com biblioteca de schema (hoje: validação mínima manual no adapter).
- Globo 3D (modo alternativo futuro).
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

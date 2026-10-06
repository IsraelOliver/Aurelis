# AURELIS — Arquitetura do Mapa

O mapa é dividido em três camadas com responsabilidades separadas:

```
┌──────────────────────────────────────────────────────────────┐
│ AURELIS DATA LAYERS   (futuro, NÃO fazem parte do basemap)   │
│ terremotos, aviões, malware, incêndios, navios…              │
│ Cores próprias, nunca alteradas pelo basemap.                │
├──────────────────────────────────────────────────────────────┤
│ MAP STYLE             public/map-styles/aurelis-dark.json    │
│ Define COMO a cartografia é desenhada. Pertence ao AURELIS.  │
├──────────────────────────────────────────────────────────────┤
│ MAP DATA PROVIDER     OpenFreeMap (tiles vetoriais)          │
│ Fornece geometria e nomes. Não decide aparência.             │
└──────────────────────────────────────────────────────────────┘
```

**O basemap é contexto. As camadas AURELIS são a informação.** O estilo é deliberadamente discreto para que dados futuros dominem visualmente.

## 1. Map data provider: OpenFreeMap

| Item | Valor |
| ---- | ----- |
| Fornecedor dos tiles | [OpenFreeMap](https://openfreemap.org), instância pública |
| TileJSON | `https://tiles.openfreemap.org/planet` (aponta para a versão semanal atual dos tiles) |
| Schema | [OpenMapTiles](https://openmaptiles.org), não modificado |
| Dados | [OpenStreetMap](https://www.openstreetmap.org/copyright) (ODbL) |
| Glyphs (fontes) | `https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf`, Noto Sans Regular / Italic (SIL OFL 1.1) |
| Sprite | nenhum (o estilo AURELIS não usa ícones) |
| Zoom dos tiles | 0–14 (o MapLibre faz overzoom até o `maxZoom` 18 do app) |
| Chave de API / cookies | nenhum |

Todos os endpoints vêm da documentação e do style oficiais da OpenFreeMap (`openfreemap.org/quick_start`, `tiles.openfreemap.org/styles/dark`). CORS: `access-control-allow-origin: *`.

**Termos (verificados em 2026-10-05):** uso comercial permitido; sem limite de views/requisições; serviço "as-is", **sem SLA**, podendo ser descontinuado sem aviso (ToS de 2026-09-09). Para uso em produção crítica, a alternativa documentada é self-hosting (a OpenFreeMap publica imagens do planeta inteiro).

## 2. Map style: `public/map-styles/aurelis-dark.json`

- Servido pelo próprio app em `/map-styles/aurelis-dark.json` (`BASEMAP_STYLE_URL` em `src/lib/map-config.ts`).
- **Derivado** do style oficial `dark` da OpenFreeMap ([openfreemap-styles](https://github.com/hyperknot/openfreemap-styles), MIT; baseado em estilos OpenMapTiles, design CC BY 4.0). A origem está registrada em `metadata` no próprio JSON.
- Os ids das layers foram mantidos iguais aos do upstream, para facilitar comparação futura.
- Mudanças em relação ao upstream:
  - recolorido para a paleta AURELIS (tabela abaixo);
  - **sem sprite**: removidos ícones de cidade (pontos que poderiam ser confundidos com marcadores de dados), textura de floresta e setas de mão única;
  - removida a source raster Natural Earth, que não era usada por nenhuma layer;
  - rótulos apenas com nome latino/inglês (`name_en` → `name:latin` → `name`), sem duplicar o nome em outra escrita;
  - atribuição declarada explicitamente na source (texto idêntico ao do TileJSON).
- O JSON é a fonte de verdade: edite-o diretamente (ou com o [Maputnik](https://maputnik.github.io/)). Valide com `validateStyleMin` de `@maplibre/maplibre-gl-style-spec` (já instalado como dependência do maplibre-gl).

### Cores do basemap

Dourado e ciano **não** são usados no basemap: são reservados ao shell e aos dados.

| Elemento | Cor | Nota |
| -------- | --- | ---- |
| Oceano / água interna / rios | `#04091B` | = `--aurelis-bg`; quase preto azulado |
| Terra (background) | `#0A1530` | azul-marinho muito escuro, pouco acima do oceano |
| Gelo / glaciares | `#0D1A38` | |
| Parques / floresta | `#0A1A31` | sem verde |
| Área residencial (z<9) | `#0C1936` @ 50% | |
| Edifícios (z12+) | `#0D1A39`, contorno `#132448` | |
| Fronteira nacional | `#334262` | cinza azulado discreto |
| Fronteira estadual | `#1E2B4A`, tracejada | mais discreta que a nacional |
| Rodovias, zoom baixo | `#13224A` | quase invisíveis |
| Rodovias principais / autoestradas | `#1A2C55` → `#22365F` com o zoom | ganham presença só ao aproximar |
| Vias menores / caminhos | `#122148` | |
| Ferrovias | `#1A2A4E` | |
| Rótulo de cidade grande | `#989BA2` | = `--aurelis-text-muted` |
| Rótulo de país | `#7A8396` | = `--aurelis-text-subtle` |
| Rótulo de cidade | `#8A92A3` | |
| Rótulo de vila | `#6F7789` | |
| Bairros / estados | `#5F6A80` | |
| Nomes de vias | `#56627A` | |
| Nomes de corpos d'água | `#3D5278` itálico | |
| Halo dos rótulos | `rgba(4, 9, 27, 0.85)` | |

### Hierarquia por zoom (Etapa 4C)

Implementada **só no style JSON**, com `minzoom`, filtros e `line-opacity` interpolada por zoom; nenhuma lógica React. Os limites seguem os dados do OpenMapTiles: a camada `place` traz `class`, `rank` e `capital` (2 = capital nacional), e cidades como Brasília só existem nos tiles a partir do z4.

| Zoom | Rótulos visíveis | Layer (`minzoom`) |
| ---- | ---------------- | ----------------- |
| 0+ | países | `place_country_*` (0) |
| 2.8+ | capitais nacionais | `place_capital` (2.8), **nova**: cópia visual de `place_city_large` filtrada por `capital == 2` |
| 4+ | grandes cidades (rank ≤ 3, não capitais) | `place_city_large` (4) |
| 4.5+ | estados / províncias / regiões | `place_state` (4.5) |
| 5.5+ | demais cidades | `place_city` (5.5) |
| 7+ | towns | `place_town` (7) |
| 9+ | vilas | `place_village` (9) |
| 11+ / 12+ | bairros / lugarejos | `place_suburb` (11), `place_other` (12) |

- **Prioridade de colisão** (camadas mais altas na pilha são posicionadas primeiro): países > capitais > estados > grandes cidades > cidades… Assim BRAZIL vence GOIÁS, UNITED STATES vence TEXAS, e BRASÍLIA vence o rótulo de estado "Federal District".
- **Fronteiras**: nacionais sempre visíveis e discretas (`#334262`); subnacionais (`boundary_state`) começam em z3 com opacidade 0 → 0.5 em z4.5 → 1 em z6, ou seja, invisíveis no overview.
- **Vias**: autoestradas surgem gradualmente entre z5.5 e z6 (`highway_motorway_subtle`); vias principais a partir de z6; vias menores a partir de z8; nomes de autoestrada a partir de z8 e de outras vias a partir de z10.
- Verificado no navegador em z1.6 (só países), z3.5 (países + capitais; nenhum estado no Brasil ou nos EUA), z5 (estados discretos + grandes cidades), z7 (cidades médias, towns e rodovias).

## 3. AURELIS data layers

| Source / layer | Tipo | Dados | Código |
| -------------- | ---- | ----- | ------ |
| `aurelis-earthquakes-source` / `aurelis-earthquakes-layer` | GeoJSON + circle (ciano) | USGS Earthquakes M2.5+ / 24 h, via `/api/earthquakes` | `src/components/map/earthquake-layer.ts` |
| `aurelis-earthquakes-selected-layer` | circle (dourado) sobre a mesma source, filtrado por `entityId` | evento selecionado | `src/components/map/earthquake-layer.ts` |
| `aurelis-iss-source` / `aurelis-iss-layer` | GeoJSON + symbol (ícone anel + núcleo e texto "ISS") | posição atual da ISS, via `/api/space/iss`; ciano, dourado quando selecionada (`icon-image`, `text-color`); no GLOBE elevada à altitude reportada (`symbol-height-offset` = `altitudeKm × 1000` m, escala real), no FLAT sobre o mapa | `src/components/map/iss-layer.ts` |
| `aurelis-iss-orbit-trail-layer` | custom layer WebGL (`renderingMode: "3d"`, `projectTileFor3D`) | **só no GLOBE**: trilha recente da ISS em altitude orbital real (cada vértice = posição recebida a `altitudeKm × 1000` m), terminando no marcador (mesmo ~5 s de atraso; endpoint interpolado só visual), oclusão por profundidade, sem divisão no antimeridiano; visível só com a ISS selecionada | `src/components/map/iss-orbit-trail-layer.ts`, `src/lib/iss-trail.ts` |
| `aurelis-iss-trail-source` / `aurelis-iss-trail-layer` | GeoJSON (MultiLineString) + line (ciano) | **só no FLAT**: trilha recente da ISS sobre o mapa; cada trecho entre pontos é uma feature com `progress`, e a ponta mais antiga desaparece gradualmente (`line-opacity` 0 → 0.55 nos primeiros 35%): só posições recebidas (10 min / 120 pts), quebrada em lacunas > 30 s e no antimeridiano; visível só com a ISS selecionada; **não** é órbita | `src/lib/iss-trail.ts`, `src/components/map/iss-layer.ts` |
| `aurelis-aurora-layer` | custom layer WebGL2 (`renderingMode: "3d"`): textura 360 × 181 da grade + malha lon/lat de 1° | **opcional** (default oculta; SHOW ON MAP no painel SPACE): forecast NOAA SWPC OVATION. **Source grid intacta** (textura = cópia dos valores publicados); **interpolação somente visual** entre os 4 vizinhos da grade (bilinear com pesos smoothstep), sem criar Observations nem valores além de um passo de grade; longitude com wrap (sem costura em ±180°), latitude clamp nos polos. **GLOBE**: casca a `AURORA_VISUAL_ALTITUDE_METERS` (110 km) — constante de apresentação; a NOAA não fornece altitude por célula —, depth test contra o planeta sem escrita de profundidade. **FLAT**: na superfície, sem altitude. Paleta de domínio da aurora (sem severidade), opacidade suave; sem animação. Inserida antes da primeira `boundary_*` (acima do basemap/imagery, abaixo de fronteiras, rótulos e dados operacionais) | `src/components/map/aurora-layer.ts`, `src/lib/aurora-grid.ts` |

Dados globais sem localização (ex.: Kp planetário NOAA SWPC, Etapa 6A) **não** têm camada no mapa (diferente do forecast OVATION, que tem distribuição geográfica real): aparecem em painéis de domínio (SPACE → SpaceWeatherPanel). O mapa mostra apenas dados geográficos.

Regras para todas as camadas de dados:

- são sources/layers MapLibre separadas, adicionadas sobre o basemap em runtime (após o evento `load`), **nunca** dentro de `aurelis-dark.json`;
- ids explícitos com o prefixo `aurelis-<domínio>-source` / `aurelis-<domínio>-layer`;
- recebem apenas objetos do modelo AURELIS (Entity/Observation), nunca o formato bruto da fonte;
- suas cores virão do sistema semântico do AURELIS (ainda não definido) e **não passam por nenhum filtro**: não existe `filter`, `backdrop-filter` ou `mix-blend-mode` sobre o canvas;
- conexões entre entidades seguem a regra de `docs/DATA_MODEL.md`: só existem com um `EntityRelationship` explícito.

## Atribuição obrigatória

Precisa permanecer visível:

> OpenFreeMap © OpenMapTiles Data from OpenStreetMap

(com links para openfreemap.org, openmaptiles.org e openstreetmap.org/copyright). É exibida pelo `AttributionControl` do MapLibre no modo **não compacto**, porque o modo compacto recolhe o texto na primeira interação com o mapa. Não esconder via CSS.

## Opções fixas do MapLibre

`src/lib/map-config.ts` → `INITIAL_VIEW`: `renderWorldCopies: false` (efeito só no Mercator), zoom 1–18.

**Projeção** (Etapa 5E): `projectionMode: "globe" | "mercator"`, **default `globe`**, projeção nativa do MapLibre (`map.setProjection`), alternável pelo controle GLOBE / FLAT (não persistido). A projeção é **independente do basemap**: hoje sempre OpenFreeMap + style AURELIS; um `basemapMode` futuro (ex.: satellite) vai se combinar com ela. No globo, uma atmosfera nativa muito sutil (`map.setSky`, tokens `--aurelis-bg`/`--aurelis-blue`). As camadas de dados AURELIS são as mesmas nas duas projeções (a ISS, só no globo, sobe à altitude orbital reportada; posição e altitude interpoladas no mesmo instante, ~5 s atrás; sem previsão orbital); a trilha da ISS dividida em ±180° aparece contínua no globo e não atravessa o mapa no Mercator.

Antes da Etapa 5E: projeção Mercator 2D. Sem globo, terrain, pitch ou rotação automática.

## Basemap mode (Etapa 5F)

`basemapMode: "dark" | "satellite"` (default **dark**), independente de `projectionMode` (globe/mercator); as quatro combinações funcionam. Controles separados: GLOBE/FLAT e MAP/SATELLITE.

| Modo | Base | Por cima |
| ---- | ---- | -------- |
| DARK | OpenFreeMap + style `aurelis-dark.json` (todas as layers) | dados AURELIS |
| SATELLITE | **Esri World Imagery** (source/layer `aurelis-basemap-imagery-source` / `-layer`, raster, logo acima do `background`) | só `boundary_*` e `place_*` do style AURELIS (restilizados para foto) + dados AURELIS |

- **Origem da imagery**: ArcGIS **Basemap Styles service v2**, style `arcgis/imagery`, autenticado com API key (`NEXT_PUBLIC_ARCGIS_API_KEY`, nunca versionada). Usa-se só a source raster que o serviço devolve (tiles `ibasemaps-api.arcgis.com/.../World_Imagery/MapServer` + atribuição); o style da Esri não é aplicado (`setStyle` não é usado) e o endpoint legado `server.arcgisonline.com` não é usado.
- Imagery requisitada só após selecionar SATELLITE; em DARK a layer fica oculta e não gera requisições.
- Ao voltar para DARK, visibilidade e pintura originais são restauradas exatamente.
- **Atribuição**: no SATELLITE, "Powered by Esri" (link esri.com) + a atribuição de dados do serviço, junto com OpenFreeMap/OpenMapTiles/OpenStreetMap (as overlays usam esses tiles); no DARK, só OpenFreeMap. Gerada pelo `AttributionControl` a partir das sources visíveis.
- A Esri é provedor de basemap: não é IntelligenceSource, não entra em SOURCES nem em SourceHealth. A credential deve permitir o referrer `http://localhost:3000/*` (e o domínio público futuro).

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
| `aurelis-iss-source` / `aurelis-iss-halo-layer`, `aurelis-iss-layer`, `aurelis-iss-label-layer` | GeoJSON + circle (anel) + circle (núcleo) + symbol ("ISS") | posição atual da ISS, via `/api/space/iss`; ciano, dourado quando selecionada (`setPaintProperty`) | `src/components/map/iss-layer.ts` |

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

`src/lib/map-config.ts` → `INITIAL_VIEW`: projeção Mercator 2D, `renderWorldCopies: false`, zoom 1–18. Sem globo, terrain, pitch ou rotação automática.

# AURELIS — Modelo de Dados

Contratos de domínio em TypeScript, definidos em `src/types/` e exportados por `src/types/index.ts`.
São apenas tipos (sem banco). A validação runtime de dados externos fica nos adapters de cada fonte (hoje, `src/lib/sources/usgs/`).

| Arquivo           | Conteúdo                                                  |
| ----------------- | --------------------------------------------------------- |
| `common.ts`       | `IsoDateTime`, `ConfidenceLevel`                          |
| `source.ts`       | `IntelligenceSource`, `SourceCategory`, `SourceReliability` |
| `location.ts`     | `GeoLocation`, `LocationPrecision`                        |
| `entity.ts`       | `AurelisEntity`, `EntityCategory`                         |
| `observation.ts`  | `Observation<T>`, `EvidenceNature`                        |
| `relationship.ts` | `EntityRelationship`, `RelationshipNature`                |
| `earthquake.ts`   | `EarthquakeObservationData`, `EarthquakeFeed` (dados específicos de terremoto) |
| `space.ts`        | `IssObservationData`, `IssFeed` (dados específicos da ISS) |
| `space-weather.ts`| `PlanetaryKpObservationData`, `PlanetaryKpFeed` (Kp planetário NOAA SWPC, sem Entity) |
| `aurora.ts`       | `AuroraForecastData`, `AuroraGridCell`, `AuroraForecastFeed` (forecast OVATION, sem Entity) |
| `weather.ts`      | `WeatherCurrentData`, `WeatherHourlyData`, `WeatherPointFeed` (clima de ponto Open-Meteo: current estimated + hourly forecast, sem Entity) |
| `eonet.ts`        | `EonetGeometry`, `EonetEventData`, `EonetFeed` (eventos naturais NASA EONET: Entities `disaster:eonet:*`, Observations reported) |
| `xray.ts`         | `GoesXrayFluxData`, `GoesXrayFlareData`, `GoesXrayFeed` (fluxo GOES observed + último evento reported, sem Entity) |
| `solar-wind.ts`   | `SolarWindPlasmaData`, `InterplanetaryMagneticFieldData`, `RtswFeed` (RTSW in situ, observed, sem Entity) |
| `source-health.ts`| `SourceHealth`, `SourceSyncState`, `GlobalHealth` (estado técnico da integração) |

Regra central: **o AURELIS nunca apresenta uma interpretação como se fosse uma observação comprovada.**

---

## Entity ≠ Observation

Este é o princípio mais importante do modelo.

- **Entity** é *a coisa*: algo que existe ou é acompanhado ao longo do tempo.
- **Observation** é *uma afirmação sobre a coisa*: o que uma fonte específica disse, viu ou forneceu, num momento específico.

> **Exemplo conceitual** (não é dado real nem é carregado pela aplicação):
>
> - Servidor X → **Entity**
> - "URLhaus reportou que o servidor X hospedava malware às 14:32" → **Observation**

A entidade não guarda "fatos" sobre si mesma. Tudo o que se sabe sobre ela vem de observações, cada uma com sua fonte, natureza, confiança e horários. Duas fontes podem discordar; o modelo preserva as duas afirmações em vez de sobrescrever uma pela outra.

---

## 1. Entity — `AurelisEntity`

Algo que existe ou é acompanhado ao longo do tempo: servidor, endereço IP, avião, navio, satélite, vulcão, instalação, tempestade etc.

| Campo                   | Significado |
| ----------------------- | ----------- |
| `id`                    | ID interno do AURELIS. |
| `category`              | Domínio (`cyber`, `aviation`, `maritime`, `space`, `weather`, `disaster`, `infrastructure`, `other`). |
| `kind`                  | Subtipo livre dentro da categoria (ex.: `"server"`, `"aircraft"`). |
| `label`                 | Nome legível. |
| `location`              | Localização atual/representativa, se houver. |
| `locationObservationId` | Observação que sustenta `location` (proveniência da posição). |
| `firstSeenAt` / `lastSeenAt` | Primeira/última vez que o AURELIS viu a entidade ao acompanhá-la ao longo do tempo. **Não** é o horário de um evento pontual: o horário de um terremoto é `Observation.observedAt`. Ficam vazios até existirem persistência e acompanhamento real (hoje, vazios em todos os terremotos). |

Composição em vez de uma entidade universal: **não existem** campos como `aircraftIcao`, `shipMmsi` ou `malwareFamily`. Atributos de domínio ficarão em estruturas especializadas, criadas quando houver ingestão real. `EntityCategory` é independente das categorias da sidebar (`src/lib/categories.ts`), que são agrupamentos de interface.

## 2. Observation — `Observation<T>`

Algo que uma fonte observou, reportou ou forneceu num momento. `T` é o payload específico da fonte/domínio.

`nature: EvidenceNature`:

| Valor        | Quando usar |
| ------------ | ----------- |
| `observed`   | A fonte mediu/detectou diretamente (sensor, transponder, varredura). |
| `reported`   | A fonte afirma, sem medição própria (boletim, alerta, entrada de feed). |
| `estimated`  | Valor calculado por modelo/método a partir de medições (magnitude, posição interpolada). |
| `inferred`   | Conclusão derivada de outros dados, pela fonte ou pelo AURELIS. |
| `forecast`   | Saída de modelo sobre um estado futuro (ou ainda não observado), válida em `validAt` (ex.: forecast de aurora OVATION). **Não** é o mesmo que `estimated`: uma estimativa descreve o presente/passado a partir de medições; um forecast descreve o momento para o qual foi emitido. |

`confidence: ConfidenceLevel` (`unknown` | `low` | `medium` | `high`) é a confiança **nesta afirmação específica**. Na ausência de base para avaliar, usa-se `unknown`.

**Observation sem Entity** (desde a Etapa 6A): dados globais/não geográficos não viram Entity nem ganham localização fictícia. Exemplo: o Kp planetário da NOAA SWPC é `Observation<PlanetaryKpObservationData>` (`src/types/space-weather.ts`) sem `entityId` e sem `location`, com `nature: "estimated"`; aparece só em painel de domínio, nunca no mapa, e não conta em ENTITIES.

## 3. Source — `IntelligenceSource`

Um fornecedor de informação (feed, API, dataset, publicação).

- `reliability` é uma avaliação **geral** da fonte. Não significa que todo dado daquela fonte seja verdadeiro; a confiança de cada afirmação fica em `Observation.confidence`.
- Nenhuma metodologia de avaliação existe ainda: a única fonte real (USGS Earthquakes) tem `reliability: "unknown"`.
- **`reliability` ≠ saúde da fonte.** `SourceHealth` (`syncing` | `fresh` | `stale` | `unavailable`) descreve o **estado técnico atual da integração** nesta sessão (a última sincronização funcionou? o snapshot está dentro da janela esperada?). Uma fonte pode ser `fresh` com `reliability: "unknown"`, ou ter alta confiabilidade e estar `unavailable`. Regras em `AURELIS_CONTEXT.md` (Etapa 4D).
- Cada fonte tem **seu próprio** `SourceHealth` (intervalo e janela de freshness próprios). `GlobalHealth` (`syncing` | `live` | `partial` | `stale` | `unavailable`) é só a agregação para a interface; não substitui o estado por fonte. Regras em `src/lib/source-health.ts`.

## 4. Location — `GeoLocation`

Ponto em WGS84 (graus decimais), **sempre acompanhado de `precision`**.

| `precision`   | Significado das coordenadas |
| ------------- | --------------------------- |
| `exact`       | A posição foi medida/reportada como tal (GPS, transponder). |
| `approximate` | Próxima ao ponto; erro opcional em `uncertaintyRadiusMeters`. |
| `city` / `region` / `country` | Só a área é conhecida; o ponto é representativo (ex.: centroide), **não** uma posição. |
| `unknown`     | A fonte não informou a precisão. |

> **Exemplo conceitual:** um IP geolocalizado em Brasília é `{ precision: "city", label: "Brasília, DF", countryCode: "BR", latitude, longitude }`. Isso diz "algum lugar em Brasília", e não "este servidor está nesta rua". A interface futura deverá representar essa diferença visualmente (ex.: área em vez de ponto).

## 5. Relationship — `EntityRelationship`

Ligação explícita e direcional entre duas entidades (`fromEntityId` → `toEntityId`, lida como "from *type* to").

- `nature`: `observed` | `reported` | `inferred`. Relacionamentos não são "estimados".
- `confidence`: confiança nesta ligação.
- `sourceId`: fonte que afirmou a relação. Fica ausente quando foi o próprio AURELIS que inferiu.
- `evidenceObservationIds`: observações que sustentam a relação.
- `observedAt`: quando a relação existiu/foi observada; `createdAt`: quando o AURELIS a registrou.

---

## Provenance

Todo dado precisa poder responder: *quem forneceu? quando aconteceu? quando a fonte publicou? quando chegou ao AURELIS? qual a origem? quão confiável? a posição é exata?*

Por isso a `Observation` preserva:

| Campo            | Responde |
| ---------------- | -------- |
| `sourceId`       | De qual fonte o AURELIS recebeu o dado. |
| `originSourceId` | Qual a fonte **original**, quando `sourceId` apenas repassa/agrega dados de terceiros. |
| `sourceRecordId` | O ID do registro no sistema da fonte, para rastrear, deduplicar e reconsultar. |
| `sourceUrl`      | Link para o registro específico na fonte, para verificação humana. |
| `observedAt`     | Quando o evento **aconteceu ou foi observado** no mundo. |
| `reportedAt`     | Quando a fonte **publicou/reportou**. |
| `ingestedAt`     | Quando o **AURELIS recebeu**. Sempre presente, definido pelo AURELIS. |
| `validAt`        | Para **forecasts/saídas de modelo**: o momento para o qual a previsão se aplica. Opcional; só quando a fonte o fornece. |

Os três tempos são distintos e não devem ser confundidos. `validAt` é um quarto tempo, **não substitui** nenhum deles: um forecast pode ter `validAt` sem `observedAt` (nada foi observado ainda).

> **Exemplo (OVATION, Etapa 6B):** "Forecast Time" 14:48Z → `validAt`; "Observation Time" 13:47Z **não** vira `observedAt` (não é uma observação da aurora e o campo não está definido na documentação do JSON): fica em `data.inputObservationTime`; `ingestedAt` = chegada ao AURELIS.

> **Exemplo conceitual:** um terremoto ocorre às 10:00:00 (`observedAt`), a agência publica às 10:07 (`reportedAt`), e o AURELIS ingere às 10:08 (`ingestedAt`). Mostrar 10:08 como "hora do terremoto" seria um erro.

Nem toda fonte fornece os três. Quando faltar `observedAt` ou `reportedAt`, o campo fica ausente: **não se copia `ingestedAt` para preencher a lacuna.**

### Tempo

Todas as datas são strings ISO 8601 em UTC (ex.: `2026-10-05T13:45:12Z`), tipadas como `IsoDateTime`. Não há classes próprias de data.

**Horários de fonte sem fuso:** um timestamp de fonte sem fuso explícito **não** recebe fuso automaticamente. Se o AURELIS precisar normalizá-lo, a suposição deve ser **específica da fonte**, justificada pelas evidências disponíveis e documentada no adapter daquela fonte.

Exemplo, NOAA SWPC Kp (`src/lib/sources/noaa/swpc-kp.ts`):

- **SOURCE FACT:** `time_tag` (`"YYYY-MM-DDTHH:MM:SS"`) não contém fuso/offset.
- **AURELIS NORMALIZATION ASSUMPTION:** interpretado como UTC devido às convenções operacionais da SWPC (produtos e materiais em UTC/Universal Time); não é uma propriedade declarada no schema do JSON.

NOAA SWPC RTSW (`src/lib/sources/noaa/rtsw.ts`) segue a mesma regra, com justificativa própria documentada no adapter (fato: `time_tag` sem fuso; suposição: UTC).

**Datas que não são observação nem publicação:** quando a fonte associa uma data a uma geometria sem semântica garantida (ex.: NASA EONET — "most likely 00:00Z unless the source provided a particular time"), ela fica nos dados especializados (`EonetGeometry.date`) e **não** preenche `observedAt` nem `reportedAt`. A Observation pode existir só com `ingestedAt`.

**Modelos meteorológicos (Etapa 8A)**: "condições atuais" de um modelo (Open-Meteo `current`) são `estimated` com `validAt`, não `observed` (não é estação); valores para horas futuras são `forecast` com `validAt`. Nenhum dos dois usa `observedAt`. Fontes **query-scoped** (o dado depende de uma coordenada escolhida pelo usuário) não criam Entity, e o snapshot de uma query nunca é reutilizado para outra.

### Identidade e IDs

Por enquanto todos os IDs são `string`. No futuro será preciso distinguir três coisas:

1. **ID interno do AURELIS:** `id` de cada objeto;
2. **ID do registro na fonte:** `Observation.sourceRecordId`;
3. **Identificadores naturais da entidade:** avião (ICAO24, callsign), servidor (IP, hostname), navio (MMSI, IMO).

Os identificadores naturais **não** foram modelados ainda. Ficarão nas estruturas especializadas de cada domínio. Um mesmo identificador natural pode mudar ou ser reutilizado (callsigns, IPs dinâmicos), por isso ele não serve como ID interno.

---

## Relationships

**O AURELIS não cria conexões visuais sem evidência de relacionamento.**

Uma linha entre duas entidades no mapa só pode existir se houver um `EntityRelationship` correspondente. Nenhuma conexão será gerada automaticamente apenas por:

- proximidade geográfica;
- ordem em array;
- pertencer à mesma categoria;
- aparecer na mesma fonte;
- coincidência temporal.

Uma relação `inferred` pode existir, mas deve ser marcada como tal, ter `confidence` explícita e, idealmente, `evidenceObservationIds`. A interface futura deverá diferenciar visualmente relações `observed`/`reported` de relações `inferred`.

---

## Validação

Não há validação em runtime (nem Zod, nem Yup). Os tipos são contratos de compilação. A validação de payloads será adicionada quando começar a ingestão de dados externos.

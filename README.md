# AURELIS

AURELIS is a personal global situational dashboard that brings public data sources together in a single interactive interface.

Its central principle is simple:

> The interface must never claim more than the underlying data supports.

## Current state

- Interactive MapLibre world map
- Custom AURELIS basemap style
- Explicit data provenance model
- USGS M2.5+ earthquakes from the past 24 hours
- International Space Station (NORAD 25544) position, updated every few seconds
- Continuous synchronization, per source
- Source health: Fresh / Stale / Unavailable
- Intelligence panels for earthquakes and the ISS

## Data philosophy

AURELIS distinguishes between:

- observed
- reported
- estimated
- inferred

Whenever possible, information preserves:

- source
- original record
- timestamps
- geographic precision
- confidence/provenance

Relationships between entities are never drawn merely for visual effect.

## Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- MapLibre GL

## Current data sources

- [USGS Earthquakes](https://earthquake.usgs.gov/earthquakes/feed/)
- [Where The ISS At?](https://wheretheiss.at/) (ISS position)

Basemap: [OpenFreeMap](https://openfreemap.org) vector tiles, © [OpenMapTiles](https://www.openmaptiles.org/), data from [OpenStreetMap](https://www.openstreetmap.org/copyright).

## Running locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Documentation

- [AURELIS_CONTEXT.md](AURELIS_CONTEXT.md): goals, architecture, decisions and log
- [docs/DATA_MODEL.md](docs/DATA_MODEL.md): entities, observations, provenance
- [docs/MAP_ARCHITECTURE.md](docs/MAP_ARCHITECTURE.md): basemap provider, style and data layers

## Status

Personal experimental project under active development.

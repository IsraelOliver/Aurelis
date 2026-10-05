// Copies the MapLibre worker files into public/ so the browser can load them.
// maplibre-gl v6 resolves its worker relative to its own module URL, which
// breaks once the bundler moves that module; we point setWorkerUrl() here.
// Runs automatically before `dev` and `build`, so versions always match.
import { cpSync, mkdirSync } from "node:fs";

const from = "node_modules/maplibre-gl/dist";
const to = "public/vendor/maplibre";

mkdirSync(to, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  cpSync(`${from}/${file}`, `${to}/${file}`);
}

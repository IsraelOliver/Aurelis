import type { CustomLayerInterface, Map as MapLibreMap } from "maplibre-gl";
import type { AuroraGridCell } from "@/types";
import { AURORA_GRID_HEIGHT, AURORA_GRID_WIDTH, auroraValueGrid } from "@/lib/aurora-grid";

/**
 * NOAA SWPC OVATION aurora forecast as a map layer: a small MapLibre custom
 * layer (WebGL2, no extra dependency).
 *
 * - DATA: the published grid, uploaded once per forecast as a 360 × 181
 *   texture (lib/aurora-grid.ts). Values are never modified.
 * - VISUALIZATION: a lon/lat mesh sampled with hardware bilinear filtering
 *   between neighbouring grid points. Visual interpolation for rendering only;
 *   source grid values remain unchanged (no new observations, no new values
 *   beyond one grid step around published non-zero points).
 * - Longitude wraps (REPEAT): 359° and 0° are neighbours, no seam at ±180°.
 *   Latitude is clamped at the poles (no wrap across a pole).
 * - GLOBE: drawn on a sphere shell AURORA_VISUAL_ALTITUDE_METERS above the
 *   surface, depth-tested against the planet (hidden behind it, never written
 *   to the depth buffer). FLAT: on the map surface, no altitude.
 * Static: no animation.
 */
export const AURORA_LAYER_ID = "aurelis-aurora-layer";

/**
 * Presentation constant, NOT data: OVATION gives no altitude per cell and
 * AURELIS does not claim the aurora is at this height. It only lifts the
 * layer off the ground on the globe for separation and readability.
 */
export const AURORA_VISUAL_ALTITUDE_METERS = 110_000;

const EARTH_RADIUS_METERS = 6_371_008.8; // sphere radius used by MapLibre's globe

const vertexSource = (define: string) => `#version 300 es
${define}
precision highp float;
uniform mat4 u_projection_matrix;
uniform mat4 u_projection_fallback_matrix;
uniform float u_projection_transition;
uniform float u_elevation;
in vec2 a_lonlat;
out vec2 v_lonlat;
const float PI = 3.141592653589793;

vec2 mercator(vec2 lonlat) {
  float lat = radians(clamp(lonlat.y, -85.051129, 85.051129));
  return vec2((lonlat.x + 180.0) / 360.0, 0.5 - log(tan(PI / 4.0 + lat / 2.0)) / (2.0 * PI));
}

void main() {
  v_lonlat = a_lonlat;
  vec2 merc = mercator(a_lonlat);
#ifdef GLOBE
  // Same unit-sphere convention as MapLibre's globe shaders.
  float lon = radians(a_lonlat.x);
  float lat = radians(a_lonlat.y);
  vec3 sphere = vec3(sin(lon) * cos(lat), sin(lat), cos(lon) * cos(lat));
  vec4 globePosition = u_projection_matrix * vec4(sphere * (1.0 + u_elevation / ${EARTH_RADIUS_METERS.toFixed(1)}), 1.0);
  if (u_projection_transition > 0.999) {
    gl_Position = globePosition;
  } else {
    // Globe → mercator transition at high zoom (as MapLibre's projectTileFor3D).
    vec4 flatPosition = u_projection_fallback_matrix * vec4(merc, u_elevation, 1.0);
    gl_Position = mix(flatPosition, globePosition, u_projection_transition);
  }
#else
  gl_Position = u_projection_matrix * vec4(merc, 0.0, 1.0);
#endif
}`;

const fragmentSource = `#version 300 es
precision highp float;
uniform highp sampler2D u_grid;
uniform vec3 u_low;
uniform vec3 u_mid;
uniform vec3 u_high;
uniform vec3 u_peak;
in vec2 v_lonlat;
out vec4 fragColor;

void main() {
  // Texel i is centered on grid point i (longitude i°, latitude i − 90°).
  const vec2 size = vec2(${AURORA_GRID_WIDTH.toFixed(1)}, ${AURORA_GRID_HEIGHT.toFixed(1)});
  vec2 p = vec2(v_lonlat.x, v_lonlat.y + 90.0) + 1.0;
  // Same 4 neighbouring grid points as bilinear, with smoothstep weights:
  // no visible grid lines, no overshoot, never beyond one grid step.
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float v = texture(u_grid, (i + f - 0.5) / size).r;
  if (v <= 0.0) discard;
  // Opacity: very low values fade out smoothly (still drawn, nearly transparent); capped.
  float a = 0.62 * pow(clamp(v / 30.0, 0.0, 1.0), 0.9) * smoothstep(0.0, 4.0, v);
  if (a < 0.002) discard;
  // Aurora-inspired domain palette (visual only; OVATION does not forecast color).
  vec3 color = v < 12.0
    ? mix(u_low, u_mid, smoothstep(2.0, 12.0, v))
    : v < 30.0
      ? mix(u_mid, u_high, (v - 12.0) / 18.0)
      : mix(u_high, u_peak, smoothstep(30.0, 60.0, v));
  fragColor = vec4(color * a, a); // premultiplied alpha
}`;

type Program = {
  program: WebGLProgram;
  lonlat: number;
  uniforms: Record<string, WebGLUniformLocation | null>;
};

function token(name: string): [number, number, number] {
  const hex = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? "shader compile error");
  }
  return shader;
}

/** Lon/lat mesh, 1° steps, −180..180 × −90..90 (follows the curvature on the globe). */
function buildMesh(): { vertices: Float32Array; indices: Uint32Array } {
  const cols = 361;
  const rows = 181;
  const vertices = new Float32Array(cols * rows * 2);
  let k = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      vertices[k++] = -180 + c;
      vertices[k++] = -90 + r;
    }
  }
  const indices = new Uint32Array((cols - 1) * (rows - 1) * 6);
  k = 0;
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const i = r * cols + c;
      indices.set([i, i + 1, i + cols, i + 1, i + cols + 1, i + cols], k);
      k += 6;
    }
  }
  return { vertices, indices };
}

type AuroraLayer = CustomLayerInterface & {
  setGrid(forecastId: string, cells: AuroraGridCell[]): void;
  setVisible(visible: boolean): void;
};

function createAuroraLayer(): AuroraLayer {
  const programs = new Map<string, Program>();
  let gl: WebGL2RenderingContext | null = null;
  let map: MapLibreMap | null = null;
  let vertexBuffer: WebGLBuffer | null = null;
  let indexBuffer: WebGLBuffer | null = null;
  let indexCount = 0;
  let texture: WebGLTexture | null = null;
  let gridId: string | null = null;
  let pending: { id: string; values: Float32Array } | null = null;
  let visible = false;
  let colors: Record<"low" | "mid" | "high" | "peak", [number, number, number]> | null = null;

  function getProgram(context: WebGL2RenderingContext, variant: string, define: string): Program {
    const cached = programs.get(variant);
    if (cached) return cached;
    const program = context.createProgram()!;
    context.attachShader(program, compile(context, context.VERTEX_SHADER, vertexSource(define)));
    context.attachShader(program, compile(context, context.FRAGMENT_SHADER, fragmentSource));
    context.linkProgram(program);
    const u = (name: string) => context.getUniformLocation(program, name);
    const entry: Program = {
      program,
      lonlat: context.getAttribLocation(program, "a_lonlat"),
      uniforms: {
        matrix: u("u_projection_matrix"),
        fallbackMatrix: u("u_projection_fallback_matrix"),
        transition: u("u_projection_transition"),
        elevation: u("u_elevation"),
        grid: u("u_grid"),
        low: u("u_low"),
        mid: u("u_mid"),
        high: u("u_high"),
        peak: u("u_peak"),
      },
    };
    programs.set(variant, entry);
    return entry;
  }

  /** Uploads a forecast grid once; the texture is reused until the forecast changes. */
  function upload(context: WebGL2RenderingContext, values: Float32Array) {
    texture ??= context.createTexture();
    context.bindTexture(context.TEXTURE_2D, texture);
    context.pixelStorei(context.UNPACK_ALIGNMENT, 1);
    // R16F is filterable in WebGL2 core (bilinear); values are small grid numbers.
    context.texImage2D(context.TEXTURE_2D, 0, context.R16F, AURORA_GRID_WIDTH, AURORA_GRID_HEIGHT, 0, context.RED, context.FLOAT, values);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.LINEAR);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, context.LINEAR);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_S, context.REPEAT); // longitude wraps
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_T, context.CLAMP_TO_EDGE); // poles
  }

  return {
    id: AURORA_LAYER_ID,
    type: "custom",
    renderingMode: "3d",

    onAdd(m, context) {
      map = m;
      gl = context as WebGL2RenderingContext;
      const mesh = buildMesh();
      vertexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);
      indexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
      indexCount = mesh.indices.length;
      colors = {
        low: token("--aurelis-aurora-low"),
        mid: token("--aurelis-aurora"),
        high: token("--aurelis-aurora-high"),
        peak: token("--aurelis-aurora-peak"),
      };
    },

    onRemove() {
      if (gl) {
        for (const { program } of programs.values()) gl.deleteProgram(program);
        gl.deleteBuffer(vertexBuffer);
        gl.deleteBuffer(indexBuffer);
        gl.deleteTexture(texture);
      }
      programs.clear();
      gl = null;
      map = null;
    },

    setGrid(forecastId, cells) {
      if (forecastId === gridId || forecastId === pending?.id) return;
      pending = { id: forecastId, values: auroraValueGrid(cells) };
      map?.triggerRepaint();
    },

    setVisible(next) {
      if (next === visible) return;
      visible = next;
      map?.triggerRepaint();
    },

    render(context, options) {
      if (!visible || !vertexBuffer || !indexBuffer || !colors) return;
      if (pending) {
        upload(context, pending.values);
        gridId = pending.id;
        pending = null;
      }
      if (!texture || gridId === null) return;

      const globe = options.shaderData.define.includes("GLOBE");
      const p = getProgram(context, options.shaderData.variantName, options.shaderData.define);
      const d = options.defaultProjectionData;
      context.useProgram(p.program);
      context.uniformMatrix4fv(p.uniforms.matrix, false, d.mainMatrix);
      context.uniformMatrix4fv(p.uniforms.fallbackMatrix, false, d.fallbackMatrix);
      context.uniform1f(p.uniforms.transition, d.projectionTransition);
      context.uniform1f(p.uniforms.elevation, globe ? AURORA_VISUAL_ALTITUDE_METERS : 0);
      context.uniform3f(p.uniforms.low, ...colors.low);
      context.uniform3f(p.uniforms.mid, ...colors.mid);
      context.uniform3f(p.uniforms.high, ...colors.high);
      context.uniform3f(p.uniforms.peak, ...colors.peak);
      context.activeTexture(context.TEXTURE0);
      context.bindTexture(context.TEXTURE_2D, texture);
      context.uniform1i(p.uniforms.grid, 0);

      context.bindBuffer(context.ARRAY_BUFFER, vertexBuffer);
      context.enableVertexAttribArray(p.lonlat);
      context.vertexAttribPointer(p.lonlat, 2, context.FLOAT, false, 0, 0);
      context.bindBuffer(context.ELEMENT_ARRAY_BUFFER, indexBuffer);
      // Depth-tested against the planet (hidden behind it) but not written:
      // a translucent shell must not hide what is drawn after it.
      // MapLibre resets its GL state after custom layers (setDirty).
      context.depthMask(false);
      context.drawElements(context.TRIANGLES, indexCount, context.UNSIGNED_INT, 0);
    },
  };
}

const layers = new WeakMap<MapLibreMap, AuroraLayer>();

/** On the surface order: above basemap/imagery, below the first border layer (borders, labels and data stay on top). */
export function addAuroraLayer(map: MapLibreMap): void {
  const layer = createAuroraLayer();
  layers.set(map, layer);
  const beforeId = map.getStyle().layers.find((l) => l.id.startsWith("boundary_"))?.id;
  map.addLayer(layer, beforeId);
}

/** Sets the forecast grid; a no-op when this forecast is already loaded. */
export function setAuroraCells(map: MapLibreMap, forecastId: string, cells: AuroraGridCell[]): void {
  layers.get(map)?.setGrid(forecastId, cells);
}

export function setAuroraVisible(map: MapLibreMap, visible: boolean): void {
  layers.get(map)?.setVisible(visible);
}

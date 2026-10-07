import type { CustomLayerInterface, Map as MapLibreMap } from "maplibre-gl";
import type { AirTrafficFeed } from "@/types";
import { AIRCRAFT_ENTITY_PREFIX, AIR_VISUAL_DELAY_MS } from "@/lib/sources/opensky/source";
import { displayState, updateTracks, type MotionSample } from "@/lib/aircraft-motion";

/**
 * AIR (OpenSky, global) on the map: one MapLibre custom layer (WebGL2,
 * instanced sprites: one quad per aircraft, one draw call; no DOM, no React
 * per aircraft).
 *
 * - SPRITES: a texture atlas of 4 cells [track-normal, track-selected,
 *   no-track-normal, no-track-selected]. Generated here as simple vector
 *   icons (cyan / gold); a hand-made pixel-art atlas can replace it
 *   (SPRITE_* constants). Sprites point north ("nose up"); each is rotated on
 *   screen by the aircraft's true track as projected at its position.
 * - MOTION: visual only. Each frame, every aircraft is drawn at display time
 *   now − AIR_VISUAL_DELAY_MS, interpolated between two REAL positions
 *   (lib/aircraft-motion.ts); never extrapolated beyond the latest one.
 * - ALTITUDE (GLOBE): real visual altitude in metres above the sphere
 *   (geometric, else barometric fallback, else surface; ground → surface),
 *   no exaggeration; clipped at the horizon like MapLibre's elevated globe
 *   features (never seen through the planet). FLAT: on the map, no altitude.
 * - PICKING: CPU-side, with the same matrix and the positions of the last
 *   drawn frame (ISS and earthquakes/EONET keep their own priority).
 */
export const AIRCRAFT_LAYER_ID = "aurelis-aircraft-layer";

/**
 * Sprite atlas: SPRITE_CELLS square cells of SPRITE_CELL_PX texels side by side
 * (any resolution: the on-screen size is ICON_PX / SELECTED_ICON_PX CSS px).
 */
const SPRITE_CELL_PX = 64;
const SPRITE_CELLS = 4;
/** LINEAR for the vector icons; NEAREST would keep hand-drawn pixel art crisp. */
const SPRITE_FILTER: "LINEAR" | "NEAREST" = "LINEAR";
/** On-screen size in CSS pixels at close zoom (normal / selected); smaller when zoomed out. */
const ICON_PX = 18;
const SELECTED_ICON_PX = 24;
/** Size factor by zoom: 0.5 at a whole-globe view, 1 from zoom ~5 (presentation only). */
const iconScale = (zoom: number) => Math.min(1, Math.max(0.5, (zoom + 1) / 6));
const PICK_RADIUS_PX = 11;

const EARTH_RADIUS_METERS = 6_371_008.8;
const MERCATOR_MAX_LAT = 85.051129;
const FRAME_INTERVAL_MS = 33; // ~30 fps of motion updates while aircraft are shown
const FLOATS_PER_INSTANCE = 6; // lon, lat, altM, trackDeg (−1 = none), sprite, half size (CSS px)

const vertexSource = (define: string) => `#version 300 es
${define}
precision highp float;
uniform mat4 u_projection_matrix;
uniform mat4 u_projection_fallback_matrix;
uniform vec4 u_projection_clipping_plane;
uniform float u_projection_transition;
uniform vec2 u_half_viewport;
uniform float u_pixel_ratio;
in vec2 a_corner;
in vec4 a_state;
in vec2 a_style;
out vec2 v_uv;
const float PI = 3.141592653589793;
const float R = ${EARTH_RADIUS_METERS.toFixed(1)};

vec2 mercator(float lon, float lat) {
  float phi = radians(clamp(lat, -${MERCATOR_MAX_LAT}, ${MERCATOR_MAX_LAT}));
  return vec2((lon + 180.0) / 360.0, 0.5 - log(tan(PI / 4.0 + phi / 2.0)) / (2.0 * PI));
}

vec4 project(float lon, float lat, float alt) {
#ifdef GLOBE
  float l = radians(lon);
  float p = radians(lat);
  vec3 s = vec3(sin(l) * cos(p), sin(p), cos(l) * cos(p)) * (1.0 + alt / R);
  vec4 g = u_projection_matrix * vec4(s, 1.0);
  g.z = (1.0 - (dot(s, u_projection_clipping_plane.xyz) + u_projection_clipping_plane.w)) * g.w;
  if (u_projection_transition > 0.999) return g;
  vec4 f = u_projection_fallback_matrix * vec4(mercator(lon, lat), 0.0, 1.0);
  vec4 r = g;
  r.z = mix(0.0, g.z, clamp((u_projection_transition - 0.2) / 0.8, 0.0, 1.0));
  r.xyw = mix(f.xyw, g.xyw, u_projection_transition);
  return r;
#else
  return u_projection_matrix * vec4(mercator(lon, lat), 0.0, 1.0);
#endif
}

void main() {
  float lon = a_state.x;
  float lat = a_state.y;
  vec4 center = project(lon, lat, a_state.z);
  // Screen direction of the track: project a point ~2 km ahead on the great circle.
  vec2 forward = vec2(0.0, 1.0);
  if (a_state.w >= 0.0) {
    float th = radians(a_state.w);
    float d = 2000.0 / R;
    float p1 = radians(lat);
    float l1 = radians(lon);
    float p2 = asin(sin(p1) * cos(d) + cos(p1) * sin(d) * cos(th));
    float l2 = l1 + atan(sin(th) * sin(d) * cos(p1), cos(d) - sin(p1) * sin(p2));
    vec4 ahead = project(degrees(l2), degrees(p2), a_state.z);
    vec2 v = (ahead.xy / ahead.w - center.xy / center.w) * u_half_viewport;
    if (length(v) > 1e-4) forward = normalize(v);
  }
  vec2 right = vec2(forward.y, -forward.x);
  vec2 offsetPx = (a_corner.x * right + a_corner.y * forward) * a_style.y * u_pixel_ratio;
  gl_Position = center;
  gl_Position.xy += offsetPx / u_half_viewport * center.w;
  // Atlas cell a_style.x; corner (+y = nose) maps to the top of the cell.
  v_uv = vec2((a_style.x + (a_corner.x + 1.0) * 0.5) / ${SPRITE_CELLS.toFixed(1)}, 1.0 - (a_corner.y + 1.0) * 0.5);
}`;

const fragmentSource = `#version 300 es
precision highp float;
uniform sampler2D u_atlas;
in vec2 v_uv;
out vec4 fragColor;
void main() {
  vec4 c = texture(u_atlas, v_uv); // premultiplied at upload
  if (c.a < 0.02) discard;
  fragColor = c;
}`;

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Vector stand-in atlas (white silhouette / diamond tinted per cell). Replaceable by a pixel-art image. */
function buildAtlas(): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = SPRITE_CELL_PX * SPRITE_CELLS;
  canvas.height = SPRITE_CELL_PX;
  const ctx = canvas.getContext("2d")!;
  const cells: [boolean, string][] = [
    [true, token("--aurelis-cyan")],
    [true, token("--aurelis-gold")],
    [false, token("--aurelis-cyan")],
    [false, token("--aurelis-gold")],
  ];
  const s = SPRITE_CELL_PX / 22; // icon designed on a 22-unit grid
  cells.forEach(([withTrack, color], i) => {
    ctx.save();
    ctx.translate(i * SPRITE_CELL_PX, 0);
    ctx.scale(s, s);
    ctx.beginPath();
    if (withTrack) {
      const pts = [
        [11, 1.5], [12.4, 4], [12.4, 8.5], [20.5, 13], [20.5, 14.6], [12.4, 12.4], [12.2, 17], [15, 19], [15, 20.3],
        [11, 19.3], [7, 20.3], [7, 19], [9.8, 17], [9.6, 12.4], [1.5, 14.6], [1.5, 13], [9.6, 8.5], [9.6, 4],
      ];
      pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    } else {
      ctx.moveTo(11, 6);
      ctx.lineTo(16, 11);
      ctx.lineTo(11, 16);
      ctx.lineTo(6, 11);
    }
    ctx.closePath();
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = token("--aurelis-bg"); // dark halo for legibility on imagery
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  });
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "shader compile error");
  return shader;
}

type Program = {
  program: WebGLProgram;
  vao: WebGLVertexArrayObject;
  uniforms: Record<string, WebGLUniformLocation | null>;
};

type AircraftLayer = CustomLayerInterface & {
  setFeed(feed: AirTrafficFeed | null, receivedAtMs: number): void;
  setSelected(icao24: string | null): void;
  setVisible(visible: boolean): void;
  pick(x: number, y: number): string | null;
};

function createAircraftLayer(): AircraftLayer {
  const programs = new Map<string, Program>();
  let gl: WebGL2RenderingContext | null = null;
  let map: MapLibreMap | null = null;
  let cornerBuffer: WebGLBuffer | null = null;
  let instanceBuffer: WebGLBuffer | null = null;
  let atlas: WebGLTexture | null = null;
  let visible = false;
  let selected: string | null = null;

  /** Real positions per ICAO24 (current snapshot's aircraft only). */
  let tracks = new Map<string, MotionSample[]>();
  /** Smallest (client clock − source time) seen: maps the source timeline to the client clock. */
  let clockOffsetMs: number | null = null;

  // Last drawn frame (for picking).
  let instances = new Float32Array(0);
  let drawnIds: string[] = [];
  let lastFrameMs = 0;
  let lastView: { matrix: ArrayLike<number>; clip: ArrayLike<number>; globe: boolean; transition: number } | null = null;
  let repaintTimer: ReturnType<typeof setTimeout> | undefined;

  function getProgram(context: WebGL2RenderingContext, variant: string, define: string): Program {
    const cached = programs.get(variant);
    if (cached) return cached;
    const program = context.createProgram()!;
    context.attachShader(program, compile(context, context.VERTEX_SHADER, vertexSource(define)));
    context.attachShader(program, compile(context, context.FRAGMENT_SHADER, fragmentSource));
    context.linkProgram(program);
    const vao = context.createVertexArray()!;
    context.bindVertexArray(vao);
    const corner = context.getAttribLocation(program, "a_corner");
    context.bindBuffer(context.ARRAY_BUFFER, cornerBuffer);
    context.enableVertexAttribArray(corner);
    context.vertexAttribPointer(corner, 2, context.FLOAT, false, 0, 0);
    const stride = FLOATS_PER_INSTANCE * 4;
    context.bindBuffer(context.ARRAY_BUFFER, instanceBuffer);
    const state = context.getAttribLocation(program, "a_state");
    context.enableVertexAttribArray(state);
    context.vertexAttribPointer(state, 4, context.FLOAT, false, stride, 0);
    context.vertexAttribDivisor(state, 1);
    const style = context.getAttribLocation(program, "a_style");
    context.enableVertexAttribArray(style);
    context.vertexAttribPointer(style, 2, context.FLOAT, false, stride, 16);
    context.vertexAttribDivisor(style, 1);
    context.bindVertexArray(null);
    const u = (name: string) => context.getUniformLocation(program, name);
    const entry: Program = {
      program,
      vao,
      uniforms: {
        matrix: u("u_projection_matrix"),
        fallbackMatrix: u("u_projection_fallback_matrix"),
        clippingPlane: u("u_projection_clipping_plane"),
        transition: u("u_projection_transition"),
        halfViewport: u("u_half_viewport"),
        pixelRatio: u("u_pixel_ratio"),
        atlas: u("u_atlas"),
      },
    };
    programs.set(variant, entry);
    return entry;
  }

  /** Display positions at the current display time → instance buffer (selected last, so on top). */
  function buildInstances(nowMs: number, zoom: number): number {
    const scale = iconScale(zoom);
    const displayTime = clockOffsetMs === null ? Infinity : nowMs - clockOffsetMs - AIR_VISUAL_DELAY_MS;
    if (instances.length < tracks.size * FLOATS_PER_INSTANCE) instances = new Float32Array(tracks.size * FLOATS_PER_INSTANCE);
    const ids: string[] = [];
    let k = 0;
    const write = (id: string, samples: MotionSample[]) => {
      const d = displayState(samples, displayTime);
      const isSelected = id === selected;
      const o = k * FLOATS_PER_INSTANCE;
      instances[o] = d.lon;
      instances[o + 1] = d.lat;
      instances[o + 2] = d.altM;
      instances[o + 3] = d.trackDeg ?? -1;
      instances[o + 4] = (d.trackDeg === null ? 2 : 0) + (isSelected ? 1 : 0);
      instances[o + 5] = (isSelected ? Math.max(16, SELECTED_ICON_PX * scale) : ICON_PX * scale) / 2;
      ids.push(id);
      k++;
    };
    for (const [id, samples] of tracks) if (id !== selected) write(id, samples);
    const sel = selected !== null ? tracks.get(selected) : undefined;
    if (sel && selected !== null) write(selected, sel);
    drawnIds = ids;
    return k;
  }

  function scheduleRepaint() {
    if (repaintTimer !== undefined || !map || !visible || tracks.size === 0) return;
    repaintTimer = setTimeout(() => {
      repaintTimer = undefined;
      map?.triggerRepaint();
    }, FRAME_INTERVAL_MS);
  }

  return {
    id: AIRCRAFT_LAYER_ID,
    type: "custom",
    renderingMode: "3d",

    onAdd(m, context) {
      map = m;
      gl = context as WebGL2RenderingContext;
      cornerBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      instanceBuffer = gl.createBuffer();
      atlas = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, atlas);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, buildAtlas());
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      const filter = SPRITE_FILTER === "NEAREST" ? gl.NEAREST : gl.LINEAR;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    },

    onRemove() {
      clearTimeout(repaintTimer);
      if (gl) {
        for (const { program, vao } of programs.values()) {
          gl.deleteProgram(program);
          gl.deleteVertexArray(vao);
        }
        gl.deleteBuffer(cornerBuffer);
        gl.deleteBuffer(instanceBuffer);
        gl.deleteTexture(atlas);
      }
      programs.clear();
      gl = null;
      map = null;
    },

    setFeed(feed, receivedAtMs) {
      tracks = updateTracks(tracks, feed?.aircraft ?? []);
      if (feed) {
        const offset = receivedAtMs - Date.parse(feed.metadata.stateTime);
        if (clockOffsetMs === null || offset < clockOffsetMs) clockOffsetMs = offset;
      }
      map?.triggerRepaint();
    },

    setSelected(icao24) {
      selected = icao24;
      map?.triggerRepaint();
    },

    setVisible(next) {
      visible = next;
      map?.triggerRepaint();
    },

    pick(x, y) {
      if (!map || !visible || !lastView || drawnIds.length === 0) return null;
      const m = lastView.matrix;
      const c = lastView.clip;
      const canvas = map.getCanvas();
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      let best: string | null = null;
      let bestD = PICK_RADIUS_PX;
      // Selected is last: iterate backwards so the top-most sprite wins ties.
      for (let i = drawnIds.length - 1; i >= 0; i--) {
        const o = i * FLOATS_PER_INSTANCE;
        const lon = instances[o];
        const lat = instances[o + 1];
        let sx: number;
        let sy: number;
        if (lastView.globe && lastView.transition > 0.999) {
          const l = (lon * Math.PI) / 180;
          const p = (lat * Math.PI) / 180;
          const k = 1 + instances[o + 2] / EARTH_RADIUS_METERS;
          const X = Math.sin(l) * Math.cos(p) * k;
          const Y = Math.sin(p) * k;
          const Z = Math.cos(l) * Math.cos(p) * k;
          if (X * c[0] + Y * c[1] + Z * c[2] + c[3] < 0) continue; // behind the horizon
          const cx = m[0] * X + m[4] * Y + m[8] * Z + m[12];
          const cy = m[1] * X + m[5] * Y + m[9] * Z + m[13];
          const cw = m[3] * X + m[7] * Y + m[11] * Z + m[15];
          if (cw <= 0) continue;
          sx = ((cx / cw + 1) / 2) * w;
          sy = ((1 - cy / cw) / 2) * h;
        } else {
          const pt = map.project([lon, lat]);
          sx = pt.x;
          sy = pt.y;
        }
        const dist = Math.hypot(sx - x, sy - y);
        if (dist < bestD) {
          bestD = dist;
          best = drawnIds[i];
        }
      }
      return best;
    },

    render(context, options) {
      if (!visible || !cornerBuffer || !instanceBuffer || !atlas || !map || tracks.size === 0) return;
      const now = Date.now();
      // Motion updates at ~30 fps; between them the last instances are redrawn as they are.
      if (now - lastFrameMs >= FRAME_INTERVAL_MS || drawnIds.length !== tracks.size) {
        const count = buildInstances(now, map.getZoom());
        context.bindBuffer(context.ARRAY_BUFFER, instanceBuffer);
        context.bufferData(context.ARRAY_BUFFER, instances.subarray(0, count * FLOATS_PER_INSTANCE), context.DYNAMIC_DRAW);
        lastFrameMs = now;
      }
      const globe = options.shaderData.define.includes("GLOBE");
      const d = options.defaultProjectionData;
      lastView = { matrix: d.mainMatrix, clip: d.clippingPlane, globe, transition: d.projectionTransition };
      const p = getProgram(context, options.shaderData.variantName, options.shaderData.define);
      context.useProgram(p.program);
      context.uniformMatrix4fv(p.uniforms.matrix, false, d.mainMatrix);
      context.uniformMatrix4fv(p.uniforms.fallbackMatrix, false, d.fallbackMatrix);
      context.uniform4f(p.uniforms.clippingPlane, ...d.clippingPlane);
      context.uniform1f(p.uniforms.transition, d.projectionTransition);
      context.uniform2f(p.uniforms.halfViewport, context.drawingBufferWidth / 2, context.drawingBufferHeight / 2);
      context.uniform1f(p.uniforms.pixelRatio, context.drawingBufferWidth / map.getCanvas().clientWidth);
      context.activeTexture(context.TEXTURE0);
      context.bindTexture(context.TEXTURE_2D, atlas);
      context.uniform1i(p.uniforms.atlas, 0);
      // Sprites over the map: no depth test/write (horizon clipped in the shader), no culling.
      context.disable(context.DEPTH_TEST);
      context.depthMask(false);
      context.disable(context.CULL_FACE);
      context.bindVertexArray(p.vao);
      context.drawArraysInstanced(context.TRIANGLE_STRIP, 0, 4, drawnIds.length);
      context.bindVertexArray(null);
      scheduleRepaint();
    },
  };
}

const layers = new WeakMap<MapLibreMap, AircraftLayer>();

/** Above earthquakes/EONET (and labels), below the ISS layers. */
export function addAircraftLayer(map: MapLibreMap, beforeId?: string): void {
  const layer = createAircraftLayer();
  layers.set(map, layer);
  map.addLayer(layer, beforeId);
}

/** New snapshot: the drawn collection becomes exactly its aircraft (real positions appended per ICAO24). */
export function setAircraftFeed(map: MapLibreMap, feed: AirTrafficFeed | null, receivedAtMs: number): void {
  layers.get(map)?.setFeed(feed, receivedAtMs);
}

export function setSelectedAircraft(map: MapLibreMap, entityId: string | null): void {
  layers.get(map)?.setSelected(entityId?.startsWith(AIRCRAFT_ENTITY_PREFIX) ? entityId.slice(AIRCRAFT_ENTITY_PREFIX.length) : null);
}

export function setAircraftVisible(map: MapLibreMap, visible: boolean): void {
  layers.get(map)?.setVisible(visible);
}

/** Aircraft entity id under a screen point (CSS px), or null. */
export function pickAircraft(map: MapLibreMap, x: number, y: number): string | null {
  const icao24 = layers.get(map)?.pick(x, y) ?? null;
  return icao24 === null ? null : `${AIRCRAFT_ENTITY_PREFIX}${icao24}`;
}

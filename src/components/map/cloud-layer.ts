import type { CustomLayerInterface, GeoJSONSourceSpecification, Map as MapLibreMap } from "maplibre-gl";
import { GFS_REGISTRY_URL } from "@/lib/sources/noaa/gfs-source";
import { AURORA_LAYER_ID } from "./aurora-layer";

/**
 * NOAA GFS total cloud cover as a map layer: a small MapLibre custom layer
 * (WebGL2, no extra dependency), NOT a Web Mercator raster (whose globe pole
 * caps stretch edge pixels).
 *
 * - DATA: one GFS field (0.25°, 1440 × 721, 90°N → 90°S) uploaded as one
 *   texture per field id; values are never modified. No data is kept apart
 *   from 0 % (validity channel) and never drawn as clear sky or as cloud.
 * - VISUALIZATION: a lon/lat mesh on the sphere (FLAT: Web Mercator), the grid
 *   sampled with hardware bilinear filtering between the 4 neighbouring grid
 *   points. Visual interpolation only; source grid values remain unchanged.
 *   At high zoom the 0.25° (~28 km) cells show: that is the real resolution.
 *   No mipmaps; longitude wraps (REPEAT: 359.75° and 0° are neighbours), latitude
 *   clamps at the poles, where GFS repeats one value per pole row (no fan).
 * - Opacity encodes cloud fraction (monotonic, 0 % = transparent); colour is a
 *   neutral thin → thick ramp, not a cloud type. Presentation only.
 * - GLOBE: a shell CLOUD_VISUAL_ELEVATION_METERS above the surface (visual
 *   elevation only, not a physical cloud-top altitude; below the aurora's
 *   110 km shell), clipped at the horizon like MapLibre's own elevated globe
 *   features (never seen through the planet). FLAT: the same grid in lon/lat
 *   on the map, no elevation, drawn for neighbouring world copies too.
 * Static: one field at a time, no temporal animation or blending.
 */
export const CLOUDS_LAYER_ID = "aurelis-clouds-layer";
const ATTRIBUTION_SOURCE_ID = "aurelis-clouds-attribution-source";
const ATTRIBUTION_LAYER_ID = "aurelis-clouds-attribution-layer";

/** Presentation constants, NOT data: alpha at 100 % cloud cover and the curve exponent. */
export const CLOUD_MAX_ALPHA = 0.6;
export const CLOUD_ALPHA_EXPONENT = 1.5;

/**
 * Presentation constant, NOT data: visual elevation only, not a physical
 * cloud-top altitude (GFS TCDC has no height). Lifts the layer slightly off
 * the basemap on the globe; lower than the aurora shell (110 km).
 */
export const CLOUD_VISUAL_ELEVATION_METERS = 20_000;

const EARTH_RADIUS_METERS = 6_371_008.8; // sphere radius used by MapLibre's globe

const MERCATOR_MAX_LAT = 85.051129;

const vertexSource = (define: string) => `#version 300 es
${define}
precision highp float;
uniform mat4 u_projection_matrix;
uniform mat4 u_projection_fallback_matrix;
uniform vec4 u_projection_clipping_plane;
uniform float u_projection_transition;
uniform float u_world_offset;
uniform float u_elevation;
in vec2 a_lonlat;
out vec2 v_lonlat;
const float PI = 3.141592653589793;

vec2 mercator(vec2 lonlat) {
  float lat = radians(clamp(lonlat.y, -${MERCATOR_MAX_LAT}, ${MERCATOR_MAX_LAT}));
  return vec2((lonlat.x + 180.0) / 360.0, 0.5 - log(tan(PI / 4.0 + lat / 2.0)) / (2.0 * PI));
}

void main() {
  v_lonlat = a_lonlat;
  vec2 merc = mercator(a_lonlat);
#ifdef GLOBE
  // Same unit-sphere convention as MapLibre's globe shaders, lifted by the visual elevation.
  float lon = radians(a_lonlat.x);
  float lat = radians(a_lonlat.y);
  vec3 sphere = vec3(sin(lon) * cos(lat), sin(lat), cos(lon) * cos(lat));
  vec3 elevated = sphere * (1.0 + u_elevation / ${EARTH_RADIUS_METERS.toFixed(1)});
  vec4 globePosition = u_projection_matrix * vec4(elevated, 1.0);
  // Horizon clipping as MapLibre's elevated globe features (globeComputeClippingZ
  // on the elevated position): the far side of the planet falls outside the clip volume.
  globePosition.z = (1.0 - (dot(elevated, u_projection_clipping_plane.xyz) + u_projection_clipping_plane.w)) * globePosition.w;
  if (u_projection_transition > 0.999) {
    gl_Position = globePosition;
  } else {
    // Globe → mercator transition at high zoom (as MapLibre's interpolateProjection).
    vec4 flatPosition = u_projection_fallback_matrix * vec4(merc, 0.0, 1.0);
    vec4 result = globePosition;
    result.z = mix(0.0, globePosition.z, clamp((u_projection_transition - 0.2) / 0.8, 0.0, 1.0));
    result.xyw = mix(flatPosition.xyw, globePosition.xyw, u_projection_transition);
    if (abs(a_lonlat.y) > ${MERCATOR_MAX_LAT}) {
      // Beyond Mercator: hidden during the transition, as MapLibre hides its pole caps.
      result = globePosition;
      result.z = mix(globePosition.z, 100.0, pow(max((1.0 - u_projection_transition) / 0.02, 0.0), 8.0));
    }
    gl_Position = result;
  }
#else
  gl_Position = u_projection_matrix * vec4(merc.x + u_world_offset, merc.y, 0.0, 1.0);
#endif
}`;

const fragmentSource = (width: number, height: number) => `#version 300 es
precision highp float;
// RG16F: r = cloud cover % × validity, g = validity (1 with a value, 0 = no data).
uniform highp sampler2D u_grid;
uniform vec3 u_thin;
uniform vec3 u_thick;
uniform float u_max_alpha;
uniform float u_alpha_exponent;
in vec2 v_lonlat;
out vec4 fragColor;

void main() {
  // Texel (col, row) is centered on grid point (col × 0.25°E, 90° − row × 0.25°).
  // Hardware bilinear between the 4 neighbouring grid points (LINEAR, no mipmaps).
  vec2 uv = vec2((v_lonlat.x * 4.0 + 0.5) / ${width.toFixed(1)}, ((90.0 - v_lonlat.y) * 4.0 + 0.5) / ${height.toFixed(1)});
  vec2 s = texture(u_grid, uv).rg;
  // Bilinear mean of the VALID neighbours only; no-data neighbours fade out, never count as 0 %.
  if (s.g < 0.001) discard;
  float cover = clamp(s.r / s.g, 0.0, 100.0) / 100.0;
  float a = u_max_alpha * pow(cover, u_alpha_exponent) * clamp(s.g, 0.0, 1.0);
  if (a < 0.004) discard;
  fragColor = vec4(mix(u_thin, u_thick, cover) * a, a); // premultiplied alpha
}`;

type Program = {
  program: WebGLProgram;
  lonlat: number;
  uniforms: Record<string, WebGLUniformLocation | null>;
};

export type CloudGrid = { id: string; width: number; height: number; values: Uint16Array; noDataValue: number };

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

/** Lon/lat mesh, 1° steps, −180..180 × −90..90 (follows the curvature; the texture carries the 0.25° data). */
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

/** RG pairs for the texture: (value × validity, validity); no data → (0, 0). */
function toTexels(grid: CloudGrid): Float32Array {
  const out = new Float32Array(grid.values.length * 2);
  for (let i = 0; i < grid.values.length; i++) {
    const v = grid.values[i];
    if (v !== grid.noDataValue) {
      out[i * 2] = v / 10; // tenths of a percent → percent
      out[i * 2 + 1] = 1;
    }
  }
  return out;
}

type CloudLayer = CustomLayerInterface & {
  setGrid(grid: CloudGrid): void;
  setVisible(visible: boolean): void;
};

function createCloudLayer(): CloudLayer {
  const programs = new Map<string, Program>();
  let gl: WebGL2RenderingContext | null = null;
  let map: MapLibreMap | null = null;
  let vertexBuffer: WebGLBuffer | null = null;
  let indexBuffer: WebGLBuffer | null = null;
  let indexCount = 0;
  let texture: WebGLTexture | null = null;
  let loaded: { id: string; width: number; height: number } | null = null;
  let pending: CloudGrid | null = null;
  let visible = false;
  let colors: { thin: [number, number, number]; thick: [number, number, number] } | null = null;

  function getProgram(context: WebGL2RenderingContext, variant: string, define: string, w: number, h: number): Program {
    const key = `${variant}:${w}x${h}`;
    const cached = programs.get(key);
    if (cached) return cached;
    const program = context.createProgram()!;
    context.attachShader(program, compile(context, context.VERTEX_SHADER, vertexSource(define)));
    context.attachShader(program, compile(context, context.FRAGMENT_SHADER, fragmentSource(w, h)));
    context.linkProgram(program);
    const u = (name: string) => context.getUniformLocation(program, name);
    const entry: Program = {
      program,
      lonlat: context.getAttribLocation(program, "a_lonlat"),
      uniforms: {
        matrix: u("u_projection_matrix"),
        fallbackMatrix: u("u_projection_fallback_matrix"),
        clippingPlane: u("u_projection_clipping_plane"),
        transition: u("u_projection_transition"),
        worldOffset: u("u_world_offset"),
        elevation: u("u_elevation"),
        grid: u("u_grid"),
        thin: u("u_thin"),
        thick: u("u_thick"),
        maxAlpha: u("u_max_alpha"),
        alphaExponent: u("u_alpha_exponent"),
      },
    };
    programs.set(key, entry);
    return entry;
  }

  /** Replaces the texture in one step (inside a frame): the previous field stays until then. */
  function upload(context: WebGL2RenderingContext, grid: CloudGrid) {
    performance.mark("aurelis-clouds-upload-start");
    const texels = toTexels(grid);
    texture ??= context.createTexture();
    context.bindTexture(context.TEXTURE_2D, texture);
    context.pixelStorei(context.UNPACK_ALIGNMENT, 1);
    // RG16F is filterable in WebGL2 core (hardware bilinear).
    context.texImage2D(context.TEXTURE_2D, 0, context.RG16F, grid.width, grid.height, 0, context.RG, context.FLOAT, texels);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.LINEAR); // no mipmaps
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, context.LINEAR);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_S, context.REPEAT); // longitude wraps
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_T, context.CLAMP_TO_EDGE); // poles
    loaded = { id: grid.id, width: grid.width, height: grid.height };
    performance.measure("aurelis-clouds-upload", "aurelis-clouds-upload-start");
  }

  return {
    id: CLOUDS_LAYER_ID,
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
      colors = { thin: token("--aurelis-cloud-thin"), thick: token("--aurelis-cloud") };
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

    setGrid(grid) {
      if (grid.id === loaded?.id || grid.id === pending?.id) return;
      pending = grid;
      map?.triggerRepaint();
    },

    setVisible(next) {
      if (next === visible) return;
      visible = next;
      map?.triggerRepaint();
    },

    render(context, options) {
      if (!visible || !vertexBuffer || !indexBuffer || !colors || !map) return;
      if (pending) {
        upload(context, pending);
        pending = null;
      }
      if (!texture || !loaded) return;

      const globe = options.shaderData.define.includes("GLOBE");
      const p = getProgram(context, options.shaderData.variantName, options.shaderData.define, loaded.width, loaded.height);
      const d = options.defaultProjectionData;
      context.useProgram(p.program);
      context.uniformMatrix4fv(p.uniforms.matrix, false, d.mainMatrix);
      context.uniformMatrix4fv(p.uniforms.fallbackMatrix, false, d.fallbackMatrix);
      context.uniform4f(p.uniforms.clippingPlane, ...d.clippingPlane);
      context.uniform1f(p.uniforms.transition, d.projectionTransition);
      context.uniform1f(p.uniforms.elevation, globe ? CLOUD_VISUAL_ELEVATION_METERS : 0);
      context.uniform3f(p.uniforms.thin, ...colors.thin);
      context.uniform3f(p.uniforms.thick, ...colors.thick);
      context.uniform1f(p.uniforms.maxAlpha, CLOUD_MAX_ALPHA);
      context.uniform1f(p.uniforms.alphaExponent, CLOUD_ALPHA_EXPONENT);
      context.activeTexture(context.TEXTURE0);
      context.bindTexture(context.TEXTURE_2D, texture);
      context.uniform1i(p.uniforms.grid, 0);

      context.bindBuffer(context.ARRAY_BUFFER, vertexBuffer);
      context.enableVertexAttribArray(p.lonlat);
      context.vertexAttribPointer(p.lonlat, 2, context.FLOAT, false, 0, 0);
      context.bindBuffer(context.ELEMENT_ARRAY_BUFFER, indexBuffer);
      // A translucent surface layer: no depth test/write (the horizon is clipped
      // in the shader), no culling. MapLibre resets its GL state after custom layers.
      context.disable(context.DEPTH_TEST);
      context.depthMask(false);
      context.disable(context.CULL_FACE);
      // FLAT: the neighbouring world copies too, so the antimeridian has no gap.
      const offsets = globe || !map.getRenderWorldCopies() ? [0] : [-1, 0, 1];
      for (const offset of offsets) {
        context.uniform1f(p.uniforms.worldOffset, offset);
        context.drawElements(context.TRIANGLES, indexCount, context.UNSIGNED_INT, 0);
      }
    },
  };
}

const layers = new WeakMap<MapLibreMap, CloudLayer>();

/**
 * Above the basemap/imagery, directly below the aurora (so borders, labels,
 * data, the weather point and the ISS stay on top). Credit through an empty
 * source whose only purpose is MapLibre's attribution control (shown while
 * the layer is shown); the custom layer itself takes no clicks.
 */
export function addCloudLayer(map: MapLibreMap): void {
  const layer = createCloudLayer();
  layers.set(map, layer);
  map.addLayer(layer, map.getLayer(AURORA_LAYER_ID) ? AURORA_LAYER_ID : undefined);
  const attribution: GeoJSONSourceSpecification = {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
    attribution: `Clouds: <a href="${GFS_REGISTRY_URL}" target="_blank" rel="noopener noreferrer">NOAA GFS</a> (model; rendered by AURELIS)`,
  };
  map.addSource(ATTRIBUTION_SOURCE_ID, attribution);
  map.addLayer(
    { id: ATTRIBUTION_LAYER_ID, type: "circle", source: ATTRIBUTION_SOURCE_ID, layout: { visibility: "none" } },
    CLOUDS_LAYER_ID,
  );
}

/** Sets the field to draw; a no-op when this field id is already loaded or pending. */
export function setCloudGrid(map: MapLibreMap, grid: CloudGrid): void {
  layers.get(map)?.setGrid(grid);
}

export function setCloudsVisible(map: MapLibreMap, visible: boolean): void {
  layers.get(map)?.setVisible(visible);
  if (map.getLayer(ATTRIBUTION_LAYER_ID)) {
    map.setLayoutProperty(ATTRIBUTION_LAYER_ID, "visibility", visible ? "visible" : "none");
  }
}

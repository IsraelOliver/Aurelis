import {
  MercatorCoordinate,
  type CustomLayerInterface,
  type CustomRenderMethodInput,
  type Map as MapLibreMap,
} from "maplibre-gl";
import type { OrbitVertex } from "@/lib/iss-trail";

/**
 * ISS trail at orbital altitude on the globe: a MapLibre custom layer
 * (renderingMode "3d", depth-tested against the planet) drawn with MapLibre's
 * own projection shader code (`projectTileFor3D`), no extra dependency. Each
 * vertex is a received position at the altitude reported with it
 * (altitudeKm × 1000 m); the last vertex is the displayed marker position.
 * Drawn only under globe projection; the flat map keeps the 2D surface trail.
 */
export const ISS_ORBIT_TRAIL_LAYER_ID = "aurelis-iss-orbit-trail-layer";

/** Same discreet look as the 2D trail: cyan, max opacity 0.55, oldest end fading in. */
const MAX_OPACITY = "0.55";
const FADE = "0.35";

const vertexSource = (prelude: string, define: string) => `#version 300 es
${prelude}
${define}
in vec2 a_merc;
in float a_elevation;
in float a_progress;
out float v_alpha;
void main() {
  gl_Position = projectTileFor3D(a_merc, a_elevation);
  v_alpha = clamp(a_progress / ${FADE}, 0.0, 1.0) * ${MAX_OPACITY};
}`;

const fragmentSource = `#version 300 es
precision highp float;
uniform vec3 u_color;
in float v_alpha;
out vec4 fragColor;
void main() {
  fragColor = vec4(u_color * v_alpha, v_alpha);
}`;

type Program = {
  program: WebGLProgram;
  attribs: { merc: number; elevation: number; progress: number };
  uniforms: Record<string, WebGLUniformLocation | null>;
};

export type IssOrbitTrailLayer = CustomLayerInterface & {
  /** Strips to draw (null or empty draws nothing). */
  setStrips(strips: OrbitVertex[][] | null): void;
};

function hexToRgb(hex: string): [number, number, number] {
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

export function createIssOrbitTrailLayer(colorHex: string): IssOrbitTrailLayer {
  const color = hexToRgb(colorHex);
  const programs = new Map<string, Program>();
  let gl: WebGL2RenderingContext | null = null;
  let buffer: WebGLBuffer | null = null;
  let map: MapLibreMap | null = null;
  let strips: OrbitVertex[][] | null = null;

  /** One program per projection shader variant (MapLibre's prelude differs per projection). */
  function getProgram(context: WebGL2RenderingContext, shaderData: CustomRenderMethodInput["shaderData"]): Program {
    const cached = programs.get(shaderData.variantName);
    if (cached) return cached;
    const program = context.createProgram()!;
    context.attachShader(
      program,
      compile(context, context.VERTEX_SHADER, vertexSource(shaderData.vertexShaderPrelude, shaderData.define)),
    );
    context.attachShader(program, compile(context, context.FRAGMENT_SHADER, fragmentSource));
    context.linkProgram(program);
    const uniform = (name: string) => context.getUniformLocation(program, name);
    const entry: Program = {
      program,
      attribs: {
        merc: context.getAttribLocation(program, "a_merc"),
        elevation: context.getAttribLocation(program, "a_elevation"),
        progress: context.getAttribLocation(program, "a_progress"),
      },
      uniforms: {
        matrix: uniform("u_projection_matrix"),
        tileMercatorCoords: uniform("u_projection_tile_mercator_coords"),
        clippingPlane: uniform("u_projection_clipping_plane"),
        transition: uniform("u_projection_transition"),
        fallbackMatrix: uniform("u_projection_fallback_matrix"),
        color: uniform("u_color"),
      },
    };
    programs.set(shaderData.variantName, entry);
    return entry;
  }

  return {
    id: ISS_ORBIT_TRAIL_LAYER_ID,
    type: "custom",
    renderingMode: "3d",

    onAdd(m, context) {
      map = m;
      gl = context as WebGL2RenderingContext;
      buffer = gl.createBuffer();
    },

    onRemove() {
      if (gl) {
        for (const { program } of programs.values()) gl.deleteProgram(program);
        if (buffer) gl.deleteBuffer(buffer);
      }
      programs.clear();
      gl = null;
      buffer = null;
      map = null;
    },

    setStrips(next) {
      strips = next;
      map?.triggerRepaint();
    },

    render(context, options) {
      // Globe only: the flat map keeps the 2D surface trail.
      if (!strips || strips.length === 0 || !buffer || !options.shaderData.define.includes("GLOBE")) return;

      const total = strips.reduce((n, s) => n + s.length, 0);
      const data = new Float32Array(total * 4);
      let i = 0;
      let index = 0;
      for (const strip of strips) {
        for (const v of strip) {
          const merc = MercatorCoordinate.fromLngLat([v.lon, v.lat]);
          data[i++] = merc.x;
          data[i++] = merc.y;
          data[i++] = v.altitudeKm * 1000; // meters above the sphere, display only
          data[i++] = total > 1 ? index / (total - 1) : 1;
          index++;
        }
      }

      const p = getProgram(context, options.shaderData);
      const d = options.defaultProjectionData;
      context.useProgram(p.program);
      context.uniformMatrix4fv(p.uniforms.matrix, false, d.mainMatrix);
      context.uniform4f(p.uniforms.tileMercatorCoords, ...d.tileMercatorCoords);
      context.uniform4f(p.uniforms.clippingPlane, ...d.clippingPlane);
      context.uniform1f(p.uniforms.transition, d.projectionTransition);
      context.uniformMatrix4fv(p.uniforms.fallbackMatrix, false, d.fallbackMatrix);
      context.uniform3f(p.uniforms.color, ...color);

      context.bindBuffer(context.ARRAY_BUFFER, buffer);
      context.bufferData(context.ARRAY_BUFFER, data, context.DYNAMIC_DRAW);
      const stride = 16;
      context.enableVertexAttribArray(p.attribs.merc);
      context.vertexAttribPointer(p.attribs.merc, 2, context.FLOAT, false, stride, 0);
      context.enableVertexAttribArray(p.attribs.elevation);
      context.vertexAttribPointer(p.attribs.elevation, 1, context.FLOAT, false, stride, 8);
      context.enableVertexAttribArray(p.attribs.progress);
      context.vertexAttribPointer(p.attribs.progress, 1, context.FLOAT, false, stride, 12);

      let first = 0;
      for (const strip of strips) {
        context.drawArrays(context.LINE_STRIP, first, strip.length);
        first += strip.length;
      }
    },
  };
}

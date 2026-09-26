// WebGL1 sprite-batch renderer. One texture atlas, one draw call per flush.
// World space is pixels; camera is centered; +y is down (screen convention).

const VERT = `
attribute vec2 aPos;
attribute vec2 aUV;
attribute vec4 aColor;
uniform vec2 uRes;
uniform vec2 uCam;
uniform float uZoom;
varying vec2 vUV;
varying vec4 vColor;
void main() {
  vec2 view = (aPos - uCam) * uZoom;
  vec2 ndc = view / (uRes * 0.5);
  ndc.y = -ndc.y;
  gl_Position = vec4(ndc, 0.0, 1.0);
  vUV = aUV;
  vColor = aColor;
}`;

const FRAG = `
precision mediump float;
varying vec2 vUV;
varying vec4 vColor;
uniform sampler2D uTex;
void main() {
  gl_FragColor = texture2D(uTex, vUV) * vColor;
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error('Shader compile: ' + gl.getShaderInfoLog(s));
  }
  return s;
}

const MAX_QUADS = 4096;
const FLOATS_PER_VERT = 8; // x,y,u,v,r,g,b,a
const VERTS_PER_QUAD = 6;

export function createRenderer(gl, atlas) {
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error('Program link: ' + gl.getProgramInfoLog(prog));
  }
  gl.useProgram(prog);

  const loc = {
    aPos: gl.getAttribLocation(prog, 'aPos'),
    aUV: gl.getAttribLocation(prog, 'aUV'),
    aColor: gl.getAttribLocation(prog, 'aColor'),
    uRes: gl.getUniformLocation(prog, 'uRes'),
    uCam: gl.getUniformLocation(prog, 'uCam'),
    uZoom: gl.getUniformLocation(prog, 'uZoom'),
    uTex: gl.getUniformLocation(prog, 'uTex'),
  };

  // Texture from atlas canvas.
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // Precompute UV rects per frame.
  const AW = atlas.canvas.width, AH = atlas.canvas.height;
  const uv = {};
  for (const name in atlas.frames) {
    const f = atlas.frames[name];
    // Inset by half a texel to avoid bleeding from neighbours.
    const ix = 0.5 / AW, iy = 0.5 / AH;
    uv[name] = {
      u0: f.x / AW + ix, v0: f.y / AH + iy,
      u1: (f.x + f.w) / AW - ix, v1: (f.y + f.h) / AH - iy,
      w: f.lw, h: f.lh,
    };
  }

  const data = new Float32Array(MAX_QUADS * VERTS_PER_QUAD * FLOATS_PER_VERT);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);

  const stride = FLOATS_PER_VERT * 4;
  gl.enableVertexAttribArray(loc.aPos);
  gl.vertexAttribPointer(loc.aPos, 2, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(loc.aUV);
  gl.vertexAttribPointer(loc.aUV, 2, gl.FLOAT, false, stride, 8);
  gl.enableVertexAttribArray(loc.aColor);
  gl.vertexAttribPointer(loc.aColor, 4, gl.FLOAT, false, stride, 16);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.disable(gl.DEPTH_TEST);
  gl.uniform1i(loc.uTex, 0);

  let count = 0; // quads in buffer
  let resX = 1, resY = 1;
  let camX = 0, camY = 0, zoom = 1;

  function resize(wPx, hPx) {
    resX = wPx; resY = hPx;
    gl.viewport(0, 0, wPx, hPx);
  }

  function begin(cx, cy, z) {
    camX = cx; camY = cy; zoom = z;
    count = 0;
    gl.clearColor(201 / 255, 178 / 255, 78 / 255, 1); // steppe ground, matches grass1
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  function flush() {
    if (count === 0) return;
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.subarray(0, count * VERTS_PER_QUAD * FLOATS_PER_VERT));
    gl.uniform2f(loc.uRes, resX, resY);
    gl.uniform2f(loc.uCam, camX, camY);
    gl.uniform1f(loc.uZoom, zoom);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.drawArrays(gl.TRIANGLES, 0, count * VERTS_PER_QUAD);
    count = 0;
  }

  // Push one quad. Reused locals; no per-call allocation.
  function pushQuad(u, x, y, w, h, rot, r, g, b, a, ax, ay) {
    if (count >= MAX_QUADS) flush();
    const lx0 = -ax * w, lx1 = (1 - ax) * w;
    const ly0 = -ay * h, ly1 = (1 - ay) * h;
    let c = 1, s = 0;
    if (rot) { c = Math.cos(rot); s = Math.sin(rot); }
    // corners: 00,10,11,01
    const x00 = x + lx0 * c - ly0 * s, y00 = y + lx0 * s + ly0 * c;
    const x10 = x + lx1 * c - ly0 * s, y10 = y + lx1 * s + ly0 * c;
    const x11 = x + lx1 * c - ly1 * s, y11 = y + lx1 * s + ly1 * c;
    const x01 = x + lx0 * c - ly1 * s, y01 = y + lx0 * s + ly1 * c;

    let o = count * VERTS_PER_QUAD * FLOATS_PER_VERT;
    const d = data;
    // tri 1
    d[o++] = x00; d[o++] = y00; d[o++] = u.u0; d[o++] = u.v0; d[o++] = r; d[o++] = g; d[o++] = b; d[o++] = a;
    d[o++] = x10; d[o++] = y10; d[o++] = u.u1; d[o++] = u.v0; d[o++] = r; d[o++] = g; d[o++] = b; d[o++] = a;
    d[o++] = x11; d[o++] = y11; d[o++] = u.u1; d[o++] = u.v1; d[o++] = r; d[o++] = g; d[o++] = b; d[o++] = a;
    // tri 2
    d[o++] = x00; d[o++] = y00; d[o++] = u.u0; d[o++] = u.v0; d[o++] = r; d[o++] = g; d[o++] = b; d[o++] = a;
    d[o++] = x11; d[o++] = y11; d[o++] = u.u1; d[o++] = u.v1; d[o++] = r; d[o++] = g; d[o++] = b; d[o++] = a;
    d[o++] = x01; d[o++] = y01; d[o++] = u.u0; d[o++] = u.v1; d[o++] = r; d[o++] = g; d[o++] = b; d[o++] = a;
    count++;
  }

  const EMPTY = {};

  // Public draw. o = {w,h,rot,sx,sy,r,g,b,a,ax,ay}
  function draw(name, x, y, o) {
    const u = uv[name];
    if (!u) return;
    o = o || EMPTY;
    const sx = o.sx == null ? 1 : o.sx;
    const sy = o.sy == null ? 1 : o.sy;
    const w = (o.w == null ? u.w : o.w) * sx;
    const h = (o.h == null ? u.h : o.h) * sy;
    pushQuad(u, x, y, w, h, o.rot || 0,
      o.r == null ? 1 : o.r, o.g == null ? 1 : o.g, o.b == null ? 1 : o.b, o.a == null ? 1 : o.a,
      o.ax == null ? 0.5 : o.ax, o.ay == null ? 0.5 : o.ay);
  }

  function frame(name) { return uv[name]; }

  return { resize, begin, draw, flush, frame, gl };
}

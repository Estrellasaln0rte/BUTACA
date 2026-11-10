// Render fijo de la mascota de Butaca con raymarching de distancias con signo (SDF).
// Cuerpo, bracitos y patitas se unen con una unión suave (smin): una sola figura sin costuras,
// con un pliegue leve donde nace cada extremidad. Sombras suaves y oclusión ambiental para el volumen.
// Se renderiza grande y se reduce (supersampling) para bordes limpios.

// Pose a renderizar: ?pose=frente (por defecto) o ?pose=tapa (se tapa los ojos)
const POSES = { frente: 0, tapa: 1 };
const POSE = POSES[new URLSearchParams(location.search).get('pose')] ?? 0;

const TAM_RENDER = 1800; // px del render interno
const TAM_SALIDA = 720; // px del PNG final

const vertice = `
attribute vec2 pos;
void main() { gl_Position = vec4(pos, 0.0, 1.0); }
`;

const fragmento = `
precision highp float;
uniform vec2 resolucion;
uniform float pose;

float sdCapsula(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

float sdElipsoide(vec3 p, vec3 r) {
  float k0 = length(p / r);
  float k1 = length(p / (r * r));
  return k0 * (k0 - 1.0) / k1;
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

// Cuerpo solo: gota redondeada, más ancha abajo
float sdCuerpo(vec3 p) {
  vec3 q = p;
  float ancho = 1.0 - 0.11 * q.y;
  q.xz /= ancho;
  return sdElipsoide(q, vec3(0.98, 0.93, 0.86)) * 0.9;
}

// Figura: devuelve distancia; material en .y (1 cuerpo, 2 ojo)
vec2 mapa(vec3 p) {
  float cuerpo = sdCuerpo(p);

  // Simetría izquierda/derecha para extremidades
  vec3 s = vec3(abs(p.x), p.y, p.z);

  // Bracitos: paletas que cuelgan a los costados, apuntando abajo y un poco afuera
  vec3 b = s - vec3(0.9, -0.34, 0.16);
  b.xy = rot(0.34) * b.xy;
  b.yz = rot(-0.15) * b.yz;
  float brazo = sdElipsoide(b, vec3(0.175, 0.33, 0.17));
  if (pose > 0.5) {
    // Se tapa los ojos: cada bracito sube desde el costado hasta la cara
    float brazoTapa = sdCapsula(s, vec3(0.8, -0.12, 0.36), vec3(0.22, 0.17, 0.93), 0.15);
    float mano = sdElipsoide(s - vec3(0.2, 0.19, 0.95), vec3(0.17, 0.15, 0.1));
    brazo = smin(brazoTapa, mano, 0.08);
  }

  // Patitas: nubes redondas hacia adelante, apoyadas en el piso
  vec3 f = s - vec3(0.32, -0.82, 0.55);
  float pata = sdElipsoide(f, vec3(0.2, 0.14, 0.24));

  float d = smin(cuerpo, brazo, 0.06);
  d = smin(d, pata, 0.09);

  // Ojitos: bolitas negras apenas salientes
  vec3 o = s - vec3(0.125, 0.2, 0.845);
  float ojo = length(o) - 0.04;

  if (ojo < d) return vec2(ojo, 2.0);
  return vec2(d, 1.0);
}

vec3 normal(vec3 p) {
  vec2 e = vec2(0.0008, 0.0);
  return normalize(vec3(
    mapa(p + e.xyy).x - mapa(p - e.xyy).x,
    mapa(p + e.yxy).x - mapa(p - e.yxy).x,
    mapa(p + e.yyx).x - mapa(p - e.yyx).x));
}

float sombraSuave(vec3 ro, vec3 rd, float k) {
  float res = 1.0;
  float t = 0.02;
  for (int i = 0; i < 96; i++) {
    float h = mapa(ro + rd * t).x;
    res = min(res, k * h / t);
    t += clamp(h, 0.01, 0.2);
    if (res < 0.001 || t > 6.0) break;
  }
  return clamp(res, 0.0, 1.0);
}

float oclusion(vec3 p, vec3 n) {
  float occ = 0.0;
  float esc = 1.0;
  for (int i = 1; i <= 6; i++) {
    float h = 0.025 * float(i) * float(i) * 0.5;
    float d = mapa(p + n * h).x;
    occ += (h - d) * esc;
    esc *= 0.72;
  }
  return clamp(1.0 - 2.2 * occ, 0.0, 1.0);
}

const float PISO = -0.94;

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * resolucion) / resolucion.y;

  vec3 ro = vec3(0.0, 0.55, 7.2);
  vec3 objetivo = vec3(0.0, -0.12, 0.0);
  vec3 ww = normalize(objetivo - ro);
  vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
  vec3 vv = cross(uu, ww);
  vec3 rd = normalize(uv.x * uu + uv.y * vv + 2.35 * ww);

  vec3 luz = normalize(vec3(-0.55, 0.85, 0.65));
  vec3 relleno = normalize(vec3(0.8, 0.25, 0.6));
  vec3 contraluz = normalize(vec3(0.6, 0.4, -0.8));

  float t = 0.0;
  vec2 h = vec2(0.0);
  bool toca = false;
  for (int i = 0; i < 220; i++) {
    h = mapa(ro + rd * t);
    if (h.x < 0.0004) { toca = true; break; }
    t += h.x * 0.85;
    if (t > 14.0) break;
  }

  if (toca) {
    vec3 p = ro + rd * t;
    vec3 n = normal(p);
    float occ = oclusion(p, n);
    float som = sombraSuave(p + n * 0.003, luz, 10.0);

    vec3 col;
    if (h.y > 1.5) {
      // Ojo: negro brillante con reflejo
      vec3 r = reflect(rd, n);
      float esp = pow(max(dot(r, luz), 0.0), 60.0);
      col = vec3(0.008, 0.007, 0.012) + vec3(1.0) * esp * 1.2;
      col *= mix(0.6, 1.0, occ);
    } else {
      vec3 base = vec3(0.965, 0.95, 0.935);

      // Mejillas rosadas pintadas sobre la superficie
      vec2 mj = vec2(abs(p.x) - 0.27, p.y - 0.13);
      mj.x /= 1.25;
      // Solo sobre la cara: no se pinta en las manos cuando tapan los ojos
      float enCara = 1.0 - smoothstep(0.004, 0.02, sdCuerpo(p));
      float mejilla = (1.0 - smoothstep(0.03, 0.058, length(mj))) * step(0.0, p.z) * enCara;
      base = mix(base, vec3(0.93, 0.5, 0.56), mejilla * 0.9);

      // Difusa envolvente (aspecto suave, como un material con un poco de translucidez)
      float dif = clamp((dot(n, luz) + 0.25) / 1.25, 0.0, 1.0) * mix(0.35, 1.0, som);
      float difRel = clamp((dot(n, relleno) + 0.3) / 1.3, 0.0, 1.0);
      float cielo = 0.5 + 0.5 * n.y;
      float borde = pow(clamp(1.0 + dot(rd, n), 0.0, 1.0), 3.0) * clamp(dot(n, contraluz) + 0.6, 0.0, 1.0);
      vec3 hm = normalize(luz - rd);
      float esp = pow(clamp(dot(n, hm), 0.0, 1.0), 28.0) * som * 0.18;

      col = base * (
        vec3(1.0, 0.96, 0.92) * dif * 0.82 +
        vec3(1.0, 0.88, 0.82) * difRel * 0.16 +
        vec3(0.86, 0.84, 0.95) * cielo * 0.26 * occ +
        vec3(0.55, 0.42, 0.45) * (1.0 - cielo) * 0.12 * occ
      );
      col *= mix(0.45, 1.0, occ);
      col += vec3(1.0, 0.84, 0.88) * borde * 0.35;
      col += vec3(1.0) * esp;
    }

    col = vec3(1.0) - exp(-col * 1.75); // tono suave
    col = pow(col, vec3(1.0 / 2.2));
    gl_FragColor = vec4(col, 1.0);
    return;
  }

  // Piso invisible: solo deja la sombra de contacto (transparente en el resto)
  if (rd.y < 0.0) {
    float tp = (PISO - ro.y) / rd.y;
    vec3 p = ro + rd * tp;
    float som = sombraSuave(p + vec3(0.0, 0.001, 0.0), luz, 6.0);
    float occ = oclusion(p, vec3(0.0, 1.0, 0.0));
    float oscuro = (1.0 - som) * 0.32 + (1.0 - occ) * 0.55;
    oscuro *= 1.0 - smoothstep(1.2, 2.4, length(p.xz));
    gl_FragColor = vec4(0.12, 0.06, 0.14, clamp(oscuro, 0.0, 0.7));
    return;
  }

  gl_FragColor = vec4(0.0);
}
`;

function compilar(gl, tipo, fuente) {
  const s = gl.createShader(tipo);
  gl.shaderSource(s, fuente);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

const lienzo = document.getElementById('lienzo');
lienzo.width = TAM_RENDER;
lienzo.height = TAM_RENDER;
const gl = lienzo.getContext('webgl', { premultipliedAlpha: false, preserveDrawingBuffer: true, alpha: true });

const prog = gl.createProgram();
gl.attachShader(prog, compilar(gl, gl.VERTEX_SHADER, vertice));
gl.attachShader(prog, compilar(gl, gl.FRAGMENT_SHADER, fragmento));
gl.linkProgram(prog);
gl.useProgram(prog);

const buf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
const loc = gl.getAttribLocation(prog, 'pos');
gl.enableVertexAttribArray(loc);
gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
gl.uniform2f(gl.getUniformLocation(prog, 'resolucion'), TAM_RENDER, TAM_RENDER);
gl.uniform1f(gl.getUniformLocation(prog, 'pose'), POSE);
gl.viewport(0, 0, TAM_RENDER, TAM_RENDER);
gl.clearColor(0, 0, 0, 0);
gl.clear(gl.COLOR_BUFFER_BIT);
gl.drawArrays(gl.TRIANGLES, 0, 3);

// Reducción en pasos para un antialias limpio
let origen = lienzo;
let tam = TAM_RENDER;
while (tam / 2 >= TAM_SALIDA) {
  const paso = document.createElement('canvas');
  paso.width = paso.height = Math.round(tam / 2);
  const c = paso.getContext('2d');
  c.imageSmoothingQuality = 'high';
  c.drawImage(origen, 0, 0, paso.width, paso.height);
  origen = paso;
  tam = paso.width;
}
const salida = document.createElement('canvas');
salida.width = salida.height = TAM_SALIDA;
const ctx = salida.getContext('2d');
ctx.imageSmoothingQuality = 'high';
ctx.drawImage(origen, 0, 0, TAM_SALIDA, TAM_SALIDA);

const url = salida.toDataURL('image/png');
document.getElementById('resultado').src = url;
document.getElementById('descargar').href = url;
document.getElementById('descargar').download = `mascota-${Object.keys(POSES)[POSE]}.png`;
window.renderListo = url;

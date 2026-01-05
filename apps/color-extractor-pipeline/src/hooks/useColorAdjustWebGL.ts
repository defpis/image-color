import { useEffect, useRef, useMemo, useCallback, useState } from "react";
import type { PeakColor } from "@image-color/color-extractor";
import type {
  ColorAdjustment,
  ColorAdjustments,
} from "../components/ColorAdjustPanel";

// Vertex shader
const VERTEX_SHADER = `
attribute vec2 aPosition;
varying vec2 vTexCoord;

void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
  vTexCoord = aPosition * 0.5 + 0.5;
}
`;

// Pass 0: Color adjustment shader (based on Canva's implementation)
const COLOR_ADJUST_SHADER = `
precision highp float;

uniform sampler2D J;  // 源图像
uniform sampler2D K;  // 色相调整 LUT (8 segments)
uniform int r;        // 色相分段数 (8)
uniform float L;      // 饱和度阈值

varying vec2 vTexCoord;

// 工具函数
float remap(float c, float a, float d, float b, float e) {
  return (c - a) * (e - b) / (d - a) + b;
}

vec3 remapVec3(vec3 c, vec3 a, vec3 d, vec3 b, vec3 e) {
  return (c - a) * (e - b) / (d - a) + b;
}

float getLuminance(vec4 a) {
  return dot(a.rgb, vec3(0.2126, 0.7152, 0.0722));
}

// sRGB <-> Linear
vec3 linearToSrgb(vec3 a) {
  return pow(max(a, vec3(0.0)), vec3(0.454545));
}

vec3 srgbToLinear(vec3 a) {
  return pow(a, vec3(2.2));
}

// Cube root
float cbrt(float a) {
  return sign(a) * pow(abs(a), 0.333333);
}

// Linear RGB -> OKLab
vec3 linearToOklab(vec3 a) {
  float e = 0.412221 * a.r + 0.536333 * a.g + 0.051446 * a.b;
  float f = 0.211903 * a.r + 0.6807 * a.g + 0.107397 * a.b;
  float g = 0.088302 * a.r + 0.281719 * a.g + 0.629979 * a.b;
  float b = cbrt(e), c = cbrt(f), d = cbrt(g);
  return vec3(
    0.210454 * b + 0.793618 * c - 0.004072 * d,
    1.977998 * b - 2.428592 * c + 0.450594 * d,
    0.025904 * b + 0.782772 * c - 0.808676 * d
  );
}

// OKLab -> Linear RGB
vec3 oklabToLinear(vec3 a) {
  float b = a.x + 0.396338 * a.y + 0.215804 * a.z;
  float c = a.x - 0.105561 * a.y - 0.063854 * a.z;
  float d = a.x - 0.089484 * a.y - 1.291486 * a.z;
  float e = b * b * b, f = c * c * c, g = d * d * d;
  return vec3(
    4.076742 * e - 3.307712 * f + 0.23097 * g,
    -1.268438 * e + 2.609757 * f - 0.341319 * g,
    -0.004196 * e - 0.703419 * f + 1.707615 * g
  );
}

// 矩阵
const mat3 RGB_TO_XYZ = mat3(
  0.412456, 0.357576, 0.180438,
  0.212673, 0.715152, 0.072175,
  0.019334, 0.119192, 0.950304
);
const mat3 XYZ_TO_RGB = mat3(
  3.240454, -1.537138, -0.498531,
  -0.969266, 1.876011, 0.041556,
  0.055643, -0.204026, 1.057225
);
const mat3 GAMUT_MATRIX = mat3(
  2.326495, -0.79599, -0.381285,
  -0.969244, 1.875968, 0.041555,
  0.055631, -0.203978, 1.056972
);

vec3 xyzToRgb(vec3 a) { return a * XYZ_TO_RGB; }
vec3 rgbToXyz(vec3 a) { return a * RGB_TO_XYZ; }
vec3 gamutCheck(vec3 a) { return a * GAMUT_MATRIX; }

// OKLab -> XYZ
vec3 oklabToXyz(vec3 a) {
  vec3 b = oklabToLinear(a);
  return rgbToXyz(b);
}

// 色域映射 - 处理负值
vec3 gamutMapNegative(vec3 b) {
  if (all(greaterThanEqual(b, vec3(0.0)))) return b;
  vec3 c = linearToOklab(b), h = c, a;
  float d = 0.0, e = 1.0;
  for (int i = 0; i < 8; i++) {
    float f = (d + e) * 0.5;
    h.yz = c.yz * f;
    a = oklabToXyz(h);
    vec3 k = gamutCheck(a), n = xyzToRgb(a);
    if (all(greaterThanEqual(k, vec3(0.0)))) d = f;
    else e = f;
  }
  vec3 g = xyzToRgb(a);
  g = max(g, vec3(0.0));
  return g;
}

// 色域映射 - 处理超出范围
vec3 gamutMapRange(vec3 b) {
  if (all(greaterThanEqual(b, vec3(0.0))) && all(lessThanEqual(b, vec3(1.0)))) return b;
  vec3 c = linearToOklab(b), h = c, a;
  float d = 0.0, e = 1.0;
  for (int i = 0; i < 8; i++) {
    float f = (d + e) * 0.5;
    h.yz = c.yz * f;
    a = oklabToXyz(h);
    vec3 k = gamutCheck(a), n = xyzToRgb(a);
    if (all(greaterThanEqual(k, vec3(0.0))) && all(lessThanEqual(n, vec3(1.0)))) d = f;
    else e = f;
  }
  vec3 g = xyzToRgb(a);
  g = clamp(g, vec3(0.0), vec3(1.0));
  return g;
}

// 亮度压缩
vec4 compressHighlight(vec4 a) {
  float b = max(max(a.r, a.g), a.b);
  if (b > 1.000001) a.rgb /= b;
  return a;
}

// 完整色域映射
vec4 gamutMap(vec4 a) {
  if (all(lessThanEqual(a.rgb, vec3(1.0))) && all(greaterThanEqual(a.rgb, vec3(0.0)))) return a;
  a = any(lessThan(a.rgb, vec3(0.0))) ? vec4(gamutMapNegative(a.rgb), a.a) : a;
  vec4 f = vec4(gamutMapRange(a.rgb), a.a), g = compressHighlight(a);
  vec3 b = linearToOklab(a.rgb), c = linearToOklab(f.rgb), d = linearToOklab(g.rgb);
  float h = abs(b.x - d.x) * 4.0;
  vec2 i = vec2(b.y - c.y, b.z - c.z);
  float e = length(i) * 1.0, k = h + e, n = e / k, q = clamp(n, 0.0, 1.0);
  vec3 v = mix(c, d, q);
  return vec4(oklabToLinear(v), a.a);
}

// OKLab -> 极坐标 (L, C, h)
vec3 oklabToPolar(vec3 a) {
  float b = a.x;
  float c = length(a.yz);
  float d = atan(a.z, a.y);
  return vec3(b, c, d);
}

// 极坐标 -> OKLab
vec3 polarToOklab(vec3 a) {
  float d = a.x;
  float b = a.y;
  float c = a.z;
  float e = b * cos(c);
  float f = b * sin(c);
  return vec3(d, e, f);
}

// 亮度曲线
vec4 applyCurve(vec4 b, float c) {
  float a = getLuminance(b);
  if (a < 1e-6) return b;
  a = clamp(a, 0.0, 1.0);
  float d = pow(2.0, c), e = 1.0 - pow(1.0 - a, d), f = e / a;
  b.rgb *= f;
  return b;
}

// 曝光
vec4 applyExposure(vec4 a, float b) {
  vec3 c = a.rgb;
  float d = pow(2.0, b);
  c *= d;
  return vec4(c, a.a);
}

// 亮度
vec4 applyBrightness(vec4 a, float b) {
  b *= 2.5;
  if (b < 0.0) {
    float c = max(b, -1.333);
    a = applyCurve(a, c);
    a = b < -1.333 ? applyExposure(a, b + 1.333) : a;
  } else {
    a = applyCurve(a, b);
  }
  return a;
}

// OKLab 饱和度缩放
vec3 scaleChroma(vec3 a, float b) {
  a.y *= b;
  a.z *= b;
  return a;
}

// 饱和度
vec4 applySaturation(vec4 a, float b) {
  vec3 c = linearToOklab(a.rgb);
  float d = remap(b, -1.0, 1.0, 0.0, 2.0);
  vec3 e = scaleChroma(c, d);
  return vec4(oklabToLinear(e), a.a);
}

// 色相插值结构
struct HueInterp {
  vec2 s;
  float t;
};

HueInterp getHueInterp(float a, int f) {
  a = mod(a, 6.283185);
  float b = 6.283185 / float(f);
  float c = floor(a / b);
  float d = mod(c + 1.0, float(f));
  float g = b * c, e = b * d;
  if (d == 0.0) e += 6.283185;
  float i;
  if (d == 0.0 && a > e) i = (a - e) / (g - e + 6.283185);
  else i = (a - g) / (e - g);
  HueInterp h;
  h.s = vec2(c, d);
  h.t = i;
  return h;
}

// LUT 坐标计算
vec2 getLutCoord(int a) {
  vec2 c = vec2(float(a) + 0.5, 0.5);
  vec2 d = vec2(float(r), 1.0);
  return c / d;
}

// 从 LUT 读取调整参数
vec3 sampleLut(int c) {
  vec3 d = texture2D(K, getLutCoord(c)).xyz;
  // 解码: [0, 0.784314] -> [-1, 1]
  d = remapVec3(d, vec3(0.0), vec3(0.784314), vec3(-1.0), vec3(1.0));
  // 色相偏移: 转换为弧度
  d.z = float(c) / float(r) * 6.283185 + d.z * 3.141593;
  return d;
}

// 应用颜色调整
vec3 applyColorAdjust(vec3 k) {
  vec3 a = oklabToPolar(k);
  HueInterp b = getHueInterp(a.z, r);
  
  int n = int(b.s.x), q = int(b.s.y);
  vec3 f = sampleLut(n), g = sampleLut(q);
  
  vec3 v = vec3(a.xy, f.z), o = vec3(a.xy, g.z);
  vec3 p = mix(polarToOklab(v), polarToOklab(o), b.t);
  vec3 c = oklabToLinear(p);
  
  vec3 h = mix(f, g, b.t);
  
  float i = smoothstep(0.0, L, a.y);
  float ba = h.x * i;
  c = applyBrightness(vec4(c, 1.0), ba).xyz;
  
  float ca = h.y * i;
  c = applySaturation(vec4(c, 1.0), ca).xyz;
  
  return c;
}

void main() {
  vec4 a = texture2D(J, vTexCoord);
  vec3 b = srgbToLinear(a.xyz);
  vec3 d = linearToOklab(b);
  
  b = applyColorAdjust(d);
  vec4 e = gamutMap(vec4(b, a.a));
  gl_FragColor = vec4(linearToSrgb(e.xyz), a.a);
}
`;

// Pass 1: Y flip shader
const FLIP_SHADER = `
precision highp float;
uniform sampler2D uSource;
varying vec2 vTexCoord;

void main() {
  vec2 uv = vTexCoord;
  uv.y = 1.0 - uv.y;
  gl_FragColor = texture2D(uSource, uv);
}
`;

// Pass 2: Output shader (premultiplied alpha)
const OUTPUT_SHADER = `
precision highp float;
uniform sampler2D uSource;
varying vec2 vTexCoord;

void main() {
  gl_FragColor = texture2D(uSource, vTexCoord);
  gl_FragColor.rgb *= gl_FragColor.a;
}
`;

interface UseColorAdjustWebGLOptions {
  image: HTMLImageElement | null;
  peakColors: PeakColor[];
  adjustments: ColorAdjustments;
  satThreshold?: number;
}

interface WebGLState {
  gl: WebGLRenderingContext;
  colorAdjustProgram: WebGLProgram;
  flipProgram: WebGLProgram;
  outputProgram: WebGLProgram;
  sourceTexture: WebGLTexture;
  lutTexture: WebGLTexture;
  framebuffer1: WebGLFramebuffer;
  framebuffer2: WebGLFramebuffer;
  fbTexture1: WebGLTexture;
  fbTexture2: WebGLTexture;
  positionBuffer: WebGLBuffer;
  imageLoaded: boolean;
  imageWidth: number;
  imageHeight: number;
}

const DEFAULT_ADJUSTMENT: ColorAdjustment = {
  hue: 0,
  saturation: 0,
  lightness: 0,
};

const LUT_SIZE = 8; // 8 segments (0°, 45°, 90°, ...)
const TWO_PI = Math.PI * 2;

/**
 * Build 8-segment LUT from peakColors and adjustments
 * Each segment covers 45° of hue
 */
function buildLUTData(
  peakColors: PeakColor[],
  adjustments: ColorAdjustments
): Uint8Array {
  const data = new Uint8Array(LUT_SIZE * 4); // RGBA for 8 segments

  // Helper functions
  const clamp = (v: number, lo: number, hi: number) =>
    Math.max(lo, Math.min(hi, v));
  const wrapHue = (h: number) => {
    let x = h % TWO_PI;
    if (x < 0) x += TWO_PI;
    return x;
  };
  const hueDist = (h1: number, h2: number) => {
    const d = Math.abs(h1 - h2);
    return Math.min(d, TWO_PI - d);
  };
  const smoothstep = (edge0: number, edge1: number, x: number) => {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  };

  // For each of 8 segments
  for (let i = 0; i < LUT_SIZE; i++) {
    // LUT[i] covers hue range [i * 45°, (i+1) * 45°)
    // Use segment center for weight calculation to ensure symmetric adjustments
    const segmentHue = ((i + 0.5) / LUT_SIZE) * TWO_PI;

    let brightness = 0;
    let saturation = 0;
    let hueShift = 0;

    // Accumulate adjustments from each peakColor
    peakColors.forEach((color, index) => {
      const peak = color.peak;
      const adj = adjustments[index] ?? DEFAULT_ADJUSTMENT;
      if (adj.hue === 0 && adj.saturation === 0 && adj.lightness === 0) return;

      // Peak hue in radians
      const peakHue = wrapHue((color.hue * Math.PI) / 180);

      // Calculate half width (handle wrap-around)
      let rangeWidth: number;
      if (peak.right >= peak.left) {
        rangeWidth = ((peak.right - peak.left) * Math.PI) / 180;
      } else {
        rangeWidth = ((360 - peak.left + peak.right) * Math.PI) / 180;
      }

      const minHalfWidth = (22.5 * Math.PI) / 180;
      const halfWidth = Math.max(rangeWidth / 2, minHalfWidth);
      const feather = 0.3;
      const featherStart = halfWidth * (1 - feather);

      // Distance from segment center to peak center
      const dist = hueDist(segmentHue, peakHue);

      // Calculate weight using smoothstep
      const weight = 1 - smoothstep(featherStart, halfWidth, dist);

      if (weight <= 0) return;

      // Accumulate weighted adjustments
      hueShift += (adj.hue / 180) * weight; // Normalize to [-1, 1]
      saturation += adj.saturation * weight;
      brightness += adj.lightness * weight;
    });

    // Clamp to [-1, 1]
    brightness = clamp(brightness, -1, 1);
    saturation = clamp(saturation, -1, 1);
    hueShift = clamp(hueShift, -1, 1);

    // Encode to [0, 200] range (matching Canva's 0.784314 = 200/255)
    // [-1, 1] -> [0, 200]
    const encodeByte = (v: number) => Math.round(((v + 1) / 2) * 200);

    data[i * 4 + 0] = encodeByte(brightness); // R: brightness
    data[i * 4 + 1] = encodeByte(saturation); // G: saturation
    data[i * 4 + 2] = encodeByte(hueShift); // B: hue shift
    data[i * 4 + 3] = 255; // A
  }

  return data;
}

function createShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader compile error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function createProgram(
  gl: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string
): WebGLProgram | null {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

  if (!vertexShader || !fragmentShader) return null;

  const program = gl.createProgram();
  if (!program) return null;

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Program link error:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

function createFramebuffer(
  gl: WebGLRenderingContext,
  width: number,
  height: number
): { framebuffer: WebGLFramebuffer; texture: WebGLTexture } | null {
  const framebuffer = gl.createFramebuffer();
  const texture = gl.createTexture();

  if (!framebuffer || !texture) return null;

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    width,
    height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture,
    0
  );

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return { framebuffer, texture };
}

export interface ColorAdjustWebGLResult {
  canvasRef: (canvas: HTMLCanvasElement | null) => void;
  dimensions: { width: number; height: number } | null;
}

export function useColorAdjustWebGL({
  image,
  peakColors,
  adjustments,
  satThreshold = 0.1,
}: UseColorAdjustWebGLOptions): ColorAdjustWebGLResult {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<WebGLState | null>(null);
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  // Build LUT data
  const lutData = useMemo(
    () => buildLUTData(peakColors, adjustments),
    [peakColors, adjustments]
  );

  // Render function
  const render = useCallback(() => {
    const state = stateRef.current;
    const canvas = canvasRef.current;
    if (!state || !canvas || !state.imageLoaded) return;

    const {
      gl,
      colorAdjustProgram,
      flipProgram,
      outputProgram,
      sourceTexture,
      lutTexture,
      framebuffer1,
      framebuffer2,
      fbTexture1,
      fbTexture2,
      positionBuffer,
      imageWidth,
      imageHeight,
    } = state;

    // Update LUT texture
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, lutTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      LUT_SIZE,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      lutData
    );

    // === Pass 0: Color Adjustment ===
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer1);
    gl.viewport(0, 0, imageWidth, imageHeight);

    gl.useProgram(colorAdjustProgram);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
    gl.uniform1i(gl.getUniformLocation(colorAdjustProgram, "J"), 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, lutTexture);
    gl.uniform1i(gl.getUniformLocation(colorAdjustProgram, "K"), 1);

    gl.uniform1i(gl.getUniformLocation(colorAdjustProgram, "r"), LUT_SIZE);
    gl.uniform1f(gl.getUniformLocation(colorAdjustProgram, "L"), satThreshold);

    const aPos0 = gl.getAttribLocation(colorAdjustProgram, "aPosition");
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(aPos0);
    gl.vertexAttribPointer(aPos0, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // === Pass 1: Y Flip ===
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer2);
    gl.viewport(0, 0, imageWidth, imageHeight);

    gl.useProgram(flipProgram);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fbTexture1);
    gl.uniform1i(gl.getUniformLocation(flipProgram, "uSource"), 0);

    const aPos1 = gl.getAttribLocation(flipProgram, "aPosition");
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(aPos1);
    gl.vertexAttribPointer(aPos1, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // === Pass 2: Output to canvas ===
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);

    gl.useProgram(outputProgram);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fbTexture2);
    gl.uniform1i(gl.getUniformLocation(outputProgram, "uSource"), 0);

    const aPos2 = gl.getAttribLocation(outputProgram, "aPosition");
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(aPos2);
    gl.vertexAttribPointer(aPos2, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }, [lutData, satThreshold]);

  // Initialize WebGL when canvas is attached
  const setCanvasRef = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      // Cleanup previous state
      if (stateRef.current) {
        const s = stateRef.current;
        s.gl.deleteTexture(s.sourceTexture);
        s.gl.deleteTexture(s.lutTexture);
        s.gl.deleteTexture(s.fbTexture1);
        s.gl.deleteTexture(s.fbTexture2);
        s.gl.deleteFramebuffer(s.framebuffer1);
        s.gl.deleteFramebuffer(s.framebuffer2);
        s.gl.deleteBuffer(s.positionBuffer);
        s.gl.deleteProgram(s.colorAdjustProgram);
        s.gl.deleteProgram(s.flipProgram);
        s.gl.deleteProgram(s.outputProgram);
        stateRef.current = null;
      }

      canvasRef.current = canvas;

      if (!canvas || !image) {
        setDimensions(null);
        return;
      }

      const gl = canvas.getContext("webgl", {
        premultipliedAlpha: false,
        preserveDrawingBuffer: true,
      });

      if (!gl) {
        console.error("WebGL not supported");
        return;
      }

      // Create programs
      const colorAdjustProgram = createProgram(
        gl,
        VERTEX_SHADER,
        COLOR_ADJUST_SHADER
      );
      const flipProgram = createProgram(gl, VERTEX_SHADER, FLIP_SHADER);
      const outputProgram = createProgram(gl, VERTEX_SHADER, OUTPUT_SHADER);

      if (!colorAdjustProgram || !flipProgram || !outputProgram) {
        console.error("Failed to create shader programs");
        return;
      }

      // Create position buffer
      const positionBuffer = gl.createBuffer();
      if (!positionBuffer) return;

      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 3, -1, -1, 3]),
        gl.STATIC_DRAW
      );

      // Create textures
      const sourceTexture = gl.createTexture();
      const lutTexture = gl.createTexture();

      if (!sourceTexture || !lutTexture) return;

      // Use image directly (already loaded)
      const w = image.width;
      const h = image.height;

      canvas.width = w;
      canvas.height = h;
      setDimensions({ width: w, height: h });

      // Create framebuffers
      const fb1 = createFramebuffer(gl, w, h);
      const fb2 = createFramebuffer(gl, w, h);

      if (!fb1 || !fb2) return;

      // Upload source texture
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        image
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      // Initialize LUT texture
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, lutTexture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        LUT_SIZE,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        lutData
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      stateRef.current = {
        gl,
        colorAdjustProgram,
        flipProgram,
        outputProgram,
        sourceTexture,
        lutTexture,
        framebuffer1: fb1.framebuffer,
        framebuffer2: fb2.framebuffer,
        fbTexture1: fb1.texture,
        fbTexture2: fb2.texture,
        positionBuffer,
        imageLoaded: true,
        imageWidth: w,
        imageHeight: h,
      };

      // Initial render
      render();
    },
    // Only depend on image - lutData updates are handled by render()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [image]
  );

  // Re-render when render function changes (which depends on lutData and satThreshold)
  useEffect(() => {
    render();
  }, [render]);

  return {
    canvasRef: setCanvasRef,
    dimensions,
  };
}

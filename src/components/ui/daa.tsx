"use client";

/**
 * ShaderBackground / DAA — Animated WebGL "Silk" Gradient Background
 *
 * A native WebGL implementation of a flowing, organic silk-like gradient
 * that creates warm, atmospheric illumination. No Three.js, no R3F —
 * pure WebGL2 with custom vertex/fragment shaders.
 *
 * Features:
 * - Warm copper/orange/yellow color palette (THE-CRUNCH brand aligned)
 * - Perlin noise-based organic flow
 * - Mouse/touch interaction subtly influences flow direction
 * - prefers-reduced-motion support (static fallback)
 * - WebGL unsupported fallback (CSS gradient)
 *
 * Props:
 * - className: Additional CSS classes
 * - fallbackColor: CSS color for WebGL unsupported/reduced motion (default: #1A1A1A)
 */
import * as React from "react";
import { cn } from "@/lib/utils";

export interface ShaderBackgroundProps {
  className?: string;
  fallbackColor?: string;
}

// Vertex Shader - Fullscreen quad with UV coordinates
const VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 a_position;
out vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// Fragment Shader - Silk gradient with Perlin noise flow
const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_intensity;

// ──────────────────────────────────────────────────────────────────────────
// Perlin Noise Implementation (Classic Ken Perlin, optimized for GLSL)
// ──────────────────────────────────────────────────────────────────────────

vec4 permute(vec4 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

vec4 taylorInvSqrt(vec4 r) {
  return 1.79284291400159 - 0.85373472095314 * r;
}

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                      -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                 + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.y  = a0.y  * x12.x + h.y  * x12.y;
  g.z  = a0.z  * x12.z + h.z  * x12.w;
  return 130.0 * dot(m, g);
}

// ──────────────────────────────────────────────────────────────────────────
// Fractal Brownian Motion (fBm) - layered noise for organic detail
// ────────────────────────────────────────────────────────────────────────────
float fbm(vec2 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    value += amplitude * snoise(p * frequency);
    amplitude *= 0.5;
    frequency *= 2.0;
  }
  return value;
}

// ──────────────────────────────────────────────────────────────────────────
// Domain Warping - creates the flowing "silk" distortion
// ────────────────────────────────────────────────────────────────────────────
vec2 warp(vec2 p, float t) {
  vec2 q = vec2(
    fbm(p + vec2(t * 0.05, t * 0.03), 4),
    fbm(p + vec2(t * 0.07, t * 0.02), 4)
  );
  vec2 r = vec2(
    fbm(p + 4.0 * q + vec2(t * 0.04, t * 0.06), 4),
    fbm(p + 4.0 * q + vec2(t * 0.08, t * 0.01), 4)
  );
  return r;
}

// ──────────────────────────────────────────────────────────────────────────
// THE-CRUNCH Brand Palette - Warm Copper/Gold Silk Colors
// ────────────────────────────────────────────────────────────────────────────
vec3 palette(float t) {
  // Warm silk gradient stops - copper, amber, gold, cream
  vec3 c1 = vec3(0.72, 0.35, 0.18);  // Deep copper #B85A2E
  vec3 c2 = vec3(0.85, 0.52, 0.22);  // Warm amber #D98538
  vec3 c3 = vec3(0.92, 0.68, 0.30);  // Muted gold #EBAE4D
  vec3 c4 = vec3(0.98, 0.82, 0.55);  // Pale gold #FAD18C
  vec3 c5 = vec3(0.79, 0.66, 0.30);  // Aged brass #C9A84C (brand gold)
  vec3 c6 = vec3(0.60, 0.30, 0.12);  // Dark copper #994D1F

  float s = sin(t * 6.28318);
  float c = cos(t * 6.28318);

  // Smooth interpolation through palette
  vec3 col = mix(c1, c2, smoothstep(0.0, 0.2, t));
  col = mix(col, c3, smoothstep(0.2, 0.4, t));
  col = mix(col, c4, smoothstep(0.4, 0.6, t));
  col = mix(col, c5, smoothstep(0.6, 0.8, t));
  col = mix(col, c6, smoothstep(0.8, 1.0, t));
  col = mix(col, c1, smoothstep(0.8, 1.0, t));

  return col;
}

void main() {
  vec2 uv = v_uv;
  vec2 centered = (uv - 0.5) * 2.0;

  // Aspect correction
  centered.x *= u_resolution.x / u_resolution.y;

  // Mouse influence (subtle)
  vec2 mouseNorm = (u_mouse - 0.5) * 2.0;
  float mouseDist = length(centered - mouseNorm * 0.3);
  float mouseInfluence = smoothstep(0.8, 0.0, mouseDist) * 0.15;

  // Time-based flow
  float t = u_time * 0.15;

  // Primary warp - creates the silk folds
  vec2 warped = centered + warp(centered * 1.5 + vec2(t, t * 0.7), t) * 0.4;

  // Secondary warp - finer detail
  warped += warp(warped * 2.0 + vec2(t * 1.3, t * 0.9), t * 0.7) * 0.15;

  // Mouse distortion
  warped += mouseInfluence * normalize(centered - mouseNorm) * 0.3;

  // Sample color along warped coordinate
  float noiseVal = fbm(warped * 3.0, 5);
  float flow = sin(warped.y * 8.0 + t * 2.0 + noiseVal * 6.28318) * 0.5 + 0.5;

  // Silk highlight - bright streaks
  float highlight = pow(smoothstep(0.45, 0.55, flow), 8.0);
  float highlight2 = pow(smoothstep(0.3, 0.4, flow), 12.0);

  // Base color from palette
  float paletteIndex = fract(noiseVal + t * 0.08 + flow * 0.3);
  vec3 baseColor = palette(paletteIndex);

  // Add highlights
  vec3 color = baseColor * (0.6 + flow * 0.4);
  color += vec3(1.0, 0.85, 0.6) * highlight * 0.6 * u_intensity;
  color += vec3(1.0, 0.9, 0.7) * highlight2 * 0.3 * u_intensity;

  // Vignette - darken edges for depth
  float vignette = 1.0 - length(centered) * 0.35;
  vignette = smoothstep(0.0, 1.0, vignette);
  color *= vignette;

  // Subtle film grain
  float grain = (snoise(gl_FragCoord.xy * 0.01 + u_time * 10.0) * 0.5 + 0.5) * 0.02;
  color += grain;

  // Gamma correction
  color = pow(color, vec3(0.9));

  fragColor = vec4(color, 1.0);
}
`;

export function ShaderBackground({
  className,
  fallbackColor = "#1A1A1A",
}: ShaderBackgroundProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [webglSupported, setWebglSupported] = React.useState(true);
  const [reduceMotion, setReduceMotion] = React.useState(false);
  const [mousePos, setMousePos] = React.useState({ x: 0.5, y: 0.5 });
  const animationRef = React.useRef<number>(0);
  const startTimeRef = React.useRef<number>(performance.now());
  const glRef = React.useRef<WebGL2RenderingContext | null>(null);
  const programRef = React.useRef<WebGLProgram | null>(null);
  const uniformsRef = React.useRef<Record<string, WebGLUniformLocation>>({});

  // Detect prefers-reduced-motion
  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setReduceMotion(query.matches);
    read();
    query.addEventListener("change", read);
    return () => query.removeEventListener("change", read);
  }, []);

  // Initialize WebGL
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || reduceMotion) {
      setWebglSupported(false);
      return;
    }

    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });

    if (!gl) {
      setWebglSupported(false);
      return;
    }

    glRef.current = gl;

    // Compile shaders
    const compileShader = (type: number, source: string): WebGLShader => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader compile error:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        throw new Error("Shader compilation failed");
      }
      return shader;
    };

    try {
      const vs = compileShader(gl.VERTEX_SHADER, VERTEX_SHADER);
      const fs = compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);

      const program = gl.createProgram()!;
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error("Program link error:", gl.getProgramInfoLog(program));
        throw new Error("Program linking failed");
      }

      programRef.current = program;

      // Get uniform locations
      uniformsRef.current = {
        u_time: gl.getUniformLocation(program, "u_time")!,
        u_resolution: gl.getUniformLocation(program, "u_resolution")!,
        u_mouse: gl.getUniformLocation(program, "u_mouse")!,
        u_intensity: gl.getUniformLocation(program, "u_intensity")!,
      };

      // Create fullscreen quad
      const positions = new Float32Array([
        -1, -1,  1, -1,  -1, 1,
        -1,  1,  1, -1,   1, 1,
      ]);
      const buffer = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

      const vao = gl.createVertexArray()!;
      gl.bindVertexArray(vao);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      // Store VAO for cleanup
      (canvas as any).__ish_vao = vao;
      (canvas as any).__ish_buffer = buffer;

      gl.useProgram(program);
      gl.bindVertexArray(vao);

      // Handle resize
      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio, 2);
        canvas.width = canvas.clientWidth * dpr;
        canvas.height = canvas.clientHeight * dpr;
        gl.viewport(0, 0, canvas.width, canvas.height);
      };
      resize();
      window.addEventListener("resize", resize);

      // Animation loop
      const render = () => {
        if (!glRef.current || reduceMotion) return;
        requestAnimationFrame(render);

        const gl = glRef.current!;
        const program = programRef.current!;
        const uniforms = uniformsRef.current;

        const now = (performance.now() - startTimeRef.current) * 0.001;

        gl.useProgram(program);
        gl.uniform1f(uniforms.u_time, now);
        gl.uniform2f(uniforms.u_resolution, canvas.width, canvas.height);
        gl.uniform2f(uniforms.u_mouse, mousePos.x, mousePos.y);
        gl.uniform1f(uniforms.u_intensity, 1.0);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
      };

      animationRef.current = requestAnimationFrame(render);

      return () => {
        cancelAnimationFrame(animationRef.current);
        window.removeEventListener("resize", resize);
        if (gl) {
          const vao = (canvas as any).__ish_vao;
          const buffer = (canvas as any).__ish_buffer;
          if (vao) gl.deleteVertexArray(vao);
          if (buffer) gl.deleteBuffer(buffer);
          if (programRef.current) gl.deleteProgram(programRef.current);
        }
      };
    } catch (e) {
      console.error("WebGL initialization failed:", e);
      setWebglSupported(false);
    }
  }, [reduceMotion]);

  // Mouse move handler
  const handleMouseMove = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (reduceMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: (e.clientX - rect.left) / rect.width,
      y: 1 - (e.clientY - rect.top) / rect.height, // Flip Y for WebGL
    });
  }, [reduceMotion]);

  const handleMouseLeave = React.useCallback(() => {
    if (reduceMotion) return;
    setMousePos({ x: 0.5, y: 0.5 });
  }, [reduceMotion]);

  // Touch support
  const handleTouchMove = React.useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (reduceMotion) return;
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: (touch.clientX - rect.left) / rect.width,
      y: 1 - (touch.clientY - rect.top) / rect.height,
    });
  }, [reduceMotion]);

  // Render
  if (reduceMotion || !webglSupported) {
    return (
      <div
        className={cn(
          "absolute inset-0 pointer-events-none",
          className
        )}
        style={{
          background: `radial-gradient(ellipse 80% 60% at 50% 40%,
            rgba(201,168,76,0.15) 0%,
            rgba(184,149,58,0.1) 30%,
            rgba(26,26,26,1) 70%,
            ${fallbackColor} 100%)`,
        }}
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className={cn("relative w-full h-full overflow-hidden", className)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchMove={handleTouchMove}
      style={{ touchAction: "none" }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ display: "block" }}
        aria-hidden="true"
      />
    </div>
  );
}

export default ShaderBackground;
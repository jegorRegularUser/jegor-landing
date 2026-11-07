// Route C (спека §5): raw WebGL fullscreen-quad — порт артефакта архитектора
// C_raw_webgl.ts, логика не переписана. Никакого three/R3F: 1.9KB gzip.
// Ядро — shadergradient: Perlin displacement + 3 цвета smoothstep,
// u_mouse лерпится за CAD-курсором (общий pointermove).
const VERT = `attribute vec2 aPos;varying vec2 vUv;void main(){vUv=aPos*0.5+0.5;gl_Position=vec4(aPos,0.0,1.0);}`;

const NOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p){float f=0.0,a=0.5;for(int i=0;i<3;i++){f+=a*snoise(p);p*=2.02;a*=0.5;}return f;}
`;

const FRAG = `precision highp float;
uniform float uTime;uniform vec2 uMouse;uniform float uAmp;
uniform vec3 uC1;uniform vec3 uC2;uniform vec3 uC3;
varying vec2 vUv;
${NOISE}
void main(){
  vec2 focus=vUv+(uMouse-vUv)*0.35;
  float n=fbm(vec3(focus*1.6,uTime*0.12));
  float n2=fbm(vec3(focus*3.2+7.3,uTime*0.18));
  float h=n*uAmp+n2*0.35;
  vec3 c=mix(uC1,uC2,smoothstep(-0.4,0.5,h));
  c=mix(c,uC3,smoothstep(0.35,0.9,h));
  gl_FragColor=vec4(c,1.0);
}`;

export interface ShaderQuad {
  setPaused(v: boolean): void;
  dispose(): void;
}

export function mountShaderQuad(
  canvas: HTMLCanvasElement,
  colors: [string, string, string],
  staticFrame = false,
): ShaderQuad | null {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: true });
  if (!gl) return null;
  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = (n: string) => gl.getUniformLocation(prog, n);
  const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  gl.uniform3fv(U('uC1'), hex(colors[0]));
  gl.uniform3fv(U('uC2'), hex(colors[1]));
  gl.uniform3fv(U('uC3'), hex(colors[2]));
  const uTime = U('uTime');
  const uMouse = U('uMouse');
  const uAmp = U('uAmp');
  gl.uniform1f(uAmp, 1.45); // приёмка: градиент был темнее/плоское фолбэка
  const glCtx = gl;
  const mouse = [0.5, 0.5];
  let target = [0.5, 0.5];
  const onMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    target = [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height];
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  let dpr = Math.min(window.devicePixelRatio, 1.5);
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio, 1.5);
    const w = canvas.clientWidth | 0;
    const h = canvas.clientHeight | 0;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  resize();
  window.addEventListener('resize', resize);
  let raf = 0;
  let last = 0;
  let paused = false;
  function loop(t: number) {
    raf = requestAnimationFrame(loop);
    if (paused) return;
    if (t - last < 1000 / 30) return; // 30fps cap
    last = t;
    mouse[0] += (target[0] - mouse[0]) * 0.06;
    mouse[1] += (target[1] - mouse[1]) * 0.06;
    glCtx.uniform1f(uTime, t / 1000);
    glCtx.uniform2f(uMouse, mouse[0], mouse[1]);
    glCtx.drawArrays(glCtx.TRIANGLES, 0, 3);
  }
  raf = requestAnimationFrame(loop);
  if (staticFrame) {
    // reduced-motion: один статичный кадр (спека §5.4).
    paused = true;
    glCtx.uniform1f(uTime, 0);
    glCtx.uniform2f(uMouse, 0.5, 0.5);
    glCtx.drawArrays(glCtx.TRIANGLES, 0, 3);
  }
  return {
    setPaused(v: boolean) {
      paused = v;
    },
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', resize);
      gl.deleteProgram(prog);
      gl.deleteBuffer(buf);
    },
  };
}

/**
 * PS1-style render pipeline.
 *
 *   Pass 1: everything on layer 0 renders into a tiny render target (~270 px tall),
 *           upscaled with nearest filtering, then color-quantized with a Bayer dither.
 *   Pass 2: the skin and the tattoo gun (HI_RES_LAYER) render crisp at full resolution
 *           on top, so the player's linework stays readable.
 *
 * Pass 2 has no depth from pass 1, so anything that should be *in front of* the skin must
 * also live on HI_RES_LAYER. Scene layout keeps everything else behind the customer.
 */
import * as THREE from 'three';
import { HI_RES_LAYER } from './scene';

/** Shorter screen side, in low-res pixels. Lower = chunkier. */
const LOW_RES = 270;
/** Color levels per channel after quantization. */
const LEVELS = 24;

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform vec2 uRes;
  varying vec2 vUv;

  const float BAYER[16] = float[16](
    0.0, 8.0, 2.0, 10.0,
    12.0, 4.0, 14.0, 6.0,
    3.0, 11.0, 1.0, 9.0,
    15.0, 7.0, 13.0, 5.0
  );

  void main() {
    gl_FragColor = vec4(texture2D(tDiffuse, vUv).rgb, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    ivec2 p = ivec2(mod(floor(vUv * uRes), 4.0));
    float threshold = BAYER[p.x + p.y * 4] / 16.0 - 0.5;
    float levels = ${LEVELS.toFixed(1)};
    gl_FragColor.rgb = floor(gl_FragColor.rgb * levels + threshold + 0.5) / levels;
  }
`;

export class PS1Pipeline {
  private readonly target: THREE.WebGLRenderTarget;
  private readonly quadScene = new THREE.Scene();
  private readonly quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly material: THREE.ShaderMaterial;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly snapRes: { value: THREE.Vector2 },
  ) {
    this.target = new THREE.WebGLRenderTarget(4, 4, {
      type: THREE.HalfFloatType,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
    });
    this.material = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: this.target.texture }, uRes: { value: new THREE.Vector2(4, 4) } },
      vertexShader,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
    });
    this.quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material));
  }

  setSize(width: number, height: number): void {
    const scale = LOW_RES / Math.min(width, height);
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    this.target.setSize(w, h);
    this.material.uniforms.uRes.value.set(w, h);
    this.snapRes.value.set(w / 2, h / 2);
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    const r = this.renderer;

    // Pass 1: low-res world. Shadows are computed once here (they include both layers).
    camera.layers.set(0);
    r.shadowMap.autoUpdate = false;
    r.shadowMap.needsUpdate = true;
    r.setRenderTarget(this.target);
    r.render(scene, camera);
    r.setRenderTarget(null);
    r.render(this.quadScene, this.quadCamera);

    // Pass 2: crisp skin + gun over the top.
    camera.layers.set(HI_RES_LAYER);
    const bg = scene.background;
    scene.background = null;
    r.autoClear = false;
    r.clearDepth();
    r.render(scene, camera);
    r.autoClear = true;
    scene.background = bg;
    camera.layers.set(0);
  }
}

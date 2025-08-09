// Particle System Manager — volumetric mist + seeded palettes + true baseOpacity + per-particle fade-in/out
// ──────────────────────────────────────────────────────────────────────────────
// Public API (extended, backward compatible):
//   createParticleSystem(position, isDoor=false, isMist=false, seed=null)
//   updateParticleSystem(points)
//   startFadeOut(points)
//
// Fixes/Features:
// • Mist opacity breath (configurable), no harsh phase steps.
// • Mist fragment disc fix (no inverted ring).
// • Deterministic color palettes for doors/objects via optional `seed`.
// • `baseOpacity` actually scales mist via uGlobalAlpha (not double-applied).
// • NEW: Mist particles fade in/out individually on spawn/death (no pops).
//        Config: fadeInFrac, fadeOutFrac, fadeJitter.
//
// Usage example:
//   const doorPS = mgr.createParticleSystem(pos, true,  false, "door-42");
//   const objPS  = mgr.createParticleSystem(pos, false, false, 1337);
//   const fogPS  = mgr.createParticleSystem(pos, false, true);
//   fogPS.userData.preset.baseOpacity = 0.012; // truly dims the mist

import * as THREE from 'three';

export class ParticleSystemManager {
    /*────────────────────────── CONFIG / PRESETS ───────────────────────────*/
    _presets = {
        door: {
            particleCount: 280,
            // colourA/B act as fallbacks; palette overrides at runtime
            colourA: 0x008cff,
            colourB: 0x96faff,
            spawn: { inner: 20, outer: 50 },
            speed: { min: 0.4, max: 30.0 },
            gravity: 10.0,
            baseSize: 2.8,
            sizeJitter: 18,
            lifetime: { min: 3, max: 6 },
            spread: 10.5,
            upwardBias: 0.25,
            baseOpacity: 1.0,
            opacityVariation: 0.0,
            pointScale: 300
        },
        object: {
            particleCount: 50,
            colourA: 0xffb44e,
            colourB: 0xff6abf,
            spawn: { inner: 45, outer: 50 },
            speed: { min: 0.9, max: 1.4 },
            gravity: 9.8,
            baseSize: 12.0,
            sizeJitter: 10,
            lifetime: { min: 1, max: 20 },
            spread: 2.0,
            upwardBias: 1.0,
            baseOpacity: 1.0,
            opacityVariation: 0.0,
            pointScale: 300
        },
        mist: {
            // Your tuned airy fog
            particleCount: 600,
            colourA: 0xf5fbff,
            colourB: 0xe8f4ff,
            spawn: { inner: 120, outer: 520 },
            speed: { min: 0.007, max: 0.1 },
            gravity: 0.0,
            baseSize: 600.0,
            sizeJitter: 90,
            lifetime: { min: 55, max: 120 },
            spread: 0.18,
            upwardBias: 0.0,
            baseOpacity: 0.5,
            opacityVariation: 0.06,
            // Smooth breathing. Set breathHz=0 to disable.
            breathHz: 0.02,        // 0.02 Hz ≈ 50 s
            breathMin: 0.6,
            breathMax: 1.0,
            // Shader tuning
            softness: 0.75,        // 0..1 edge softness
            noiseScale: 3.0,       // sprite-space noise tiling
            noiseStrength: 0.7,    // alpha modulation by wisps
            wispSpeed: 0.07,       // noise animation speed
            wispFloor: 0.0,        // min contribution from wisps (0..1)
            midlifeBoost: 0.6,     // more opacity mid-life
            pointScale: 420,
            // NEW: per-particle spawn/death fades (fractions of lifetime)
            fadeInFrac: 0.18,      // 0..1 (e.g., 18% of life ramps in)
            fadeOutFrac: 0.24,     // 0..1 (e.g., last 24% ramps out)
            fadeJitter: 0.25       // 0..1 +/- variance per particle
        }
    };

    // Curated color PALETTES for deterministic selection (edit freely)
    _doorColorPairs = [
        [0x4fd1ff, 0x96faff], // azure → ice
        [0x6c63ff, 0xb39cff], // indigo → lavender
        [0x00f5a0, 0x00d9f5], // mint → aqua
        [0xff8a00, 0xffe29f], // amber → butter
        [0xff5ea8, 0x9e7bff], // rose → violet
        [0x50fa7b, 0x8be9fd], // neon green → cyan
        [0x00bcd4, 0x18ffff], // teal → light cyan
        [0xff4e50, 0xf9d423], // coral → golden
        [0x3ae374, 0xe0ff4f], // spring → lime
        [0x00c6ff, 0x0072ff]  // sky → deep blue
    ];

    _objectColorPairs = [
        [0xffb44e, 0xff6abf], // peach → pink
        [0xffc371, 0xf84d6a], // apricot → magenta-red
        [0x66ffa6, 0x2ee6ff], // mint → cyan
        [0xff9a9e, 0xfad0c4], // soft rose → blush
        [0x57e6e6, 0x9bf6ff], // aqua → pale cyan
        [0x9be15d, 0x00e3ae], // lime → sea
        [0xffc600, 0xff7a00], // yellow → orange
        [0xb993ff, 0x7bffb7], // lilac → seafoam
        [0xffd3a5, 0xfd6585], // sand → watermelon
        [0x00ffa3, 0xdc1fff]  // neon mint → electric purple
    ];

    /*────────────────────────────────────────────────────────────────────────*/
    constructor() {
        // Radial sprite (doors/objects use this; mist shader handles alpha itself)
        this.texture = this._makeSprite(64);

        // Easing LUT for nice pulses
        this._easeTable = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
            const t = i / 255;
            this._easeTable[i] = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        }
    }

    /*──────────────────────────── PUBLIC API ───────────────────────────────*/

    /**
     * Create a particle system.
     * @param {THREE.Vector3} position
     * @param {boolean} isDoor
     * @param {boolean} isMist
     * @param {string|number|null} seed  Optional seed for deterministic palette (doors/objects)
     */
    createParticleSystem(position, isDoor = false, isMist = false, seed = null) {
        const preset = isMist ? this._presets.mist : (isDoor ? this._presets.door : this._presets.object);
        const count = preset.particleCount;

        const positions  = new Float32Array(count * 3);
        const velocities = new Float32Array(count * 3);
        const sizeAttr   = new Float32Array(count);      // live size → GPU
        const baseSizes  = new Float32Array(count);      // CPU reference
        const colours    = new Float32Array(count * 3);  // used by door/object shader
        const lifetimes  = new Float32Array(count * 2);  // current,max
        const flicker    = new Float32Array(count * 2);  // freq,phase
        const seeds      = new Float32Array(count);      // mist: rotation/noise variation

        // Choose deterministic color pair for doors/objects
        let chosenA = preset.colourA;
        let chosenB = preset.colourB;
        if (!isMist) {
            const [a, b] = this._chooseColorPair(isDoor, seed);
            chosenA = a;
            chosenB = b;
        }

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;

            // Spawn in spherical shell (avoids dense center clump)
            const off = this._randomInShell(preset.spawn.inner, preset.spawn.outer);
            positions[i3]     = position.x + off.x;
            positions[i3 + 1] = position.y + off.y;
            positions[i3 + 2] = position.z + off.z;

            // Velocity
            const angle = Math.random() * Math.PI * 2;
            const speed = THREE.MathUtils.lerp(preset.speed.min, preset.speed.max, Math.random());
            if (isMist) {
                velocities[i3]     = (Math.random() - 0.5) * speed * 2;
                velocities[i3 + 1] = (Math.random() - 0.5) * speed * 2;
                velocities[i3 + 2] = (Math.random() - 0.5) * speed * 2;
            } else {
                velocities[i3]     = Math.cos(angle) * preset.spread * Math.random();
                velocities[i3 + 1] = speed * preset.upwardBias;
                velocities[i3 + 2] = Math.sin(angle) * preset.spread * Math.random();
            }

            // Size
            const s = preset.baseSize + Math.random() * preset.sizeJitter;
            baseSizes[i] = s;
            sizeAttr[i]  = s;

            // Lifetime
            lifetimes[i * 2]     = 0;
            lifetimes[i * 2 + 1] = THREE.MathUtils.lerp(preset.lifetime.min, preset.lifetime.max, Math.random());

            // Flicker / fade variance
            if (isMist) {
                flicker[i * 2]     = THREE.MathUtils.randFloat(0.3, 1.2);
                flicker[i * 2 + 1] = Math.random() * Math.PI * 2;
                seeds[i] = Math.random();
            } else {
                flicker[i * 2]     = THREE.MathUtils.randFloat(1.0, 3.0);
                flicker[i * 2 + 1] = Math.random() * Math.PI * 2;
                seeds[i] = 0.0;
            }

            // Color gets set during update for door/object; mist ignores it
            colours[i3] = colours[i3 + 1] = colours[i3 + 2] = 0;
        }

        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position',  new THREE.BufferAttribute(positions, 3));
        geom.setAttribute('velocity',  new THREE.BufferAttribute(velocities, 3));
        geom.setAttribute('size',      new THREE.BufferAttribute(sizeAttr, 1));
        geom.setAttribute('color',     new THREE.BufferAttribute(colours, 3));
        geom.setAttribute('lifetime',  new THREE.BufferAttribute(lifetimes, 2));
        geom.setAttribute('flicker',   new THREE.BufferAttribute(flicker, 2));
        geom.setAttribute('seed',      new THREE.BufferAttribute(seeds, 1));

        const material = this._buildMaterial(isMist, preset);
        const points = new THREE.Points(geom, material);
        points.matrixAutoUpdate = false;

        points.userData = {
            isDoor: !isMist && isDoor,
            isMist,
            preset,
            origin: position.clone(),
            time: 0,
            fadeOut: false,
            fadeStart: 0,
            baseSizes,
            // Store the chosen palette colors for this system (doors/objects)
            colourA: chosenA,
            colourB: chosenB
        };
        return points;
    }

    startFadeOut(ps) {
        ps.userData.fadeOut   = true;
        ps.userData.fadeStart = ps.userData.time;
    }

    updateParticleSystem(ps) {
        const { geometry: g, userData: d, material: m } = ps;
        const pos      = g.attributes.position.array;
        const vel      = g.attributes.velocity.array;
        const sizeAttr = g.attributes.size.array;
        const col      = g.attributes.color.array;
        const life     = g.attributes.lifetime.array;
        const flick    = g.attributes.flicker.array;
        const base     = d.baseSizes;

        const dt = 1 / 60;
        d.time += dt;

        // Shared uniforms
        if (m.uniforms.uTime)       m.uniforms.uTime.value = d.time;
        if (m.uniforms.uPointScale) m.uniforms.uPointScale.value = d.preset.pointScale || 300;

        // Smooth "breathing" opacity for mist (no discrete phases)
        let mistOpacityMultiplier = 1.0;
        if (d.isMist) {
            const hz  = (typeof d.preset.breathHz === 'number')  ? d.preset.breathHz  : 0.02;
            const mn  = (typeof d.preset.breathMin === 'number') ? d.preset.breathMin : 0.6;
            const mx  = (typeof d.preset.breathMax === 'number') ? d.preset.breathMax : 1.0;
            if (hz > 0) {
                const breath = 0.5 + 0.5 * Math.sin(2 * Math.PI * hz * d.time); // 0..1
                mistOpacityMultiplier = THREE.MathUtils.lerp(mn, mx, breath);
            }
        }

        // Per-system fade out on command (startFadeOut)
        const globalFade = d.fadeOut
            ? 1.0 - THREE.MathUtils.clamp((d.time - d.fadeStart) / 1.0, 0, 1)
            : 1.0;

        // Apply baseOpacity *only* to mist (so doors/objects aren't double-scaled)
        const baseAlpha = d.isMist ? (d.preset.baseOpacity ?? 1.0) : 1.0;
        if (m.uniforms.uGlobalAlpha) {
            m.uniforms.uGlobalAlpha.value = baseAlpha * globalFade * mistOpacityMultiplier;
        }

        const preset = d.preset;

        for (let i = 0; i < preset.particleCount; i++) {
            const i3 = i * 3;
            const li = i * 2;

            // Lifetime / Respawn
            life[li] += dt;
            if (life[li] >= life[li + 1]) {
                const off = this._randomInShell(preset.spawn.inner, preset.spawn.outer);
                pos[i3]     = d.origin.x + off.x;
                pos[i3 + 1] = d.origin.y + off.y;
                pos[i3 + 2] = d.origin.z + off.z;

                if (d.isMist) {
                    const speed = THREE.MathUtils.lerp(preset.speed.min, preset.speed.max, Math.random());
                    vel[i3]     = (Math.random() - 0.5) * speed * 2;
                    vel[i3 + 1] = (Math.random() - 0.5) * speed * 2;
                    vel[i3 + 2] = (Math.random() - 0.5) * speed * 2;
                    g.attributes.seed.array[i] = Math.random();
                } else {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = THREE.MathUtils.lerp(preset.speed.min, preset.speed.max, Math.random());
                    vel[i3]     = Math.cos(angle) * preset.spread * Math.random();
                    vel[i3 + 1] = speed * preset.upwardBias;
                    vel[i3 + 2] = Math.sin(angle) * preset.spread * Math.random();
                    g.attributes.seed.array[i] = 0.0;
                }

                const s = preset.baseSize + Math.random() * preset.sizeJitter;
                base[i]     = s;
                sizeAttr[i] = s;

                life[li]     = 0;
                life[li + 1] = THREE.MathUtils.lerp(preset.lifetime.min, preset.lifetime.max, Math.random());

                if (d.isMist) {
                    flick[i * 2]     = THREE.MathUtils.randFloat(0.3, 1.2);
                    flick[i * 2 + 1] = Math.random() * Math.PI * 2;
                } else {
                    flick[i * 2]     = THREE.MathUtils.randFloat(1.0, 3.0);
                    flick[i * 2 + 1] = Math.random() * Math.PI * 2;
                }
            }

            // Physics
            pos[i3]     += vel[i3] * dt;
            pos[i3 + 1] += vel[i3 + 1] * dt;
            pos[i3 + 2] += vel[i3 + 2] * dt;

            if (d.isMist) {
                // Gentle random drift with strong damping
                vel[i3]     += (Math.random() - 0.5) * 0.0015;
                vel[i3 + 1] += (Math.random() - 0.5) * 0.0015;
                vel[i3 + 2] += (Math.random() - 0.5) * 0.0015;
                vel[i3]     *= 0.9995;
                vel[i3 + 1] *= 0.9995;
                vel[i3 + 2] *= 0.9995;
            } else {
                vel[i3 + 1] += preset.gravity * dt * 0.08;
                vel[i3]     += (Math.random() - 0.5) * 0.05;
                vel[i3 + 1] += (Math.random() - 0.5) * 0.05;
                vel[i3 + 2] += (Math.random() - 0.5) * 0.05;
            }

            // Visuals
            const prog  = life[li] / life[li + 1];
            const ease  = this._easeTable[Math.min(255, (prog * 255) | 0)];

            if (!d.isMist) {
                // Door/Object: color + pulse (use userData colours)
                const alphaEnv = Math.min(prog / 0.1, (1 - prog) / 0.1, 1);
                const flickMul = 1 - 0.25 * (1 - Math.sin((d.time + flick[i*2+1]) * flick[i*2] * Math.PI * 2)) * 0.5;
                const alpha = alphaEnv * flickMul * (preset.baseOpacity ?? 1.0);

                const colour = new THREE.Color(d.colourA).lerp(new THREE.Color(d.colourB), ease);

                // Premultiply color with per-particle alpha (uGlobalAlpha handles system fade)
                col[i3]     = colour.r * alpha;
                col[i3 + 1] = colour.g * alpha;
                col[i3 + 2] = colour.b * alpha;

                // Size pulse
                sizeAttr[i] = base[i] * (0.9 + 0.2 * Math.sin(ease * Math.PI));
            } else {
                // Mist: subtle breathing per particle
                const slowWave = Math.sin(d.time * 0.12 + i * 0.021) * 0.12;
                sizeAttr[i] = base[i] * (1.0 + slowWave);
            }
        }

        // Flag updates
        g.attributes.position.needsUpdate = true;
        g.attributes.velocity.needsUpdate = true;
        g.attributes.color.needsUpdate    = true;   // ignored by mist shader
        g.attributes.size.needsUpdate     = true;
        g.attributes.lifetime.needsUpdate = true;
        g.attributes.flicker.needsUpdate  = true;
        g.attributes.seed.needsUpdate     = true;
    }

    /*────────────────────────── SHADER HELPERS ───────────────────────────*/

    _buildMaterial(isMist = false, preset = this._presets.object) {
        if (isMist) {
            // Volumetric-ish fog via premultiplied alpha + FBM noise + per-particle fades
            return new THREE.ShaderMaterial({
                uniforms: {
                    uGlobalAlpha:   { value: 1.0 },
                    uTime:          { value: 0.0 },
                    uPointScale:    { value: preset.pointScale || 420 },
                    uColorA:        { value: new THREE.Color(preset.colourA) },
                    uColorB:        { value: new THREE.Color(preset.colourB) },
                    uSoftness:      { value: THREE.MathUtils.clamp(preset.softness ?? 0.75, 0.2, 0.95) },
                    uNoiseScale:    { value: preset.noiseScale ?? 3.0 },
                    uNoiseStrength: { value: THREE.MathUtils.clamp(preset.noiseStrength ?? 0.7, 0.0, 1.0) },
                    uWispSpeed:     { value: preset.wispSpeed ?? 0.02 },
                    uWispFloor:     { value: THREE.MathUtils.clamp(preset.wispFloor ?? 0.0, 0.0, 1.0) },
                    uMidlifeBoost:  { value: THREE.MathUtils.clamp(preset.midlifeBoost ?? 0.6, 0.0, 1.0) },
                    // NEW: spawn/death fades
                    uFadeInFrac:    { value: THREE.MathUtils.clamp(preset.fadeInFrac ?? 0.18, 0.0, 1.0) },
                    uFadeOutFrac:   { value: THREE.MathUtils.clamp(preset.fadeOutFrac ?? 0.24, 0.0, 1.0) },
                    uFadeJitter:    { value: THREE.MathUtils.clamp(preset.fadeJitter ?? 0.25, 0.0, 1.0) }
                },
                vertexShader: `
                    attribute float size;
                    attribute vec2  lifetime; // x=current, y=max
                    attribute float seed;     // 0..1
                    varying float vLife;
                    varying float vSeed;

                    uniform float uPointScale;

                    void main(){
                        vLife = clamp(lifetime.x / max(lifetime.y, 0.0001), 0.0, 1.0);
                        vSeed = seed;

                        vec4 mv = modelViewMatrix * vec4(position, 1.0);
                        gl_PointSize = size * (uPointScale / -mv.z);
                        gl_Position  = projectionMatrix * mv;
                    }`,
                fragmentShader: `
                    precision highp float;

                    varying float vLife;
                    varying float vSeed;

                    uniform float uTime;
                    uniform float uGlobalAlpha;
                    uniform float uSoftness;      // 0..1
                    uniform float uNoiseScale;
                    uniform float uNoiseStrength; // 0..1
                    uniform float uWispSpeed;
                    uniform float uWispFloor;     // 0..1
                    uniform float uMidlifeBoost;
                    uniform float uFadeInFrac;    // 0..1 fraction of life
                    uniform float uFadeOutFrac;   // 0..1 fraction of life
                    uniform float uFadeJitter;    // 0..1 variance
                    uniform vec3  uColorA;
                    uniform vec3  uColorB;

                    // --- tiny hash / noise / fbm ---
                    float hash(vec2 p){
                        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
                    }
                    float noise(vec2 x){
                        vec2 i = floor(x);
                        vec2 f = fract(x);
                        float a = hash(i);
                        float b = hash(i + vec2(1.0, 0.0));
                        float c = hash(i + vec2(0.0, 1.0));
                        float d = hash(i + vec2(1.0, 1.0));
                        vec2 u = f * f * (3.0 - 2.0 * f);
                        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
                    }
                    float fbm(vec2 x){
                        float v = 0.0;
                        float a = 0.5;
                        for (int i = 0; i < 4; i++){
                            v += a * noise(x);
                            x *= 2.0;
                            a *= 0.5;
                        }
                        return v;
                    }

                    void main(){
                        // UV in point space, per-particle rotation for variety
                        vec2 uv = gl_PointCoord - 0.5;
                        float ang = vSeed * 6.2831853; // 0..2π
                        mat2 R = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
                        uv = R * uv;

                        float r = length(uv);
                        if (r > 0.5) discard; // keep circular sprite

                        // Soft disc (no inverted rim)
                        float outer = 0.5;
                        float feather = clamp(uSoftness, 0.0, 0.95) * 0.5; // 0..0.475
                        float rim = smoothstep(outer - feather, outer, r); // 0 center → 1 edge
                        float disc = 1.0 - rim;                             // full center, soft edge

                        // Wispy modulation
                        float t = uTime * uWispSpeed;
                        float n = fbm(uv * uNoiseScale + vec2(vSeed * 13.37, vSeed * 19.91) + t);
                        float wisps = smoothstep(0.35, 1.0, n);

                        // Mid-life boost
                        float lifeBell = 1.0 - abs(vLife * 2.0 - 1.0); // 0 ends → 1 mid
                        float midBoost = mix(1.0, 1.0 + uMidlifeBoost, lifeBell);

                        // Per-particle fade-in/out envelope (prevents pops)
                        // small jitter so not all particles share the same fade timing
                        float jitter = fract(sin(vSeed * 951.135) * 43758.5453); // 0..1
                        float inFrac  = clamp(uFadeInFrac  * mix(1.0 - uFadeJitter, 1.0 + uFadeJitter, jitter), 0.0001, 1.0);
                        float outFrac = clamp(uFadeOutFrac * mix(1.0 - uFadeJitter, 1.0 + uFadeJitter, 1.0 - jitter), 0.0001, 1.0);

                        float lifeIn  = smoothstep(0.0, inFrac, vLife);
                        float lifeOut = 1.0 - smoothstep(1.0 - outFrac, 1.0, vLife);
                        float lifeEnv = lifeIn * lifeOut;

                        // Alpha (premultiplied later) — with wisps + life envelope
                        float alpha = disc
                                      * mix(uWispFloor, 1.0, wisps)
                                      * midBoost
                                      * lifeEnv
                                      * uGlobalAlpha;

                        // Reduce over-dense pixels a touch via noise mapping
                        alpha *= mix(1.0, uNoiseStrength, wisps);

                        // Subtle cool tint ramp
                        vec3 baseCol = mix(uColorA, uColorB, wisps * 0.5 + vLife * 0.2);

                        // Premultiplied
                        gl_FragColor = vec4(baseCol * alpha, alpha);
                    }`,
                transparent: true,
                depthWrite: false,
                depthTest: true,
                premultipliedAlpha: true,
                blending: THREE.NormalBlending,
                vertexColors: false // ignore geometry color; shader picks mist color
            });
        }

        // Doors/objects (additive glow, premultiplied)
        return new THREE.ShaderMaterial({
            uniforms: {
                uGlobalAlpha: { value: 1.0 },          // used for fadeOut only
                uMap:         { value: this.texture },
                uPointScale:  { value: preset.pointScale || 300 }
            },
            vertexShader: `
                attribute float size;
                varying   vec3  vColor;
                varying   float vAlpha;
                uniform   float uGlobalAlpha;
                uniform   float uPointScale;

                void main(){
                    #ifdef USE_COLOR
                        vColor = color;  // from BufferGeometry attribute (premultiplied in JS)
                    #else
                        vColor = vec3(1.0);
                    #endif
                    vAlpha = uGlobalAlpha; // global/system alpha (fadeOut)
                    vec4 mv  = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = size * (uPointScale / -mv.z);
                    gl_Position  = projectionMatrix * mv;
                }`,
            fragmentShader: `
                uniform sampler2D uMap;
                varying vec3  vColor;
                varying float vAlpha;

                void main(){
                    vec2 uv = gl_PointCoord - 0.5;
                    float r = length(uv);
                    if (r > 0.5) discard;

                    float falloff = 1.0 - smoothstep(0.0, 0.5, r);
                    vec4 tex = texture2D(uMap, gl_PointCoord);

                    // Premultiplied alpha
                    float a = vAlpha * tex.a * falloff;
                    gl_FragColor = vec4(vColor * tex.rgb * falloff, a);
                }`,
            transparent: true,
            depthWrite: false,
            depthTest: true,
            premultipliedAlpha: true,
            blending: THREE.AdditiveBlending,
            vertexColors: true
        });
    }

    /*──────────────────────── DETERMINISTIC PALETTE PICKER ─────────────────*/

    _chooseColorPair(isDoor, seed) {
        const palette = isDoor ? this._doorColorPairs : this._objectColorPairs;
        if (palette.length === 0) {
            // Fallback to preset if palette empty
            return isDoor
                ? [this._presets.door.colourA, this._presets.door.colourB]
                : [this._presets.object.colourA, this._presets.object.colourB];
        }
        if (seed === null || seed === undefined) {
            const idx = Math.floor(Math.random() * palette.length);
            return palette[idx];
        }
        const h = this._hashToUint(seed);
        const idx = h % palette.length;
        return palette[idx];
    }

    _hashToUint(seed) {
        // Accept number or string; produce a stable 32-bit unsigned int
        if (typeof seed === 'number' && Number.isFinite(seed)) {
            let x = seed | 0;
            // xorshift-ish scramble
            x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
            return (x >>> 0);
        }
        const str = String(seed);
        // FNV-1a 32-bit
        let h = 0x811c9dc5;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = (h * 0x01000193) >>> 0;
        }
        // extra avalanche
        h ^= h << 13; h ^= h >>> 7; h ^= h << 17;
        return (h >>> 0);
    }

    /*──────────────────────── UTILITY FUNCTIONS ─────────────────────────*/

    _makeSprite(size) {
        const canvas = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(size, size) : document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        const grd = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
        grd.addColorStop(0.0, 'rgba(255,255,255,1)');
        grd.addColorStop(0.7, 'rgba(255,255,255,0.35)');
        grd.addColorStop(1.0, 'rgba(255,255,255,0)');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, size, size);
        const tex = new THREE.CanvasTexture(canvas);
        tex.anisotropy = 4;
        tex.magFilter = THREE.LinearFilter;
        tex.minFilter = THREE.LinearMipMapLinearFilter;
        return tex;
    }

    _randomInShell(rMin, rMax) {
        const u = Math.random();
        const v = Math.random();
        const theta = 2 * Math.PI * u;
        const phi   = Math.acos(2 * v - 1);
        const r = Math.cbrt(Math.random() * (rMax ** 3 - rMin ** 3) + rMin ** 3);
        return new THREE.Vector3(
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.sin(phi) * Math.sin(theta),
            r * Math.cos(phi)
        );
    }
}

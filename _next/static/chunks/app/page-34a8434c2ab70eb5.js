(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[974],{2680:(e,t,a)=>{"use strict";a.d(t,{PortfolioSite:()=>H});var s=a(5155),i=a(2115),o=a(8500),l=a.n(o),r=a(5269),n=a(9625),c=a(5911);let u=`
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`,d=`
  precision highp float;

  #define MAX_PLANES 32
  #define MAX_LINKS 32

  varying vec2 vUv;

  uniform vec2  uResolution;   // canvas size in px
  uniform vec2  uSize;         // resting plane size in px
  uniform float uRadius;       // resting corner radius in px

  // per-plane state, driven from JS
  uniform float uCount;
  uniform vec2  uPos[MAX_PLANES];    // centre in px, origin at screen centre
  uniform float uRot[MAX_PLANES];    // radians
  // xy = 0..1 per axis, z = brightness (1 = lit, 0 = black), w = which atlas
  // cell this plane wears. All three ride in here rather than in arrays of
  // their own because GLSL ES gives every element of a uniform array a full
  // vec4 row whatever it is declared as — zw were already being paid for and
  // thrown away. The cell is resolved on the CPU because it depends on where
  // the plane sits on the ring, not on its index, and working that out per
  // pixel in the loop below would be absurd.
  uniform vec4  uScale[MAX_PLANES];

  // honey threads between neighbours, driven from JS
  uniform float uLinkCount;
  uniform vec2  uLinkA[MAX_LINKS];
  uniform vec2  uLinkB[MAX_LINKS];
  // (radius at the ends, radius at the pinch, droop, fillet)
  uniform vec4  uLinkPar[MAX_LINKS];

  uniform float uK;            // smin blend strength in px
  uniform float uWobble;       // surface tension noise amount, px
  uniform float uTime;
  uniform vec3  uColor;
  uniform vec3  uPage;         // what is behind the ring, for the tag to read

  // All the artwork lives in one atlas: ESSL 1.00 cannot index an array of
  // samplers with a varying index, so a per-plane texture is not an option.
  uniform sampler2D uAtlas;
  uniform vec2  uGrid;         // atlas cells across, down
  uniform float uBlend;        // px over which neighbouring art crossfades
  uniform float uTextured;

  // --- ASCII particle opening ---------------------------------------------
  // Real glyphs rasterised into a tiny atlas for the intro assembly.
  uniform sampler2D uAsciiTex;
  uniform vec4 uIntro; // gather progress, cloud expansion, cell px, opacity
  uniform vec4 uCardParticles; // launch, reach px, cell px, opacity
  uniform vec2 uFocusParticlePos;
  uniform vec4 uFocusParticleBox; // half size, radius, rotation
  uniform vec4 uFocusParticles; // amount, reach px, cell px, opacity
  uniform vec2 uFocusParticleMotion; // flow phase, motion multiplier

  // --- pointer -------------------------------------------------------------
  // Nothing is ever drawn at the cursor. It only changes how the ring behaves
  // around it: the field goes soft, and a wake runs out through the surface.
  // Packed into vec4s for the same reason the link parameters are.
  uniform vec4 uMouse;  // cursor.xy px, presence 0..1, blend px added at it
  uniform vec4 uMelt;   // reach px, wake px, wake frequency, wake speed

  // --- the cursor tag ------------------------------------------------------
  // Drawn in this pass with everything else rather than as an element over the
  // canvas. That is what lets its label inspect the pixels it is sitting on and
  // invert against them, and it means the glass refracts the ring the same way
  // the lip does instead of having to sample it back out of a backdrop.
  uniform sampler2D uTagTex;  // the label; only its alpha is used, as a mask
  uniform vec4 uTag;   // centre.xy px, scale.xy — scale 0 is simply absent
  uniform vec4 uTagP;  // half width, half height, corner radius, refract px
  uniform vec4 uTagQ;  // frost, rim gain, unused, unused

  vec2 atlasUV(vec2 uv, float idx) {
    float col = mod(idx, uGrid.x);
    float row = floor(idx / uGrid.x);
    return (vec2(col, row) + uv) / uGrid;
  }

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  // --- glass lip -----------------------------------------------------------
  // A band along the top and bottom of the screen behaving like the rounded
  // edge of a thick glass sheet. Because the whole scene is evaluated from p,
  // warping p here refracts the planes and the honey together, with no second
  // pass and no render target.
  uniform float uBandTop;     // px
  uniform float uBandBottom;  // px
  uniform vec4  uGlass;       // refract px, squeeze, ripple px, ripple freq
  uniform float uFringe;      // px of chromatic split inside the band
  uniform float uSheen;       // lift applied across the lip

  // Warps p in place and returns how deep into the lip this pixel sits, 0..1.
  float glassBend(inout vec2 p) {
    float band = p.y > 0.0 ? uBandTop : uBandBottom;
    if (band <= 0.5) return 0.0;

    float dy = abs(p.y) - (uResolution.y * 0.5 - band);
    if (dy <= 0.0) return 0.0;

    float t = clamp(dy / band, 0.0, 1.0);
    // Circular profile: barely bends at the inner edge, falls away sharply at
    // the very edge, which is what reads as thickness rather than a gradient.
    float bend = 1.0 - sqrt(max(0.0, 1.0 - t * t));

    float s = sign(p.y);
    // Sampling back toward centre throws content outward, so the image
    // stretches forward into the lip and swells as it reaches the edge.
    // Both terms are signed: negatives invert the lip and compress instead.
    p.y -= s * bend * (uGlass.x + sin(p.x * uGlass.w) * uGlass.z);
    p.x *= 1.0 - bend * uGlass.y;

    return bend;
  }

  // --- simplex noise -------------------------------------------------------
  // Copyright (C) 2011 Ashima Arts. All rights reserved.
  // Copyright (C) 2011-2016 by Stefan Gustavson (Classic noise and others)
  // Distributed under the MIT License. https://github.com/ashima/webgl-noise
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                       -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                            + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
                            dot(x12.zw, x12.zw)), 0.0);
    m = m * m; m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  // --- sdf helpers ---------------------------------------------------------
  float sdRoundBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
  }

  // The honey between two planes: a flat slab spanning centre to centre, as
  // wide as the edges it comes off and pinched in the middle, drooping under
  // its own weight.
  //
  // Deliberately not a capsule. A capsule has a round cross-section, so at
  // full merge it bulges out past the flat sides of the planes themselves.
  // This is swept as a box, so while the planes overlap it stays entirely
  // inside them and the silhouette reads as one flat card.
  float sdBridge(vec2 p, vec2 a, vec2 b, float rEnd, float rMid, float sag) {
    vec2 ba = b - a;
    float len = length(ba);
    if (len < 0.001) return 1e6;

    vec2 dir = ba / len;
    vec2 nrm = vec2(-dir.y, dir.x);

    vec2 q = p - (a + b) * 0.5;
    float along = dot(q, dir);
    float across = dot(q, nrm);

    float h = clamp(along / len + 0.5, 0.0, 1.0);
    float bell = sin(3.14159265 * h);           // 0 at the ends, 1 in the middle

    // droop, world -Y, resolved onto the across axis
    across += sag * bell * nrm.y;

    float taper = pow(1.0 - bell, 1.7);         // 1 at the ends, 0 in the middle
    float r = mix(rMid, rEnd, taper);

    // Ends are square and buried inside the planes, so they never show.
    return max(abs(along) - len * 0.5, abs(across) - r);
  }

  // The tag's own outline, scaled by whatever the pop animation is doing.
  float sdTag(vec2 p) {
    vec2 hs = uTagP.xy * abs(uTag.zw);
    return sdRoundBox(p - uTag.xy, hs, min(uTagP.z, min(hs.x, hs.y)));
  }

  // Its surface normal, by difference. A pill's normal is vertical along the
  // flat edges and radial round the ends, so nothing simpler than this gets the
  // refraction pointing the right way the whole way round.
  vec2 tagNormal(vec2 p) {
    vec2 e = vec2(1.0, 0.0);
    vec2 g = vec2(
      sdTag(p + e.xy) - sdTag(p - e.xy),
      sdTag(p + e.yx) - sdTag(p - e.yx)
    );
    float l = length(g);
    return l > 0.0001 ? g / l : vec2(0.0);
  }

  // smooth minimum — this is what makes the shapes read as liquid.
  // Note it also behaves as a plain min() when a is the 1e6 sentinel.
  float smin(float a, float b, float k) {
    if (k <= 0.0001) return min(a, b);
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
  }

  vec4 introParticles(vec2 p) {
    float t = clamp(uIntro.x, 0.0, 1.0);
    float gather = t * t * (3.0 - 2.0 * t);
    float cloudScale = mix(max(1.0, uIntro.y), 1.0, gather);

    // Work in the seed card's local frame so the opening follows the image as
    // the centre card begins its launch onto the ring.
    vec2 q = p - uPos[0];
    float a = uRot[0];
    float ca = cos(a), sa = sin(a);
    q = vec2(q.x * ca + q.y * sa, -q.x * sa + q.y * ca);

    vec2 target = q / cloudScale;
    vec2 halfSize = max(uSize * 0.5, vec2(1.0));
    vec2 normalised = target / halfSize;
    float diamondD = abs(normalised.x) + abs(normalised.y) - 1.0;
    float boxD = max(abs(normalised.x), abs(normalised.y)) - 1.0;
    float shapeMorph = smoothstep(0.35, 0.92, gather);
    float shapeD = mix(diamondD, boxD, shapeMorph);
    if (shapeD > 0.0) return vec4(0.0);

    float cell = max(uIntro.z, 5.0);
    float radius = max(length(q), 1.0);
    float ripple = sin(
      uTime * 1.4 + (abs(q.x) + abs(q.y)) * 0.018
    );
    vec2 current = q +
      (q / radius) * ripple * cell * 0.38 * (1.0 - gather);
    vec2 gridP = current / cell;
    vec2 mirrored = abs(gridP);
    vec2 tile = floor(mirrored);
    vec2 glyphUv = fract(mirrored);
    float seed = hash21(tile + 71.19);

    vec2 imageUv = target / uSize + 0.5;
    imageUv.y = 1.0 - imageUv.y;
    imageUv = clamp(imageUv, 0.004, 0.996);
    vec3 art = uTextured > 0.5
      ? texture2D(uAtlas, atlasUV(imageUv, uScale[0].w)).rgb
      : uColor;
    float luminance = dot(art, vec3(0.2126, 0.7152, 0.0722));

    float imageInfluence = smoothstep(0.28, 0.88, gather);
    float density = mix(0.30, 0.90, gather);
    float present = step(seed, density);
    float glyphBase = 3.0 + seed * 2.0;
    float glyphImage =
      (1.0 - luminance) * 4.8 + gather * 1.35 + seed * 0.8;
    float glyph = floor(clamp(
      mix(glyphBase, glyphImage, imageInfluence),
      0.0, 6.0
    ));
    vec2 atlasP = vec2((glyph + glyphUv.x) / 7.0, glyphUv.y);
    float mask = texture2D(uAsciiTex, atlasP).a;

    float born = smoothstep(0.0, 0.09, t);
    float handoff = 1.0 - smoothstep(0.58, 0.96, t);
    float pulse = 0.82 + 0.18 * sin(uTime * 3.2 + seed * 6.2831853);
    float cloudEdge = 1.0 - smoothstep(-0.16, 0.0, shapeD);
    float alpha =
      mask * present * born * handoff * pulse * cloudEdge * uIntro.w;

    // Keep pale source pixels legible on the paper field without flattening
    // the image back to monochrome.
    vec3 particle = mix(uColor, mix(uColor, art, 0.68), imageInfluence);
    return vec4(particle, alpha);
  }

  vec4 singleCardParticles(vec2 p) {
    float gather = clamp(uIntro.x, 0.0, 1.0);
    float launch = clamp(uCardParticles.x, 0.0, 1.0);
    float enter = smoothstep(0.52, 0.94, gather);
    float leave = smoothstep(0.04, 0.76, launch);
    float life = enter * (1.0 - leave);
    if (life <= 0.001) return vec4(0.0);

    // The field belongs only to the seed card. It rotates and contracts with
    // that card, then dies before the fan starts opening into a ring.
    vec2 q = p - uPos[0];
    float a = uRot[0];
    float ca = cos(a), sa = sin(a);
    q = vec2(q.x * ca + q.y * sa, -q.x * sa + q.y * ca);

    vec2 seedScale = max(uScale[0].xy, vec2(0.08));
    vec2 halfSize = max(uSize * 0.5 * seedScale, vec2(1.0));
    float cardD = sdRoundBox(q, halfSize, min(uRadius, halfSize.y));
    float reach = max(uCardParticles.y, 8.0);

    // A four-axis diamond holds the particles behind the card instead of
    // allowing a circular fog. The inner cutout keeps the photograph crisp.
    vec2 outerHalf = halfSize + vec2(reach * 1.35, reach);
    float diamondD =
      abs(q.x / outerHalf.x) + abs(q.y / outerHalf.y) - 1.0;
    float envelope = 1.0 - smoothstep(-0.10, 0.0, diamondD);
    float outside = smoothstep(1.5, 5.0, cardD);
    float falloff = 1.0 - smoothstep(0.0, reach, cardD);
    float field = envelope * outside * pow(max(falloff, 0.0), 0.72);
    if (field <= 0.001) return vec4(0.0);

    float cell = max(uCardParticles.z, 5.0);
    float radius = max(length(q), 1.0);
    vec2 direction = q / radius;

    // Positive travel pulls mirrored rows inward. The sign reverses on exit,
    // so the same glyphs visibly peel back out through the four diamond tips.
    float travel = enter * 2.2 - leave * 5.0 + uTime * 0.16 * life;
    vec2 particleP = q + direction * cell * travel;
    vec2 gridP = abs(particleP / cell);
    vec2 tile = floor(gridP);
    vec2 glyphUv = fract(gridP);
    float seed = hash21(tile + 143.57);

    float density = mix(0.12, 0.66, enter) *
                    mix(0.62, 1.0, pow(max(falloff, 0.0), 0.55));
    float present = step(seed, density);
    float glyph = floor(clamp(
      falloff * 5.2 + seed * 1.45,
      0.0, 6.0
    ));
    vec2 atlasP = vec2((glyph + glyphUv.x) / 7.0, glyphUv.y);
    float mask = texture2D(uAsciiTex, atlasP).a;

    float phase = hash21(tile + 29.31) * 6.2831853;
    float pulse = 0.76 + 0.24 * sin(uTime * 3.0 + phase);
    float alpha =
      mask * present * field * life * pulse * uCardParticles.w;
    return vec4(uColor, alpha);
  }

  vec4 hoveredCardParticles(vec2 p) {
    float amount = clamp(uFocusParticles.x, 0.0, 1.0);
    if (amount <= 0.001) return vec4(0.0);

    vec2 q = p - uFocusParticlePos;
    float a = uFocusParticleBox.w;
    float ca = cos(a), sa = sin(a);
    q = vec2(q.x * ca + q.y * sa, -q.x * sa + q.y * ca);

    vec2 halfSize = max(uFocusParticleBox.xy, vec2(1.0));
    float cardD = sdRoundBox(q, halfSize, uFocusParticleBox.z);
    float reach = max(uFocusParticles.y, 8.0);

    // Restore the original loose shadow field: distance from the rounded card
    // controls density, with no geometric envelope and no mirrored quadrants.
    float outside = smoothstep(1.5, 5.0, cardD);
    float falloff = 1.0 - smoothstep(0.0, reach, cardD);
    float field = outside * pow(max(falloff, 0.0), 1.25);
    if (field <= 0.001) return vec4(0.0);

    float cell = max(uFocusParticles.z, 5.0);
    float radius = max(length(q), 1.0);
    vec2 direction = q / radius;
    float travel =
      (uFocusParticleMotion.x + amount * 3.6) * uFocusParticleMotion.y;
    vec2 drift = vec2(
      uTime * 0.45 * cell,
      sin(uTime * 1.7 + q.x * 0.013) * cell * 0.34
    ) * uFocusParticleMotion.y;
    vec2 particleP = q + direction * cell * travel + drift;
    vec2 gridP = particleP / cell;
    vec2 tile = floor(gridP);
    vec2 glyphUv = fract(gridP);
    float seed = hash21(tile + 223.41);

    float density = mix(0.10, 0.76, pow(max(falloff, 0.0), 0.72)) *
                    mix(0.28, 1.0, amount);
    float present = step(seed, density);
    float glyph = floor(clamp(
      falloff * 6.35 + (seed - 0.5) * 1.35,
      0.0, 6.0
    ));
    vec2 atlasP = vec2((glyph + glyphUv.x) / 7.0, glyphUv.y);
    float mask = texture2D(uAsciiTex, atlasP).a;

    float phase = hash21(tile + 47.13) * 6.2831853;
    float movingPulse = 0.74 + 0.26 * sin(uTime * 3.2 + phase);
    float pulse = mix(1.0, movingPulse, uFocusParticleMotion.y);
    float alpha =
      mask * present * field * amount * pulse * uFocusParticles.w;
    return vec4(uColor, alpha);
  }

  void main() {
    // Screen position, kept unbent: the tag is pinned to the cursor, so it is
    // placed and drawn here rather than in the lip's warped space.
    vec2 ps = (vUv - 0.5) * uResolution;

    vec2 p = ps;
    float bend = glassBend(p);

    // The tag refracts whatever is under it, so its warp has to be applied to
    // the sampling position before the field is read — the same order the lip
    // works in. Flat through the middle, bending hard at the rim, which is what
    // reads as a thickness of glass rather than a smear.
    float dTag = sdTag(ps);
    float tagOn = min(abs(uTag.z), abs(uTag.w));
    if (tagOn > 0.001 && dTag < 0.0 && uTagP.w > 0.0) {
      float depth = clamp(-dTag / max(uTagP.y * abs(uTag.w), 1.0), 0.0, 1.0);
      float t = 1.0 - depth;
      p += tagNormal(ps) * (1.0 - sqrt(max(0.0, 1.0 - t * t))) * uTagP.w;
    }

    // Read after the bend, so the cursor acts in the same warped space as the
    // ring: dragged into the lip, its influence is refracted with everything
    // else rather than sitting flat on top of it.
    float toMouse = length(p - uMouse.xy);

    // Blend strength is lifted in a halo around the cursor, so the ring goes
    // soft exactly where it is being touched and stays crisp everywhere else.
    // Resolved once per pixel rather than per plane: it costs one length().
    float k = uK;
    if (uMouse.z > 0.001) {
      float t = 1.0 - smoothstep(0.0, max(uMelt.x, 1.0), toMouse);
      k += uMouse.w * uMouse.z * t * t;
    }

    float d = 1e6;

    // The two planes nearest this pixel, tracked alongside the field so the
    // colour can be resolved without a second pass. In the goo between two
    // planes both are close, which is exactly where the crossfade belongs.
    float d0 = 1e6, d1 = 1e6;
    vec2 uv0 = vec2(0.5), uv1 = vec2(0.5);
    float im0 = 0.0, im1 = 0.0;
    float dm0 = 1.0, dm1 = 1.0;

    float halfSpan = length(uSize) * 0.5;

    for (int i = 0; i < MAX_PLANES; i++) {
      if (float(i) >= uCount) break;

      vec4 st = uScale[i];
      vec2 sc = st.xy;
      float grown = max(sc.x, sc.y);
      if (grown <= 0.0001) continue;

      vec2 q = p - uPos[i];
      // Anything further out than this cannot affect the surface, so it can be
      // skipped outright — this is what keeps 32 planes affordable. Scaled by
      // the plane rather than fixed, because a plane swollen under the cursor
      // reaches further than its resting size, as does the melt around it.
      float cull = halfSpan * grown + k + uWobble + 8.0;
      if (dot(q, q) > cull * cull) continue;

      // into the plane's local frame
      float a  = uRot[i];
      float ca = cos(a), sa = sin(a);
      q = vec2(q.x * ca + q.y * sa, -q.x * sa + q.y * ca);

      vec2 halfSize = max(uSize * 0.5 * sc, vec2(0.0001));

      // starts as a circle (r = half extent), relaxes into the rounded rect
      float rMax = min(halfSize.x, halfSize.y);
      float r = min(rMax, mix(rMax, uRadius, smoothstep(0.30, 1.0, min(sc.x, sc.y))));

      float di = sdRoundBox(q, halfSize, r);
      d = smin(d, di, k);

      // Local UV. Clamped, so the goo outside a plane carries that plane's
      // edge colour rather than repeating or sampling the next atlas cell.
      vec2 luv = q / (2.0 * halfSize) + 0.5;
      luv.y = 1.0 - luv.y;
      luv = clamp(luv, 0.004, 0.996);

      if (di < d0) {
        d1 = d0; uv1 = uv0; im1 = im0; dm1 = dm0;
        d0 = di; uv0 = luv; im0 = st.w; dm0 = st.z;
      } else if (di < d1) {
        d1 = di; uv1 = luv; im1 = st.w; dm1 = st.z;
      }
    }

    // Threads strung between neighbours as they pull apart.
    for (int i = 0; i < MAX_LINKS; i++) {
      if (float(i) >= uLinkCount) break;

      vec4 par = uLinkPar[i];
      // Radii are allowed to go negative: that lifts the bridge's field clear
      // of the surface so it fades out, rather than bottoming out at zero as a
      // half-covered hairline. Only cull once it is further out than the
      // antialiasing can reach.
      if (par.x <= -3.0) continue;

      vec2 a = uLinkA[i];
      vec2 b = uLinkB[i];
      vec2 mid = (a + b) * 0.5;
      float reach = length(b - a) * 0.5 + par.x + par.w + 8.0;
      if (dot(p - mid, p - mid) > reach * reach) continue;

      d = smin(d, sdBridge(p, a, b, par.x, par.y, par.z), par.w);
    }

    // Surface tension wobble, decays to zero so resting planes are dead flat.
    if (uWobble > 0.001) {
      float n = snoise(p * 0.012 + vec2(uTime * 0.22, uTime * -0.17));
      d += n * uWobble;
    }

    // A capillary wake off the cursor, amplitude driven by how fast it is
    // moving. Rings out from it and dies over the same reach the softening
    // uses, so a flick leaves a ripple in the surface that outlives the
    // movement that made it.
    if (uMelt.y > 0.001) {
      d += sin(toMouse * uMelt.z - uTime * uMelt.w)
         * uMelt.y * exp(-toMouse / max(uMelt.x, 1.0));
    }

    // Clamped, not just floored: the distance cull above leaves a step in the
    // field, and an unclamped fwidth across that step paints a half-opaque
    // outline along every cull boundary.
    float aa = clamp(fwidth(d), 0.5, 2.0);
    float alpha = 1.0 - smoothstep(-aa, aa, d);

    vec4 intro = vec4(0.0);
    if (uIntro.w > 0.001 && uIntro.x < 0.999) {
      intro = introParticles(p);
    }
    vec4 cardParticles = vec4(0.0);
    if (
      uCardParticles.w > 0.001 &&
      uIntro.x > 0.48 &&
      uCardParticles.x < 0.80
    ) {
      cardParticles = singleCardParticles(p);
    }
    vec4 focusParticles = vec4(0.0);
    if (uFocusParticles.x > 0.001) {
      focusParticles = hoveredCardParticles(p);
    }

    // The tag has to survive this: it can overhang the edge of a card, and
    // those pixels are its own even though the ring has nothing there.
    float taa = clamp(fwidth(dTag), 0.5, 2.0);
    float ta = tagOn > 0.001 ? 1.0 - smoothstep(-taa, taa, dTag) : 0.0;

    if (
      alpha <= 0.001 &&
      ta <= 0.001 &&
      focusParticles.a <= 0.001 &&
      cardParticles.a <= 0.001 &&
      intro.a <= 0.001
    ) discard;

    // Even mix where the two nearest planes are equidistant, resolving to
    // whichever is clearly nearer beyond uBlend. Both the art and the dim are
    // carried across on it, so neither can put a seam down the goo.
    float nearest = smoothstep(-uBlend, uBlend, d1 - d0);

    vec3 col = uColor;
    if (uTextured > 0.5) {
      vec3 c0, c1;

      // Uniform branch, so the derivatives the mip selection needs stay
      // defined. The offset is scaled by bend, so outside the lip the three
      // taps land on the same texel and there is no fringe.
      if (uFringe > 0.0) {
        vec2 fr = vec2(uFringe * bend / max(uSize.x, 1.0), 0.0);
        c0 = vec3(
          texture2D(uAtlas, atlasUV(uv0 + fr, im0)).r,
          texture2D(uAtlas, atlasUV(uv0, im0)).g,
          texture2D(uAtlas, atlasUV(uv0 - fr, im0)).b
        );
        c1 = vec3(
          texture2D(uAtlas, atlasUV(uv1 + fr, im1)).r,
          texture2D(uAtlas, atlasUV(uv1, im1)).g,
          texture2D(uAtlas, atlasUV(uv1 - fr, im1)).b
        );
      } else {
        c0 = texture2D(uAtlas, atlasUV(uv0, im0)).rgb;
        c1 = texture2D(uAtlas, atlasUV(uv1, im1)).rgb;
      }

      col = mix(c1, c0, nearest);
    }

    // Cards standing off the one being pointed at are turned down, so the
    // hovered card reads as the lit one. Untextured, uColor is already almost
    // black and there is nothing here to see — which is fine, that mode exists
    // to read the goo's silhouette.
    col *= mix(dm1, dm0, nearest);

    // A touch of lift where the lip is steepest, so the band reads as a
    // surface catching light rather than only a warp.
    col += bend * uSheen;

    // Composite both particle phases behind the photographic surface. This
    // keeps antialiased card edges clean instead of tinting them like an
    // outline, and prevents the field from following the completed ring.
    if (cardParticles.a > 0.001) {
      float combined = alpha + cardParticles.a * (1.0 - alpha);
      col = (col * alpha +
             cardParticles.rgb * cardParticles.a * (1.0 - alpha)) /
            max(combined, 0.0001);
      alpha = combined;
    }
    if (focusParticles.a > 0.001) {
      float combined = alpha + focusParticles.a * (1.0 - alpha);
      col = (col * alpha +
             focusParticles.rgb * focusParticles.a * (1.0 - alpha)) /
            max(combined, 0.0001);
      alpha = combined;
    }
    if (intro.a > 0.001) {
      float combined = alpha + intro.a * (1.0 - alpha);
      col = (col * alpha + intro.rgb * intro.a * (1.0 - alpha)) /
            max(combined, 0.0001);
      alpha = combined;
    }
    // --- the tag -------------------------------------------------------------
    if (ta > 0.001) {
        // Where the ring does not reach, the page is what shows through the
        // glass, so the label has something real to read there too.
        vec3 under = mix(uPage, col, alpha);
        vec3 glass = mix(under, vec3(1.0), uTagQ.x);

        // Rim: lit where it faces the light, dark where it turns away. Signing
        // it is what gives an edge that reads as thickness rather than as an
        // outline drawn on.
        float band = clamp(1.0 + dTag / max(uTagP.z, 1.0), 0.0, 1.0);
        glass += band * band * uTagQ.y *
                 dot(tagNormal(ps), vec2(-0.7071, 0.7071));

        // The label. Pure black or pure white, decided per pixel from what that
        // pixel is sitting on, so a glyph crossing a light edge onto a dark one
        // changes colour halfway across. A blend cannot do this — inverting a
        // mid grey returns a mid grey — and picking one colour for the whole
        // label cannot either.
        vec2 tuv = (ps - uTag.xy) / (uTagP.xy * 2.0 * abs(uTag.zw)) + 0.5;
        float m = texture2D(uTagTex, clamp(tuv, 0.0, 1.0)).a;
        float l = dot(glass, vec3(0.2126, 0.7152, 0.0722));
        // Narrow, not hard: a step here would alias along the boundary.
        glass = mix(glass, vec3(1.0 - smoothstep(0.46, 0.54, l)), m);

      col = mix(col, glass, ta);
      alpha = max(alpha, ta);
    }

    // Written straight through. The atlas is tagged NoColorSpace so sampling
    // returns the authored sRGB values, and this shader adds no output
    // encoding of its own — decoding on read without encoding on write is
    // what darkens everything.
    gl_FragColor = vec4(col, alpha);
  }
`,h=Array.from({length:15},(e,t)=>{let a=String(t+1).padStart(2,"0"),s=`work-${a}`;return{id:s,name:`作品 ${a}`,type:"VIDEO",year:"2026",poster:`/sites/showcase/works/${s}.jpg`,video:`https://keran-portfolio-videos-1346495263.cos.ap-guangzhou.myqcloud.com/${s}.mp4`,preview:`/sites/showcase/works/${s}-preview.mp4`,description:"",placeholder:!1}}),p=h.map(e=>({...e,file:e.poster.slice(1)})),m=p.map(e=>e.file),f=Math.round(512/1.5),g=["left","right"],v=e=>e?.firstElementChild?.children;function x(e,t,a){e&&(t>=1?(e.style.filter="none",e.style.opacity="1"):t<=0?(e.style.filter="none",e.style.opacity="0"):(e.style.filter=`blur(${Math.min(a/t-a,100)}px)`,e.style.opacity=`${Math.pow(t,.4)}`))}function y(e,t,a){let s={t:1},i=["",""],o=[!1,!1],l=()=>{let i=t[e];if(!i)return;let l=v(i.layers[0]),r=v(i.layers[1]),n=v(i.plain),c=s.t;for(let e=0;e<2;e++)o[e]?(x(l?.[e],1-c,a.nameBlur),x(r?.[e],c,a.nameBlur),n?.[e]&&(n[e].style.opacity="0")):(l?.[e]&&(l[e].style.opacity="0"),r?.[e]&&(r[e].style.opacity="0"),n?.[e]&&(n[e].style.opacity="1"));i.goo&&(i.goo.style.filter=c>=1?"none":`url(#name-goo) blur(${a.nameSoften}px)`)};return{m:s,set:r=>{let n=t[e];if(!n?.layers[0]||!n.layers[1]||!n.plain)return;c.Ay.killTweensOf(s),s.t=1,l();let u=[r[0]??"",r[1]??""];o=[u[0]!==i[0],u[1]!==i[1]];let d=v(n.layers[0]),h=v(n.layers[1]),p=v(n.plain);for(let e=0;e<2;e++)d?.[e]&&(d[e].textContent=i[e]),h?.[e]&&(h[e].textContent=u[e]),p?.[e]&&(p[e].textContent=u[e]);if(i=u,!o[0]&&!o[1]){s.t=1,l();return}s.t=0,l(),c.Ay.to(s,{t:1,duration:a.nameMorphTime,ease:a.nameEase,onUpdate:l})}}}let w=`
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`,b=`
  precision highp float;

  varying vec2 vUv;

  uniform sampler2D uTex;
  uniform float uReveal;
  uniform vec3  uColor;
  uniform float uOpacity;

  void main() {
    float gy = vUv.y + 1.0 - uReveal;
    if (gy > 1.0 || gy < 0.0) discard;

    float a = texture2D(uTex, vec2(vUv.x, gy)).a;
    if (a <= 0.001) discard;

    gl_FragColor = vec4(uColor, a * uOpacity);
  }
`,M=".:+x*#@",T=2*Math.PI,P=Math.PI/2,S=Math.PI/180,A=e=>e<0?0:e>1?1:e,k=e=>1-Math.pow(1-e,3),_=e=>e<.5?4*e*e*e:1-Math.pow(-2*e+2,3)/2,C=(e,t,a)=>{let s=A((a-e)/(t-e));return s*s*(3-2*s)},E=e=>0===e?0:e%2==1?(e+1)/2:-e/2,j=(e,t)=>1-Math.pow(1-t,60*e);function R({onOpen:e,onActive:t}){let a=(0,i.useRef)(null),o=(0,i.useRef)(null),l=(0,i.useRef)([]),h=(0,i.useRef)(null),v=(0,i.useRef)(null),x=(0,i.useRef)(null),F=(0,i.useRef)({left:{box:null,goo:null,layers:[],plain:null},right:{box:null,goo:null,layers:[],plain:null}});return(0,i.useEffect)(()=>{let s,i,R,I,O,q,z,N,L,U=a.current,B=o.current,D=h.current,W=!1,$={refWidth:1512,refHeight:870,fitHeight:0,minScale:.5,maxScale:1.75,narrowAt:0,narrowPlane:1.25,narrowRadius:1.3,narrowText:1.5,narrowPosX:-2.5,narrowEndScale:4.22,tightAt:0,tightRadius:.82,tightPosX:-3.5,tightSplit:.8,tightName:1.5,tightNameBottom:16,tightNameRight:16,tightMetaWidth:70,planeSize:90,count:p.length,ringRadius:340,seed:0,radial:!0,radius:6,textured:!0,blend:14,imageOffset:0,holdAfter:0,loaderChase:.18,loaderBottom:1,loaderOut:.45,stagger:.34,launchTime:1.95,spreadEase:"power2.out",spreadTime:3.6,stageAt:.7,spinTurns:1,spinTime:2.6,spinEase:"power2.inOut",spinDelay:0,posX:-2,posY:0,endScale:4.46,moveTime:2.2,moveEase:"power2.inOut",moveDelay:.2,scrollSpeed:.0022,damping:.94,maxSpeed:12,dragSpeed:1,snap:!0,snapTime:.8,snapFrom:1,pickTime:.55,pickEase:"power3.inOut",text:"SELECTED WORKS",textSize:41,textFont:"Showcase Sans",textWeight:400,textTracking:0,textColor:"#0a0a0a",textAt:.42,textTime:.95,textStagger:.015,textEase:"power4.out",textOut:!0,textOutAt:-.5,textOutTime:.7,textOutEase:"power2.in",metaLeft:5.5,metaRight:5.5,metaGapL:4.7,metaGapR:3.6,metaWidth:34,nameSize:24/1440*100,nameFont:"Showcase Sans",nameWeight:500,idxSize:16/1440*100,idxFont:"Showcase Sans",idxWeight:400,listSize:.9,nameMorphTime:1.2,nameEase:"circ.out",nameBlur:8.5,nameEdge:400,nameCut:.33,nameSoften:.35,glass:!0,bandTop:.08,bandBottom:.08,refract:60,squeeze:.05,ripple:5,rippleFreq:.02,fringe:1.5,sheen:.05,hover:!0,touchHold:.16,touchSlop:10,lag:.3,melt:34,meltReach:260,reach:1.7,swell:.09,pull:26,grab:.14,release:.06,web:.2,webReach:1.15,wave:4,waveFreq:.05,waveSpeed:7,sideScale:.035,sidePush:17,sideDim:.15,sideReach:2.4,focusParticles:!0,focusParticleFrom:1024,focusParticleReach:82,focusParticleCell:11,focusParticleOpacity:.58,focusParticleEnter:.16,focusParticleExit:.11,focusParticleDrift:.7,focusParticleOut:3.2,assemble:!0,assembleFrom:1024,assembleTime:1.55,assembleEase:"power3.inOut",assembleSpread:3.8,assembleCardScale:2.6,assembleCell:13,assembleOpacity:.96,assembleHaloReach:148,assembleHaloOpacity:.72,tagFrom:1024,tagText:"View",tagSize:14,tagWeight:500,tagArrow:14,tagGap:6,tagX:64,tagY:-38,tagFrost:.16,tagRim:.02,tagRefract:39.5,thread:1,thin:.4,pinch:.35,sag:6,dissolve:2.9,fillet:14,wobble:3,goo:35};U.clientWidth<=767&&($.launchTime=.6,$.spreadTime=1.2,$.spinTime=1.2,$.moveTime=.8,$.hover=!1,$.glass=!1);let G={progress:0,launch:0,spread:0,spin:0,shift:0},Y={restingGap:0,window:"",scale:1,band:"wide"};try{s=new n.JeP({antialias:!0,alpha:!0})}catch(e){console.error("[ring] could not create a WebGL context:",e);return}s.setPixelRatio(Math.min(window.devicePixelRatio,2)),U.appendChild(s.domElement);let X=new r.Z58,H=new r.qUd(-1,1,1,-1,-100,100),K=function(){let e=document.createElement("canvas");e.width=128*M.length,e.height=128;let t=e.getContext("2d");t.clearRect(0,0,e.width,e.height),t.fillStyle="#ffffff",t.font="700 84px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",t.textAlign="center",t.textBaseline="middle";for(let e=0;e<M.length;e++)t.fillText(M[e],128*e+64,65.28);let a=new r.GOR(e);return a.colorSpace=r.jf0,a.minFilter=r.k6q,a.magFilter=r.k6q,a.generateMipmaps=!1,a.needsUpdate=!0,a}(),Q=window.matchMedia("(prefers-reduced-motion: reduce)"),V={uResolution:{value:new r.I9Y(1,1)},uSize:{value:new r.I9Y(150,100)},uRadius:{value:$.radius},uCount:{value:$.count},uPos:{value:Array.from({length:32},()=>new r.I9Y)},uRot:{value:new Float32Array(32)},uScale:{value:Array.from({length:32},()=>new r.IUQ(0,0,1,0))},uLinkCount:{value:0},uLinkA:{value:Array.from({length:32},()=>new r.I9Y)},uLinkB:{value:Array.from({length:32},()=>new r.I9Y)},uLinkPar:{value:Array.from({length:32},()=>new r.IUQ)},uK:{value:$.goo},uWobble:{value:$.wobble},uTime:{value:0},uColor:{value:new r.Q1f("#0a0a0a")},uAtlas:{value:((i=new r.GYF(new Uint8Array([255,255,255,255]),1,1)).needsUpdate=!0,i)},uGrid:{value:new r.I9Y(1,1)},uBlend:{value:$.blend},uTextured:{value:0},uBandTop:{value:0},uBandBottom:{value:0},uGlass:{value:new r.IUQ},uFringe:{value:0},uSheen:{value:0},uMouse:{value:new r.IUQ},uMelt:{value:new r.IUQ},uAsciiTex:{value:K},uIntro:{value:new r.IUQ(1,1,12,0)},uCardParticles:{value:new r.IUQ(1,0,12,0)},uFocusParticlePos:{value:new r.I9Y},uFocusParticleBox:{value:new r.IUQ},uFocusParticles:{value:new r.IUQ},uFocusParticleMotion:{value:new r.I9Y},uTagTex:{value:new r.GYF(new Uint8Array([0,0,0,0]),1,1)},uTag:{value:new r.IUQ},uTagP:{value:new r.IUQ},uTagQ:{value:new r.IUQ},uPage:{value:new r.Q1f("#fafafa")}},J=new r.eaF(new r.bdM(1,1),new r.BKk({vertexShader:u,fragmentShader:d,uniforms:V,transparent:!0,depthWrite:!1}));J.renderOrder=10,X.add(J);let Z=new r.YJl;X.add(Z);let ee=(R=[],I=[],{build:()=>{O();let e=$.textSize,t=2*Math.min(window.devicePixelRatio,2),a=`${$.textWeight} ${e}px "${$.textFont}", ui-sans-serif, system-ui, sans-serif`,s=document.createElement("canvas").getContext("2d");s.font=a;let i=[...$.text],o=i.map(e=>s.measureText(e).width),l=$.textTracking*e,n=o.reduce((e,t)=>e+t,0)+l*(i.length-1),c=.25*e,u=1.3*e+2*c,d=-n/2;i.forEach((s,i)=>{let n=o[i];if(s.trim()){let i=n+2*c,o=document.createElement("canvas");o.width=Math.max(1,Math.ceil(i*t)),o.height=Math.max(1,Math.ceil(u*t));let l=o.getContext("2d");l.scale(t,t),l.font=a,l.textBaseline="alphabetic",l.fillStyle="#000",l.fillText(s,c,c+e);let h=new r.GOR(o);h.colorSpace=r.jf0,h.minFilter=r.k6q,h.magFilter=r.k6q,h.generateMipmaps=!1;let p=new r.BKk({vertexShader:w,fragmentShader:b,uniforms:{uTex:{value:h},uReveal:{value:0},uColor:{value:new r.Q1f($.textColor)},uOpacity:{value:1}},transparent:!0,depthTest:!1,depthWrite:!1}),m=new r.eaF(new r.bdM(1,1),p);m.scale.set(i,u,1),m.position.set(d+n/2,0,0),m.renderOrder=0,Z.add(m),R.push(p.uniforms.uReveal),I.push(p.uniforms.uOpacity)}d+=n+l})},dispose:O=()=>{for(let e of[...Z.children])Z.remove(e),e.geometry.dispose(),e.material.uniforms.uTex.value?.dispose(),e.material.dispose();R=[],I=[]},get chars(){return R},get fades(){return I}}),et=(q={sx:.5,sy:0},z=new Image,N=!1,L=null,{box:q,build:()=>{let e=2*Math.min(window.devicePixelRatio,2),t=document.createElement("canvas");t.width=Math.ceil(104*e),t.height=Math.ceil(40*e);let a=t.getContext("2d");a.scale(e,e),a.font=`${$.tagWeight} ${$.tagSize}px "${$.textFont}", ui-sans-serif, system-ui, sans-serif`,a.textBaseline="middle",a.fillStyle="#fff";let s=a.measureText($.tagText).width,i=(104-($.tagArrow+$.tagGap+s))*.5;if(a.fillText($.tagText,i+$.tagArrow+$.tagGap,20),N){let e=(40-$.tagArrow)*.5;a.drawImage(z,i,e,$.tagArrow,$.tagArrow)}L?.dispose(),(L=new r.GOR(t)).colorSpace=r.jf0,L.minFilter=r.k6q,L.magFilter=r.k6q,L.generateMipmaps=!1,V.uTagTex.value=L},show:e=>{c.Ay.killTweensOf(q),e?(c.Ay.to(q,{sx:1,duration:.62,ease:"elastic.out(1, 0.5)"}),c.Ay.to(q,{sy:1,duration:.74,ease:"elastic.out(1, 0.42)"})):c.Ay.to(q,{sx:.5,sy:0,duration:.28,ease:"power3.in"})},load:e=>{z.onload=()=>{N=!0,e?.()},z.src="/sites/showcase/arrow-top-right-svgrepo-com.svg"},dispose:()=>{c.Ay.killTweensOf(q),L?.dispose()}}),ea=function(e,t){let{groups:a,list:s,loader:i,cut:o,live:l}=e,r=y("left",a,t),n=y("right",a,t),u=()=>{o?.setAttribute("values",`1 0 0 0 0
       0 1 0 0 0
       0 0 1 0 0
       0 0 0 ${t.nameEdge} ${-t.nameEdge*t.nameCut}`)};return{show:e=>{let t=p[e];t&&(r.set([String(e+1).padStart(2,"0"),t.name]),n.set([t.type,t.year]),l&&(l.textContent=`${t.name}. ${t.type}, ${t.year}.`))},style:({textK:e,tight:o,viewW:l})=>{let r=t.nameSize*e*(o?t.tightName:1),n=`${r}vw`,c=`${t.idxSize*e}vw`,d=`"${t.nameFont}", ui-sans-serif, system-ui, sans-serif`,h=`"${t.idxFont}", ui-sans-serif, system-ui, sans-serif`,p=`${t.nameWeight}`,m=`${t.idxWeight}`,f=3*r;for(let e of g){let s=a[e];if(!s?.box)continue;let i="right"===e,u=o&&!i;if(o&&i){s.box.style.display="none";continue}if(s.box.style.display="",s.box.style.width=`${u?t.tightMetaWidth:t.metaWidth}vw`,s.box.style.height=`${f}vw`,u){let e=f*l/100,a=r*l/100;s.box.style.top="auto",s.box.style.left="auto",s.box.style.right=`${t.tightNameRight}px`,s.box.style.bottom=`${t.tightNameBottom+.5*a-.5*e}px`,s.box.style.transform="none"}else s.box.style.top="",s.box.style.bottom="",s.box.style.transform="",s.box.style.left=i?"auto":`${t.metaLeft}vw`,s.box.style.right=i?`${t.metaRight}vw`:"auto";for(let e of[...s.layers,s.plain]){if(!e)continue;e.style.justifyContent=u||i?"flex-end":"flex-start";let a=e.firstElementChild;a.style.gap=`${i?t.metaGapR:t.metaGapL}vw`;let[s,o]=a.children;s.style.display=u?"none":"",s.style.fontFamily=i?d:h,s.style.fontSize=i?n:c,s.style.fontWeight=i?p:m,o.style.fontFamily=i?h:d,o.style.fontSize=i?c:n,o.style.fontWeight=i?m:p}}s&&(s.style.fontSize=`${t.listSize*e}vw`),i&&(i.style.bottom=`${t.loaderBottom}vh`,i.style.fontFamily=h,i.style.fontSize=c,i.style.fontWeight=m),u()},setThreshold:u,dispose:()=>{c.Ay.killTweensOf(r.m),c.Ay.killTweensOf(n.m)}}}({groups:F.current,list:B,loader:D,cut:x.current,live:v.current},$),es=!1,ei=0,eo=!1,el=[],er=function(e=m,t){let a=Math.ceil(Math.sqrt(e.length)),s=Math.ceil(e.length/a),i=document.createElement("canvas");i.width=512*a,i.height=s*f;let o=i.getContext("2d"),l=new r.GOR(i);l.flipY=!1,l.colorSpace=r.jf0,l.wrapS=r.ghU,l.wrapT=r.ghU,l.minFilter=r.k6q,l.magFilter=r.k6q,l.generateMipmaps=!1;let n=(e,t)=>{let s=t%a*512,i=Math.floor(t/a)*f,l=Math.max(512/(e.videoWidth||e.width),f/(e.videoHeight||e.height)),r=(e.videoWidth||e.width)*l,n=(e.videoHeight||e.height)*l;o.save(),o.beginPath(),o.rect(s,i,512,f),o.clip(),o.drawImage(e,s+(512-r)/2,i+(f-n)/2,r,n),o.restore()},c=0,u=()=>t?.(c/e.length),d=(t,a)=>{let s;return(s=`/${e[t]}`,new Promise((e,t)=>{let i=new Image;a&&(i.fetchPriority=a),i.onload=()=>e(i),i.onerror=()=>t(Error(`failed to load ${s}`)),i.src=s})).then(e=>n(e,t)).catch(e=>console.warn("[atlas]",e.message)).finally(()=>{c++,u()})},h=d(0,"high").then(()=>{l.needsUpdate=!0}),g=Promise.all([h,...e.slice(1).map((e,t)=>d(t+1,"low"))]).then(()=>{l.needsUpdate=!0}),v=-1,x=0,y=!1,w=new Map;return u(),{update:(e,t)=>{if(y||e<0||!p[e])return;if(e!==v){if(w.has(v)&&w.get(v).pause(),v=e,!w.has(e)){let t=document.createElement("video");t.muted=!0,t.loop=!0,t.playsInline=!0,t.preload="metadata",t.src=p[e].preview||p[e].video,w.set(e,t)}w.get(e).play().catch(()=>{})}let a=w.get(e);!document.hidden&&a&&a.readyState>=2&&t-x>1e3/24&&(n(a,e),l.needsUpdate=!0,x=t)},dispose:()=>{y=!0,w.forEach(e=>{e.pause(),e.removeAttribute("src"),e.load()}),w.clear()},texture:l,grid:[a,s],count:e.length,first:h,ready:g}}(m,e=>{W||(ei=e)});V.uAtlas.value.dispose(),er.texture.anisotropy=s.capabilities.getMaxAnisotropy(),V.uAtlas.value=er.texture,V.uGrid.value.set(er.grid[0],er.grid[1]);let en=er.count;er.first.then(()=>{W||(es=!0)}),er.ready.then(()=>{W||(ei=1)});let ec=1,eu=1,ed={left:0,top:0},eh=1,ep=1,em=1,ef=1,eg=!1,ev=!1,ex=()=>ea.style({textK:ef,tight:ev,viewW:ec}),ey=()=>{let e,t,a,i,o,l;ec=U.clientWidth,eu=U.clientHeight,e=ec/Math.max(1,$.refWidth),t=eu/Math.max(1,$.refHeight),a=e*(1-$.fitHeight)+Math.min(e,t)*$.fitHeight,eh=Math.min($.maxScale,Math.max($.minScale,a)),i=ec<=$.narrowAt,o=ec<=$.tightAt,eg=i,ev=o,ep=i?$.narrowPlane:1,em=(i?$.narrowRadius:1)*(o?$.tightRadius:1),ef=i?$.narrowText:1,Y.window=`${Math.round(ec)} x ${Math.round(eu)}`,Y.scale=Math.round(1e3*eh)/1e3,Y.band=o?"tight":i?"narrow":"wide",l=eh*ef*(o?$.tightSplit:1),Z.scale.set(l,l,1),s.setSize(ec,eu),H.left=-ec/2,H.right=ec/2,H.top=eu/2,H.bottom=-eu/2,H.updateProjectionMatrix(),J.scale.set(ec,eu,1),V.uResolution.value.set(ec,eu);let r=s.domElement.getBoundingClientRect();ed.left=r.left,ed.top=r.top},ew=()=>{ey(),ex()};ey(),window.addEventListener("resize",ew);let eb={x:0,y:0},eM=0,eT=!1,eP=0,eS=!1,eA=0,ek=0,e_=!1,eC=0,eE=0,ej=!1,eR=0,eF=0,eI=0,eO=e=>{let t=e.clientX-ed.left-eb.x;return Math.atan2(-(e.clientY-ed.top-eb.y),t)},eq=()=>{ej&&(c.Ay.killTweensOf(G),ej=!1)},ez=e=>{let t=T/Math.round($.count),a=eM-$.seed*S-E(e)*t,s=a+Math.round((G.spin-a)/T)*T,i=Math.abs(s-G.spin)/t;i<.01||(eP=0,e_=!1,ej=!0,c.Ay.killTweensOf(G),c.Ay.to(G,{spin:s,duration:$.pickTime*Math.sqrt(Math.max(1,i)),ease:$.pickEase,onComplete:()=>{ej=!1}}))},eN={x:0,y:0,inside:!1,seeded:!1},eL={x:0,y:0,amt:0,wake:0},eU=!1,eB=!1,eD=0,eW=()=>{clearTimeout(eD),eD=0,eB=!1},e$=e=>{eU="touch"===e.pointerType,eN.x=e.clientX-ed.left-.5*ec,eN.y=.5*eu-(e.clientY-ed.top),eN.inside=!0,eN.seeded||(eN.seeded=!0,eL.x=eN.x,eL.y=eN.y)},eG=()=>{eN.inside=!1},eY=e=>{if(!eT)return;e.preventDefault();let t=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;eq(),e_=!1,eP+=t*$.scrollSpeed,eP=Math.max(-$.maxSpeed,Math.min($.maxSpeed,eP))},eX=e=>{eR=0,eF=e.clientX,eI=e.clientY,e$(e),eT&&(eq(),eU&&(clearTimeout(eD),eD=setTimeout(()=>{eB=!0},1e3*$.touchHold)),eS=!0,e_=!1,eP=0,eA=eO(e),ek=performance.now(),s.domElement.setPointerCapture?.(e.pointerId))},eH=e=>{e$(e);let t=e.clientX-eF,a=e.clientY-eI;if(eR+=Math.abs(t)+Math.abs(a),eF=e.clientX,eI=e.clientY,eU&&!eB&&eR>$.touchSlop&&eW(),!eS)return;let s=eO(e),i=ec<=767?-(Math.abs(a)>Math.abs(t)?a:t)/Math.max(240,1.5*ec):s-eA;i>Math.PI&&(i-=T),i<-Math.PI&&(i+=T);let o=i*$.dragSpeed;G.spin+=o;let l=performance.now();eP=o/(Math.max(8,l-ek)/1e3),eA=s,ek=l},eK=e=>{e$(e),eW(),eS&&(eS=!1,s.domElement.releasePointerCapture?.(e.pointerId))},eQ=t=>{if(!eT||eR>=5)return;let a=t.clientX-ed.left-.5*ec,s=.5*eu-(t.clientY-ed.top);for(let t=0;t<Math.round($.count);t++){let i=V.uPos.value[t],o=V.uScale.value[t],l=V.uRot.value[t],r=Math.cos(l),n=Math.sin(l),c=a-i.x,u=s-i.y;if(Math.abs(c*r+u*n)<=V.uSize.value.x*o.x*.5&&Math.abs(-c*n+u*r)<=V.uSize.value.y*o.y*.5){ez(t),e(Math.round(o.w));return}}};U.addEventListener("wheel",eY,{passive:!1}),U.addEventListener("pointerdown",eX),U.addEventListener("pointermove",eH),U.addEventListener("pointerup",eK),U.addEventListener("pointercancel",eK),U.addEventListener("pointerleave",eG),U.addEventListener("click",eQ);let eV={shown:0},eJ=new Float32Array(32),eZ=new Float32Array(32),e0=[],e1=Array.from({length:32},()=>new r.I9Y),e2=new Float32Array(32),e5=new Float32Array(32),e3=new Float32Array(32),e4=new Float32Array(32),e6=new Float32Array(32),e8=new r.I9Y,e9=e=>Math.max(.05,1+$.swell*e2[e]-$.sideScale*e6[e]),e7=-1,te=-1,tt=-1,ta=!1,ts=-1,ti=0,to=0,tl=0;et.build(),et.load(()=>{W||et.build()}),ex();let tr=null,tn=()=>{W||tr||(ee.build(),et.build(),ex(),tr?.kill(),tr=(()=>{eT=!1,te=-1,eP=0,eS=!1,e_=!1,ts=-1,ti=0,to=0,V.uFocusParticles.value.x=0,eq();let e=++tl;D&&c.Ay.set(D,{opacity:+!eo});let t=c.Ay.timeline({delay:.25,onComplete:()=>{eT=!0}}),a=$.assemble&&ec>$.assembleFrom&&!Q.matches;t.fromTo(G,{progress:0,launch:0,spread:0,spin:0,shift:0},{progress:1,duration:a?$.assembleTime:.65,ease:a?$.assembleEase:"power1.out"}),t.addPause(">",()=>{let a;a=()=>{c.Ay.delayedCall($.holdAfter,()=>{!W&&e===tl&&(t.resume(),D&&c.Ay.to(D,{opacity:0,duration:$.loaderOut,ease:"power2.in"}))})},eo?a():el.push(a)}),t.to(G,{launch:1,duration:$.launchTime,ease:"power2.inOut"});let s=t.duration()-.15;t.to(G,{spread:1,duration:$.spreadTime,ease:$.spreadEase},s);let i=s+$.stageAt*$.spreadTime;t.to(G,{spin:$.spinTurns*T,duration:$.spinTime,ease:$.spinEase},i+$.spinDelay),t.to(G,{shift:1,duration:$.moveTime,ease:$.moveEase},i+$.moveDelay);let o=s+$.textAt*$.spreadTime;if(ee.chars.length&&t.fromTo(ee.chars,{value:0},{value:1,duration:$.textTime,ease:$.textEase,stagger:$.textStagger},o),$.textOut&&ee.fades.length){let e=Math.max(i+$.spinDelay+$.spinTime,i+$.moveDelay+$.moveTime);t.fromTo(ee.fades,{value:1},{value:0,duration:$.textOutTime,ease:$.textOutEase,stagger:$.textStagger},Math.max(0,e+$.textOutAt))}return B&&t.fromTo(B,{opacity:0},{opacity:1,duration:$.textTime,ease:$.textEase},o),t})())},tc=setTimeout(tn,3e3);Promise.all([document.fonts?.ready??Promise.resolve(),er.first]).then(tn).catch(tn);let tu=performance.now(),td=tu;return s.setAnimationLoop(()=>{let e,a,i,o=performance.now(),r=Math.min(.05,(o-td)/1e3);if(td=o,V.uTime.value=(o-tu)*.001,eT&&!eS&&!ej){G.spin+=eP*r,eP*=Math.pow($.damping,60*r);let e=0;if($.snap){let t=T/Math.round($.count),a=Math.max(.01,-(60*Math.log($.damping))),s=Math.max($.snapFrom,a*t*.5),i=4.8/Math.max(.05,$.snapTime);if(!e_&&Math.abs(eP)<s){let e=G.spin+eP/a,s=$.seed*S-eM;eC=Math.round((e+s)/t)*t-s,eE=Math.max(Math.abs(eP),.5*t*i),e_=!0}if(e_){e=eC-G.spin;let t=Math.max(-eE,Math.min(eE,e*i));eP+=(t-eP)*A(i*r)}}else e_=!1;.0015>Math.abs(eP)&&8e-4>Math.abs(e)&&(eP=0,G.spin+=e)}let n=Math.min(ei,A(G.progress));eV.shown+=(n-eV.shown)*j(r,$.loaderChase);let c=Math.min(100,Math.max(1,Math.round(100*eV.shown)));if(D&&(D.textContent=String(c).padStart(3,"0")),!eo&&c>=100){for(let e of(eo=!0,el))e();el.length=0}e=$.hover&&(eU?eB:eN.inside)&&eN.seeded&&eT,eL.amt+=(!!e-eL.amt)*j(r,.12),a=j(r,$.lag),eL.x+=(eN.x-eL.x)*a,eL.y+=(eN.y-eL.y)*a,i=Math.hypot(eN.x-eL.x,eN.y-eL.y),eL.wake=Math.max(eL.wake*Math.pow(.94,60*r),A(i/(2600*Math.max(r,.001)))),V.uMouse.value.set(eL.x,eL.y,eL.amt,$.melt*eh),V.uMelt.value.set($.meltReach*eh,$.wave*eh*eL.wake*eL.amt,$.waveFreq,$.waveSpeed),(e=>{let t=Math.round($.count);V.uCount.value=t;let a=T/t,s=A(G.spread),i=eg?$.narrowEndScale:$.endScale,o=ev?$.tightPosX:eg?$.narrowPosX:$.posX,r=A(G.shift),n=ec<=767,c=n?.76*ec/$.planeSize:(1+(i-1)*r)*eh,u=n?-$.ringRadius*em*c*_(A(G.launch)):o*ec*.5*r,d=$.posY*eu*.5*r,h=$.assemble&&ec>$.assembleFrom&&!Q.matches,p=h?1+($.assembleCardScale-1)*(1-C(.05,.82,G.launch)):1;eb.x=.5*ec+u,eb.y=.5*eu-d,eM=0!==u||0!==d?Math.atan2(-d,-u):0;let m=$.planeSize*ep*c*p,f=m/1.5;V.uSize.value.set(m,f),V.uRadius.value=$.radius*ep*c;let g=$.radial?f:m,v=$.radial?m:f,x=$.ringRadius*em*c,y=2*x*Math.sin(a/2)-g;Y.restingGap=Math.round(y/c*10)/10;let w=Math.max(1,y),b=Math.max(1,Math.abs(E(t-1))),M=Math.max(.1,.94-$.stagger);eZ[0]=0;for(let e=1;e<=b;e++){let t=A((s-(.06+(e-1)/b*$.stagger))/M),a=t*t*(3-2*t);eJ[e]=a,eZ[e]=eZ[e-1]+a}let R=$.seed*S,F=_(A(G.launch)),I=x*F;e0.length=0;let O=eL.amt>.001,q=Math.max(1,$.reach*m),z=Math.max(1,$.sideReach*m),N=j(e,$.grab),L=j(e,$.release),U=-1,B=1e9,D=0,W=Math.round($.imageOffset),X=e=>en>0?((W-e)%en+en)%en:0,H=eN.inside&&eN.seeded&&eT,K=-1,J=O?tt:-1;for(let e=0;e<t;e++){let t=E(e),s=Math.abs(t),i=0===e?A(G.progress):eJ[s],o=X(t),l=R+Math.sign(t)*a*eZ[s]+G.spin,r=Math.cos(l)*I+u,n=Math.sin(l)*I+d;e1[e].set(r,n);let c=l-eM,p=Math.abs(Math.atan2(Math.sin(c),Math.cos(c)));p<B&&(B=p,U=e,D=o);let g=0,v=0,x=0;if(O){let e=eL.x-r,t=eL.y-n,a=Math.hypot(e,t);if((g=C(q,.22*q,a)*eL.amt*i)>1e-4&&a>1e-4){let s=$.pull*eh*g/a;v=e*s,x=t*s}}let y=g>e2[e]?N:L;e2[e]+=(g-e2[e])*y,e5[e]+=(v-e5[e])*y,e3[e]+=(x-e3[e])*y;let w=0;J>=0&&e!==J&&(w=C(z,.2*z,Math.hypot(e8.x-r,e8.y-n))*i),e6[e]+=(w-e6[e])*(w>e6[e]?N:L);let b=0,M=0;if(e6[e]>1e-4){let t=r-e8.x,a=n-e8.y,s=Math.hypot(t,a);if(s>1e-4){let i=$.sidePush*eh*e6[e]/s;b=t*i,M=a*i}}V.uPos.value[e].set(r+e5[e]+b,n+e3[e]+M),V.uRot.value[e]=($.radial?l:l+P)*F;let T=0===e?k(A(h?(i-.5)/.46:i/.7)):k(A(i/.34)),S=0===e?k(A(h?(i-.58)/.38:(i-.18)/.74)):k(A((i-.06)/.36)),_=e9(e);if(V.uScale.value[e].set(T*_,S*_,1-$.sideDim*e6[e],o),H&&K<0){let t=V.uRot.value[e],a=eL.x-(r+e5[e]+b),s=eL.y-(n+e3[e]+M),i=Math.cos(t),o=Math.sin(t);Math.abs(a*i+s*o)<=.5*m*T*_&&Math.abs(-a*o+s*i)<=.5*f*S*_&&(K=e)}e0.push(e)}for(let e=t;e<32;e++)V.uScale.value[e].set(0,0,1,0),e2[e]=0,e5[e]=0,e3[e]=0,e6[e]=0;tt=K;let Z=$.focusParticles&&ec>$.focusParticleFrom&&!eU&&eT&&s>.995?tt:-1;ts<0&&Z>=0&&(ts=Z,to=0);let ee=ts>=0&&ts===Z,ea=ee?$.focusParticleEnter:$.focusParticleExit;if(ti+=(!!ee-ti)*j(e,ea),!Q.matches&&ts>=0&&(to+=e*(ee?$.focusParticleDrift:-$.focusParticleOut)),!ee&&ti<.015&&(ts=Z,ti=0,to=0),ts>=0){let e=V.uPos.value[ts],t=V.uScale.value[ts],a=.5*m*t.x,s=.5*f*t.y,i=Math.min(a,s),o=C(.3,1,Math.min(t.x,t.y)),l=Math.min(i,i+(V.uRadius.value-i)*o);V.uFocusParticlePos.value.copy(e),V.uFocusParticleBox.value.set(a,s,l,V.uRot.value[ts])}V.uFocusParticles.value.set(ti,$.focusParticleReach*eh,Math.max(6,$.focusParticleCell*eh),$.focusParticleOpacity),V.uFocusParticleMotion.value.set(to,+!Q.matches);let ei=tt>=0&&!eU&&ec>$.tagFrom;if(ei!==ta&&(ta=ei,et.show(ei)),tt>=0&&e8.copy(e1[tt]),V.uTag.value.set(eL.x+$.tagX,eL.y+$.tagY,et.box.sx,et.box.sy),V.uTagP.value.set(52,20,20,$.tagRefract),V.uTagQ.value.set($.tagFrost,$.tagRim,0,0),U>=0&&en>0&&D!==e7){e7=D;let e=l.current;for(let t=0;t<e.length;t++){let a=e[t];if(!a)continue;let s=t===e7;a.style.opacity=s?"1":"0.2",s?a.setAttribute("aria-current","true"):a.removeAttribute("aria-current")}}e0.sort((e,t)=>E(e)-E(t));let eo=.5*v*$.thread,el=Math.min(s>.995&&t>2?t:t-1,32);for(let e=0;e<el;e++){let a=e0[e],s=e0[(e+1)%t],i=V.uPos.value[a],o=V.uPos.value[s],l=V.uScale.value[a],r=V.uScale.value[s],n=($.radial?l.y:l.x)/e9(a),u=($.radial?r.y:r.x)/e9(s),d=A((e1[a].distanceTo(e1[s])-.5*g*(n+u))/w),h=0;if(O&&$.web>1e-4){let e=(i.x+o.x)*.5,t=(i.y+o.y)*.5,a=Math.max(1,$.webReach*m);h=C(a,.15*a,Math.hypot(eL.x-e,eL.y-t))*eL.amt}e4[e]+=(h-e4[e])*(h>e4[e]?N:L);let p=eo*Math.max(Math.pow(1-d,$.thin),$.web*e4[e])-$.dissolve,f=p*(1-(1-$.pinch)*C(0,.7,d));V.uLinkA.value[e].copy(i),V.uLinkB.value[e].copy(o),V.uLinkPar.value[e].set(p,f,$.sag*c*Math.pow(d,1.5),Math.min($.fillet*c*C(0,.35,d),1.5*Math.max(f,0)))}for(let e=el;e<32;e++)V.uLinkPar.value[e].set(-100,-100,0,0);V.uLinkCount.value=el,V.uK.value=$.goo*ep*eh,V.uWobble.value=$.wobble*eh*(1-C(.2,.95,G.progress)),V.uTextured.value=$.textured&&es?1:0,V.uBlend.value=Math.max(.5,$.blend*ep*c),V.uIntro.value.set(h?A(G.progress):1,$.assembleSpread,Math.max(7,$.assembleCell*eh),h?$.assembleOpacity:0),V.uCardParticles.value.set(A(G.launch),$.assembleHaloReach*eh,Math.max(7,$.assembleCell*eh),h?$.assembleHaloOpacity:0);let er=$.glass;V.uBandTop.value=er?$.bandTop*eu:0,V.uBandBottom.value=er?$.bandBottom*eu:0,V.uGlass.value.set($.refract,$.squeeze,$.ripple,$.rippleFreq),V.uFringe.value=er?$.fringe:0,V.uSheen.value=er?$.sheen:0})(r),er.update(e7,o),eT&&!eS&&!ej&&0===eP&&e7>=0&&e7!==te&&(te=e7,ea.show(e7),t(e7)),s.render(X,H)}),()=>{W=!0,clearTimeout(eD),clearTimeout(tc),s.setAnimationLoop(null),window.removeEventListener("resize",ew),U.removeEventListener("wheel",eY),U.removeEventListener("pointerdown",eX),U.removeEventListener("pointermove",eH),U.removeEventListener("pointerup",eK),U.removeEventListener("pointercancel",eK),U.removeEventListener("pointerleave",eG),U.removeEventListener("click",eQ),tr?.kill(),c.Ay.killTweensOf(ee.chars),c.Ay.killTweensOf(ee.fades),c.Ay.killTweensOf(B),ea.dispose(),et.dispose(),ee.dispose(),er.dispose(),J.geometry.dispose(),J.material.dispose(),V.uAtlas.value?.dispose(),V.uAsciiTex.value?.dispose(),V.uTagTex.value?.dispose(),s.dispose(),s.forceContextLoss(),s.domElement.remove()}},[e,t]),(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)("div",{ref:a,className:"fixed inset-0 touch-none"}),(0,s.jsx)("ul",{ref:o,"aria-label":"Projects",style:{fontFamily:'"Showcase Sans", ui-sans-serif, system-ui, sans-serif'},className:"pointer-events-none fixed right-[12vw] top-[2.4vh] z-10 flex flex-col items-start text-right leading-[1.4] tracking-[0.01em] text-[#0a0a0a] opacity-0",children:p.map((t,a)=>(0,s.jsx)("li",{ref:e=>{l.current[a]=e},style:{opacity:.2},children:(0,s.jsx)("button",{type:"button",className:"pointer-events-auto cursor-pointer border-0 bg-transparent p-0 text-inherit","aria-label":`打开${t.name}`,onClick:()=>e(a),children:t.name})},t.file))}),[{side:"left",justify:"flex-start"},{side:"right",justify:"flex-end"}].map(({side:e,justify:t})=>{let a=(0,s.jsxs)("span",{className:"flex items-baseline whitespace-nowrap",children:[(0,s.jsx)("span",{}),(0,s.jsx)("span",{})]});return(0,s.jsxs)("div",{ref:t=>{F.current[e].box=t},"aria-hidden":"true",className:"pointer-events-none fixed top-1/2 z-10 -translate-y-1/2 tracking-[-0.01em] text-[#0a0a0a]",children:[(0,s.jsx)("span",{ref:t=>{F.current[e].goo=t},className:"absolute inset-0",style:{willChange:"filter"},children:[0,1].map(i=>(0,s.jsx)("span",{ref:t=>{F.current[e].layers[i]=t},className:"absolute inset-0 flex items-center",style:{justifyContent:t},children:a},i))}),(0,s.jsx)("span",{ref:t=>{F.current[e].plain=t},className:"absolute inset-0 flex items-center",style:{justifyContent:t},children:a})]},e)}),(0,s.jsx)("div",{ref:h,"aria-hidden":"true",className:"pointer-events-none fixed left-1/2 z-10 -translate-x-1/2 tracking-[-0.01em] text-[#0a0a0a]"}),(0,s.jsx)("div",{ref:v,"aria-live":"polite",className:"sr-only"}),(0,s.jsx)("svg",{"aria-hidden":"true",className:"pointer-events-none absolute h-0 w-0",focusable:"false",children:(0,s.jsx)("defs",{children:(0,s.jsx)("filter",{id:"name-goo",x:"-20%",y:"-100%",width:"140%",height:"300%",colorInterpolationFilters:"sRGB",children:(0,s.jsx)("feColorMatrix",{ref:x,in:"SourceGraphic",type:"matrix",values:"1 0 0 0 0\n                      0 1 0 0 0\n                      0 0 1 0 0\n                      0 0 0 255 -140"})})})})]})}var F=a(9426),I=a.n(F);function O(){let[e,t]=(0,i.useState)(0),[a,o]=(0,i.useState)(null),r=(0,i.useRef)(null),n=(0,i.useRef)(null),c=(0,i.useRef)(null),u=(0,i.useCallback)(e=>t(e),[]),d=(0,i.useCallback)(e=>{c.current=document.activeElement instanceof HTMLElement?document.activeElement:null,o(e),r.current?.showModal()},[]),p=(0,i.useCallback)(()=>{n.current?.pause(),r.current?.close(),o(null),c.current?.focus()},[]);(0,i.useEffect)(()=>{null!==a&&n.current?.play().catch(()=>void 0)},[a]);let m=null===a?null:h[a];return(0,s.jsxs)("main",{className:I().page,children:[(0,s.jsx)("div",{className:I().carousel,children:(0,s.jsx)(R,{onOpen:d,onActive:u})}),(0,s.jsx)("header",{className:I().header,children:(0,s.jsxs)(l(),{href:"/#works",children:["MY PORTFOLIO",(0,s.jsx)("span",{children:"SELECTED VIDEO WORKS"})]})}),(0,s.jsxs)("footer",{className:I().footer,children:[(0,s.jsx)("span",{children:"滑动或拖拽切换 \xb7 点击作品播放"}),(0,s.jsxs)("button",{type:"button",onClick:()=>d(e),children:["播放当前作品 ",(0,s.jsx)("span",{children:"↗"})]}),(0,s.jsxs)("span",{children:[String(e+1).padStart(2,"0")," / ",String(h.length).padStart(2,"0")]})]}),(0,s.jsx)("dialog",{ref:r,className:I().dialog,onCancel:p,onClick:e=>{e.target===e.currentTarget&&p()},"aria-label":m?`${m.name}视频`:"作品视频",children:m&&(0,s.jsxs)("section",{className:I().playerPanel,children:[(0,s.jsxs)("header",{children:[(0,s.jsxs)("div",{children:[(0,s.jsxs)("span",{children:["SELECTED WORK / ",String((a??0)+1).padStart(2,"0")]}),(0,s.jsx)("h1",{children:m.name})]}),(0,s.jsx)("button",{type:"button",onClick:p,"aria-label":"关闭视频",children:"关闭 \xd7"})]}),(0,s.jsx)("video",{ref:n,src:m.video,poster:m.poster,controls:!0,autoPlay:!0,playsInline:!0,preload:"metadata"},m.id),(0,s.jsxs)("footer",{children:[(0,s.jsx)("p",{children:m.description}),(0,s.jsxs)("div",{children:[m.placeholder&&(0,s.jsx)("span",{children:"占位视频"}),(0,s.jsx)("button",{type:"button",onClick:()=>o(e=>((e??0)+1)%h.length),children:"下一部作品 →"})]})]})]})})]})}let q=["方文山","杨干嬅","赵丽颖","杨丞琳","萧敬腾","宋佳","宋茜","唐嫣","杨颖","杨紫","张蔷","林更新","奚梦瑶","马伊琍","李现","陈冲","陈意涵","范丞丞","黄轩","雷佳音","黄绮珊","王栎鑫","王耀庆","李诞","白鹿","陈昊宇","白宇","张晋","时代少年团","杨迪","周雨然","文咏珊","徐明浩","李晓峰","艾热AIR","GALI","Jony","万妮达","盘尼西林乐队","裴蓓","杨英格","赵佳丽","杜鹃","鞠婧祎","赵磊","程潇","张予曦","易立竞","张晋","方逸伦","宋轶一诺","葛曼棋","孟子义","李晨","王楚然","任嘉伦","胡彦斌","门腔","吴谨言","张婧怡","虞书欣","丁禹兮","祝绪丹","杨仕泽","费启鸣","李奕臻","卢禹豪","孟鹤堂","林一","彭冠英","李小冉","李晨","方逸伦","五条人乐队","李云霄","潘展乐","李云迪","李一桐","周深","陈都灵","侯明昊","沙一汀等"],z=["华为","CK","百度","小米","DPU","淘宝","三星","MISTINE","天猫","VIVO","欧莱雅","京东","大众汽车","理肤泉","抖音","沃尔沃汽车","稀物集","字节","仰望汽车","林清轩","快手","哪托汽车","花西子","网易","五菱汽车","AUPRES","聚划算","宝骏Kiwi","时尚芭莎","支付宝","中信银行","招商银行","联通5G","必胜客","鲜橙多","康师傅","百草味","华润绿城","统一","英雄联盟","王者荣耀","永劫无间","梦幻西游","问童子","剑网3","逆水寒","花知\uD84C\uDDC8","中免日上","水星家纺","NEIWAI","十月结晶","FUNNY","LIKEUU","PICO","珂蔓朵","可悠然","伊利","清风","德祐","知乎","方太","丝蕴","大话西游","CoCo","KiLaLa","COSMO","MissBerry","CHOUCHC","老板电器","雀巢","安慕希空刻","洽洽瓜子","人头马","古茗","茶百道","麦当劳","道达尔","肯德基","蒙牛","梦百合","格丽缇","波司登","华为养生堂","OPPO","361","理想宝洁","迪士尼"],N="/sites/showcase/profile.jpg";var L=a(5310),U=a(7478),B=a.n(U);function D(){let e=(0,i.useRef)(null);return(0,i.useEffect)(()=>{let t=e.current;if(!t||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;let a=Array.from(t.querySelectorAll("[data-name]")),s=new Map,i=new Set,o=e=>{let t=e.querySelector("[data-scramble]");if(!t)return;let a=s.get(e);a||(a=new L.A(t,{timeOffset:65,fps:24,chars:/[\u3400-\u9fff]/.test(e.textContent??"")?["光","影","字","形","声","色","未","来","映","像"]:["A","X","R","M","N","0","1","+","/","_"]}),s.set(e,a)),a.play().start()},l=new IntersectionObserver(e=>{e.filter(e=>e.isIntersecting).forEach((e,t)=>{l.unobserve(e.target);let a=setTimeout(()=>{i.delete(a),o(e.target)},Math.min(35*t,500));i.add(a)})},{root:t,rootMargin:"0px 0px -15% 0px",threshold:.5}),r=a.map(e=>{let t=()=>o(e);return e.addEventListener("pointerenter",t),l.observe(e),()=>e.removeEventListener("pointerenter",t)}),n=()=>{let e=t.clientHeight;a.forEach(t=>{let a=Math.max(0,Math.min(1,(.92*e-t.getBoundingClientRect().top)/(.22*e)));t.style.opacity=String(.15+.85*a)})},c=0,u=()=>{cancelAnimationFrame(c),c=requestAnimationFrame(n)};return n(),t.addEventListener("scroll",u,{passive:!0}),window.addEventListener("resize",u),()=>{l.disconnect(),i.forEach(clearTimeout),r.forEach(e=>e()),s.forEach(e=>e.stop()),cancelAnimationFrame(c),t.removeEventListener("scroll",u),window.removeEventListener("resize",u)}},[]),(0,s.jsxs)("main",{ref:e,className:B().page,"aria-label":"Cooperation",children:[(0,s.jsxs)("header",{className:B().header,children:[(0,s.jsx)("a",{href:"#works",children:"MY PORTFOLIO"}),(0,s.jsx)("span",{children:"COOPERATION / 合作"})]}),(0,s.jsxs)("div",{className:B().intro,children:[(0,s.jsx)("span",{children:"PEOPLE & BRANDS"}),(0,s.jsx)("p",{children:"合作过的艺人，与一起创作的品牌。"}),(0,s.jsx)("a",{href:"#cooperation-brands",onClick:t=>{t.preventDefault(),e.current?.querySelector("#cooperation-brands")?.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"})},children:"查看品牌 ↓"})]}),[{title:"ARTISTS",label:"合作过的艺人",names:q,id:"cooperation-artists"},{title:"BRANDS",label:"合作过的品牌",names:z,id:"cooperation-brands"}].map((e,t)=>(0,s.jsxs)("section",{id:e.id,className:B().section,children:[(0,s.jsxs)("div",{className:B().label,children:[(0,s.jsxs)("span",{children:["FIG. 0",t+1]}),(0,s.jsx)("h1",{children:e.title}),(0,s.jsx)("p",{children:e.label})]}),(0,s.jsx)("p",{className:B().text,children:e.names.map((e,t)=>(0,s.jsxs)("span",{"data-name":!0,children:[(0,s.jsx)("span",{className:B().original,children:e}),(0,s.jsx)("span",{className:B().scrambled,"data-scramble":!0,"aria-hidden":"true",children:e})]},`${t}-${e}`))})]},e.id)),(0,s.jsxs)("footer",{className:B().footer,children:["THANK YOU FOR THE TRUST.",(0,s.jsx)("span",{children:"感谢每一次信任与合作。"})]})]})}var W=a(7153),$=a.n(W);let G=["works","cooperation","about"];function Y(e){return window.addEventListener("hashchange",e),()=>window.removeEventListener("hashchange",e)}function X(){let e=window.location.hash.slice(1);return G.includes(e)?e:"works"}function H(){let e=(0,i.useSyncExternalStore)(Y,X,()=>"works");return(0,s.jsxs)("div",{className:$().site,children:["works"===e?(0,s.jsx)(O,{}):"cooperation"===e?(0,s.jsx)(D,{}):(0,s.jsxs)("main",{className:$().panel,children:[(0,s.jsxs)("a",{className:$().brand,href:"#works",children:["MY PORTFOLIO",(0,s.jsx)("span",{children:"A LITTLE ABOUT ME"})]}),(0,s.jsxs)("div",{className:$().content,children:[(0,s.jsx)("div",{className:$().eyebrow,children:" 03 / INTRODUCTION"}),(0,s.jsxs)("header",{className:$().title,children:[(0,s.jsxs)("h1",{children:["About",(0,s.jsx)("span",{children:"."})]}),(0,s.jsx)("p",{children:"关于我"})]}),(0,s.jsxs)("div",{className:$().about,children:[(0,s.jsx)("div",{className:$().portrait,children:N?(0,s.jsx)("div",{className:$().photo,style:{backgroundImage:`url(${JSON.stringify(N)})`},role:"img","aria-label":"个人照片"}):(0,s.jsxs)(s.Fragment,{children:[(0,s.jsxs)("span",{children:["YOUR",(0,s.jsx)("br",{}),"PORTRAIT"]}),(0,s.jsx)("small",{children:"个人照片待添加"})]})}),(0,s.jsxs)("section",{className:$().bio,children:[(0,s.jsx)("span",{className:$().eyebrow,children:"HELLO, I AM"}),(0,s.jsx)("h2",{children:"江可染"}),(0,s.jsx)("p",{className:$().role,children:"广告 / 电影摄影师"}),(0,s.jsx)("p",{className:$().description,children:"从事广告行业多年，拍摄过超90+位知名艺人，服务过上百家国内知名品牌；也参与亚运会、央视、英雄联盟等诸多重大赛事宣发广告的拍摄。作品在主流媒体如微博、小红书、抖音、快手、央视和浙江卫视等皆有传播。\n\n有着丰富的广告拍摄经验的同时会考虑影像风格的多变，善于根据每个影片的不同气质来提供更多影像变化和思路。有良好的审美以及较好的画面感受力，善长通过视觉表达营造更好的影片氛围；对于女性之美的表达有自己独到的理解。"}),(0,s.jsxs)("div",{className:$().details,children:[(0,s.jsxs)("div",{children:[(0,s.jsx)("span",{children:"SELECTED WORKS / 作品主页"}),(0,s.jsx)("p",{children:(0,s.jsxs)("a",{href:"https://www.xinpianchang.com/u10389533?from=navigator",target:"_blank",rel:"noopener noreferrer",children:["江可染Core \xb7 新片场"," ↗"]})})]}),(0,s.jsxs)("div",{children:[(0,s.jsx)("span",{children:"CONTACT / 联系方式"}),(0,s.jsx)("p",{children:"KeRanJ"})]})]})]})]})]}),(0,s.jsx)("span",{className:$().pageNumber,children:"03 / 03"})]},e),(0,s.jsx)("nav",{className:$().navigation,"aria-label":"主要导航",children:G.map(t=>(0,s.jsx)("a",{href:`#${t}`,"aria-current":e===t?"page":void 0,children:t[0].toUpperCase()+t.slice(1)},t))})]})}},3767:(e,t,a)=>{Promise.resolve().then(a.bind(a,2680))},7153:e=>{e.exports={site:"portfolio_site__BGqKD",panel:"portfolio_panel__sfpXp",enter:"portfolio_enter__ZDNnd",brand:"portfolio_brand__yWhmW",content:"portfolio_content__Kx06Q",eyebrow:"portfolio_eyebrow__HD8bB",title:"portfolio_title__R418M",partners:"portfolio_partners__gRJPq",group:"portfolio_group__khT7A",names:"portfolio_names__sknVh",empty:"portfolio_empty__lJiGW",about:"portfolio_about__DwIUt",portrait:"portfolio_portrait__BFiDK",photo:"portfolio_photo__GUVZc",bio:"portfolio_bio__3oRq_",role:"portfolio_role__HE5VJ",description:"portfolio_description__lSppu",details:"portfolio_details___R2wn",pageNumber:"portfolio_pageNumber__BHfI_",navigation:"portfolio_navigation__jabWm"}},7478:e=>{e.exports={page:"cooperation_page__C2bLy",header:"cooperation_header__8oj6q",intro:"cooperation_intro__qKgqs",section:"cooperation_section__yduS8",label:"cooperation_label__vFAc4",text:"cooperation_text__Gl__a",footer:"cooperation_footer__1757Q",original:"cooperation_original__9iFoV",scrambled:"cooperation_scrambled__JOvd_"}},9426:e=>{e.exports={page:"showcase_page__cYA0Q",header:"showcase_header___3JCG",footer:"showcase_footer__C2mj9",dialog:"showcase_dialog__1L_Jl",playerPanel:"showcase_playerPanel__tvMOw",carousel:"showcase_carousel__49Qth"}}},e=>{e.O(0,[190,367,831,592,37,441,794,358],()=>e(e.s=3767)),_N_E=e.O()}]);
# Phase 1 — Direct Renderer Rebuild

## What changed
- Replaced the old 3 giant cloud cards with 8 lightweight camera-relative world-space billboards using 4 cached CanvasTextures: hero, secondary, wisp, horizon.
- Hero/secondary/wisp/horizon textures are individually composed so clouds are real formations rather than many formations packed into one giant texture.
- Cloud materials use depth testing, remain transparent/depth-write disabled, and are added to the scene instead of the camera-centered sky dome.
- Clouds keep slow drift and different distances for parallax.
- Sky palette was strengthened for clearer phase identity; horizon glow and dither were reduced.
- Fog near/far are overridden during Phase 1 to stronger atmospheric perspective targets without requiring config changes.
- CSS visual filter was reduced to avoid a global filter look.
- Sun halo/ corona multipliers and geometry sizes were reduced substantially, while keeping the existing Sun architecture intact.
- Star system remains the existing 420-point field.

## Performance
- 8 cloud meshes total.
- 4 cached CanvasTextures.
- 1 shared PlaneGeometry.
- No per-frame texture/geometry/material allocations.
- No volumetric cloud rendering or ray marching.

## Validation
- `node --check` passed for `renderer-3d.js`.
- Runtime browser visual validation still needs to be performed in the user's local game because the provided environment does not run their local HTTP server/game runtime.

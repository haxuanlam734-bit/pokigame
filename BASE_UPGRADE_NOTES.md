# Base upgrade

Upgraded the 3D military base in `src/rendering/renderer-3d.js` into a larger military complex:
- ~176x176 concrete base footprint
- perimeter defensive wall + inner fence
- road network and parking markings
- command HQ + central plaza
- barracks, mess hall, medical block
- supply depot, fuel farm, motor pool
- research facility, vehicle workshop
- training ground and shooting range
- radar station and communications tower
- expanded guard towers, main/secondary gates
- perimeter lighting and military props

Validation:
- `node --check` passed for all 20 JavaScript files.
- `npm test` exits successfully (project currently has no real test script).

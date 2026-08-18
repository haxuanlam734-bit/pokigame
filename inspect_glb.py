#!/usr/bin/env python3
"""Inspect GLB weapon models to extract grip positions and bounding boxes."""

import struct
import json
from pathlib import Path
from pygltflib import GLTF2

def read_accessor_data(gltf, accessor_idx, blob):
    """Read accessor data and return array of vectors."""
    accessor = gltf.accessors[accessor_idx]
    buffer_view = gltf.bufferViews[accessor.bufferView]
    
    start = buffer_view.byteOffset + accessor.byteOffset
    type_count = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[accessor.type]
    end = start + accessor.count * type_count * 4  # float32
    
    data = blob[start:end]
    count = accessor.count
    components = type_count
    
    values = []
    for i in range(count):
        offset = i * components * 4
        vec = []
        for j in range(components):
            val = struct.unpack('<f', data[offset + j*4:offset + j*4 + 4])[0]
            vec.append(val)
        values.append(vec)
    
    return values

def get_node_world_transform(gltf, node_idx, parent_transform=None):
    """Get world transform of a node by traversing the scene graph."""
    if parent_transform is None:
        parent_transform = {
            'translation': [0.0, 0.0, 0.0],
            'rotation': [0.0, 0.0, 0.0, 1.0],
            'scale': [1.0, 1.0, 1.0]
        }
    
    node = gltf.nodes[node_idx]
    
    # Get local transform
    local_trans = node.translation if node.translation else [0.0, 0.0, 0.0]
    local_rot = node.rotation if node.rotation else [0.0, 0.0, 0.0, 1.0]
    local_scale = node.scale if node.scale else [1.0, 1.0, 1.0]
    
    # Multiply matrices (simplified: just compute positions)
    # For accurate results, we'd need full quaternion multiplication
    # But for this inspection, we just report local transforms
    
    return {
        'node': node,
        'local_translation': local_trans,
        'local_rotation': local_rot,
        'local_scale': local_scale
    }

def inspect_glb(filepath):
    print(f"\n{'='*60}")
    print(f"FILE: {filepath.name}")
    print(f"{'='*60}")
    
    blob = Path(filepath).read_bytes()
    gltf = GLTF2().load(str(filepath))
    
    # Print nodes
    print("\n--- NODES ---")
    for i, node in enumerate(gltf.nodes):
        translation = node.translation if node.translation else [0, 0, 0]
        rotation = node.rotation if node.rotation else [0, 0, 0, 1]
        scale = node.scale if node.scale else [1, 1, 1]
        print(f"Node {i}: {node.name}")
        print(f"  translation: [{translation[0]:.4f}, {translation[1]:.4f}, {translation[2]:.4f}]")
        print(f"  rotation: [{rotation[0]:.4f}, {rotation[1]:.4f}, {rotation[2]:.4f}, {rotation[3]:.4f}]")
        print(f"  scale: [{scale[0]:.4f}, {scale[1]:.4f}, {scale[2]:.4f}]")
        print(f"  children: {node.children}")
        if node.mesh is not None:
            print(f"  mesh: {node.mesh}")
    
    # Print meshes
    print("\n--- MESHES ---")
    for i, mesh in enumerate(gltf.meshes):
        print(f"Mesh {i}: {mesh.name if hasattr(mesh, 'name') else 'unnamed'}")
        for j, prim in enumerate(mesh.primitives):
            print(f"  Primitive {j}:")
            print(f"    attributes: {prim.attributes}")
            if prim.attributes.POSITION is not None:
                print(f"    POSITION accessor: {prim.attributes.POSITION}")
            print(f"    mode: {prim.mode}")
    
    # Print bounding boxes of meshes (in local mesh space, before node transforms)
    print("\n--- MESH VERTEX BOUNDS (local mesh space) ---")
    for i, mesh in enumerate(gltf.meshes):
        for j, prim in enumerate(mesh.primitives):
            if prim.attributes.POSITION is None:
                continue
            positions = read_accessor_data(gltf, prim.attributes.POSITION, blob)
            if not positions:
                continue
            
            min_x = min(p[0] for p in positions)
            max_x = max(p[0] for p in positions)
            min_y = min(p[1] for p in positions)
            max_y = max(p[1] for p in positions)
            min_z = min(p[2] for p in positions)
            max_z = max(p[2] for p in positions)
            
            print(f"Mesh {i} Prim {j} POSITION:")
            print(f"  X: [{min_x:.4f}, {max_x:.4f}] range={max_x-min_x:.4f}")
            print(f"  Y: [{min_y:.4f}, {max_y:.4f}] range={max_y-min_y:.4f}")
            print(f"  Z: [{min_z:.4f}, {max_z:.4f}] range={max_z-min_z:.4f}")
            print(f"  center: [{(min_x+max_x)/2:.4f}, {(min_y+max_y)/2:.4f}, {(min_z+max_z)/2:.4f}]")
    
    # Print animations
    print("\n--- ANIMATIONS ---")
    print(f"Count: {len(gltf.animations)}")
    
    # Print skins
    print("\n--- SKINS ---")
    print(f"Count: {len(gltf.skins)}")
    
    # Find "grip" related nodes
    print("\n--- GRIP CANDIDATES ---")
    found = False
    for i, node in enumerate(gltf.nodes):
        name_lower = (node.name or '').lower()
        if 'grip' in name_lower or 'handle' in name_lower or 'guard' in name_lower:
            translation = node.translation if node.translation else [0, 0, 0]
            print(f"  Node {i}: {node.name} at {translation}")
            found = True
    if not found:
        print("  No grip/handle/guard nodes found")
    
    # Compute transformed bounds for each mesh
    print("\n--- TRANSFORMED MESH BOUNDS (in parent node space) ---")
    for i, node in enumerate(gltf.nodes):
        if node.mesh is None:
            continue
        
        mesh = gltf.meshes[node.mesh]
        trans = node.translation if node.translation else [0.0, 0.0, 0.0]
        scale = node.scale if node.scale else [1.0, 1.0, 1.0]
        
        # We need to account for rotation too, but for bounds estimation,
        # just apply translation and scale
        all_positions = []
        for prim in mesh.primitives:
            if prim.attributes.POSITION is None:
                continue
            positions = read_accessor_data(gltf, prim.attributes.POSITION, blob)
            for p in positions:
                all_positions.append([
                    p[0] * scale[0] + trans[0],
                    p[1] * scale[1] + trans[1],
                    p[2] * scale[2] + trans[2]
                ])
        
        if all_positions:
            min_x = min(p[0] for p in all_positions)
            max_x = max(p[0] for p in all_positions)
            min_y = min(p[1] for p in all_positions)
            max_y = max(p[1] for p in all_positions)
            min_z = min(p[2] for p in all_positions)
            max_z = max(p[2] for p in all_positions)
            
            print(f"Node {i} ({node.name}) -> Mesh {node.mesh}:")
            print(f"  X: [{min_x:.4f}, {max_x:.4f}] range={max_x-min_x:.4f}")
            print(f"  Y: [{min_y:.4f}, {max_y:.4f}] range={max_y-min_y:.4f}")
            print(f"  Z: [{min_z:.4f}, {max_z:.4f}] range={max_z-min_z:.4f}")
            print(f"  center: [{(min_x+max_x)/2:.4f}, {(min_y+max_y)/2:.4f}, {(min_z+max_z)/2:.4f}]")

# Inspect all three weapons
base = Path("src/assets/weapon")
files = [
    base / "MeleeWeapon.js" / "katana_low_poly.glb",
    base / "RangedWeapon.js" / "free_fire_gun_desert_eagle.glb",
    base / "RangedWeapon.js" / "gun_m4a1.glb",
]

for f in files:
    if f.exists():
        inspect_glb(f)
    else:
        print(f"NOT FOUND: {f}")

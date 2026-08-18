#!/usr/bin/env python3
"""Inspect GLB weapon models - compute bounds in model root space."""

import struct
import math
from pathlib import Path
from pygltflib import GLTF2

def quat_multiply(q1, q2):
    """Multiply two quaternions (x, y, z, w)."""
    x1, y1, z1, w1 = q1
    x2, y2, z2, w2 = q2
    return [
        w1*x2 + x1*w2 + y1*z2 - z1*y2,
        w1*y2 - x1*z2 + y1*w2 + z1*x2,
        w1*z2 + x1*y2 - y1*x2 + z1*w2,
        w1*w2 - x1*x2 - y1*y2 - z1*z2
    ]

def transform_point(point, translation, rotation, scale):
    """Transform a point by TRS."""
    x, y, z = point
    sx, sy, sz = scale
    
    # Scale
    x *= sx
    y *= sy
    z *= sz
    
    # Rotate
    rx, ry, rz, rw = rotation
    # Quaternion rotation formula
    qx = rx * x + ry * y + rz * z
    qy = rx * x - ry * y - rz * z  # simplified - need full formula
    # Actually let me just use matrix math
    pass

def transform_point_by_quat(point, quat):
    """Rotate point by quaternion."""
    x, y, z = point
    qx, qy, qz, qw = quat
    
    # v' = q * v * q^-1
    # For unit quaternion, q^-1 = (qx, qy, qz, -qw)
    # Simplified: 
    t = 2 * (qy * z - qz * y)
    u = 2 * (qz * x - qx * z)
    v = 2 * (qx * y - qy * x)
    
    return [
        x + qw * t + qy * v - qz * u,
        y + qw * u + qz * t - qx * v,
        z + qw * v + qx * u - qy * t
    ]

def get_world_transform(gltf, node_idx, nodes, visited=None):
    """Compute world transform of a node."""
    if visited is None:
        visited = set()
    if node_idx in visited:
        return {'translation': [0,0,0], 'rotation': [0,0,0,1], 'scale': [1,1,1]}
    visited.add(node_idx)
    
    node = nodes[node_idx]
    
    trans = node.translation if node.translation else [0.0, 0.0, 0.0]
    rot = node.rotation if node.rotation else [0.0, 0.0, 0.0, 1.0]
    scale = node.scale if node.scale else [1.0, 1.0, 1.0]
    
    if node.children:
        for child_idx in node.children:
            child_world = get_world_transform(gltf, child_idx, nodes, visited)
            # Actually we need parent transforms, not children
            pass
    
    # For root node, world = local
    # We need to traverse from root to this node
    return {'translation': trans, 'rotation': rot, 'scale': scale}

def compute_world_transform(gltf, nodes, root_idx, target_idx):
    """Compute world transform of target by traversing from root."""
    if root_idx == target_idx:
        node = nodes[target_idx]
        return {
            'translation': node.translation if node.translation else [0.0, 0.0, 0.0],
            'rotation': node.rotation if node.rotation else [0.0, 0.0, 0.0, 1.0],
            'scale': node.scale if node.scale else [1.0, 1.0, 1.0]
        }
    
    # BFS/DFS from root to target
    queue = [(root_idx, [0,0,0], [0,0,0,1], [1,1,1])]
    visited = {root_idx}
    
    while queue:
        idx, parent_trans, parent_rot, parent_scale = queue.pop(0)
        node = nodes[idx]
        
        local_trans = node.translation if node.translation else [0.0, 0.0, 0.0]
        local_rot = node.rotation if node.rotation else [0.0, 0.0, 0.0, 1.0]
        local_scale = node.scale if node.scale else [1.0, 1.0, 1.0]
        
        # Compose: world = parent * local
        # Scale first
        world_scale = [
            parent_scale[0] * local_scale[0],
            parent_scale[1] * local_scale[1],
            parent_scale[2] * local_scale[2]
        ]
        
        # Rotation
        world_rot = quat_multiply(parent_rot, local_rot)
        
        # Translation: parent_trans + parent_scale * (parent_rot * local_trans)
        rotated_local_trans = transform_point_by_quat(local_trans, parent_rot)
        world_trans = [
            parent_trans[0] + parent_scale[0] * rotated_local_trans[0],
            parent_trans[1] + parent_scale[1] * rotated_local_trans[1],
            parent_trans[2] + parent_scale[2] * rotated_local_trans[2]
        ]
        
        if idx == target_idx:
            return {
                'translation': world_trans,
                'rotation': world_rot,
                'scale': world_scale
            }
        
        for child_idx in node.children:
            if child_idx not in visited:
                visited.add(child_idx)
                queue.append((child_idx, world_trans, world_rot, world_scale))
    
    return None

def read_accessor_data(gltf, accessor_idx, blob):
    """Read accessor data and return array of vectors."""
    accessor = gltf.accessors[accessor_idx]
    buffer_view = gltf.bufferViews[accessor.bufferView]
    
    start = buffer_view.byteOffset + accessor.byteOffset
    type_count = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[accessor.type]
    end = start + accessor.count * type_count * 4
    
    data = blob[start:end]
    count = accessor.count
    
    values = []
    for i in range(count):
        offset = i * type_count * 4
        vec = []
        for j in range(type_count):
            val = struct.unpack('<f', data[offset + j*4:offset + j*4 + 4])[0]
            vec.append(val)
        values.append(vec)
    
    return values

def inspect_glb(filepath):
    print(f"\n{'='*60}")
    print(f"FILE: {filepath.name}")
    print(f"{'='*60}")
    
    blob = Path(filepath).read_bytes()
    gltf = GLTF2().load(str(filepath))
    nodes = gltf.nodes
    
    # Print nodes
    print("\n--- NODES ---")
    for i, node in enumerate(nodes):
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
    
    # Compute world transforms for all nodes
    print("\n--- WORLD TRANSFORMS (from model root) ---")
    world_transforms = {}
    for i in range(len(nodes)):
        wt = compute_world_transform(gltf, nodes, 0, i)
        if wt:
            world_transforms[i] = wt
            print(f"Node {i} ({nodes[i].name}):")
            print(f"  world_translation: [{wt['translation'][0]:.4f}, {wt['translation'][1]:.4f}, {wt['translation'][2]:.4f}]")
            print(f"  world_scale: [{wt['scale'][0]:.4f}, {wt['scale'][1]:.4f}, {wt['scale'][2]:.4f}]")
    
    # Compute mesh bounds in model root space
    print("\n--- MESH BOUNDS IN MODEL ROOT SPACE ---")
    all_vertices = []
    for i, node in enumerate(nodes):
        if node.mesh is None:
            continue
        
        mesh = gltf.meshes[node.mesh]
        wt = world_transforms.get(i)
        if not wt:
            continue
        
        for prim in mesh.primitives:
            if prim.attributes.POSITION is None:
                continue
            positions = read_accessor_data(gltf, prim.attributes.POSITION, blob)
            
            transformed = []
            for p in positions:
                # Scale
                x = p[0] * wt['scale'][0]
                y = p[1] * wt['scale'][1]
                z = p[2] * wt['scale'][2]
                
                # Rotate
                rx, ry, rz, rw = wt['rotation']
                # Full quaternion rotation
                qx = rx * x + ry * y + rz * z
                qy = rx * x - ry * y - rz * z  # This is wrong, need proper formula
                # Let me use the proper formula
                # v' = 2 * dot(q, v) * q / |q|^2 + (|q|^2 - 2 * dot(v, v)) * v / |q|^2
                # For unit quaternion: v' = v + 2*cross(qxyz, cross(qxyz, v) + qw*v)
                qx2 = rx * rx
                qy2 = ry * ry
                qz2 = rz * rz
                qw2 = rw * rw
                
                tx = 2 * (ry * z - rz * y)
                ty = 2 * (rz * x - rx * z)
                tz = 2 * (rx * y - ry * x)
                
                rx_out = x + rw * tx + ry * tz - rz * ty
                ry_out = y + rw * ty + rz * tx - rx * tz
                rz_out = z + rw * tz + rx * ty - ry * tx
                
                # Translate
                final = [
                    rx_out + wt['translation'][0],
                    ry_out + wt['translation'][1],
                    rz_out + wt['translation'][2]
                ]
                transformed.append(final)
                all_vertices.append(final)
            
            if transformed:
                min_x = min(p[0] for p in transformed)
                max_x = max(p[0] for p in transformed)
                min_y = min(p[1] for p in transformed)
                max_y = max(p[1] for p in transformed)
                min_z = min(p[2] for p in transformed)
                max_z = max(p[2] for p in transformed)
                
                print(f"Node {i} ({node.name}) Mesh {node.mesh}:")
                print(f"  X: [{min_x:.4f}, {max_x:.4f}] range={max_x-min_x:.4f}")
                print(f"  Y: [{min_y:.4f}, {max_y:.4f}] range={max_y-min_y:.4f}")
                print(f"  Z: [{min_z:.4f}, {max_z:.4f}] range={max_z-min_z:.4f}")
                print(f"  center: [{(min_x+max_x)/2:.4f}, {(min_y+max_y)/2:.4f}, {(min_z+max_z)/2:.4f}]")
    
    if all_vertices:
        min_x = min(p[0] for p in all_vertices)
        max_x = max(p[0] for p in all_vertices)
        min_y = min(p[1] for p in all_vertices)
        max_y = max(p[1] for p in all_vertices)
        min_z = min(p[2] for p in all_vertices)
        max_z = max(p[2] for p in all_vertices)
        
        print(f"\nOVERALL MODEL BOUNDS:")
        print(f"  X: [{min_x:.4f}, {max_x:.4f}] range={max_x-min_x:.4f}")
        print(f"  Y: [{min_y:.4f}, {max_y:.4f}] range={max_y-min_y:.4f}")
        print(f"  Z: [{min_z:.4f}, {max_z:.4f}] range={max_z-min_z:.4f}")
        print(f"  center: [{(min_x+max_x)/2:.4f}, {(min_y+max_y)/2:.4f}, {(min_z+max_z)/2:.4f}]")
        
        # Identify grip position (bottom of handle, lowest Y)
        sorted_by_y = sorted(all_vertices, key=lambda p: p[1])
        print(f"\n  Grip candidates (lowest Y):")
        for p in sorted_by_y[:5]:
            print(f"    ({p[0]:.4f}, {p[1]:.4f}, {p[2]:.4f})")

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

import json

with open('src/.expanse.json', 'r') as f:
    scene = json.load(f)

objects = scene['objects']
it_id = 'c9ebc1a7-e91e-417b-b829-d5063c0d3152'

# 1. Remove stencil portal component from Image Target
sc = 'c0f0a001-bbbb-4f4d-9a01-000000000001'
if sc in objects[it_id]['components']:
    del objects[it_id]['components'][sc]
    print("Removed Stencil Portal component")
else:
    print("Stencil Portal component not found (already removed)")

# 2. Remove single portal mask plane
pm = 'c0f0a001-aaaa-4f4d-9a01-000000000010'
if pm in objects:
    del objects[pm]
    print("Removed portal mask plane")
else:
    print("Portal mask plane not found (already removed)")

# 3. Add 4 hider walls forming frame around portal opening (~0.9 x 0.6)
hider_data = [
    ('c0f0a001-1111-4f4d-9a01-100000000001', 'Hider Top',    [0, 5.3, 0.001],    4.01),
    ('c0f0a001-1111-4f4d-9a01-100000000002', 'Hider Bottom', [0, -5.3, 0.001],   4.02),
    ('c0f0a001-1111-4f4d-9a01-100000000003', 'Hider Left',   [-5.45, 0, 0.001],  4.03),
    ('c0f0a001-1111-4f4d-9a01-100000000004', 'Hider Right',  [5.45, 0, 0.001],   4.04),
]
for wid, wname, wpos, worder in hider_data:
    objects[wid] = {
        "id": wid,
        "position": wpos,
        "rotation": [0, 0, 0, 1],
        "scale": [1, 1, 1],
        "geometry": {"type": "plane", "width": 10, "height": 10},
        "material": {"type": "hider"},
        "parentId": it_id,
        "components": {},
        "name": wname,
        "order": worder
    }
print("Added 4 hider walls")

# 4. Fix city position so it's BEHIND the image plane
# City bounding box: min(-273.8, -15.6, -39.85) max(0.2, 0.1, 75.05)
# At scale 0.035:
#   front (maxZ): 75.05 * 0.035 = 2.627
#   back (minZ): -39.85 * 0.035 = -1.395
#   With entity Z = -2.7: front at Z = -2.7 + 2.627 = -0.073 (BEHIND hider at Z=0.001)
#   CenterX = -136.8 * 0.035 = -4.788, offset +4.79 to center
#   Ground (minY) = -15.6 * 0.035 = -0.546, offset +0.25 to raise ground near bottom
cid = '91576797-b198-4057-89f6-e37f24fbb359'
objects[cid]['position'] = [4.79, 0.25, -2.7]
objects[cid]['rotation'] = [0, 0, 0, 1]
objects[cid]['scale'] = [0.035, 0.035, 0.035]
front_z = -2.7 + 75.05 * 0.035
status = "BEHIND" if front_z < 0.001 else "IN FRONT OF"
print(f"City: pos=[4.79, 0.25, -2.7], scale=0.035")
print(f"  Front face at Z={front_z:.3f} ({status} hider walls at Z=0.001)")

# 5. Sky background behind everything
sid = 'c0f0a001-1111-4f4d-9a01-100000000009'
objects[sid]['position'] = [0, 0.1, -5.0]
objects[sid]['geometry'] = {"type": "plane", "width": 6, "height": 6}
print("Sky background: Z=-5.0, 6x6")

# 6. Frame planes (thin dark border around portal opening)
frame_data = [
    ('c0f0a001-1111-4f4d-9a01-100000000005', 'Frame Top',    [0, 0.31, 0.002],   0.92, 0.02, 4.11),
    ('c0f0a001-1111-4f4d-9a01-100000000006', 'Frame Bottom', [0, -0.31, 0.002],  0.92, 0.02, 4.12),
    ('c0f0a001-1111-4f4d-9a01-100000000007', 'Frame Left',   [-0.46, 0, 0.002],  0.02, 0.64, 4.13),
    ('c0f0a001-1111-4f4d-9a01-100000000008', 'Frame Right',  [0.46, 0, 0.002],   0.02, 0.64, 4.14),
]
for fid, fname, fpos, fw, fh, forder in frame_data:
    objects[fid] = {
        "id": fid,
        "position": fpos,
        "rotation": [0, 0, 0, 1],
        "scale": [1, 1, 1],
        "geometry": {"type": "plane", "width": fw, "height": fh},
        "material": {"type": "unlit", "color": "#111111"},
        "parentId": it_id,
        "components": {},
        "name": fname,
        "order": forder
    }
print("Added 4 frame planes")

# Save
with open('src/.expanse.json', 'w') as f:
    json.dump(scene, f, indent=2)

# Validate
with open('src/.expanse.json', 'r') as f:
    json.load(f)
print("\nSaved and validated! JSON is VALID.")

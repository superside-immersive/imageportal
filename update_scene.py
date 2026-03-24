import json

with open('src/.expanse.json', 'r') as f:
    scene = json.load(f)

objects = scene['objects']

to_remove = [
    'c0f0a001-1111-4f4d-9a01-100000000001',
    'c0f0a001-1111-4f4d-9a01-100000000002',
    'c0f0a001-1111-4f4d-9a01-100000000003',
    'c0f0a001-1111-4f4d-9a01-100000000004',
    'c0f0a001-1111-4f4d-9a01-100000000005',
    'c0f0a001-1111-4f4d-9a01-100000000006',
    'c0f0a001-1111-4f4d-9a01-100000000007',
    'c0f0a001-1111-4f4d-9a01-100000000008',
]
removed = 0
for key in to_remove:
    if key in objects:
        del objects[key]
        removed += 1
print(f"Removed {removed} old hider/frame entities")

portal_mask_id = 'c0f0a001-aaaa-4f4d-9a01-000000000010'
objects[portal_mask_id] = {
    "id": portal_mask_id,
    "position": [0, 0, 0.001],
    "rotation": [0, 0, 0, 1],
    "scale": [1, 1, 1],
    "geometry": {
        "type": "plane",
        "width": 1.0,
        "height": 0.667
    },
    "material": {
        "type": "hider"
    },
    "parentId": "c9ebc1a7-e91e-417b-b829-d5063c0d3152",
    "components": {},
    "name": "Portal Mask",
    "order": 3.9
}
print("Added portal mask plane")

city_id = '91576797-b198-4057-89f6-e37f24fbb359'
objects[city_id]['position'] = [5.472, 0.291, -1.2]
objects[city_id]['rotation'] = [0, 0, 0, 1]
objects[city_id]['scale'] = [0.04, 0.04, 0.04]
print("Updated city position/rotation/scale")

sky_id = 'c0f0a001-1111-4f4d-9a01-100000000009'
objects[sky_id]['position'] = [0, 0.15, -3.0]
objects[sky_id]['geometry'] = {
    "type": "plane",
    "width": 4,
    "height": 4
}
print("Updated sky background")

image_target_id = 'c9ebc1a7-e91e-417b-b829-d5063c0d3152'
stencil_comp_id = 'c0f0a001-bbbb-4f4d-9a01-000000000001'
objects[image_target_id]['components'][stencil_comp_id] = {
    "id": stencil_comp_id,
    "name": "Stencil Portal",
    "parameters": {
        "portalMask": {"type": "entity", "id": portal_mask_id},
        "city": {"type": "entity", "id": city_id},
        "skyBackground": {"type": "entity", "id": sky_id}
    }
}
print("Added Stencil Portal component to Image Target")

with open('src/.expanse.json', 'w') as f:
    json.dump(scene, f, indent=2)

print("Scene updated successfully!")
with open('src/.expanse.json', 'r') as f:
    json.load(f)
print("JSON validation: VALID")

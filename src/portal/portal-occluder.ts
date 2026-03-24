import * as ecs from '@8thwall/ecs'

// Portal Occluder:
// - Uses the `BIG` mesh inside `shity.glb` as the portal shell.
// - Outside of `BIG`, an invisible depth-only clone hides interior content.
// - Inside of `BIG`, the original textured backfaces remain visible.
// - Old portal experiment content is hidden.

ecs.registerComponent({
  name: 'Portal Occluder',
  schema: {},
  schemaDefaults: {},
  stateMachine: ({world, eid}) => {
    let configured = false
    let tickCount = 0
    let didRecenter = false

    const hiddenSceneNames = new Set([
      'City Anchor',
      'Sky Background',
      'Frame Top',
      'Frame Bottom',
      'Frame Left',
      'Frame Right',
      '__portalOccluder',
      '__portalDemo',
    ])

    const hideLegacyContent = (container: any, modelRoot?: any) => {
      if (!container) return

      container.children.forEach((child: any) => {
        if (child === modelRoot) return
        if (!hiddenSceneNames.has(child.name)) return

        child.visible = false
      })
    }

    const makeOccluderMaterial = (THREE: any) => new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: true,
      depthTest: true,
      side: THREE.FrontSide,
    })

    const configureBigPortal = (modelRoot: any, THREE: any) => {
      if (!modelRoot) return false

      const bigMesh = modelRoot.getObjectByName('BIG') || modelRoot.getObjectByName('big')
      if (!bigMesh) return false

      if (!didRecenter) {
        const rootOffset = bigMesh.position.clone()
        modelRoot.children.forEach((child: any) => {
          child.position.sub(rootOffset)
        })
        modelRoot.rotation.set(0, Math.PI / 2, 0)
        didRecenter = true
      }

      modelRoot.traverse((node: any) => {
        if (!node.isMesh || !node.material) return

        if (node.userData.portalOccluder) return

        node.frustumCulled = false
        node.renderOrder = 1

        const materials = Array.isArray(node.material) ? node.material : [node.material]
        materials.forEach((material: any) => {
          material.depthTest = true
          material.depthWrite = true
          material.needsUpdate = true
        })
      })

      bigMesh.traverse((node: any) => {
        if (!node.isMesh || !node.material) return

        if (node.userData.portalOccluder) return

        const materials = Array.isArray(node.material) ? node.material : [node.material]
        materials.forEach((material: any) => {
          material.side = THREE.FrontSide
          material.depthTest = true
          material.depthWrite = true
          material.needsUpdate = true
        })

        node.renderOrder = 2
        node.frustumCulled = false

        const occluder = new THREE.Mesh(
          node.geometry,
          Array.isArray(node.material)
            ? node.material.map(() => makeOccluderMaterial(THREE))
            : makeOccluderMaterial(THREE)
        )

        occluder.name = `${node.name || 'BIG'}__outerOccluder`
        occluder.position.copy(node.position)
        occluder.quaternion.copy(node.quaternion)
        occluder.scale.copy(node.scale)
        occluder.renderOrder = 0
        occluder.frustumCulled = false
        occluder.matrixAutoUpdate = node.matrixAutoUpdate
        occluder.visible = true
        occluder.userData.portalOccluder = true

        const occluderMaterials = Array.isArray(occluder.material) ? occluder.material : [occluder.material]
        occluderMaterials.forEach((material: any) => {
          material.side = THREE.BackSide
          material.colorWrite = false
          material.depthWrite = true
          material.depthTest = true
          material.needsUpdate = true
        })

        node.parent?.add(occluder)
      })

      return true
    }

    ecs.defineState('default')
      .initial()
      .onTick(() => {
        tickCount += 1

        const three = world.three as any
        const THREE = (window as any).THREE
        if (!three || !THREE || !three.entityToObject) return

        const obj = three.entityToObject.get(eid)
        if (!obj) return

        const modelRoot = obj.getObjectByName('Portal Model') || obj.children.find((child: any) => child.name === 'Portal Model')
        hideLegacyContent(obj, modelRoot)

        if (configured) return

        if (tickCount < 180 || tickCount % 30 === 0) {
          configured = configureBigPortal(modelRoot, THREE)
        }
      })
  },
})

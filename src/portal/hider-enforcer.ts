import * as ecs from '@8thwall/ecs'
import {getPortalShellPanels} from './hider-shell'

ecs.registerComponent({
  name: 'Hider Enforcer',
  schema: {},
  schemaDefaults: {},
  stateMachine: ({world, eid}) => {
    let built = false
    const isDebug = new URLSearchParams(window.location.search).get('debugHider') === '1'

    ecs.defineState('default')
      .initial()
      .onTick(() => {
        if (built) return

        const three = world.three as any
        const THREE = (window as any).THREE
        if (!three || !THREE || !three.entityToObject) return

        const object = three.entityToObject.get(eid)
        if (!object) return

        built = true

        // Occluder material
        const mat = isDebug
          ? new THREE.MeshBasicMaterial({
              color: 0x00ff00,
              transparent: true,
              opacity: 0.25,
              side: THREE.DoubleSide,
              depthTest: true,
            })
          : (() => {
              const m = new THREE.MeshBasicMaterial({side: THREE.DoubleSide})
              m.colorWrite = false
              m.depthWrite = true
              m.depthTest  = true
              return m
            })()

        const ro = isDebug ? 10 : -1

        const add = (geo: any, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, name = '') => {
          const mesh = new THREE.Mesh(geo, mat)
          mesh.position.set(x, y, z)
          mesh.rotation.set(rx, ry, rz)
          mesh.name = name
          mesh.renderOrder   = ro
          mesh.frustumCulled = false
          object.add(mesh)
        }

        getPortalShellPanels().forEach((panel) => {
          add(
            new THREE.PlaneGeometry(panel.width, panel.height),
            panel.position[0],
            panel.position[1],
            panel.position[2],
            panel.rotation[0],
            panel.rotation[1],
            panel.rotation[2],
            panel.name
          )
        })

        console.log('[Hider Enforcer] hollow portal shell built from planes with image-target-sized opening')
      })
  },
})

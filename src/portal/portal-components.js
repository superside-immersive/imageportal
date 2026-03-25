const TARGET_HEIGHT = 1601 / 1200

const POSITION_EPSILON = 0.0001
const SCALE_EPSILON = 0.0001
const QUATERNION_DOT_EPSILON = 0.99999

const registerComponent = (name, definition) => {
  if (!window.AFRAME || window.AFRAME.components[name]) {
    return
  }

  window.AFRAME.registerComponent(name, definition)
}

const createDepthMaterial = (debug = false) => {
  const {THREE} = window

  if (debug) {
    return new THREE.MeshBasicMaterial({
      color: 0x22ff88,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: true,
    })
  }

  const material = new THREE.MeshBasicMaterial({side: THREE.DoubleSide})
  material.colorWrite = false
  material.depthWrite = true
  material.depthTest = true
  return material
}

registerComponent('depth-mask', {
  schema: {
    debug: {default: false},
  },

  init() {
    this.applyDepthMask = this.applyDepthMask.bind(this)
    this.el.addEventListener('object3dset', this.applyDepthMask)
    this.el.addEventListener('model-loaded', this.applyDepthMask)
    this.applyDepthMask()
  },

  applyDepthMask() {
    const mesh = this.el.getObject3D('mesh') || this.el.object3D
    if (!mesh) {
      return
    }

    mesh.traverse((object) => {
      if (!object.isMesh) {
        return
      }

      object.material = createDepthMaterial(this.data.debug)
      object.renderOrder = this.data.debug ? 10 : -1
      object.frustumCulled = !this.data.debug
    })
  },

  remove() {
    this.el.removeEventListener('object3dset', this.applyDepthMask)
    this.el.removeEventListener('model-loaded', this.applyDepthMask)
  },
})

registerComponent('bob', {
  schema: {
    distance: {default: 0.15},
    duration: {default: 1000},
  },

  init() {
    const {el, data} = this
    const {position} = el.object3D
    data.initialY = position.y
    data.direction = 1
    data.elapsed = 0
  },

  tick(_, delta = 16) {
    const {data, el} = this
    const cycle = Math.max(data.duration * 2, 1)
    data.elapsed = (data.elapsed + delta) % cycle
    const t = data.elapsed / cycle
    const y = data.initialY + Math.sin(t * Math.PI * 2) * data.distance
    el.object3D.position.y = y
  },
})

registerComponent('unlit-model', {
  schema: {
    doubleSided: {default: false},
  },

  init() {
    this.applyUnlitMaterials = this.applyUnlitMaterials.bind(this)
    this.el.addEventListener('model-loaded', this.applyUnlitMaterials)
    this.el.addEventListener('object3dset', this.applyUnlitMaterials)
    this.applyUnlitMaterials()
  },

  applyUnlitMaterials() {
    const {THREE} = window
    const mesh = this.el.getObject3D('mesh')

    if (!THREE || !mesh) {
      return
    }

    mesh.traverse((object) => {
      if (!object.isMesh || !object.material) {
        return
      }

      const materials = Array.isArray(object.material) ? object.material : [object.material]
      const nextMaterials = materials.map((material) => {
        const nextMaterial = new THREE.MeshBasicMaterial({
          map: material.map || null,
          color: material.color ? material.color.clone() : new THREE.Color(0xffffff),
          transparent: material.transparent === true,
          opacity: material.opacity ?? 1,
          alphaTest: material.alphaTest ?? 0,
          side: this.data.doubleSided ? THREE.DoubleSide : material.side,
        })
        nextMaterial.name = `${material.name || 'unlit'}-basic`
        return nextMaterial
      })

      object.material = Array.isArray(object.material) ? nextMaterials : nextMaterials[0]
      object.castShadow = false
      object.receiveShadow = false
      object.frustumCulled = true
    })
  },

  remove() {
    this.el.removeEventListener('model-loaded', this.applyUnlitMaterials)
    this.el.removeEventListener('object3dset', this.applyUnlitMaterials)
  },
})

// Portal component – uses the 8th Wall hider-walls depth-occlusion approach:
// hider-walls (depth-mask material, colorWrite:false, depthWrite:true) form a closed box
// around the camera with exactly one rectangular opening (the image target).
// Content behind the opening is visible; camera feed shows everywhere else.
// User is ALWAYS outside the portal (never walks through).
registerComponent('portal', {
  schema: {
    width:  {default: 1},
    height: {default: TARGET_HEIGHT},
  },

  init() {
    this.contents  = this.el.querySelector('[data-portal-contents]')
    this.hiderWalls = this.el.querySelector('[data-hider-walls]')

    if (this.contents)  this.contents.object3D.visible  = true
    if (this.hiderWalls) this.hiderWalls.object3D.visible = true
  },
})

registerComponent('image-target-anchor', {
  schema: {
    name: {type: 'string', default: 'poster2'},
    positionSmoothing: {default: 0.18},
    rotationSmoothing: {default: 0.16},
    scaleSmoothing: {default: 0.2},
  },

  init() {
    const {THREE} = window

    this.onTracked = this.onTracked.bind(this)
    this.onLost = this.onLost.bind(this)
    this.onCameraStatus = this.onCameraStatus.bind(this)
    this.previewEnabled = !new URLSearchParams(window.location.search).has('noDesktopPreview')
    this.hasTrackedPose = false
    this.targetPosition = new THREE.Vector3()
    this.targetQuaternion = new THREE.Quaternion()
    this.targetScale = new THREE.Vector3(1, 1, 1)

    this.el.object3D.visible = false
    this.el.sceneEl.addEventListener('xrimagefound', this.onTracked)
    this.el.sceneEl.addEventListener('xrimageupdated', this.onTracked)
    this.el.sceneEl.addEventListener('xrimagelost', this.onLost)
    this.el.sceneEl.addEventListener('camerastatuschange', this.onCameraStatus)
  },

  onTracked(event) {
    const detail = event.detail || {}

    if (detail.name !== this.data.name) {
      return
    }

    const {object3D} = this.el
    const position = detail.position || {x: 0, y: 0, z: 0}
    const rotation = detail.rotation || {x: 0, y: 0, z: 0, w: 1}
    const scale = detail.scale || 1

    this.targetPosition.set(position.x, position.y, position.z)
    this.targetQuaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
    this.targetScale.set(scale, scale, scale)

    if (!this.hasTrackedPose) {
      object3D.position.copy(this.targetPosition)
      object3D.quaternion.copy(this.targetQuaternion)
      object3D.scale.copy(this.targetScale)
      this.hasTrackedPose = true
    }

    object3D.visible = true
  },

  tick() {
    const {object3D} = this.el

    if (!this.hasTrackedPose || !object3D.visible) {
      return
    }

    if (object3D.position.distanceToSquared(this.targetPosition) > POSITION_EPSILON) {
      object3D.position.lerp(this.targetPosition, this.data.positionSmoothing)
    } else {
      object3D.position.copy(this.targetPosition)
    }

    if (Math.abs(object3D.quaternion.dot(this.targetQuaternion)) < QUATERNION_DOT_EPSILON) {
      object3D.quaternion.slerp(this.targetQuaternion, this.data.rotationSmoothing)
    } else {
      object3D.quaternion.copy(this.targetQuaternion)
    }

    if (object3D.scale.distanceToSquared(this.targetScale) > SCALE_EPSILON) {
      object3D.scale.lerp(this.targetScale, this.data.scaleSmoothing)
    } else {
      object3D.scale.copy(this.targetScale)
    }
  },

  onLost(event) {
    const detail = event.detail || {}

    if (detail.name !== this.data.name) {
      return
    }

    if (!this.previewEnabled) {
      this.el.object3D.visible = false
    }
  },

  onCameraStatus(event) {
    const status = event.detail?.status
    if (status === 'hasDesktop3D' && this.previewEnabled) {
      this.el.object3D.position.set(0, 0, 0)
      this.el.object3D.quaternion.identity()
      this.el.object3D.scale.set(1, 1, 1)
      this.hasTrackedPose = false
      this.el.object3D.visible = true
    }
  },

  remove() {
    this.el.sceneEl.removeEventListener('xrimagefound', this.onTracked)
    this.el.sceneEl.removeEventListener('xrimageupdated', this.onTracked)
    this.el.sceneEl.removeEventListener('xrimagelost', this.onLost)
    this.el.sceneEl.removeEventListener('camerastatuschange', this.onCameraStatus)
  },
})
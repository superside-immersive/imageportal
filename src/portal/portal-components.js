const TARGET_HEIGHT = 1601 / 1200

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
      object.frustumCulled = false
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

registerComponent('portal', {
  schema: {
    width: {default: 1},
    height: {default: TARGET_HEIGHT},
    depth: {default: 3},
  },

  init() {
    this.camera = document.getElementById('camera')
    this.contents = this.el.querySelector('[data-portal-contents]')
    this.walls = this.el.querySelector('[data-hider-walls]')
    this.portalWall = this.el.querySelector('[data-portal-wall]')
    this.isInPortalSpace = false
    this.wasOutside = true
    this.localCameraPosition = new window.THREE.Vector3()
  },

  tick() {
    if (!this.camera || !this.contents || !this.walls || !this.portalWall) {
      return
    }

    this.camera.object3D.getWorldPosition(this.localCameraPosition)
    this.el.object3D.worldToLocal(this.localCameraPosition)

    const isOutside = this.localCameraPosition.z > this.data.depth / 2
    const withinPortalBounds =
      Math.abs(this.localCameraPosition.x) < this.data.width / 2 &&
      Math.abs(this.localCameraPosition.y) < this.data.height / 2

    if (this.wasOutside !== isOutside && withinPortalBounds) {
      this.isInPortalSpace = !isOutside
    }

    this.contents.object3D.visible = this.isInPortalSpace || isOutside
    this.walls.object3D.visible = !this.isInPortalSpace && isOutside
    this.portalWall.object3D.visible = this.isInPortalSpace && !isOutside
    this.wasOutside = isOutside
  },
})

registerComponent('image-target-anchor', {
  schema: {
    name: {type: 'string', default: 'poster2'},
  },

  init() {
    this.onTracked = this.onTracked.bind(this)
    this.onLost = this.onLost.bind(this)
    this.onCameraStatus = this.onCameraStatus.bind(this)
    this.previewEnabled = !new URLSearchParams(window.location.search).has('noDesktopPreview')

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

    object3D.position.set(position.x, position.y, position.z)
    object3D.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
    object3D.scale.set(scale, scale, scale)
    object3D.visible = true
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
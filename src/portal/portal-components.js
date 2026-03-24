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
    const {THREE} = window
    this.THREE = THREE
    this.portalWall = this.el.querySelector('[data-portal-wall]')
    this.contents = this.el.querySelector('[data-portal-contents]')

    // ── Stencil-based portal ──
    // 1. The portal-wall plane writes stencil=1 (no color, no depth)
    // 2. All portal content only renders where stencil=1 (the opening)
    // 3. Outside the opening → camera feed shows through (no 3D)

    this._setupStencilMask()

    if (this.contents) {
      this.contents.object3D.visible = true
    }

    // Apply stencil test to content meshes (multiple attempts for async loading)
    const applyStencil = () => this._applyStencilToContents()

    const cityEl = this.el.querySelector('#portal-city')
    if (cityEl) {
      cityEl.addEventListener('model-loaded', applyStencil)
    }

    this.el.sceneEl.addEventListener('loaded', () => {
      applyStencil()
      setTimeout(applyStencil, 500)
      setTimeout(applyStencil, 2000)
      setTimeout(applyStencil, 5000)
    })
  },

  _setupStencilMask() {
    if (!this.portalWall) return
    const {THREE} = this

    const applyMask = () => {
      const mesh = this.portalWall.getObject3D('mesh')
      if (!mesh) return false

      mesh.traverse((obj) => {
        if (obj.isMesh) {
          obj.material = new THREE.MeshBasicMaterial({
            colorWrite: false,
            depthWrite: false,
            stencilWrite: true,
            stencilRef: 1,
            stencilFunc: THREE.AlwaysStencilFunc,
            stencilZPass: THREE.ReplaceStencilOp,
            stencilFail: THREE.KeepStencilOp,
            stencilZFail: THREE.KeepStencilOp,
          })
          obj.renderOrder = -1
          obj.frustumCulled = false
        }
      })

      this.portalWall.object3D.visible = true
      return true
    }

    if (!applyMask()) {
      this.portalWall.addEventListener('object3dset', () => applyMask())
    }
  },

  _applyStencilToContents() {
    if (!this.contents) return
    const {THREE} = this

    this.contents.object3D.traverse((obj) => {
      if (obj.isMesh && obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        mats.forEach((mat) => {
          mat.stencilWrite = true
          mat.stencilRef = 1
          mat.stencilFunc = THREE.EqualStencilFunc
          mat.stencilFail = THREE.KeepStencilOp
          mat.stencilZFail = THREE.KeepStencilOp
          mat.stencilZPass = THREE.KeepStencilOp
          mat.needsUpdate = true
        })
        obj.renderOrder = 1
      }
    })
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
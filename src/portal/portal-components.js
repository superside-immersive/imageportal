const TARGET_HEIGHT = 1210 / 908

// Smoothing removed – direct pose copy every frame for zero-drift tracking

const registerComponent = (name, definition) => {
  if (!window.AFRAME || window.AFRAME.components[name]) {
    return
  }

  window.AFRAME.registerComponent(name, definition)
}

// Shared depth-mask material instances (one per debug mode) – avoids
// creating a new material for every mesh on every a-plane/a-box.
let _depthMaterial = null
let _depthMaterialDebug = null

const getSharedDepthMaterial = (debug = false) => {
  const {THREE} = window

  if (debug) {
    if (!_depthMaterialDebug) {
      _depthMaterialDebug = new THREE.MeshBasicMaterial({
        color: 0x22ff88,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
        depthTest: true,
        depthWrite: true,
      })
    }
    return _depthMaterialDebug
  }

  if (!_depthMaterial) {
    _depthMaterial = new THREE.MeshBasicMaterial({side: THREE.DoubleSide})
    _depthMaterial.colorWrite = false
    _depthMaterial.depthWrite = true
    _depthMaterial.depthTest = true
  }
  return _depthMaterial
}

registerComponent('depth-mask', {
  schema: {
    debug: {default: false},
  },

  init() {
    this.applied = false
    this.currentDebug = this.data.debug
    this.applyDepthMask = this.applyDepthMask.bind(this)
    this.el.addEventListener('object3dset', this.applyDepthMask)
    this.el.addEventListener('model-loaded', this.applyDepthMask)
    this.applyDepthMask()
  },

  update() {
    if (this.currentDebug === this.data.debug) {
      return
    }

    this.currentDebug = this.data.debug
    this.applied = false
    this.applyDepthMask()
  },

  applyDepthMask() {
    if (this.applied) return

    const mesh = this.el.getObject3D('mesh') || this.el.object3D
    if (!mesh) {
      return
    }

    const mat = getSharedDepthMaterial(this.data.debug)
    const ro = this.data.debug ? 10 : -1
    const fc = !this.data.debug

    mesh.traverse((object) => {
      if (!object.isMesh) {
        return
      }

      object.material = mat
      object.renderOrder = ro
      object.frustumCulled = fc
    })

    this.applied = true
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
    this.applied = false
    this.applyUnlitMaterials = this.applyUnlitMaterials.bind(this)
    this.el.addEventListener('model-loaded', this.applyUnlitMaterials)
    this.el.addEventListener('object3dset', this.applyUnlitMaterials)
    this.applyUnlitMaterials()
  },

  applyUnlitMaterials() {
    if (this.applied) return

    const {THREE} = window
    const mesh = this.el.getObject3D('mesh')

    if (!THREE || !mesh) {
      return
    }

    const side = this.data.doubleSided ? THREE.DoubleSide : undefined

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
          side: side !== undefined ? side : material.side,
        })
        nextMaterial.name = `${material.name || 'unlit'}-basic`
        return nextMaterial
      })

      object.material = Array.isArray(object.material) ? nextMaterials : nextMaterials[0]
      object.castShadow = false
      object.receiveShadow = false
    })

    this.applied = true
  },

  remove() {
    this.el.removeEventListener('model-loaded', this.applyUnlitMaterials)
    this.el.removeEventListener('object3dset', this.applyUnlitMaterials)
  },
})

registerComponent('gltf-loop-animation', {
  schema: {
    clip: {type: 'string', default: '*'},
    timeScale: {default: 1},
  },

  init() {
    this.mixer = null
    this.actions = []
    this.playAnimations = this.playAnimations.bind(this)
    this.el.addEventListener('model-loaded', this.playAnimations)
    this.playAnimations()
  },

  playAnimations() {
    const {THREE} = window
    const mesh = this.el.getObject3D('mesh')

    if (!THREE || !mesh) {
      return
    }

    const clips = mesh.animations || []

    if (clips.length === 0) {
      return
    }

    if (this.mixer) {
      this.mixer.stopAllAction()
    }

    const selectedClips = this.data.clip === '*'
      ? clips
      : clips.filter((clip) => clip.name === this.data.clip)

    if (selectedClips.length === 0) {
      return
    }

    this.mixer = new THREE.AnimationMixer(mesh)
    this.actions = selectedClips.map((clip) => {
      const action = this.mixer.clipAction(clip)
      action.setLoop(THREE.LoopRepeat, Infinity)
      action.clampWhenFinished = false
      action.enabled = true
      action.timeScale = this.data.timeScale
      action.play()
      return action
    })
  },

  tick(_, delta = 0) {
    if (!this.mixer || delta <= 0) {
      return
    }

    this.mixer.update(delta / 1000)
  },

  remove() {
    this.el.removeEventListener('model-loaded', this.playAnimations)

    if (this.mixer) {
      this.mixer.stopAllAction()
      this.mixer.uncacheRoot(this.el.getObject3D('mesh'))
    }

    this.actions = []
    this.mixer = null
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
    name: {type: 'string', default: 'download-1773332030950-2-2'},
  },

  init() {
    const {THREE} = window

    this.onTracked = this.onTracked.bind(this)
    this.onLost = this.onLost.bind(this)
    this.onCameraStatus = this.onCameraStatus.bind(this)
    this.previewEnabled = !new URLSearchParams(window.location.search).has('noDesktopPreview')
    this.hasTrackedPose = false
    this._tmpPos = new THREE.Vector3()
    this._tmpQuat = new THREE.Quaternion()

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

    this.hasTrackedPose = true
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
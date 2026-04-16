const STORAGE_KEY = 'portal-editor-config-v1'

// theta = horizontal rotation in degrees (0 = looking from +Z)
// phi = vertical angle in degrees from top pole (90 = horizon, <90 = above, >90 = below)
const DEFAULT_CAMERA_VIEW = {
  target: {x: 0, y: 0, z: -13},
  distance: 16,
  theta: 0,
  phi: 75,
}

const VIEW_PRESETS = {
  reset: {...DEFAULT_CAMERA_VIEW},
  front: {target: {x: 0, y: 0, z: -13}, distance: 16, theta: 0, phi: 90},
  iso: {target: {x: 0, y: 0, z: -13}, distance: 18, theta: 35, phi: 70},
  top: {target: {x: 0, y: 0, z: -13}, distance: 20, theta: 0, phi: 5},
}

const normalizeWheelDelta = (event) => {
  const multiplier = event.deltaMode === 1 ? 14 : event.deltaMode === 2 ? 120 : 1
  return event.deltaY * multiplier
}

const copyVec3 = (value) => ({x: Number(value.x), y: Number(value.y), z: Number(value.z)})

const applyCameraView = (camera, view) => {
  if (!camera) {
    return
  }

  const target = copyVec3(view.target || DEFAULT_CAMERA_VIEW.target)
  const distance = Number(view.distance || DEFAULT_CAMERA_VIEW.distance)
  const theta = Number(view.theta ?? DEFAULT_CAMERA_VIEW.theta)
  const phi = Number(view.phi ?? DEFAULT_CAMERA_VIEW.phi)

  camera.setAttribute(
    'editor-camera-controls',
    `target: ${target.x} ${target.y} ${target.z}; distance: ${distance}; theta: ${theta}; phi: ${phi}`
  )
}

const fitCameraToElements = (camera, elements) => {
  if (!camera || !window.AFRAME?.THREE) {
    return
  }

  const {THREE} = window.AFRAME
  const box = new THREE.Box3()

  elements
    .filter(Boolean)
    .forEach((element) => {
      const object3D = element.object3D || element
      if (!object3D) {
        return
      }

      const nextBox = new THREE.Box3().setFromObject(object3D)
      if (!nextBox.isEmpty()) {
        box.union(nextBox)
      }
    })

  if (box.isEmpty()) {
    applyCameraView(camera, VIEW_PRESETS.reset)
    return
  }

  const size = new THREE.Vector3()
  const center = new THREE.Vector3()
  box.getSize(size)
  box.getCenter(center)
  const radius = Math.max(size.x, size.y, size.z, 1)

  applyCameraView(camera, {
    target: {x: round(center.x), y: round(center.y), z: round(center.z)},
    distance: round(Math.min(Math.max(radius * 2.4, 3.8), 28), 3),
    theta: 35,
    phi: 70,
  })
}

const ensureEditorCameraControls = () => {
  if (!window.AFRAME || window.AFRAME.components['editor-camera-controls']) {
    return
  }

  const {THREE} = window.AFRAME
  const DEG2RAD = THREE.MathUtils.degToRad

  window.AFRAME.registerComponent('editor-camera-controls', {
    schema: {
      target: {type: 'vec3', default: DEFAULT_CAMERA_VIEW.target},
      distance: {default: DEFAULT_CAMERA_VIEW.distance},
      minDistance: {default: 0.2},
      maxDistance: {default: 1000},
      theta: {default: 0},
      phi: {default: 75},
    },

    init() {
      this.targetVec = new THREE.Vector3(this.data.target.x, this.data.target.y, this.data.target.z)
      this.spherical = new THREE.Spherical()
      this.syncSpherical()
      this.dragMode = null
      this.pointerAttached = false
      this.onMouseDown = this.onMouseDown.bind(this)
      this.onMouseMove = this.onMouseMove.bind(this)
      this.onMouseUp = this.onMouseUp.bind(this)
      this.onWheel = this.onWheel.bind(this)
      this.onContextMenu = this.onContextMenu.bind(this)
      this.attachWhenReady = this.attachWhenReady.bind(this)
      this.onKeyDown = this.onKeyDown.bind(this)

      this.attachWhenReady()
      this.updateCamera()
      window.addEventListener('keydown', this.onKeyDown)
    },

    remove() {
      this.detachPointerListeners()
      window.removeEventListener('keydown', this.onKeyDown)
    },

    update(oldData) {
      if (!oldData) {
        return
      }

      this.targetVec.set(this.data.target.x, this.data.target.y, this.data.target.z)
      this.syncSpherical()
      this.updateCamera()
    },

    syncSpherical() {
      this.spherical.set(
        this.data.distance,
        DEG2RAD(THREE.MathUtils.clamp(this.data.phi, 1, 179)),
        DEG2RAD(this.data.theta)
      )
    },

    attachWhenReady() {
      const canvas = this.el.sceneEl?.canvas
      if (!canvas) {
        this.el.sceneEl?.addEventListener('renderstart', this.attachWhenReady, {once: true})
        return
      }

      if (this.pointerAttached) {
        return
      }

      this.pointerAttached = true
      canvas.style.cursor = 'grab'
      canvas.addEventListener('mousedown', this.onMouseDown)
      canvas.addEventListener('wheel', this.onWheel, {passive: false})
      canvas.addEventListener('contextmenu', this.onContextMenu)
    },

    detachPointerListeners() {
      const canvas = this.el.sceneEl?.canvas
      if (!canvas) {
        return
      }

      canvas.removeEventListener('mousedown', this.onMouseDown)
      canvas.removeEventListener('wheel', this.onWheel)
      canvas.removeEventListener('contextmenu', this.onContextMenu)
      window.removeEventListener('mousemove', this.onMouseMove)
      window.removeEventListener('mouseup', this.onMouseUp)
      this.pointerAttached = false
    },

    onContextMenu(event) {
      event.preventDefault()
    },

    onMouseDown(event) {
      if (event.target.closest?.('.portal-editor')) {
        return
      }

      event.preventDefault()
      this.dragMode = event.button === 1 || event.button === 2 ? 'pan' : 'orbit'
      this.lastX = event.clientX
      this.lastY = event.clientY
      this.el.sceneEl.canvas.style.cursor = this.dragMode === 'pan' ? 'move' : 'grabbing'
      window.addEventListener('mousemove', this.onMouseMove)
      window.addEventListener('mouseup', this.onMouseUp)
    },

    onMouseMove(event) {
      if (!this.dragMode) {
        return
      }

      const dx = event.clientX - this.lastX
      const dy = event.clientY - this.lastY
      this.lastX = event.clientX
      this.lastY = event.clientY

      if (this.dragMode === 'orbit') {
        this.spherical.theta -= dx * 0.005
        this.spherical.phi += dy * 0.005
        this.spherical.phi = THREE.MathUtils.clamp(this.spherical.phi, DEG2RAD(1), DEG2RAD(179))
      } else {
        const offset = new THREE.Vector3().setFromSpherical(this.spherical).normalize()
        const camUp = new THREE.Vector3(0, 1, 0)
        const right = new THREE.Vector3().crossVectors(camUp, offset).normalize()
        const up = new THREE.Vector3().crossVectors(offset, right).normalize()
        const panScale = this.spherical.radius * 0.002
        this.targetVec.addScaledVector(right, dx * panScale)
        this.targetVec.addScaledVector(up, dy * panScale)
      }

      this.updateCamera()
    },

    onMouseUp() {
      this.dragMode = null
      if (this.el.sceneEl?.canvas) {
        this.el.sceneEl.canvas.style.cursor = 'grab'
      }
      window.removeEventListener('mousemove', this.onMouseMove)
      window.removeEventListener('mouseup', this.onMouseUp)
    },

    onWheel(event) {
      event.preventDefault()
      const delta = THREE.MathUtils.clamp(normalizeWheelDelta(event), -300, 300)
      const zoomFactor = 1 + delta * 0.003
      this.spherical.radius = THREE.MathUtils.clamp(
        this.spherical.radius * zoomFactor,
        this.data.minDistance,
        this.data.maxDistance
      )
      this.updateCamera()
    },

    onKeyDown(event) {
      const tagName = event.target?.tagName
      if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
        return
      }

      let handled = true
      switch (event.key) {
        case 'ArrowLeft':
          this.spherical.theta += 0.07
          break
        case 'ArrowRight':
          this.spherical.theta -= 0.07
          break
        case 'ArrowUp':
          this.spherical.phi = THREE.MathUtils.clamp(this.spherical.phi - 0.05, DEG2RAD(1), DEG2RAD(179))
          break
        case 'ArrowDown':
          this.spherical.phi = THREE.MathUtils.clamp(this.spherical.phi + 0.05, DEG2RAD(1), DEG2RAD(179))
          break
        case '+':
        case '=':
          this.spherical.radius = THREE.MathUtils.clamp(this.spherical.radius * 0.9, this.data.minDistance, this.data.maxDistance)
          break
        case '-':
        case '_':
          this.spherical.radius = THREE.MathUtils.clamp(this.spherical.radius * 1.12, this.data.minDistance, this.data.maxDistance)
          break
        case '0':
          this.targetVec.set(DEFAULT_CAMERA_VIEW.target.x, DEFAULT_CAMERA_VIEW.target.y, DEFAULT_CAMERA_VIEW.target.z)
          this.syncSpherical()
          break
        default:
          handled = false
      }

      if (!handled) {
        return
      }

      event.preventDefault()
      this.updateCamera()
    },

    updateCamera() {
      const offset = new THREE.Vector3().setFromSpherical(this.spherical)
      const position = new THREE.Vector3().copy(this.targetVec).add(offset)
      this.el.object3D.position.copy(position)
      this.el.object3D.lookAt(this.targetVec)
    },
  })
}

const round = (value, precision = 4) => Number(Number(value || 0).toFixed(precision))

const EDITABLE_NODES = [
  {
    id: 'camera',
    label: 'Camera',
    selector: '#camera',
    fields: [
      {key: 'position', label: 'Position', type: 'vec3', attr: 'position', step: 0.01},
      {key: 'rotation', label: 'Rotation', type: 'vec3', attr: 'rotation', step: 1},
    ],
  },
  {
    id: 'target-anchor',
    label: 'Target Anchor',
    selector: '#target-anchor',
    fields: [
      {key: 'position', label: 'Position', type: 'vec3', attr: 'position', step: 0.01},
      {key: 'rotation', label: 'Rotation', type: 'vec3', attr: 'rotation', step: 1},
      {key: 'scale', label: 'Scale', type: 'vec3', attr: 'scale', step: 0.01},
    ],
  },
  {
    id: 'portal-root',
    label: 'Portal Root',
    selector: '#portal-root',
    fields: [
      {key: 'position', label: 'Position', type: 'vec3', attr: 'position', step: 0.01},
      {key: 'rotation', label: 'Rotation', type: 'vec3', attr: 'rotation', step: 1},
      {key: 'scale', label: 'Scale', type: 'vec3', attr: 'scale', step: 0.01},
      {key: 'portal.width', label: 'Portal Width', type: 'number', attr: 'portal', prop: 'width', step: 0.01, min: 0.1},
      {key: 'portal.height', label: 'Portal Height', type: 'number', attr: 'portal', prop: 'height', step: 0.01, min: 0.1},
      {key: 'portal.depth', label: 'Portal Depth', type: 'number', attr: 'portal', prop: 'depth', step: 0.01, min: 0.1},
    ],
  },
  {
    id: 'portal-wall',
    label: 'Portal Wall',
    selector: '#portal-wall',
    fields: [
      {key: 'position', label: 'Position', type: 'vec3', attr: 'position', step: 0.01},
      {key: 'rotation', label: 'Rotation', type: 'vec3', attr: 'rotation', step: 1},
      {key: 'width', label: 'Width', type: 'number', attr: 'width', step: 0.01, min: 0.01},
      {key: 'height', label: 'Height', type: 'number', attr: 'height', step: 0.01, min: 0.01},
    ],
  },
  {
    id: 'portal-city',
    label: 'City Model',
    selector: '#portal-city',
    fields: [
      {key: 'position', label: 'Position', type: 'vec3', attr: 'position', step: 0.01},
      {key: 'rotation', label: 'Rotation', type: 'vec3', attr: 'rotation', step: 1},
      {key: 'scale', label: 'Scale', type: 'vec3', attr: 'scale', step: 0.01},
    ],
  },
  {
    id: 'portal-orb',
    label: 'Floating Orb',
    selector: '#portal-orb',
    fields: [
      {key: 'position', label: 'Position', type: 'vec3', attr: 'position', step: 0.01},
      {key: 'radius', label: 'Radius', type: 'number', attr: 'radius', step: 0.01, min: 0.01},
      {key: 'material.color', label: 'Color', type: 'color', attr: 'material', prop: 'color'},
      {key: 'bob.distance', label: 'Bob Distance', type: 'number', attr: 'bob', prop: 'distance', step: 0.01, min: 0},
      {key: 'bob.duration', label: 'Bob Duration', type: 'number', attr: 'bob', prop: 'duration', step: 10, min: 0},
    ],
  },
  {
    id: 'portal-key-light',
    label: 'Key Light',
    selector: '#portal-key-light',
    fields: [
      {key: 'position', label: 'Position', type: 'vec3', attr: 'position', step: 0.01},
      {key: 'light.intensity', label: 'Intensity', type: 'number', attr: 'light', prop: 'intensity', step: 0.05, min: 0},
    ],
  },
  {
    id: 'portal-ambient-light',
    label: 'Ambient Light',
    selector: '#portal-ambient-light',
    fields: [
      {key: 'light.intensity', label: 'Intensity', type: 'number', attr: 'light', prop: 'intensity', step: 0.05, min: 0},
      {key: 'light.color', label: 'Color', type: 'color', attr: 'light', prop: 'color'},
    ],
  },
  {
    id: 'portal-floor',
    label: 'Floor',
    selector: '#portal-floor',
    fields: [
      {key: 'position', label: 'Position', type: 'vec3', attr: 'position', step: 0.01},
      {key: 'rotation', label: 'Rotation', type: 'vec3', attr: 'rotation', step: 1},
      {key: 'radius', label: 'Radius', type: 'number', attr: 'radius', step: 0.01, min: 0.01},
      {key: 'material.color', label: 'Color', type: 'color', attr: 'material', prop: 'color'},
      {key: 'material.opacity', label: 'Opacity', type: 'number', attr: 'material', prop: 'opacity', step: 0.01, min: 0, max: 1},
    ],
  },
  {
    id: 'portal-sky',
    label: 'Sky Sphere',
    selector: '#portal-sky',
    fields: [
      {key: 'position', label: 'Position', type: 'vec3', attr: 'position', step: 0.01},
      {key: 'radius', label: 'Radius', type: 'number', attr: 'radius', step: 0.05, min: 0.1},
      {key: 'material.color', label: 'Color', type: 'color', attr: 'material', prop: 'color'},
    ],
  },
  {
    id: 'portal-frame-left',
    label: 'Frame Left',
    selector: '#portal-frame-left',
    fields: [
      {key: 'position', label: 'Position', type: 'vec3', attr: 'position', step: 0.01},
      {key: 'width', label: 'Width', type: 'number', attr: 'width', step: 0.01, min: 0.01},
      {key: 'height', label: 'Height', type: 'number', attr: 'height', step: 0.01, min: 0.01},
      {key: 'depth', label: 'Depth', type: 'number', attr: 'depth', step: 0.01, min: 0.01},
      {key: 'color', label: 'Color', type: 'color', attr: 'color'},
    ],
  },
  {
    id: 'portal-frame-right',
    label: 'Frame Right',
    selector: '#portal-frame-right',
    fields: [
      {key: 'position', label: 'Position', type: 'vec3', attr: 'position', step: 0.01},
      {key: 'width', label: 'Width', type: 'number', attr: 'width', step: 0.01, min: 0.01},
      {key: 'height', label: 'Height', type: 'number', attr: 'height', step: 0.01, min: 0.01},
      {key: 'depth', label: 'Depth', type: 'number', attr: 'depth', step: 0.01, min: 0.01},
      {key: 'color', label: 'Color', type: 'color', attr: 'color'},
    ],
  },
  {
    id: 'portal-frame-top',
    label: 'Frame Top',
    selector: '#portal-frame-top',
    fields: [
      {key: 'position', label: 'Position', type: 'vec3', attr: 'position', step: 0.01},
      {key: 'width', label: 'Width', type: 'number', attr: 'width', step: 0.01, min: 0.01},
      {key: 'height', label: 'Height', type: 'number', attr: 'height', step: 0.01, min: 0.01},
      {key: 'depth', label: 'Depth', type: 'number', attr: 'depth', step: 0.01, min: 0.01},
      {key: 'color', label: 'Color', type: 'color', attr: 'color'},
    ],
  },
  {
    id: 'portal-frame-bottom',
    label: 'Frame Bottom',
    selector: '#portal-frame-bottom',
    fields: [
      {key: 'position', label: 'Position', type: 'vec3', attr: 'position', step: 0.01},
      {key: 'width', label: 'Width', type: 'number', attr: 'width', step: 0.01, min: 0.01},
      {key: 'height', label: 'Height', type: 'number', attr: 'height', step: 0.01, min: 0.01},
      {key: 'depth', label: 'Depth', type: 'number', attr: 'depth', step: 0.01, min: 0.01},
      {key: 'color', label: 'Color', type: 'color', attr: 'color'},
    ],
  },
]

const readVec3 = (element, attr) => {
  const value = element.getAttribute(attr) || {x: 0, y: 0, z: 0}
  return {x: round(value.x), y: round(value.y), z: round(value.z)}
}

const readFieldValue = (element, field) => {
  if (field.type === 'vec3') {
    return readVec3(element, field.attr)
  }

  if (field.prop) {
    const current = element.getAttribute(field.attr) || {}
    return current[field.prop]
  }

  return element.getAttribute(field.attr)
}

const applyFieldValue = (element, field, value) => {
  if (!element) {
    return
  }

  if (field.type === 'vec3') {
    element.setAttribute(field.attr, `${value.x} ${value.y} ${value.z}`)
    return
  }

  if (field.prop) {
    const current = element.getAttribute(field.attr) || {}
    element.setAttribute(field.attr, {...current, [field.prop]: value})
    return
  }

  element.setAttribute(field.attr, value)
}

const collectEditorState = () => {
  const state = {}

  EDITABLE_NODES.forEach((node) => {
    const element = document.querySelector(node.selector)
    if (!element) {
      return
    }

    state[node.id] = {}
    node.fields.forEach((field) => {
      state[node.id][field.key] = readFieldValue(element, field)
    })
  })

  return state
}

export const applySavedPortalEditorState = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return
    }

    const state = JSON.parse(raw)
    EDITABLE_NODES.forEach((node) => {
      const element = document.querySelector(node.selector)
      const nodeState = state[node.id]
      if (!element || !nodeState) {
        return
      }

      node.fields.forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(nodeState, field.key)) {
          applyFieldValue(element, field, nodeState[field.key])
        }
      })
    })
  } catch {
    // ignore malformed local storage state
  }
}

const saveEditorState = () => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(collectEditorState()))
}

const createNumberInput = ({value, step = 0.01, min, max, onInput}) => {
  const input = document.createElement('input')
  input.type = 'number'
  input.value = `${value}`
  input.step = `${step}`
  if (typeof min === 'number') input.min = `${min}`
  if (typeof max === 'number') input.max = `${max}`
  input.className = 'portal-editor-number'
  input.addEventListener('input', onInput)
  return input
}

const createStyles = () => {
  if (document.getElementById('portal-editor-style')) {
    return
  }

  const style = document.createElement('style')
  style.id = 'portal-editor-style'
  style.textContent = `
    .portal-editor {
      position: fixed;
      top: 16px;
      right: 16px;
      bottom: 16px;
      width: min(380px, calc(100vw - 32px));
      z-index: 30;
      overflow: auto;
      padding: 16px;
      border-radius: 20px;
      background: rgba(8, 12, 24, 0.86);
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 18px 60px rgba(0, 0, 0, 0.35);
      backdrop-filter: blur(18px);
      color: #eef3ff;
      font-family: Inter, system-ui, sans-serif;
    }
    .portal-editor * { box-sizing: border-box; }
    .portal-editor h2 { margin: 0 0 6px; font-size: 1.05rem; }
    .portal-editor p { margin: 0; color: #bfd0fb; font-size: 0.9rem; line-height: 1.4; }
    .portal-editor .portal-editor-stack { display: grid; gap: 12px; margin-top: 14px; }
    .portal-editor .portal-editor-card {
      display: grid;
      gap: 10px;
      padding: 12px;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .portal-editor select,
    .portal-editor textarea,
    .portal-editor button,
    .portal-editor .portal-editor-number,
    .portal-editor input[type="color"] {
      width: 100%;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      background: rgba(255, 255, 255, 0.08);
      color: #eef3ff;
      padding: 10px 12px;
      font: inherit;
    }
    .portal-editor input[type="color"] { padding: 6px; min-height: 42px; }
    .portal-editor textarea { min-height: 160px; resize: vertical; font-family: ui-monospace, SFMono-Regular, monospace; font-size: 12px; }
    .portal-editor .portal-editor-row { display: grid; gap: 8px; }
    .portal-editor .portal-editor-field { display: grid; gap: 8px; }
    .portal-editor .portal-editor-field label { font-size: 12px; color: #bfd0fb; text-transform: uppercase; letter-spacing: 0.06em; }
    .portal-editor .portal-editor-vec3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .portal-editor .portal-editor-actions { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
    .portal-editor .portal-editor-wide { grid-column: 1 / -1; }
    .portal-editor .portal-editor-view-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
    .portal-editor .portal-editor-help {
      font-size: 12px;
      color: #d8e3ff;
      line-height: 1.5;
      white-space: normal;
    }
  `
  document.head.appendChild(style)
}

export const enablePortalEditorMode = ({sceneEl, setStatus, setCompatibility}) => {
  if (!sceneEl) {
    return
  }

  ensureEditorCameraControls()
  createStyles()
  applySavedPortalEditorState()

  const anchor = document.getElementById('target-anchor')
  const targetReference = document.getElementById('target-reference')
  const portalFrame = document.getElementById('portal-frame')
  const portalRoot = document.getElementById('portal-root')
  const portalCity = document.getElementById('portal-city')
  const portalOrb = document.getElementById('portal-orb')
  const depthMasks = [...sceneEl.querySelectorAll('[depth-mask]')]
  const contents = document.getElementById('portal-contents')
  const walls = document.getElementById('hider-walls')
  const portalWall = document.getElementById('portal-wall')
  const camera = document.getElementById('camera')

  if (camera) {
    camera.setAttribute('look-controls', 'enabled: false')
    camera.setAttribute('wasd-controls', 'enabled: false')
    applyCameraView(camera, VIEW_PRESETS.reset)
  }

  if (anchor) {
    anchor.setAttribute('position', '0 0 0')
    anchor.setAttribute('rotation', '0 0 0')
    anchor.setAttribute('scale', '1 1 1')
    anchor.object3D.visible = true
  }

  if (targetReference) {
    targetReference.object3D.visible = true
  }

  depthMasks.forEach((element) => {
    element.setAttribute('depth-mask', 'debug: true')
  })

  if (contents) contents.object3D.visible = true
  if (walls) walls.object3D.visible = false
  if (portalWall) portalWall.object3D.visible = false

  setStatus('Editor A-Frame activo. Escena 3D visible y editable sin oclusión de hider walls.')
  setCompatibility('Mouse izquierdo: orbitar · click derecho o botón central: pan · rueda/trackpad: zoom libre. En editor se desactiva la oclusión para facilitar la revisión visual.')

  const panel = document.createElement('aside')
  panel.className = 'portal-editor'
  panel.innerHTML = `
    <h2>Portal Scene Editor</h2>
    <p>Edita la escena real de A-Frame. Los cambios se guardan en este navegador.</p>
    <div class="portal-editor-stack">
      <div class="portal-editor-card">
        <div class="portal-editor-view-grid">
          <button id="portal-editor-view-fit">Encuadrar</button>
          <button id="portal-editor-view-reset">Reset vista</button>
          <button id="portal-editor-view-front">Frente</button>
          <button id="portal-editor-view-iso">Isométrica</button>
        </div>
        <p class="portal-editor-help">
          Orbitar: click izquierdo + arrastrar.<br>
          Pan: click derecho o botón central + arrastrar.<br>
          Zoom: rueda / trackpad (scroll).<br>
          Teclado: flechas para rotar, +/- zoom, 0 reset.
        </p>
      </div>
      <div class="portal-editor-card">
        <div class="portal-editor-row">
          <label for="portal-editor-node">Elemento</label>
          <select id="portal-editor-node"></select>
        </div>
        <div id="portal-editor-fields"></div>
      </div>
      <div class="portal-editor-card">
        <div class="portal-editor-actions">
          <button id="portal-editor-reset">Reset local</button>
          <button id="portal-editor-refresh">Refrescar JSON</button>
          <button id="portal-editor-copy" class="portal-editor-wide">Copiar JSON</button>
        </div>
        <textarea id="portal-editor-json" spellcheck="false"></textarea>
      </div>
    </div>
  `
  document.body.appendChild(panel)

  const nodeSelect = panel.querySelector('#portal-editor-node')
  const fieldsRoot = panel.querySelector('#portal-editor-fields')
  const jsonOutput = panel.querySelector('#portal-editor-json')
  const resetButton = panel.querySelector('#portal-editor-reset')
  const refreshButton = panel.querySelector('#portal-editor-refresh')
  const copyButton = panel.querySelector('#portal-editor-copy')
  const fitViewButton = panel.querySelector('#portal-editor-view-fit')
  const resetViewButton = panel.querySelector('#portal-editor-view-reset')
  const frontViewButton = panel.querySelector('#portal-editor-view-front')
  const isoViewButton = panel.querySelector('#portal-editor-view-iso')

  EDITABLE_NODES.forEach((node) => {
    const option = document.createElement('option')
    option.value = node.id
    option.textContent = node.label
    nodeSelect.appendChild(option)
  })

  const refreshJson = () => {
    jsonOutput.value = JSON.stringify(collectEditorState(), null, 2)
  }

  const renderFields = () => {
    const node = EDITABLE_NODES.find((item) => item.id === nodeSelect.value) || EDITABLE_NODES[0]
    const element = document.querySelector(node.selector)
    fieldsRoot.innerHTML = ''

    if (!element) {
      fieldsRoot.textContent = 'Elemento no disponible.'
      return
    }

    const card = document.createElement('div')
    card.className = 'portal-editor-card'

    node.fields.forEach((field) => {
      const wrapper = document.createElement('div')
      wrapper.className = 'portal-editor-field'
      const label = document.createElement('label')
      label.textContent = field.label
      wrapper.appendChild(label)

      if (field.type === 'vec3') {
        const value = readFieldValue(element, field)
        const group = document.createElement('div')
        group.className = 'portal-editor-vec3'

        ;['x', 'y', 'z'].forEach((axis) => {
          const input = createNumberInput({
            value: value[axis],
            step: field.step,
            onInput: () => {
              const nextValue = {
                x: Number(group.querySelector('[data-axis="x"]').value),
                y: Number(group.querySelector('[data-axis="y"]').value),
                z: Number(group.querySelector('[data-axis="z"]').value),
              }
              applyFieldValue(element, field, nextValue)
              saveEditorState()
              refreshJson()
            },
          })
          input.dataset.axis = axis
          group.appendChild(input)
        })

        wrapper.appendChild(group)
      } else if (field.type === 'color') {
        const input = document.createElement('input')
        input.type = 'color'
        input.value = `${readFieldValue(element, field) || '#ffffff'}`
        input.addEventListener('input', () => {
          applyFieldValue(element, field, input.value)
          saveEditorState()
          refreshJson()
        })
        wrapper.appendChild(input)
      } else {
        const input = createNumberInput({
          value: readFieldValue(element, field),
          step: field.step,
          min: field.min,
          max: field.max,
          onInput: () => {
            applyFieldValue(element, field, Number(input.value))
            saveEditorState()
            refreshJson()
          },
        })
        wrapper.appendChild(input)
      }

      card.appendChild(wrapper)
    })

    fieldsRoot.appendChild(card)
  }

  nodeSelect.addEventListener('change', renderFields)
  resetButton.addEventListener('click', () => {
    window.localStorage.removeItem(STORAGE_KEY)
    window.location.reload()
  })
  refreshButton.addEventListener('click', refreshJson)
  copyButton.addEventListener('click', async () => {
    refreshJson()
    try {
      await navigator.clipboard.writeText(jsonOutput.value)
      setStatus('JSON de la escena copiado al portapapeles.')
    } catch {
      setStatus('No se pudo copiar automáticamente. Copialo manualmente desde el panel.')
    }
  })
  fitViewButton.addEventListener('click', () => {
    fitCameraToElements(camera, [targetReference, portalFrame, contents, portalOrb])
    setStatus('Vista ajustada al image target y al portal.')
  })
  resetViewButton.addEventListener('click', () => {
    applyCameraView(camera, VIEW_PRESETS.reset)
    setStatus('Vista reseteada.')
  })
  frontViewButton.addEventListener('click', () => {
    applyCameraView(camera, VIEW_PRESETS.front)
    setStatus('Vista frontal aplicada.')
  })
  isoViewButton.addEventListener('click', () => {
    applyCameraView(camera, VIEW_PRESETS.iso)
    setStatus('Vista isométrica aplicada.')
  })

  nodeSelect.value = EDITABLE_NODES[0].id
  renderFields()
  refreshJson()

  fitCameraToElements(camera, [targetReference, portalFrame, contents, portalOrb])
}

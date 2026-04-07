import './portal/portal-components'

const sceneEl = document.querySelector('a-scene')
const statusEl = document.getElementById('status')
const compatibilityEl = document.getElementById('compatibility')
const toggleBtnEl = document.getElementById('toggle-portal')
const slamAnchorEl = document.getElementById('slam-anchor')
const portalRootEl = document.getElementById('portal-root')
const targetReferenceEl = document.getElementById('target-reference')

const DEFAULT_PORTAL_SCALE = 0.76
const PORTAL_HALF_HEIGHT = (1.3325991189 * DEFAULT_PORTAL_SCALE) / 2

let portalVisible = true
let hasPlaced = false
let isDragging = false
let dragStartX = 0
let dragStartZ = 0
let pointerDownX = 0
let pointerDownY = 0

const setStatus = (message) => {
  if (statusEl) {
    statusEl.textContent = message
  }
}

const setCompatibility = (message = '') => {
  if (compatibilityEl) {
    compatibilityEl.textContent = message
  }
}

const describeCameraStatus = (status) => {
  switch (status) {
    case 'requesting':
      return 'Solicitando acceso a cámara o sesión desktop…'
    case 'hasStream':
      return 'Cámara lista. Buscando plano de piso para colocar el portal…'
    case 'hasVideo':
      return hasPlaced
        ? 'Portal colocado. Tocá de nuevo el piso para recolocarlo en XY.'
        : 'Video activo. Tocá el piso para colocar el portal.'
    case 'hasDesktop3D':
      return 'Desktop preview activo. Podés navegar la escena e inspeccionarla con A-Frame.'
    case 'failed':
      return 'No se pudo iniciar la sesión XR actual.'
    default:
      return 'Runtime XR activo.'
  }
}

const updateCompatibilityFromXR = () => {
  if (!window.XR8 || !window.XR8.XrDevice) {
    return
  }

  const compatible = window.XR8.XrDevice.isDeviceBrowserCompatible({allowedDevices: 'any'})
  setCompatibility(compatible
    ? 'Compatibilidad detectada: lista para SLAM o preview desktop.'
    : 'Compatibilidad limitada: si no hay sesión AR, debería abrir el preview desktop.')
}

const syncToggleLabel = () => {
  if (!toggleBtnEl) {
    return
  }

  toggleBtnEl.textContent = portalVisible ? 'Portal ON' : 'Portal OFF'
  toggleBtnEl.classList.toggle('is-off', !portalVisible)
}

const applyContentVisibility = () => {
  if (portalRootEl) {
    portalRootEl.object3D.visible = portalVisible
  }

  if (targetReferenceEl) {
    targetReferenceEl.object3D.visible = !portalVisible
  }

  syncToggleLabel()
}

const getYawFacingCamera = () => {
  if (!sceneEl || !sceneEl.camera || !slamAnchorEl) {
    return 0
  }

  const cameraPosition = sceneEl.camera.el.object3D.getWorldPosition(new window.THREE.Vector3())
  const anchorPosition = slamAnchorEl.object3D.getWorldPosition(new window.THREE.Vector3())
  const dx = cameraPosition.x - anchorPosition.x
  const dz = cameraPosition.z - anchorPosition.z

  return Math.atan2(dx, dz) * (180 / Math.PI)
}

const placeAnchorAt = (x, z) => {
  if (!slamAnchorEl) {
    return
  }

  slamAnchorEl.object3D.position.set(x, PORTAL_HALF_HEIGHT, z)
  slamAnchorEl.object3D.rotation.set(0, getYawFacingCamera() * (Math.PI / 180), 0)
  slamAnchorEl.object3D.visible = true
  hasPlaced = true

  setStatus('Portal colocado en piso. Tocá otra zona para moverlo en XY.')
}

const projectTouchToFloor = (event) => {
  if (!sceneEl || !sceneEl.camera) {
    return null
  }

  const touch = event.touches?.[0] || event.changedTouches?.[0]
  const pointX = touch?.clientX ?? event.clientX
  const pointY = touch?.clientY ?? event.clientY

  if (pointX === undefined || pointY === undefined) {
    return null
  }

  const normalizedX = (pointX / window.innerWidth) * 2 - 1
  const normalizedY = -(pointY / window.innerHeight) * 2 + 1

  const raycaster = new window.THREE.Raycaster()
  const camera = sceneEl.camera
  raycaster.setFromCamera({x: normalizedX, y: normalizedY}, camera)

  const rayDirection = raycaster.ray.direction
  const rayOrigin = raycaster.ray.origin
  const floorY = 0

  if (Math.abs(rayDirection.y) < 1e-5) {
    return null
  }

  const t = (floorY - rayOrigin.y) / rayDirection.y

  if (t <= 0) {
    return null
  }

  return {
    x: rayOrigin.x + rayDirection.x * t,
    z: rayOrigin.z + rayDirection.z * t,
  }
}

const attemptHitTestPlane = (screenX, screenY) => {
  if (!window.XR8 || !window.XR8.XrFrame || !window.XR8.XrFrame.hitTest) {
    return null
  }

  try {
    const hits = window.XR8.XrFrame.hitTest(screenX, screenY, window.XR8.XrFrame.HIT_TEST_TYPE_ESTIMATED_PLANE)
    if (hits && hits.length > 0 && hits[0].pose) {
      const pose = hits[0].pose
      return {
        x: pose.position.x,
        z: pose.position.z,
      }
    }
  } catch (e) {
    return null
  }

  return null
}

const screenTouchToWorldPosition = (screenX, screenY) => {
  const hitTestResult = attemptHitTestPlane(screenX, screenY)
  if (hitTestResult) {
    return hitTestResult
  }

  const syntheticEvent = {
    clientX: screenX,
    clientY: screenY,
  }
  return projectTouchToFloor(syntheticEvent)
}

const onPlaceInteraction = (event) => {
  if (!window.XR8 || !window.XR8.XrController) {
    return
  }

  const touch = event.touches?.[0] || event.changedTouches?.[0]
  const screenX = touch?.clientX ?? event.clientX
  const screenY = touch?.clientY ?? event.clientY

  if (screenX === undefined || screenY === undefined) {
    return
  }

  const position = screenTouchToWorldPosition(screenX, screenY)

  if (!position) {
    setStatus('No se pudo estimar el piso desde este punto. Probá en otra zona.')
    return
  }

  placeAnchorAt(position.x, position.z)
}

const onPointerDown = (event) => {
  if (!hasPlaced || isDragging) {
    return
  }

  pointerDownX = event.clientX
  pointerDownY = event.clientY
  dragStartX = slamAnchorEl.object3D.position.x
  dragStartZ = slamAnchorEl.object3D.position.z
  isDragging = true
  event.preventDefault()
}

const onPointerMove = (event) => {
  if (!isDragging || !hasPlaced || !slamAnchorEl) {
    return
  }

  const touch = event.touches?.[0]
  if (!touch) {
    return
  }

  const screenX = touch.clientX
  const screenY = touch.clientY

  const position = screenTouchToWorldPosition(screenX, screenY)

  if (!position) {
    return
  }

  slamAnchorEl.object3D.position.set(position.x, PORTAL_HALF_HEIGHT, position.z)

  event.preventDefault()
}

const onPointerUp = (event) => {
  if (!isDragging) {
    return
  }

  isDragging = false
  setStatus('Portal reposicionado. Tocá por otro lugar para mover o tocá el botón para cambiar vista.')

  event.preventDefault()
}

const attachUiListeners = () => {
  if (!sceneEl) {
    return
  }

  sceneEl.addEventListener('camerastatuschange', (event) => {
    setStatus(describeCameraStatus(event.detail?.status))

    if (event.detail?.status === 'hasDesktop3D' && slamAnchorEl && !hasPlaced) {
      placeAnchorAt(0, -2)
    }
  })

  sceneEl.addEventListener('realityerror', (event) => {
    const detail = event.detail || {}
    const reason = detail.error?.message || 'Error desconocido en el runtime XR.'
    setStatus(`Error XR: ${reason}`)
    updateCompatibilityFromXR()
  })

  if (toggleBtnEl) {
    toggleBtnEl.addEventListener('click', () => {
      portalVisible = !portalVisible
      applyContentVisibility()
    })
  }

  window.addEventListener('touchend', onPlaceInteraction, {passive: false})
  window.addEventListener('pointerdown', onPointerDown, {passive: false})
  window.addEventListener('touchmove', onPointerMove, {passive: false})
  window.addEventListener('pointerup', onPointerUp, {passive: false})
}

const waitForSceneLoad = () => new Promise((resolve) => {
  if (!sceneEl || sceneEl.hasLoaded) {
    resolve()
    return
  }

  sceneEl.addEventListener('loaded', resolve, {once: true})
})

const startReality = async () => {
  await waitForSceneLoad()

  if (portalRootEl) {
    portalRootEl.setAttribute('scale', `${DEFAULT_PORTAL_SCALE} ${DEFAULT_PORTAL_SCALE} ${DEFAULT_PORTAL_SCALE}`)
    if (portalRootEl.object3D) {
      portalRootEl.object3D.scale.set(DEFAULT_PORTAL_SCALE, DEFAULT_PORTAL_SCALE, DEFAULT_PORTAL_SCALE)
      portalRootEl.object3D.updateMatrix()
      portalRootEl.object3D.updateMatrixWorld(true)
    }
  }

  applyContentVisibility()

  if (!window.XR8 || !window.XR8.XrController || !sceneEl) {
    setStatus('XR8 todavía no está disponible.')
    return
  }

  window.XR8.XrController.configure({
    disableWorldTracking: false,
  })

  updateCompatibilityFromXR()
  setStatus('Runtime listo. Iniciando SLAM…')
  sceneEl.emit('runreality')
}

attachUiListeners()

if (window.XR8) {
  startReality()
} else {
  window.addEventListener('xrloaded', startReality, {once: true})
}

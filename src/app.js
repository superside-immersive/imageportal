import './portal/portal-components'
import {applySavedPortalEditorState, enablePortalEditorMode} from './portal/portal-editor'

const poster2Target = require('../image-targets copy/poster2.json')

const sceneEl = document.querySelector('a-scene')
const statusEl = document.getElementById('status')
const compatibilityEl = document.getElementById('compatibility')
const portalRootEl = document.getElementById('portal-root')
const portalScaleInputEl = document.getElementById('portal-scale')
const portalScaleValueEl = document.getElementById('portal-scale-value')
const editorMode =
  window.location.pathname.endsWith('/editor.html') ||
  new URLSearchParams(window.location.search).has('editor')

const PORTAL_SCALE_STORAGE_KEY = 'imageportal.portalScale'
const DEFAULT_PORTAL_SCALE = 1
const MIN_PORTAL_SCALE = 0.75
const MAX_PORTAL_SCALE = 1.15
let portalScaleControlAttached = false

const clampPortalScale = (value) => {
  const numeric = Number(value)

  if (!Number.isFinite(numeric)) {
    return DEFAULT_PORTAL_SCALE
  }

  return Math.min(MAX_PORTAL_SCALE, Math.max(MIN_PORTAL_SCALE, numeric))
}

const formatPortalScale = (value) => clampPortalScale(value).toFixed(2)

const readCurrentPortalScale = () => {
  if (!portalRootEl) {
    return DEFAULT_PORTAL_SCALE
  }

  const objectScale = portalRootEl.object3D?.scale?.x
  if (Number.isFinite(objectScale) && objectScale > 0) {
    return clampPortalScale(objectScale)
  }

  const attributeScale = portalRootEl.getAttribute('scale')
  if (typeof attributeScale === 'object' && attributeScale?.x) {
    return clampPortalScale(attributeScale.x)
  }

  if (typeof attributeScale === 'string') {
    const [x] = attributeScale.split(/\s+/)
    return clampPortalScale(x)
  }

  return DEFAULT_PORTAL_SCALE
}

const applyPortalScale = (value, {persist = true} = {}) => {
  const scale = clampPortalScale(value)

  if (portalRootEl) {
    portalRootEl.setAttribute('scale', `${scale} ${scale} ${scale}`)
    if (portalRootEl.object3D) {
      portalRootEl.object3D.scale.set(scale, scale, scale)
      portalRootEl.object3D.updateMatrix()
      portalRootEl.object3D.updateMatrixWorld(true)
    }
  }

  if (portalScaleInputEl && portalScaleInputEl.value !== String(scale)) {
    portalScaleInputEl.value = String(scale)
  }

  if (portalScaleValueEl) {
    portalScaleValueEl.textContent = formatPortalScale(scale)
  }

  if (persist) {
    try {
      window.localStorage.setItem(PORTAL_SCALE_STORAGE_KEY, String(scale))
    } catch (error) {
      // Ignore storage failures in private mode or restricted contexts.
    }
  }

  return scale
}

const loadPortalScale = () => {
  try {
    const stored = window.localStorage.getItem(PORTAL_SCALE_STORAGE_KEY)

    if (stored == null) {
      return null
    }

    return clampPortalScale(stored)
  } catch (error) {
    return null
  }
}

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
      return 'Cámara lista. Buscando el image target poster2…'
    case 'hasVideo':
      return 'Video activo. Escaneá poster2 para fijar el portal.'
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
    ? 'Compatibilidad detectada: lista para AR o preview desktop.'
    : 'Compatibilidad limitada: si no hay sesión AR, debería abrir el preview desktop.')
}

const attachUiListeners = () => {
  if (!sceneEl) {
    return
  }

  sceneEl.addEventListener('camerastatuschange', (event) => {
    setStatus(describeCameraStatus(event.detail?.status))
  })

  sceneEl.addEventListener('xrimagefound', (event) => {
    if (event.detail?.name === 'poster2') {
      setStatus('poster2 detectado. El portal quedó anclado a la imagen.')
    }
  })

  sceneEl.addEventListener('xrimagelost', (event) => {
    if (event.detail?.name === 'poster2') {
      setStatus('Se perdió poster2. Volvé a encuadrarlo para reanclar el portal.')
    }
  })

  sceneEl.addEventListener('realityerror', (event) => {
    const detail = event.detail || {}
    const reason = detail.error?.message || 'Error desconocido en el runtime XR.'
    setStatus(`Error XR: ${reason}`)
    updateCompatibilityFromXR()
  })
}

const attachScaleControl = () => {
  const savedScale = loadPortalScale()
  const currentScale = readCurrentPortalScale()
  const initialScale = applyPortalScale(savedScale ?? currentScale, {persist: false})

  if (portalScaleInputEl && !portalScaleControlAttached) {
    portalScaleControlAttached = true
    portalScaleInputEl.value = String(initialScale)
    portalScaleInputEl.addEventListener('input', (event) => {
      applyPortalScale(event.target.value)
    })
    portalScaleInputEl.addEventListener('change', (event) => {
      applyPortalScale(event.target.value)
    })
  }

  applyPortalScale(initialScale, {persist: false})
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

  applySavedPortalEditorState()
  attachScaleControl()

  if (editorMode) {
    enablePortalEditorMode({sceneEl, setStatus, setCompatibility})
    return
  }

  if (!window.XR8 || !window.XR8.XrController || !sceneEl) {
    setStatus('XR8 todavía no está disponible.')
    return
  }

  window.XR8.XrController.configure({
    imageTargetData: [poster2Target],
    disableWorldTracking: true,
  })

  updateCompatibilityFromXR()
  setStatus('Runtime listo. Iniciando image tracking y preview desktop…')
  sceneEl.emit('runreality')
}

attachScaleControl()
attachUiListeners()

if (window.XR8) {
  startReality()
} else {
  window.addEventListener('xrloaded', startReality, {once: true})
}


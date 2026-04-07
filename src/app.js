import './portal/portal-components'
import './portal/narrative-sequence'

const imageTarget = require('../image-targets/download-1773332030950-2-2.json')
const IMAGE_TARGET_NAME = imageTarget.name

const sceneEl = document.querySelector('a-scene')
const statusEl = document.getElementById('status')
const compatibilityEl = document.getElementById('compatibility')
const editorMode =
  window.location.pathname.endsWith('/editor.html') ||
  new URLSearchParams(window.location.search).has('editor')
const statsMode = new URLSearchParams(window.location.search).has('stats')

const DEFAULT_PORTAL_SCALE = 0.76

const enableEditorReferenceAssets = () => {
  const imageTargetReferenceEl = document.getElementById('imageTargetReference')
  const imageTargetReferenceSrc = imageTargetReferenceEl?.dataset?.src

  if (imageTargetReferenceEl && imageTargetReferenceSrc && imageTargetReferenceEl.getAttribute('src') !== imageTargetReferenceSrc) {
    imageTargetReferenceEl.setAttribute('src', imageTargetReferenceSrc)
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
      return 'Cámara lista. Buscando el image target configurado…'
    case 'hasVideo':
      return 'Video activo. Escaneá el image target para fijar el portal.'
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
    if (event.detail?.name === IMAGE_TARGET_NAME) {
      setStatus('Image target detectado. El portal quedó anclado a la imagen.')
    }
  })

  sceneEl.addEventListener('xrimagelost', (event) => {
    if (event.detail?.name === IMAGE_TARGET_NAME) {
      setStatus('Se perdió el image target. Volvé a encuadrarlo para reanclar el portal.')
    }
  })

  sceneEl.addEventListener('realityerror', (event) => {
    const detail = event.detail || {}
    const reason = detail.error?.message || 'Error desconocido en el runtime XR.'
    setStatus(`Error XR: ${reason}`)
    updateCompatibilityFromXR()
  })
}

const waitForSceneLoad = () => new Promise((resolve) => {
  if (!sceneEl || sceneEl.hasLoaded) {
    resolve()
    return
  }

  sceneEl.addEventListener('loaded', resolve, {once: true})
})

const loadPortalEditorModule = async () => import('./portal/portal-editor')

const startReality = async () => {
  await waitForSceneLoad()

  if (statsMode && sceneEl) {
    sceneEl.setAttribute('stats', '')
  }

  const portalRootEl = document.getElementById('portal-root')
  if (portalRootEl) {
    portalRootEl.setAttribute('scale', `${DEFAULT_PORTAL_SCALE} ${DEFAULT_PORTAL_SCALE} ${DEFAULT_PORTAL_SCALE}`)
    if (portalRootEl.object3D) {
      portalRootEl.object3D.scale.set(DEFAULT_PORTAL_SCALE, DEFAULT_PORTAL_SCALE, DEFAULT_PORTAL_SCALE)
      portalRootEl.object3D.updateMatrix()
      portalRootEl.object3D.updateMatrixWorld(true)
    }
  }

  if (editorMode) {
    enableEditorReferenceAssets()
    const {applySavedPortalEditorState, enablePortalEditorMode} = await loadPortalEditorModule()
    applySavedPortalEditorState()
    enablePortalEditorMode({sceneEl, setStatus, setCompatibility})
    return
  }

  if (!window.XR8 || !window.XR8.XrController || !sceneEl) {
    setStatus('XR8 todavía no está disponible.')
    return
  }

  window.XR8.XrController.configure({
    imageTargetData: [imageTarget],
    disableWorldTracking: true,
  })

  updateCompatibilityFromXR()
  setStatus('Runtime listo. Iniciando image tracking y preview desktop…')
  sceneEl.emit('runreality')
}

attachUiListeners()

if (window.XR8) {
  startReality()
} else {
  window.addEventListener('xrloaded', startReality, {once: true})
}


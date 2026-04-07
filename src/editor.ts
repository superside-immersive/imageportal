import fallbackScene from './.expanse.json'
import {
  AmbientLight,
  AxesHelper,
  BoxGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  GridHelper,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  RingGeometry,
  Scene,
  SphereGeometry,
  Texture,
  TextureLoader,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
} from 'three'
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js'
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js'
import {getPortalShellPanels, IMAGE_TARGET_HEIGHT, IMAGE_TARGET_WIDTH} from './portal/hider-shell'

type GeometryDefinition = {
  type: string
  width?: number
  height?: number
  depth?: number
  radius?: number
  tubeRadius?: number
  innerRadius?: number
  outerRadius?: number
}

type MaterialDefinition = {
  type?: string
  color?: string
  opacity?: number
}

type Resource = {
  asset?: string
  url?: string
}

type GraphObject = {
  id: string
  name?: string
  parentId?: string
  position?: number[]
  rotation?: number[]
  scale?: number[]
  hidden?: boolean
  geometry?: GeometryDefinition | null
  material?: MaterialDefinition | null
  gltfModel?: {src?: Resource} | null
  imageTarget?: unknown
  camera?: unknown
  ambientLight?: unknown
  directionalLight?: unknown
  ui?: unknown
  videoTextureSource?: unknown
  components?: Record<string, {name?: string}>
}

type ImageTargetDefinition = {
  name?: string
}

type SceneGraph = {
  objects: Record<string, GraphObject>
  [key: string]: any
}

type TransformState = {
  position: [number, number, number]
  scale: [number, number, number]
}

type SliderControl = {
  wrapper: HTMLLabelElement
  range: HTMLInputElement
  number: HTMLInputElement
}

declare global {
  interface Window {
    __AR_EDITOR__?: boolean
  }
}

const isEditorPage =
  window.__AR_EDITOR__ ||
  window.location.pathname.endsWith('/editor.html') ||
  new URLSearchParams(window.location.search).has('editor')

const deepClone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))

const readVec3 = (value: number[] | undefined, fallback: [number, number, number]): [number, number, number] => {
  if (!Array.isArray(value) || value.length < 3) {
    return [...fallback] as [number, number, number]
  }

  return [Number(value[0]) || 0, Number(value[1]) || 0, Number(value[2]) || 0]
}

if (isEditorPage) {
  const gltfLoader = new GLTFLoader()
  const textureLoader = new TextureLoader()
  const fallbackGraph = deepClone(fallbackScene) as SceneGraph
  const object3DMap = new Map<string, Object3D>()
  const childMap = new Map<string, string[]>()
  const buildSet = new Set<string>()
  const editableIds: string[] = []
  const saveDebounceMs = 250

  let currentSceneGraph = fallbackGraph
  let originalSceneGraph = deepClone(fallbackGraph) as SceneGraph
  let currentObjectId = ''
  let saveTimer: number | null = null
  let saveNonce = 0
  let lastSavedAt = ''

  const root = document.createElement('div')
  root.id = 'ar-editor-root'
  const canvas = document.createElement('canvas')
  root.appendChild(canvas)
  document.body.appendChild(root)

  const renderer = new WebGLRenderer({canvas, antialias: true})
  const previewScene = new Scene()
  previewScene.background = new Color('#0b1020')
  const imageTargetHelperRoot = new Group()
  previewScene.add(imageTargetHelperRoot)

  const camera = new PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 500)
  camera.position.set(9, 7, 11)

  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.08

  const overlay = document.createElement('aside')
  overlay.id = 'ar-editor-overlay'
  overlay.innerHTML = `
    <style>
      #ar-editor-root { position: fixed; inset: 0; }
      #ar-editor-root canvas { width: 100%; height: 100%; display: block; touch-action: none; }
      #ar-editor-overlay {
        position: fixed;
        top: env(safe-area-inset-top, 0);
        right: 0;
        bottom: 0;
        width: min(400px, 96vw);
        padding: 16px;
        overflow: auto;
        background: rgba(7, 11, 23, 0.84);
        border-left: 1px solid rgba(255,255,255,0.12);
        backdrop-filter: blur(16px);
        color: #fff;
        z-index: 5;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      }
      #ar-editor-overlay * { box-sizing: border-box; }
      #ar-editor-overlay .title { margin: 0 0 6px; font-size: 22px; }
      #ar-editor-overlay .sub,
      #ar-editor-overlay .status,
      #ar-editor-overlay .path,
      #ar-editor-overlay .hint { margin: 0; color: rgba(255,255,255,0.72); line-height: 1.4; }
      #ar-editor-overlay .status { margin-top: 10px; font-size: 12px; }
      #ar-editor-overlay .stack { display: grid; gap: 12px; margin-top: 14px; }
      #ar-editor-overlay .card {
        display: grid;
        gap: 10px;
        padding: 12px;
        border-radius: 16px;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.08);
      }
      #ar-editor-overlay .card h3 { margin: 0; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; }
      #ar-editor-overlay input,
      #ar-editor-overlay select,
      #ar-editor-overlay textarea,
      #ar-editor-overlay button,
      #ar-editor-overlay a { font: inherit; }
      #ar-editor-overlay .search,
      #ar-editor-overlay .select,
      #ar-editor-overlay .number,
      #ar-editor-overlay .textarea,
      #ar-editor-overlay .button {
        width: 100%;
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.14);
        background: rgba(255,255,255,0.08);
        color: #fff;
      }
      #ar-editor-overlay .textarea { min-height: 130px; resize: vertical; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
      #ar-editor-overlay .slider-grid { display: grid; gap: 10px; }
      #ar-editor-overlay .slider-row { display: grid; grid-template-columns: 56px minmax(0,1fr) 92px; gap: 8px; align-items: center; }
      #ar-editor-overlay .slider-row span { font-size: 12px; color: rgba(255,255,255,0.76); }
      #ar-editor-overlay .slider { width: 100%; accent-color: #7dd3fc; }
      #ar-editor-overlay .actions { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px; }
      #ar-editor-overlay .button { cursor: pointer; text-align: center; text-decoration: none; font-weight: 600; }
      #ar-editor-overlay .button:hover { background: rgba(255,255,255,0.14); }
      #ar-editor-overlay .pill { display: inline-flex; width: fit-content; padding: 6px 10px; border-radius: 999px; background: rgba(56, 189, 248, 0.14); color: #bae6fd; font-size: 11px; }
      @media (max-width: 720px) {
        #ar-editor-overlay {
          top: auto;
          left: 0;
          width: 100vw;
          height: 54vh;
          border-left: 0;
          border-top: 1px solid rgba(255,255,255,0.12);
        }
      }
    </style>
  `
  document.body.appendChild(overlay)

  const title = document.createElement('h1')
  title.className = 'title'
  title.textContent = 'Editor 3D'

  const pill = document.createElement('div')
  pill.className = 'pill'
  pill.textContent = 'Sin detección · grid + axis + guardado directo'

  const subtitle = document.createElement('p')
  subtitle.className = 'sub'
  subtitle.textContent = 'Ajusta GLB, helpers y occluders con sliders. Cada cambio se escribe en .expanse.json.'

  const status = document.createElement('p')
  status.className = 'status'
  status.textContent = 'Cargando escena...'

  const stack = document.createElement('div')
  stack.className = 'stack'

  const objectCard = document.createElement('section')
  objectCard.className = 'card'
  const objectTitle = document.createElement('h3')
  objectTitle.textContent = 'Objeto'
  const searchInput = document.createElement('input')
  searchInput.className = 'search'
  searchInput.placeholder = 'Buscar GLB, sphere, occluder...'
  const objectSelect = document.createElement('select')
  objectSelect.className = 'select'
  const pathLabel = document.createElement('p')
  pathLabel.className = 'path'
  objectCard.append(objectTitle, searchInput, objectSelect, pathLabel)

  const trackerCard = document.createElement('section')
  trackerCard.className = 'card'
  const trackerTitle = document.createElement('h3')
  trackerTitle.textContent = 'Image Tracker'
  const trackerInfo = document.createElement('p')
  trackerInfo.className = 'hint'
  trackerInfo.textContent = 'El tracker se muestra en la escena como un plano con la imagen y ejes para ubicar mejor los objetos.'
  trackerCard.append(trackerTitle, trackerInfo)

  const transformCard = document.createElement('section')
  transformCard.className = 'card'
  const transformTitle = document.createElement('h3')
  transformTitle.textContent = 'Sliders'
  const positionGrid = document.createElement('div')
  positionGrid.className = 'slider-grid'
  const scaleGrid = document.createElement('div')
  scaleGrid.className = 'slider-grid'
  transformCard.append(transformTitle)

  const actionsCard = document.createElement('section')
  actionsCard.className = 'card'
  const actionsTitle = document.createElement('h3')
  actionsTitle.textContent = 'Acciones'
  const actions = document.createElement('div')
  actions.className = 'actions'
  const saveButton = document.createElement('button')
  saveButton.className = 'button'
  saveButton.textContent = 'Guardar ahora'
  const resetButton = document.createElement('button')
  resetButton.className = 'button'
  resetButton.textContent = 'Reset objeto'
  const reloadButton = document.createElement('button')
  reloadButton.className = 'button'
  reloadButton.textContent = 'Recargar archivo'
  const resetAllButton = document.createElement('button')
  resetAllButton.className = 'button'
  resetAllButton.textContent = 'Reset todo'
  const openArLink = document.createElement('a')
  openArLink.className = 'button'
  openArLink.href = './'
  openArLink.target = '_blank'
  openArLink.rel = 'noreferrer'
  openArLink.textContent = 'Abrir AR'
  const frameButton = document.createElement('button')
  frameButton.className = 'button'
  frameButton.textContent = 'Enfocar objeto'
  actions.append(saveButton, resetButton, reloadButton, resetAllButton, openArLink, frameButton)
  actionsCard.append(actionsTitle, actions)

  const exportCard = document.createElement('section')
  exportCard.className = 'card'
  const exportTitle = document.createElement('h3')
  exportTitle.textContent = 'Transforms guardados'
  const exportArea = document.createElement('textarea')
  exportArea.className = 'textarea'
  exportArea.readOnly = true
  const exportHint = document.createElement('p')
  exportHint.className = 'hint'
  exportHint.textContent = 'Esto refleja los cambios ya persistidos en el archivo.'
  exportCard.append(exportTitle, exportArea, exportHint)

  stack.append(objectCard, trackerCard, transformCard, actionsCard, exportCard)
  overlay.append(pill, title, subtitle, status, stack)

  previewScene.add(new GridHelper(40, 40, '#60a5fa', '#334155'))
  previewScene.add(new AxesHelper(3))
  previewScene.add(new AmbientLight('#ffffff', 0.8))
  previewScene.add(new HemisphereLight('#c7d2fe', '#0f172a', 1.2))
  const sun = new DirectionalLight('#ffffff', 1.8)
  sun.position.set(8, 14, 10)
  previewScene.add(sun)

  const createSliderControl = (label: string, min: number, max: number, step: number): SliderControl => {
    const wrapper = document.createElement('label')
    wrapper.className = 'slider-row'
    const text = document.createElement('span')
    text.textContent = label
    const range = document.createElement('input')
    range.className = 'slider'
    range.type = 'range'
    range.min = String(min)
    range.max = String(max)
    range.step = String(step)
    const number = document.createElement('input')
    number.className = 'number'
    number.type = 'number'
    number.min = String(min)
    number.max = String(max)
    number.step = String(step)
    wrapper.append(text, range, number)
    return {wrapper, range, number}
  }

  const positionControls = {
    x: createSliderControl('Pos X', -50, 50, 0.001),
    y: createSliderControl('Pos Y', -50, 50, 0.001),
    z: createSliderControl('Pos Z', -50, 50, 0.001),
  }
  const scaleControls = {
    x: createSliderControl('Scl X', 0.01, 30, 0.001),
    y: createSliderControl('Scl Y', 0.01, 30, 0.001),
    z: createSliderControl('Scl Z', 0.01, 30, 0.001),
  }
  positionGrid.append(positionControls.x.wrapper, positionControls.y.wrapper, positionControls.z.wrapper)
  scaleGrid.append(scaleControls.x.wrapper, scaleControls.y.wrapper, scaleControls.z.wrapper)
  transformCard.append(positionGrid, scaleGrid)

  const isObjectSkipped = (object: GraphObject) => Boolean(
    object.hidden ||
    object.camera ||
    object.ambientLight ||
    object.directionalLight ||
    object.ui ||
    object.videoTextureSource
  )

  const hasHiderEnforcer = (object: GraphObject) => Object.values(object.components || {}).some(component => component?.name === 'Hider Enforcer')

  const isExplicitRenderable = (object: GraphObject) => Boolean(
    object.gltfModel || object.geometry || object.material?.type === 'hider' || hasHiderEnforcer(object)
  )

  const getEntrySpaceId = () => currentSceneGraph.entrySpaceId as string | undefined

  const isDescendantOf = (id: string, ancestorId?: string) => {
    if (!ancestorId) {
      return true
    }

    let cursor: string | undefined = id
    let depth = 0

    while (cursor && depth < 24) {
      if (cursor === ancestorId) {
        return true
      }

      cursor = currentSceneGraph.objects[cursor]?.parentId
      depth += 1
    }

    return false
  }

  const getPrimaryImageTargetObject = () => {
    const entrySpaceId = getEntrySpaceId()
    const imageTargets = Object.values(currentSceneGraph.objects || {}).filter((object) => {
      return Boolean(object.imageTarget) && isDescendantOf(object.id, entrySpaceId)
    })

    return imageTargets[0] || null
  }

  const getObjectKind = (object: GraphObject) => {
    if (object.gltfModel) {
      return 'GLB'
    }

    if (object.material?.type === 'hider') {
      return 'Occluder'
    }

    if (object.geometry) {
      return object.geometry.type === 'sphere' ? 'Sphere' : `Geo ${object.geometry.type}`
    }

    return 'Helper'
  }

  const getDisplayName = (object: GraphObject) => {
    if (object.imageTarget) {
      return `TRACKER FIJO · ${getImageTargetName(object)}`
    }

    return `${getObjectKind(object)} · ${object.name || object.id}`
  }

  const buildChildMap = () => {
    childMap.clear()
    Object.values(currentSceneGraph.objects || {}).forEach((object) => {
      if (!object.parentId) {
        return
      }

      const next = childMap.get(object.parentId) || []
      next.push(object.id)
      childMap.set(object.parentId, next)
    })
  }

  const markBuildableNodes = () => {
    buildSet.clear()

    const visit = (id: string): boolean => {
      const object = currentSceneGraph.objects[id]
      if (!object || isObjectSkipped(object)) {
        return false
      }

      const explicit = isExplicitRenderable(object)
      const childHasRenderable = (childMap.get(id) || []).some(visit)

      if (explicit || childHasRenderable) {
        buildSet.add(id)
        return true
      }

      return false
    }

    Object.keys(currentSceneGraph.objects || {}).forEach(visit)
  }

  const getEditableIds = () => {
    const entrySpaceId = getEntrySpaceId()
    return Array.from(buildSet)
      .filter((id) => isDescendantOf(id, entrySpaceId))
      .filter((id) => !currentSceneGraph.objects[id]?.imageTarget)
      .filter((id) => isExplicitRenderable(currentSceneGraph.objects[id]))
      .filter((id) => {
        const primaryTarget = getPrimaryImageTargetObject()
        return primaryTarget ? isDescendantOf(id, entrySpaceId) : true
      })
    .sort((a, b) => (currentSceneGraph.objects[a]?.name || '').localeCompare(currentSceneGraph.objects[b]?.name || ''))
  }

  const getImageTargetObjects = () => {
    const primaryTarget = getPrimaryImageTargetObject()
    return primaryTarget ? [primaryTarget] : []
  }

  const getImageTargetName = (object: GraphObject) => (object.imageTarget as ImageTargetDefinition | undefined)?.name || object.name || object.id

  const loadTextureSafe = async (paths: string[]): Promise<Texture | null> => {
    for (const path of paths) {
      try {
        const texture = await textureLoader.loadAsync(path)
        return texture
      } catch {
        // try next candidate
      }
    }

    return null
  }

  const buildImageTargetHelpers = async () => {
    imageTargetHelperRoot.clear()

    const imageTargets = getImageTargetObjects()
    if (imageTargets.length === 0) {
      trackerInfo.textContent = 'No se encontró ningún image tracker en la escena.'
      return
    }

    const labels: string[] = []

    await Promise.all(imageTargets.map(async (object) => {
      const targetName = getImageTargetName(object)
      labels.push(`TRACKER FIJO · ${targetName}`)

      const helperGroup = new Group()
      helperGroup.name = `${targetName}-tracker-helper`
      applyTransformToObject3D(helperGroup, object)

      const texture = await loadTextureSafe([
        `./image-targets/${targetName}_cropped.png`,
        `./image-targets/${targetName}_original.png`,
        `./image-targets/${targetName}.png`,
        `./image-targets/${targetName}.jpeg`,
      ])

      const planeWidth = IMAGE_TARGET_WIDTH
      const planeHeight = IMAGE_TARGET_HEIGHT

      const trackerPlane = new Mesh(
        new PlaneGeometry(planeWidth, planeHeight),
        new MeshBasicMaterial({
          map: texture || undefined,
          color: texture ? '#ffffff' : '#f59e0b',
          transparent: true,
          opacity: texture ? 0.92 : 0.35,
          side: DoubleSide,
        })
      )
      trackerPlane.name = `${targetName}-tracker-plane`

      const trackerBorder = new Mesh(
        new PlaneGeometry(planeWidth * 1.02, planeHeight * 1.02),
        new MeshBasicMaterial({
          color: '#f472b6',
          wireframe: true,
          transparent: true,
          opacity: 0.9,
          side: DoubleSide,
        })
      )
      trackerBorder.position.z = -0.001

      const trackerAxes = new AxesHelper(0.8)
      trackerAxes.position.z = 0.02

      helperGroup.add(trackerPlane)
      helperGroup.add(trackerBorder)
      helperGroup.add(trackerAxes)
      imageTargetHelperRoot.add(helperGroup)
    }))

    trackerInfo.textContent = `Referencia fija visible: ${labels.join(' · ')}. Ese tracker no se mueve y la posición final en AR queda basada en eso.`
  }

  const getObjectPath = (id: string) => {
    const names: string[] = []
    let cursor = currentSceneGraph.objects[id]
    let depth = 0

    while (cursor && depth < 12) {
      names.unshift(cursor.name || cursor.id)
      cursor = cursor.parentId ? currentSceneGraph.objects[cursor.parentId] : undefined
      depth += 1
    }

    return names.join(' / ')
  }

  const getObjectTransform = (id: string): TransformState => ({
    position: readVec3(currentSceneGraph.objects[id]?.position, [0, 0, 0]),
    scale: readVec3(currentSceneGraph.objects[id]?.scale, [1, 1, 1]),
  })

  const getOriginalTransform = (id: string): TransformState => ({
    position: readVec3(originalSceneGraph.objects[id]?.position, [0, 0, 0]),
    scale: readVec3(originalSceneGraph.objects[id]?.scale, [1, 1, 1]),
  })

  const makeGeometry = (object: GraphObject) => {
    const geometry = object.geometry
    if (!geometry) {
      return null
    }

    switch (geometry.type) {
      case 'box': return new BoxGeometry(geometry.width || 1, geometry.height || 1, geometry.depth || 1)
      case 'sphere': return new SphereGeometry(geometry.radius || 0.5, 32, 24)
      case 'plane': return new PlaneGeometry(geometry.width || 1, geometry.height || 1)
      case 'cone': return new ConeGeometry(geometry.radius || 0.5, geometry.height || 1, 24)
      case 'cylinder': return new CylinderGeometry(geometry.radius || 0.5, geometry.radius || 0.5, geometry.height || 1, 24)
      case 'circle': return new CircleGeometry(geometry.radius || 0.5, 32)
      case 'ring': return new RingGeometry(geometry.innerRadius || 0.3, geometry.outerRadius || 0.5, 32)
      case 'torus': return new TorusGeometry(geometry.radius || 0.7, geometry.tubeRadius || 0.2, 16, 60)
      default: return new SphereGeometry(0.18, 18, 14)
    }
  }

  const makeMaterial = (object: GraphObject) => {
    if (object.material?.type === 'hider') {
      return new MeshBasicMaterial({color: '#ec4899', transparent: true, opacity: 0.28, side: DoubleSide})
    }

    return new MeshStandardMaterial({
      color: object.material?.color || '#7dd3fc',
      transparent: typeof object.material?.opacity === 'number',
      opacity: object.material?.opacity ?? 0.95,
      metalness: 0.1,
      roughness: 0.7,
      side: DoubleSide,
    })
  }

  const applyTransformToObject3D = (object3D: Object3D, object: GraphObject) => {
    const [px, py, pz] = readVec3(object.position, [0, 0, 0])
    const [sx, sy, sz] = readVec3(object.scale, [1, 1, 1])
    object3D.position.set(px, py, pz)
    object3D.scale.set(sx, sy, sz)

    if (Array.isArray(object.rotation) && object.rotation.length === 4) {
      object3D.quaternion.set(
        Number(object.rotation[0]) || 0,
        Number(object.rotation[1]) || 0,
        Number(object.rotation[2]) || 0,
        Number(object.rotation[3]) || 1
      )
    }
  }

  const attachRenderableContent = async (id: string, group: Group, object: GraphObject) => {
    if (hasHiderEnforcer(object)) {
      const shellMaterial = new MeshBasicMaterial({
        color: '#7dd3fc',
        transparent: true,
        opacity: 0.18,
        side: DoubleSide,
      })

      const shellEdgeMaterial = new MeshBasicMaterial({
        color: '#38bdf8',
        wireframe: true,
        transparent: true,
        opacity: 0.75,
        side: DoubleSide,
      })

      getPortalShellPanels().forEach((panel) => {
        const fill = new Mesh(new PlaneGeometry(panel.width, panel.height), shellMaterial)
        fill.position.set(panel.position[0], panel.position[1], panel.position[2])
        fill.rotation.set(panel.rotation[0], panel.rotation[1], panel.rotation[2])
        fill.name = `${id}-${panel.name}-fill`
        group.add(fill)

        const edge = new Mesh(new PlaneGeometry(panel.width, panel.height), shellEdgeMaterial)
        edge.position.copy(fill.position)
        edge.rotation.copy(fill.rotation)
        edge.position.z += 0.002
        edge.name = `${id}-${panel.name}-edge`
        group.add(edge)
      })

      return
    }

    const src = object.gltfModel?.src?.asset || object.gltfModel?.src?.url
    if (src) {
      try {
        const gltf = await gltfLoader.loadAsync(src)
        group.add(gltf.scene)
        return
      } catch {
        // fallback continues below
      }
    }

    const geometry = makeGeometry(object)
    if (geometry) {
      group.add(new Mesh(geometry, makeMaterial(object)))
      return
    }

    group.add(new Mesh(new SphereGeometry(0.16, 18, 14), new MeshStandardMaterial({color: '#fbbf24'})))
    group.add(new AxesHelper(0.7))
  }

  const syncPair = (control: SliderControl, value: number) => {
    control.range.value = String(value)
    control.number.value = String(value)
  }

  const syncControlsFromCurrentObject = () => {
    if (!currentObjectId) {
      return
    }

    const transform = getObjectTransform(currentObjectId)
    syncPair(positionControls.x, transform.position[0])
    syncPair(positionControls.y, transform.position[1])
    syncPair(positionControls.z, transform.position[2])
    syncPair(scaleControls.x, transform.scale[0])
    syncPair(scaleControls.y, transform.scale[1])
    syncPair(scaleControls.z, transform.scale[2])
    pathLabel.textContent = getObjectPath(currentObjectId)
  }

  const refreshExport = () => {
    const saved = editableIds.reduce<Record<string, TransformState>>((acc, id) => {
      const current = getObjectTransform(id)
      const original = getOriginalTransform(id)
      const changed =
        current.position.some((value, index) => value !== original.position[index]) ||
        current.scale.some((value, index) => value !== original.scale[index])

      if (changed) {
        acc[id] = current
      }

      return acc
    }, {})

    exportArea.value = JSON.stringify(saved, null, 2)
  }

  const populateObjectSelect = (query = '') => {
    const filtered = editableIds.filter((id) => {
      const label = `${currentSceneGraph.objects[id]?.name || ''} ${getObjectPath(id)}`.toLowerCase()
      return label.includes(query.trim().toLowerCase())
    })

    objectSelect.innerHTML = ''
    filtered.forEach((id) => {
      const option = document.createElement('option')
      const object = currentSceneGraph.objects[id]
      option.value = id
      option.textContent = getDisplayName(object)
      objectSelect.appendChild(option)
    })

    if (!filtered.includes(currentObjectId)) {
      currentObjectId = filtered[0] || ''
    }

    objectSelect.value = currentObjectId
    pathLabel.textContent = currentObjectId ? getObjectPath(currentObjectId) : 'Sin objeto seleccionado'
    status.textContent = `${filtered.length} objetos editables · último guardado ${lastSavedAt || 'pendiente'}`
  }

  const frameCurrentObject = () => {
    if (!currentObjectId) {
      return
    }

    const object3D = object3DMap.get(currentObjectId)
    if (!object3D) {
      return
    }

    const position = new Vector3()
    object3D.getWorldPosition(position)
    controls.target.copy(position)
  }

  const saveSceneGraph = async () => {
    const nonce = ++saveNonce
    status.textContent = 'Guardando archivo...'

    try {
      const response = await fetch('/__editor/scene', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(currentSceneGraph),
      })

      if (!response.ok) {
        throw new Error('save failed')
      }

      const result = await response.json()
      if (nonce !== saveNonce) {
        return
      }

      originalSceneGraph = deepClone(currentSceneGraph)
      lastSavedAt = new Date(result.updatedAt || Date.now()).toLocaleTimeString()
      status.textContent = `Guardado directo en .expanse.json · ${lastSavedAt}`
      refreshExport()
    } catch {
      status.textContent = 'No se pudo guardar directo. Revisa que el server siga activo.'
    }
  }

  const queueSave = () => {
    if (saveTimer !== null) {
      window.clearTimeout(saveTimer)
    }

    saveTimer = window.setTimeout(() => {
      saveTimer = null
      void saveSceneGraph()
    }, saveDebounceMs)
  }

  const updateCurrentObjectFromControls = () => {
    if (!currentObjectId) {
      return
    }

    const object = currentSceneGraph.objects[currentObjectId]
    object.position = [
      Number(positionControls.x.number.value),
      Number(positionControls.y.number.value),
      Number(positionControls.z.number.value),
    ]
    object.scale = [
      Math.max(0.01, Number(scaleControls.x.number.value)),
      Math.max(0.01, Number(scaleControls.y.number.value)),
      Math.max(0.01, Number(scaleControls.z.number.value)),
    ]

    const object3D = object3DMap.get(currentObjectId)
    if (object3D) {
      applyTransformToObject3D(object3D, object)
    }

    refreshExport()
    queueSave()
  }

  const wireControl = (control: SliderControl) => {
    const syncFromRange = () => {
      control.number.value = control.range.value
      updateCurrentObjectFromControls()
    }

    const syncFromNumber = () => {
      control.range.value = control.number.value
      updateCurrentObjectFromControls()
    }

    control.range.addEventListener('input', syncFromRange)
    control.number.addEventListener('input', syncFromNumber)
    control.number.addEventListener('change', syncFromNumber)
  }

  const rebuildPreviewScene = async () => {
    Array.from(object3DMap.values()).forEach((object3D) => object3D.removeFromParent())
    object3DMap.clear()

    buildChildMap()
    markBuildableNodes()
    editableIds.splice(0, editableIds.length, ...getEditableIds())

    Array.from(buildSet).forEach((id) => {
      const group = new Group()
      const object = currentSceneGraph.objects[id]
      group.name = object.name || id
      applyTransformToObject3D(group, object)
      object3DMap.set(id, group)
    })

    Array.from(buildSet).forEach((id) => {
      const group = object3DMap.get(id)
      const parentId = currentSceneGraph.objects[id]?.parentId

      if (!group) {
        return
      }

      if (parentId && object3DMap.has(parentId)) {
        object3DMap.get(parentId)?.add(group)
      } else {
        previewScene.add(group)
      }
    })

    await Promise.all(Array.from(buildSet).map(async (id) => {
      const group = object3DMap.get(id) as Group | undefined
      const object = currentSceneGraph.objects[id]
      if (group && object) {
        await attachRenderableContent(id, group, object)
      }
    }))

    await buildImageTargetHelpers()

    populateObjectSelect(searchInput.value)
    if (!currentObjectId || !editableIds.includes(currentObjectId)) {
      currentObjectId = editableIds[0] || ''
    }
    syncControlsFromCurrentObject()
    frameCurrentObject()
    refreshExport()
  }

  const loadSceneGraphFromServer = async () => {
    try {
      const response = await fetch('/__editor/scene', {cache: 'no-store'})
      if (!response.ok) {
        throw new Error('load failed')
      }

      const nextScene = await response.json()
      currentSceneGraph = deepClone(nextScene)
      originalSceneGraph = deepClone(nextScene)
    } catch {
      currentSceneGraph = deepClone(fallbackGraph)
      originalSceneGraph = deepClone(fallbackGraph)
    }
  }

  const resetCurrentObject = () => {
    if (!currentObjectId) {
      return
    }

    const original = getOriginalTransform(currentObjectId)
    const object = currentSceneGraph.objects[currentObjectId]
    object.position = [...original.position]
    object.scale = [...original.scale]

    const object3D = object3DMap.get(currentObjectId)
    if (object3D) {
      applyTransformToObject3D(object3D, object)
    }

    syncControlsFromCurrentObject()
    refreshExport()
    queueSave()
  }

  const resetAllObjects = () => {
    currentSceneGraph = deepClone(originalSceneGraph)
    void rebuildPreviewScene().then(() => {
      queueSave()
    })
  }

  const handleResize = () => {
    const width = window.innerWidth
    const height = window.innerHeight
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }

  const animate = () => {
    requestAnimationFrame(animate)
    controls.update()
    renderer.render(previewScene, camera)
  }

  Object.values(positionControls).forEach(wireControl)
  Object.values(scaleControls).forEach(wireControl)

  searchInput.addEventListener('input', () => populateObjectSelect(searchInput.value))
  objectSelect.addEventListener('change', () => {
    currentObjectId = objectSelect.value
    syncControlsFromCurrentObject()
    frameCurrentObject()
  })
  saveButton.addEventListener('click', () => {
    if (saveTimer !== null) {
      window.clearTimeout(saveTimer)
      saveTimer = null
    }
    void saveSceneGraph()
  })
  reloadButton.addEventListener('click', async () => {
    status.textContent = 'Recargando archivo...'
    await loadSceneGraphFromServer()
    await rebuildPreviewScene()
    status.textContent = `Archivo recargado · último guardado ${lastSavedAt || 'servidor'}`
  })
  resetButton.addEventListener('click', resetCurrentObject)
  resetAllButton.addEventListener('click', resetAllObjects)
  frameButton.addEventListener('click', frameCurrentObject)
  window.addEventListener('resize', handleResize)

  void (async () => {
    await loadSceneGraphFromServer()
    await rebuildPreviewScene()
    handleResize()
    animate()
    status.textContent = 'Editor listo. Ajusta con sliders y se guarda directo al archivo.'
  })()
}
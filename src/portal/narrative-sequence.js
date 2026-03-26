/* narrative-sequence.js
 * 3D narrative text panels that emerge from the portal, with connecting
 * light-lines and a convergence to CHECKOUT.
 * Activated only when ?narrative is present in the URL. */

const ENABLED = new URLSearchParams(window.location.search).has('narrative')

const registerComponent = (name, definition) => {
  if (!window.AFRAME || window.AFRAME.components[name]) return
  window.AFRAME.registerComponent(name, definition)
}

/* ------------------------------------------------------------------ */
/* Canvas-texture helpers                                              */
/* ------------------------------------------------------------------ */

const createPanelCanvas = (title, subtitle, iconFn, w = 512, h = 192) => {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')

  // background
  ctx.fillStyle = 'rgba(8,14,30,0.82)'
  ctx.beginPath()
  roundRect(ctx, 0, 0, w, h, 18)
  ctx.fill()

  // border
  ctx.strokeStyle = 'rgba(140,180,255,0.25)'
  ctx.lineWidth = 2
  ctx.beginPath()
  roundRect(ctx, 1, 1, w - 2, h - 2, 17)
  ctx.stroke()

  // icon area
  if (iconFn) iconFn(ctx, 32, 32, 80, h - 64)

  // text
  const tx = 130
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 22px Inter, system-ui, sans-serif'
  ctx.shadowColor = 'rgba(0,0,0,0.6)'
  ctx.shadowBlur = 6
  wrapText(ctx, title, tx, 52, w - tx - 24, 28)

  ctx.fillStyle = '#8ab4ff'
  ctx.font = '18px Inter, system-ui, sans-serif'
  ctx.shadowBlur = 0
  ctx.fillText(subtitle, tx, h - 32)

  return c
}

const createLabelCanvas = (text, w = 320, h = 96) => {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')

  ctx.fillStyle = 'rgba(8,14,30,0.85)'
  ctx.beginPath()
  roundRect(ctx, 0, 0, w, h, 14)
  ctx.fill()

  ctx.strokeStyle = 'rgba(100,255,160,0.35)'
  ctx.lineWidth = 2
  ctx.beginPath()
  roundRect(ctx, 1, 1, w - 2, h - 2, 13)
  ctx.stroke()

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 20px Inter, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 4
  ctx.fillText(text, w / 2, h / 2)

  return c
}

const createCtaCanvas = (w = 384, h = 128) => {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')

  ctx.fillStyle = 'rgba(8,14,30,0.85)'
  ctx.beginPath()
  roundRect(ctx, 0, 0, w, h, 16)
  ctx.fill()

  ctx.strokeStyle = 'rgba(140,180,255,0.3)'
  ctx.lineWidth = 2
  ctx.beginPath()
  roundRect(ctx, 1, 1, w - 2, h - 2, 15)
  ctx.stroke()

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 22px Inter, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 5
  ctx.fillText('📸  TAKE A PHOTO!', w / 2, 46)

  ctx.fillStyle = '#8ab4ff'
  ctx.font = '16px Inter, system-ui, sans-serif'
  ctx.shadowBlur = 0
  ctx.fillText('REWARDS  ·  SWAG', w / 2, 86)

  return c
}

/* tiny helpers */
function roundRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ')
  let line = ''
  let cy = y
  for (const word of words) {
    const test = line + word + ' '
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line.trim(), x, cy)
      line = word + ' '
      cy += lineH
    } else {
      line = test
    }
  }
  ctx.fillText(line.trim(), x, cy)
}

/* ------------------------------------------------------------------ */
/* Simple icon drawing functions                                       */
/* ------------------------------------------------------------------ */

function iconCouchTablet(ctx, x, y, w, h) {
  const cx = x + w / 2
  const cy = y + h / 2
  ctx.strokeStyle = '#8ab4ff'
  ctx.lineWidth = 2.5
  ctx.lineJoin = 'round'

  // couch body
  ctx.strokeRect(cx - 28, cy - 8, 56, 24)
  // armrests
  ctx.strokeRect(cx - 34, cy - 4, 8, 20)
  ctx.strokeRect(cx + 26, cy - 4, 8, 20)
  // tablet
  ctx.strokeStyle = '#64ffa0'
  ctx.strokeRect(cx - 12, cy - 24, 24, 14)
  ctx.fillStyle = '#64ffa0'
  ctx.fillRect(cx - 2, cy - 12, 4, 3)
}

function iconTVPhone(ctx, x, y, w, h) {
  const cx = x + w / 2
  const cy = y + h / 2
  ctx.strokeStyle = '#8ab4ff'
  ctx.lineWidth = 2.5
  ctx.lineJoin = 'round'

  // TV
  ctx.strokeRect(cx - 26, cy - 18, 40, 28)
  ctx.beginPath()
  ctx.moveTo(cx - 6, cy + 10)
  ctx.lineTo(cx - 16, cy + 20)
  ctx.moveTo(cx + 6, cy + 10)
  ctx.lineTo(cx + 16, cy + 20)
  ctx.stroke()

  // phone
  ctx.strokeStyle = '#64ffa0'
  ctx.strokeRect(cx + 18, cy - 10, 14, 24)
  ctx.fillStyle = '#64ffa0'
  ctx.fillRect(cx + 22, cy + 10, 6, 2)
}

function iconCartShelf(ctx, x, y, w, h) {
  const cx = x + w / 2
  const cy = y + h / 2
  ctx.strokeStyle = '#8ab4ff'
  ctx.lineWidth = 2.5
  ctx.lineJoin = 'round'

  // shelf
  ctx.beginPath()
  ctx.moveTo(cx + 10, cy - 20)
  ctx.lineTo(cx + 10, cy + 16)
  ctx.moveTo(cx + 10, cy - 6)
  ctx.lineTo(cx + 36, cy - 6)
  ctx.moveTo(cx + 10, cy + 8)
  ctx.lineTo(cx + 36, cy + 8)
  ctx.stroke()

  // cart
  ctx.strokeStyle = '#64ffa0'
  ctx.beginPath()
  ctx.moveTo(cx - 30, cy - 14)
  ctx.lineTo(cx - 22, cy - 14)
  ctx.lineTo(cx - 14, cy + 8)
  ctx.lineTo(cx + 2, cy + 8)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx - 12, cy + 16, 3, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx, cy + 16, 3, 0, Math.PI * 2)
  ctx.stroke()
}

/* ------------------------------------------------------------------ */
/* Animated THREE.Line helper                                          */
/* ------------------------------------------------------------------ */

function createAnimatedLine(points, color, parent) {
  const THREE = window.THREE
  const fullPositions = new Float32Array(points.length * 3)
  points.forEach((p, i) => {
    fullPositions[i * 3] = p.x
    fullPositions[i * 3 + 1] = p.y
    fullPositions[i * 3 + 2] = p.z
  })

  const geom = new THREE.BufferGeometry()
  const drawPositions = new Float32Array(fullPositions.length)
  // start all points at first point
  for (let i = 0; i < drawPositions.length; i += 3) {
    drawPositions[i] = fullPositions[0]
    drawPositions[i + 1] = fullPositions[1]
    drawPositions[i + 2] = fullPositions[2]
  }
  geom.setAttribute('position', new THREE.BufferAttribute(drawPositions, 3))

  const mat = new THREE.LineBasicMaterial({color, linewidth: 2, transparent: true, opacity: 0.8, depthTest: false, depthWrite: false})
  const line = new THREE.Line(geom, mat)
  line.renderOrder = 998
  parent.add(line)

  return {line, geom, mat, fullPositions}
}

function animateLine(lineData, duration, easeFn) {
  const {geom, fullPositions} = lineData
  const positions = geom.attributes.position.array
  const numPts = fullPositions.length / 3
  const startTime = performance.now()

  return new Promise((resolve) => {
    const tick = () => {
      const t = Math.min(1, (performance.now() - startTime) / duration)
      const et = easeFn(t)
      const progress = et * (numPts - 1)
      const idx = Math.floor(progress)
      const frac = progress - idx

      for (let i = 0; i <= idx && i < numPts; i++) {
        positions[i * 3] = fullPositions[i * 3]
        positions[i * 3 + 1] = fullPositions[i * 3 + 1]
        positions[i * 3 + 2] = fullPositions[i * 3 + 2]
      }
      // interpolate leading point
      if (idx + 1 < numPts) {
        const ni = idx + 1
        positions[ni * 3] = fullPositions[idx * 3] + (fullPositions[ni * 3] - fullPositions[idx * 3]) * frac
        positions[ni * 3 + 1] = fullPositions[idx * 3 + 1] + (fullPositions[ni * 3 + 1] - fullPositions[idx * 3 + 1]) * frac
        positions[ni * 3 + 2] = fullPositions[idx * 3 + 2] + (fullPositions[ni * 3 + 2] - fullPositions[idx * 3 + 2]) * frac
        // clamp rest to leading point
        for (let i = ni + 1; i < numPts; i++) {
          positions[i * 3] = positions[ni * 3]
          positions[i * 3 + 1] = positions[ni * 3 + 1]
          positions[i * 3 + 2] = positions[ni * 3 + 2]
        }
      }
      geom.attributes.position.needsUpdate = true

      if (t < 1) {
        requestAnimationFrame(tick)
      } else {
        resolve()
      }
    }
    requestAnimationFrame(tick)
  })
}

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)
const easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

/* ------------------------------------------------------------------ */
/* Path animation – moves a mesh through multiple waypoints (x,y,z)    */
/* ------------------------------------------------------------------ */

function pathAnimate(mesh, waypoints, duration, opts = {}) {
  // waypoints: [{x,y,z}, ...] — at least 2
  // opts.onCrossZ: {z, fn} — call fn() when mesh crosses z threshold
  mesh.position.set(waypoints[0].x, waypoints[0].y, waypoints[0].z)
  mesh.visible = true
  const startTime = performance.now()
  const segments = waypoints.length - 1
  let crossFired = false

  return new Promise((resolve) => {
    const tick = () => {
      const t = Math.min(1, (performance.now() - startTime) / duration)
      const et = easeInOutCubic(t)
      const progress = et * segments
      const segIdx = Math.min(Math.floor(progress), segments - 1)
      const segT = progress - segIdx
      const a = waypoints[segIdx]
      const b = waypoints[segIdx + 1]
      mesh.position.set(
        a.x + (b.x - a.x) * segT,
        a.y + (b.y - a.y) * segT,
        a.z + (b.z - a.z) * segT
      )

      // Fire callback when crossing a z threshold (e.g. to disable depthTest)
      if (opts.onCrossZ && !crossFired && mesh.position.z >= opts.onCrossZ.z) {
        crossFired = true
        opts.onCrossZ.fn()
      }

      if (t < 1) {
        requestAnimationFrame(tick)
      } else {
        resolve()
      }
    }
    requestAnimationFrame(tick)
  })
}

/* ------------------------------------------------------------------ */
/* Fade-in helper                                                      */
/* ------------------------------------------------------------------ */

function fadeIn(mesh, duration) {
  mesh.material.opacity = 0
  mesh.material.transparent = true
  mesh.visible = true
  const startTime = performance.now()
  return new Promise((resolve) => {
    const tick = () => {
      const t = Math.min(1, (performance.now() - startTime) / duration)
      mesh.material.opacity = easeOutCubic(t)
      if (t < 1) {
        requestAnimationFrame(tick)
      } else {
        resolve()
      }
    }
    requestAnimationFrame(tick)
  })
}

/* ------------------------------------------------------------------ */
/* Panel mesh builder                                                  */
/* ------------------------------------------------------------------ */

function buildPanel(canvas, width, height) {
  const THREE = window.THREE
  const tex = new THREE.CanvasTexture(canvas)
  tex.minFilter = THREE.LinearFilter
  // Start with depthTest ON — hider walls naturally hide the panel while inside the portal.
  // We flip depthTest off once it crosses the opening so hider strips don't clip it.
  const mat = new THREE.MeshBasicMaterial({map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false, depthTest: true})
  const geom = new THREE.PlaneGeometry(width, height)
  const mesh = new THREE.Mesh(geom, mat)
  mesh.renderOrder = 999
  mesh.visible = false
  return {mesh, tex, mat, geom}
}

/* ------------------------------------------------------------------ */
/* Component: narrative-sequence                                       */
/* ------------------------------------------------------------------ */

if (!ENABLED) {
  // Register a no-op component so the HTML attribute doesn't warn
  registerComponent('narrative-sequence', {
    init() {
      this.el.setAttribute('visible', false)
    },
  })
} else {
  registerComponent('narrative-sequence', {
    init() {
      this._resources = []
      this._running = false

      // Listen for the same XR events that image-target-anchor uses
      this._onFound = (e) => {
        // Start once any image target is found
        this._startSequence()
      }
      this._onCameraStatus = (e) => {
        // Desktop preview mode – start when 3D preview activates
        if (e.detail?.status === 'hasDesktop3D') {
          this._startSequence()
        }
      }

      this.el.sceneEl.addEventListener('xrimagefound', this._onFound)
      this.el.sceneEl.addEventListener('camerastatuschange', this._onCameraStatus)

      // Fallback: if scene is already loaded in desktop mode, start after delay
      setTimeout(() => {
        if (!this._running && this.el.closest('[image-target-anchor]')?.object3D?.visible) {
          this._startSequence()
        }
      }, 3000)
    },

    _startSequence() {
      if (this._running) return
      this._running = true

      const THREE = window.THREE
      const group = new THREE.Group()
      this.el.object3D.add(group)
      this._group = group

      /* Panel definitions
       * Portal opening in anchor space: ~0.76 wide × ~1.01 tall, centered at origin, z≈0.
       * Panels start deep inside (z=-0.8), travel to the center of the opening (z≈0.01),
       * then fan outward and to the sides (positive z, offset x).
       * depthTest starts ON so hider walls naturally occlude them while inside;
       * it flips OFF once they cross z=0 so the front hider strips don't clip them.
       */
      const panels = [
        {
          title: 'START AT HOME: ACTIVATE NATIVE APPS & SITES',
          subtitle: 'Couch Data',
          icon: iconCouchTablet,
          // Path: inside → center opening → fan upper-left
          waypoints: [
            {x: 0, y: 0, z: -0.8},
            {x: 0, y: 0.05, z: 0.01},
            {x: -0.46, y: 0.34, z: 0.25},
          ],
          lineTarget: {x: -0.20, y: -0.10, z: -0.3},
        },
        {
          title: 'REACH SHOPPERS ON CTV, SOCIAL & PROGRAMMATIC',
          subtitle: 'The Street Data',
          icon: iconTVPhone,
          // Path: inside → center opening → settle center-above
          waypoints: [
            {x: 0, y: 0, z: -0.8},
            {x: 0, y: 0, z: 0.01},
            {x: 0, y: 0.06, z: 0.20},
          ],
          lineTarget: {x: 0, y: -0.15, z: -0.35},
        },
        {
          title: 'IMPACT THE AISLE: IN-STORE SCREENS & RETAIL MEDIA',
          subtitle: 'The Store Data',
          icon: iconCartShelf,
          // Path: inside → center opening → fan upper-right
          waypoints: [
            {x: 0, y: 0, z: -0.8},
            {x: 0, y: -0.05, z: 0.01},
            {x: 0.46, y: -0.22, z: 0.25},
          ],
          lineTarget: {x: 0.20, y: -0.20, z: -0.4},
        },
      ]

      const checkoutPos = {x: 0, y: -0.32, z: -0.5}
      const ctaPos = {x: 0, y: 0.52, z: 0.28}

      const panelWidth = 0.52
      const panelHeight = 0.195

      /* Build all meshes up-front (hidden) */
      const built = panels.map((p) => {
        const canvas = createPanelCanvas(p.title, p.subtitle, p.icon)
        const panel = buildPanel(canvas, panelWidth, panelHeight)
        panel.mesh.position.set(p.waypoints[0].x, p.waypoints[0].y, p.waypoints[0].z)
        group.add(panel.mesh)
        this._resources.push(panel)
        return {def: p, panel}
      })

      // Checkout label
      const checkoutCanvas = createLabelCanvas('CHECKOUT · incremental SALE')
      const checkout = buildPanel(checkoutCanvas, 0.36, 0.11)
      checkout.mesh.position.set(checkoutPos.x, checkoutPos.y, checkoutPos.z)
      group.add(checkout.mesh)
      this._resources.push(checkout)

      // CTA
      const ctaCanvas = createCtaCanvas()
      const cta = buildPanel(ctaCanvas, 0.44, 0.15)
      cta.mesh.position.set(ctaPos.x, ctaPos.y, ctaPos.z)
      group.add(cta.mesh)
      this._resources.push(cta)

      /* Run the timed sequence */
      this._animate(built, checkout, cta, panels, checkoutPos)
    },

    async _animate(built, checkout, cta, panels, checkoutPos) {
      const THREE = window.THREE

      // 1s initial delay
      await delay(1000)

      // Slide panels in one by one along their waypoint paths
      for (let i = 0; i < built.length; i++) {
        const {def, panel} = built[i]

        // Animate along the 3-point path (inside → opening center → fanned out)
        // When crossing z=0 (the portal opening), disable depthTest so front
        // hider-wall strips don't clip the panel once it's outside.
        await pathAnimate(panel.mesh, def.waypoints, 1400, {
          onCrossZ: {
            z: 0.0,
            fn: () => { panel.mat.depthTest = false },
          },
        })

        // Draw connecting line from final panel position to its city target
        const finalWp = def.waypoints[def.waypoints.length - 1]
        const lineStart = new THREE.Vector3(finalWp.x, finalWp.y, finalWp.z)
        const lineMid = new THREE.Vector3(
          (finalWp.x + def.lineTarget.x) / 2,
          (finalWp.y + def.lineTarget.y) / 2,
          (finalWp.z + def.lineTarget.z) / 2
        )
        const lineEnd = new THREE.Vector3(def.lineTarget.x, def.lineTarget.y, def.lineTarget.z)

        const lineData = createAnimatedLine([lineStart, lineMid, lineEnd], 0x8ab4ff, this._group)
        this._resources.push(lineData)
        await animateLine(lineData, 600, easeOutCubic)

        if (i < built.length - 1) await delay(1000)
      }

      // Convergence lines (green) to checkout
      await delay(500)
      const ckPt = new THREE.Vector3(checkoutPos.x, checkoutPos.y, checkoutPos.z)
      for (let i = 0; i < panels.length; i++) {
        const p = panels[i]
        const from = new THREE.Vector3(p.lineTarget.x, p.lineTarget.y, p.lineTarget.z)
        const cLineData = createAnimatedLine([from, ckPt], 0x64ffa0, this._group)
        this._resources.push(cLineData)
        animateLine(cLineData, 800, easeOutCubic) // run in parallel
      }
      await delay(800)

      // Show checkout label
      await fadeIn(checkout.mesh, 500)

      // Show CTA
      await delay(500)
      await fadeIn(cta.mesh, 600)
    },

    remove() {
      // Clean up event listeners
      if (this._onFound) {
        this.el.sceneEl.removeEventListener('xrimagefound', this._onFound)
      }
      if (this._onCameraStatus) {
        this.el.sceneEl.removeEventListener('camerastatuschange', this._onCameraStatus)
      }
      // Dispose all GPU resources
      for (const r of this._resources) {
        if (r.tex) r.tex.dispose()
        if (r.mat) r.mat.dispose()
        if (r.geom) r.geom.dispose()
      }
      if (this._group && this._group.parent) {
        this._group.parent.remove(this._group)
      }
    },
  })
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

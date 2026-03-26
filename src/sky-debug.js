// Standalone debug hook: if sky image fails to load, force a visible fallback color.
window.addEventListener('DOMContentLoaded', () => {
  const skyImage = document.getElementById('skyTex')
  const skySphere = document.getElementById('debug-sky')

  if (!skyImage || !skySphere) return

  skyImage.addEventListener('error', () => {
    skySphere.setAttribute('material', 'shader: flat; side: back; color: #55b9ff')
    // eslint-disable-next-line no-console
    console.error('skyTex failed to load:', skyImage.getAttribute('src'))
  })

  skyImage.addEventListener('load', () => {
    // eslint-disable-next-line no-console
    console.log('skyTex loaded:', skyImage.naturalWidth, skyImage.naturalHeight)
  })
})

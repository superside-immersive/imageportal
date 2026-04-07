export const IMAGE_TARGET_WIDTH = 1
export const IMAGE_TARGET_HEIGHT = 1210 / 908

export const PORTAL_SHELL_DEPTH = 8
export const PORTAL_SHELL_OUTER_WIDTH = 12
export const PORTAL_SHELL_OUTER_HEIGHT = 8

export type ShellPanel = {
  width: number
  height: number
  position: [number, number, number]
  rotation: [number, number, number]
  name: string
}

export const getImageTargetHoleSize = () => ({
  width: IMAGE_TARGET_WIDTH,
  height: IMAGE_TARGET_HEIGHT,
})

export const getPortalShellPanels = (): ShellPanel[] => {
  const hole = getImageTargetHoleSize()
  const sideWidth = (PORTAL_SHELL_OUTER_WIDTH - hole.width) / 2
  const topHeight = (PORTAL_SHELL_OUTER_HEIGHT - hole.height) / 2
  const halfOuterWidth = PORTAL_SHELL_OUTER_WIDTH / 2
  const halfOuterHeight = PORTAL_SHELL_OUTER_HEIGHT / 2
  const halfDepth = PORTAL_SHELL_DEPTH / 2

  return [
    {
      name: 'front-top',
      width: PORTAL_SHELL_OUTER_WIDTH,
      height: topHeight,
      position: [0, hole.height / 2 + topHeight / 2, 0],
      rotation: [0, 0, 0],
    },
    {
      name: 'front-bottom',
      width: PORTAL_SHELL_OUTER_WIDTH,
      height: topHeight,
      position: [0, -(hole.height / 2 + topHeight / 2), 0],
      rotation: [0, 0, 0],
    },
    {
      name: 'front-left',
      width: sideWidth,
      height: hole.height,
      position: [-(hole.width / 2 + sideWidth / 2), 0, 0],
      rotation: [0, 0, 0],
    },
    {
      name: 'front-right',
      width: sideWidth,
      height: hole.height,
      position: [hole.width / 2 + sideWidth / 2, 0, 0],
      rotation: [0, 0, 0],
    },
    {
      name: 'back',
      width: PORTAL_SHELL_OUTER_WIDTH,
      height: PORTAL_SHELL_OUTER_HEIGHT,
      position: [0, 0, -PORTAL_SHELL_DEPTH],
      rotation: [0, 0, 0],
    },
    {
      name: 'left-wall',
      width: PORTAL_SHELL_DEPTH,
      height: PORTAL_SHELL_OUTER_HEIGHT,
      position: [-halfOuterWidth, 0, -halfDepth],
      rotation: [0, Math.PI / 2, 0],
    },
    {
      name: 'right-wall',
      width: PORTAL_SHELL_DEPTH,
      height: PORTAL_SHELL_OUTER_HEIGHT,
      position: [halfOuterWidth, 0, -halfDepth],
      rotation: [0, -Math.PI / 2, 0],
    },
    {
      name: 'top-wall',
      width: PORTAL_SHELL_OUTER_WIDTH,
      height: PORTAL_SHELL_DEPTH,
      position: [0, halfOuterHeight, -halfDepth],
      rotation: [Math.PI / 2, 0, 0],
    },
    {
      name: 'bottom-wall',
      width: PORTAL_SHELL_OUTER_WIDTH,
      height: PORTAL_SHELL_DEPTH,
      position: [0, -halfOuterHeight, -halfDepth],
      rotation: [-Math.PI / 2, 0, 0],
    },
  ]
}
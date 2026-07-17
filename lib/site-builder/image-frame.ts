// lib/site-builder/image-frame.ts
//
// Single source of truth for how tenant-site property photos are framed.
// property_images stores no intrinsic dimensions, so every photo goes into a
// fixed frame. 4:3 is chosen deliberately: it is the native iPhone photo ratio
// and the dominant MLS ratio, so the common case fills the frame with no crop
// and no letterbox bars.
//
// Grid tiles (DealCard) cover — uniform tiles matter more than an outlier's
// edges. The detail-page hero contains over a blurred backdrop so that nothing
// is ever cropped where the buyer is actually deciding.

/** CSS aspect-ratio value for every tenant-site property photo frame. */
export const PHOTO_FRAME_RATIO = "4 / 3"

/** Numeric width:height, for intrinsic width/height attrs that prevent CLS. */
export const PHOTO_FRAME_W = 4
export const PHOTO_FRAME_H = 3

/** Height for a given frame width at PHOTO_FRAME_RATIO, rounded to a whole px. */
export function frameHeight(width: number): number {
  return Math.round((width * PHOTO_FRAME_H) / PHOTO_FRAME_W)
}

/**
 * The hero backdrop is a 28px-blurred copy of the same photo. Detail is
 * imperceptible through that blur, so it is requested at a deliberately tiny
 * size — roughly 2KB — rather than reusing the full-size render.
 */
export const HERO_BACKDROP_WIDTH = 64
export const HERO_BACKDROP_QUALITY = 40

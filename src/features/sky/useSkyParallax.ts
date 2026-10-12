import { useRef } from 'react'

type SkyParallaxInput = {
  heading: number | null
  altitude: number | null
}

type SkyParallax = {
  offsetX: number
  offsetY: number
}

const HORIZONTAL_PX_PER_DEGREE = 4
const VERTICAL_PX_PER_DEGREE = 4

function normalizeSignedAngle(angle: number) {
  return ((angle + 180) % 360 + 360) % 360 - 180
}

export function useSkyParallax({
  heading,
  altitude,
}: SkyParallaxInput): SkyParallax {
  const previousHeadingRef = useRef<number | null>(null)
  const previousAltitudeRef = useRef<number | null>(null)

  const offsetXRef = useRef(0)
  const offsetYRef = useRef(0)

  if (
    heading === null ||
    altitude === null ||
    !Number.isFinite(heading) ||
    !Number.isFinite(altitude)
  ) {
    return {
      offsetX: offsetXRef.current,
      offsetY: offsetYRef.current,
    }
  }

  const previousHeading = previousHeadingRef.current
  const previousAltitude = previousAltitudeRef.current

  if (
    previousHeading !== null &&
    previousAltitude !== null
  ) {
    const headingDelta = normalizeSignedAngle(
      heading - previousHeading
    )

    const altitudeDelta =
      altitude - previousAltitude

    // 右を向くと、星空は左へ流れる
    offsetXRef.current -=
      headingDelta * HORIZONTAL_PX_PER_DEGREE

    // 上を見ると、星空は下へ流れる
    offsetYRef.current +=
      altitudeDelta * VERTICAL_PX_PER_DEGREE
  }

  previousHeadingRef.current = heading
  previousAltitudeRef.current = altitude

  return {
    offsetX: offsetXRef.current,
    offsetY: offsetYRef.current,
  }
}
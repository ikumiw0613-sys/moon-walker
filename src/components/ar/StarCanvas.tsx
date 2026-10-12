import { useEffect, useRef } from 'react'

type StarCanvasProps = {
  offsetX?: number
  offsetY?: number
}

type Star = {
  x: number
  y: number
  radius: number
  twinkleSpeed: number
  twinklePhase: number
}

type StarLayer = {
  count: number
  minRadius: number
  maxRadius: number
  speed: number
  opacity: number
  twinkleAmount: number
  stars: Star[]
}

function createStars(
  count: number,
  width: number,
  height: number,
  minRadius: number,
  maxRadius: number
): Star[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    radius:
      minRadius +
      Math.random() * (maxRadius - minRadius),
    // A slow cycle of roughly 6–16 seconds, independent for each star.
    twinkleSpeed: 0.4 + Math.random() * 0.7,
    twinklePhase: Math.random() * Math.PI * 2,
  }))
}

export function StarCanvas({
  offsetX = 0,
  offsetY = 0,
}: StarCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const layersRef = useRef<StarLayer[]>([])
  const offsetsRef = useRef({ offsetX, offsetY })

  useEffect(() => {
    offsetsRef.current = { offsetX, offsetY }
  }, [offsetX, offsetY])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext('2d')
    if (!context) return

    let width = 0
    let height = 0
    let animationFrameId = 0

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      width = canvas.clientWidth
      height = canvas.clientHeight

      canvas.width = width * dpr
      canvas.height = height * dpr

      context.setTransform(dpr, 0, 0, dpr, 0, 0)

      layersRef.current = [
        {
          count: 30,
          minRadius: 0.4,
          maxRadius: 0.8,
          speed: 0.15,
          opacity: 0.35,
          twinkleAmount: 0.04,
          stars: createStars(
            70,
            width,
            height,
            0.4,
            0.8
          ),
        },
        {
          count: 20,
          minRadius: 0.7,
          maxRadius: 1.2,
          speed: 0.35,
          opacity: 0.55,
          twinkleAmount: 0.08,
          stars: createStars(
            40,
            width,
            height,
            0.7,
            1.2
          ),
        },
        {
          count: 10,
          minRadius: 1.0,
          maxRadius: 1.8,
          speed: 0.65,
          opacity: 0.8,
          twinkleAmount: 0.14,
          stars: createStars(
            20,
            width,
            height,
            1.0,
            1.8
          ),
        },
      ]
    }

    const draw = (timestamp: number) => {
      animationFrameId = window.requestAnimationFrame(draw)
      if (width <= 0 || height <= 0) return

      const time = timestamp / 1000
      const { offsetX, offsetY } = offsetsRef.current
      context.clearRect(0, 0, width, height)

      for (const layer of layersRef.current) {
        for (const star of layer.stars) {
          let x = star.x + offsetX * layer.speed
          let y = star.y + offsetY * layer.speed

          x = ((x % width) + width) % width
          y = ((y % height) + height) % height

          const twinkle = layer.opacity +
            Math.sin(time * star.twinkleSpeed + star.twinklePhase) * layer.twinkleAmount
          const opacity = Math.max(0, Math.min(1, twinkle))

          context.beginPath()
          context.arc(
            x,
            y,
            star.radius,
            0,
            Math.PI * 2
          )

          context.fillStyle =
            `rgba(255, 255, 255, ${opacity})`

          context.fill()
        }
      }
    }

    resize()
    window.addEventListener('resize', resize)
    animationFrameId = window.requestAnimationFrame(draw)

    return () => {
      window.cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="star-canvas"
      aria-hidden="true"
    />
  )
}

import { useEffect, useRef } from 'react'

type StarCanvasProps = {
  offsetX?: number
  offsetY?: number
}

type Star = {
  x: number
  y: number
  radius: number
}

type StarLayer = {
  count: number
  minRadius: number
  maxRadius: number
  speed: number
  opacity: number
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
  }))
}

export function StarCanvas({
  offsetX = 0,
  offsetY = 0,
}: StarCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const layersRef = useRef<StarLayer[]>([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext('2d')
    if (!context) return

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const width = canvas.clientWidth
      const height = canvas.clientHeight

      canvas.width = width * dpr
      canvas.height = height * dpr

      context.setTransform(dpr, 0, 0, dpr, 0, 0)

      layersRef.current = [
        {
          count: 70,
          minRadius: 0.4,
          maxRadius: 0.8,
          speed: 0.15,
          opacity: 0.35,
          stars: createStars(
            70,
            width,
            height,
            0.4,
            0.8
          ),
        },
        {
          count: 40,
          minRadius: 0.7,
          maxRadius: 1.2,
          speed: 0.35,
          opacity: 0.55,
          stars: createStars(
            40,
            width,
            height,
            0.7,
            1.2
          ),
        },
        {
          count: 20,
          minRadius: 1.0,
          maxRadius: 1.8,
          speed: 0.65,
          opacity: 0.8,
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

    resize()
    window.addEventListener('resize', resize)

    return () => {
      window.removeEventListener('resize', resize)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext('2d')
    if (!context) return

    const width = canvas.clientWidth
    const height = canvas.clientHeight

    context.clearRect(0, 0, width, height)

    for (const layer of layersRef.current) {
      for (const star of layer.stars) {
        let x = star.x + offsetX * layer.speed
        let y = star.y + offsetY * layer.speed

        x = ((x % width) + width) % width
        y = ((y % height) + height) % height

        context.beginPath()
        context.arc(
          x,
          y,
          star.radius,
          0,
          Math.PI * 2
        )

        context.fillStyle =
          `rgba(255, 255, 255, ${layer.opacity})`

        context.fill()
      }
    }
  }, [offsetX, offsetY])

  return (
    <canvas
      ref={canvasRef}
      className="star-canvas"
      aria-hidden="true"
    />
  )
}
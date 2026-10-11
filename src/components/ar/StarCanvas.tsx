import { useEffect, useRef } from 'react'

type StarCanvasProps = {
  offsetX?: number
  offsetY?: number
}

type Star = {
  x: number
  y: number
  radius: number
  depth: number
}

export function StarCanvas({
  offsetX = 0,
  offsetY = 0,
}: StarCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const starsRef = useRef<Star[]>([])

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

      starsRef.current = Array.from({ length: 100 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: 0.5 + Math.random() * 1.3,
        depth: 0.15 + Math.random() * 0.85,
      }))
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

    for (const star of starsRef.current) {
      const parallaxX = offsetX * star.depth
      const parallaxY = offsetY * star.depth

      let x = star.x + parallaxX
      let y = star.y + parallaxY

      x = ((x % width) + width) % width
      y = ((y % height) + height) % height

      context.beginPath()
      context.arc(x, y, star.radius, 0, Math.PI * 2)
      context.fillStyle = `rgba(255, 255, 255, ${
        0.35 + star.depth * 0.5
      })`
      context.fill()
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
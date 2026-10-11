import { useMemo } from "react";

type SkyParallaxInput = {
  alpha: number | null
  beta: number | null
  gamma: number | null
}

type SkyParallax = {
  offsetX : number
  offsetY : number
}


const HORIZONTAL_STRENGTH = 4
const VERTICAL_STRENGTH = 4

export function useSkyParallax({
  beta,
  gamma,
}: SkyParallaxInput): SkyParallax {
  return useMemo(() => {
    if (
      beta === null ||
      gamma === null ||
      !Number.isFinite(beta) ||
      !Number.isFinite(gamma) 
    ) {
      return {
        offsetX: 0,
        offsetY: 0,
      }
    }
    return {
      offsetX: -gamma * HORIZONTAL_STRENGTH,
      offsetY: -(beta-90) * VERTICAL_STRENGTH,
    }
  },[beta,gamma])
}
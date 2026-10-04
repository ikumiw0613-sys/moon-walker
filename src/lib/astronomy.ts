import { Horizon, Observer, Body, Equator } from "astronomy-engine";
import type { MoonPosition } from "../types/moon"

export function getMoonPosition(
  latitude: number,
  longitude: number,
  date: Date
): MoonPosition {
  const observer = new Observer(
    latitude,
    longitude,
    0
  )
  const equator = Equator(
    Body.Moon,
    date,
    observer,
    true,
    true
  )
  const moon = Horizon(
    date,
    observer,
    equator.ra,
    equator.dec,
    "normal"
  )
  return {
    azimuth: moon.azimuth,
    altitude: moon.altitude,
    isAboveHorizon: moon.altitude > 0,
  }
}
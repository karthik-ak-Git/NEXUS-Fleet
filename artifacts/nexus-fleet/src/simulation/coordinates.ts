/**
 * Centralized Coordinate System Utilities for NEXUS Fleet Simulation
 *
 * World Coordinate System:
 * - X: horizontal warehouse axis [-18, 18]
 * - Y: depth/vertical warehouse axis [-12, 12]
 *
 * 3D Three.js Coordinate System:
 * - X = world X
 * - Z = world Y
 * - Y = elevation (0.32 for robot chassis floor height)
 *
 * 2D Screen/SVG Coordinate System:
 * - viewBox = "-19 -13 38 26"
 * - screenX = world X
 * - screenY = world Y
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export function worldToThree(x: number, y: number, elevation = 0.32): [number, number, number] {
  return [x, elevation, y];
}

export function threeToWorld(position: [number, number, number] | { x: number; y: number; z: number }): Point2D {
  if (Array.isArray(position)) {
    return { x: position[0], y: position[2] };
  }
  return { x: position.x, y: position.z };
}

export function headingToThreeRotation(heading: number): [number, number, number] {
  return [0, -heading, 0];
}

export function worldToSvgPath(points: Point2D[]): string {
  if (!points.length) return "";
  return points.reduce((acc, pt, i) => `${acc} ${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`, "");
}

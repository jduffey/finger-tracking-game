import { useEffect, useRef, useState } from "react";
import {
  computeConveyorBackLaunchSpeed,
  CONVEYOR_AUTO_THROW_BACK_SPEED,
} from "../conveyorGame.js";

const SPHERE_COUNT = 4;
const BASE_SPHERE_RADIUS = 72;
const MAX_WORLD_Z = 1500;
const NEAR_WORLD_Z = 120;
const FAR_WORLD_Z = 1320;
const SCREEN_SURFACE_Z = NEAR_WORLD_Z;
const BACK_WALL_Z = FAR_WORLD_Z;
const CONVEYOR_SPEED = 190;
const GRAVITY = 880;
const AIR_DRAG = 0.994;
const FORWARD_DRAG = 0.991;
const FLOOR_BOUNCE = 0.72;
const FLOOR_FRICTION = 0.94;
const SIDE_BOUNCE = 0.78;
const X_BOUND = 260;
const WORLD_TOP_Y = BASE_SPHERE_RADIUS * 11.2;
const MAX_STEP_SECONDS = 0.05;
const STRIPE_STEP_Z = 92;
const WALL_IMPACT_FADE_MS = 3000;
const MAX_WALL_IMPACTS = 40;
const GRID_DEPTH_STEPS = 8;
const GRID_HEIGHT_STEPS = 5;
const GRID_WIDTH_STEPS = 4;
const SPHERE_COLORS = ["#ff7540", "#5ec8ff", "#7ce488", "#f6d462"];

function clampValue(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerpValue(start, end, alpha) {
  return start + (end - start) * alpha;
}

function randomBetween(min, max) {
  return min + Math.random() * Math.max(0, max - min);
}

function createSphere(index) {
  const baseZ =
    360 +
    (index / Math.max(1, SPHERE_COUNT - 1)) * (FAR_WORLD_Z - 520) +
    randomBetween(-90, 90);
  return {
    id: index + 1,
    x: randomBetween(-X_BOUND * 0.72, X_BOUND * 0.72),
    y: BASE_SPHERE_RADIUS,
    z: clampValue(baseZ, NEAR_WORLD_Z + 140, FAR_WORLD_Z),
    vx: randomBetween(-22, 22),
    vy: 0,
    vz: 0,
    radius: BASE_SPHERE_RADIUS + randomBetween(-10, 10),
    color: SPHERE_COLORS[index % SPHERE_COLORS.length],
  };
}

function projectWorldPoint(x, y, z, width, height) {
  const depthT = clampValue(1 - z / MAX_WORLD_Z, 0, 1);
  const horizonY = height * 0.24;
  const floorY = height * 0.93;
  const horizontalSpan = lerpValue(width * 0.11, width * 0.56, depthT);
  const screenX = width * 0.5 + (x / X_BOUND) * horizontalSpan;
  const groundY = lerpValue(horizonY, floorY, depthT);
  const heightScale = lerpValue(0.05, 0.65, depthT);
  const screenY = groundY - y * heightScale;
  return {
    x: screenX,
    y: screenY,
    groundY,
    depthT,
    radiusScale: lerpValue(0.16, 1.08, depthT),
  };
}

export default function ConveyorSphereGame({ cursor, pinchActive, onBack }) {
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const cursorRef = useRef(cursor);
  const pinchRef = useRef(pinchActive);
  const previousPinchRef = useRef(pinchActive);
  const simulationRef = useRef({
    spheres: [],
    grabbedId: null,
    wallImpacts: [],
    lastTimestamp: 0,
    conveyorOffset: 0,
    throwCount: 0,
    lastBackLaunch: 0,
    hudTimestamp: 0,
  });

  const [hud, setHud] = useState({
    grabbedId: null,
    throwCount: 0,
    lastBackLaunch: 0,
    pinchActive: false,
  });
  const [message, setMessage] = useState(
    "Pinch a sphere to grab it. Release to auto-throw it toward the back; faster flicks add speed.",
  );

  useEffect(() => {
    cursorRef.current = cursor;
  }, [cursor]);

  useEffect(() => {
    pinchRef.current = pinchActive;
  }, [pinchActive]);

  const resetSimulation = (reason = "manual_reset") => {
    simulationRef.current = {
      spheres: Array.from({ length: SPHERE_COUNT }, (_, index) => createSphere(index)),
      grabbedId: null,
      wallImpacts: [],
      lastTimestamp: 0,
      conveyorOffset: 0,
      throwCount: 0,
      lastBackLaunch: 0,
      hudTimestamp: 0,
    };
    previousPinchRef.current = pinchRef.current;
    setHud({
      grabbedId: null,
      throwCount: 0,
      lastBackLaunch: 0,
      pinchActive: Boolean(pinchRef.current),
    });
    setMessage(
      reason === "manual_reset"
        ? "Conveyor reset. Grab a sphere, then release to auto-throw it toward the back."
        : "Pinch a sphere to grab it. Release to auto-throw it toward the back; faster flicks add speed.",
    );
  };

  useEffect(() => {
    resetSimulation("initial");

    let rafId = 0;
    let unmounted = false;

    const frame = (timestamp) => {
      if (unmounted) {
        return;
      }

      const stage = stageRef.current;
      const canvas = canvasRef.current;
      if (!stage || !canvas) {
        rafId = requestAnimationFrame(frame);
        return;
      }

      const rect = stage.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const context = canvas.getContext("2d");
      if (!context) {
        rafId = requestAnimationFrame(frame);
        return;
      }

      const state = simulationRef.current;
      if (!Array.isArray(state.spheres) || state.spheres.length === 0) {
        state.spheres = Array.from({ length: SPHERE_COUNT }, (_, index) => createSphere(index));
      }

      const dtSeconds = clampValue(
        (timestamp - (state.lastTimestamp || timestamp)) / 1000,
        0.001,
        MAX_STEP_SECONDS,
      );
      state.lastTimestamp = timestamp;
      state.conveyorOffset = (state.conveyorOffset + CONVEYOR_SPEED * dtSeconds) % STRIPE_STEP_Z;
      const pushWallImpact = (impact) => {
        state.wallImpacts.push({
          id: `${impact.wall}-${timestamp}-${Math.random().toString(36).slice(2, 7)}`,
          createdAt: timestamp,
          ...impact,
        });
        if (state.wallImpacts.length > MAX_WALL_IMPACTS) {
          state.wallImpacts.splice(0, state.wallImpacts.length - MAX_WALL_IMPACTS);
        }
      };

      const pointerGlobal = cursorRef.current;
      const pointerInside =
        pointerGlobal.x >= rect.left &&
        pointerGlobal.x <= rect.right &&
        pointerGlobal.y >= rect.top &&
        pointerGlobal.y <= rect.bottom;
      const pointerLocal = {
        x: clampValue(pointerGlobal.x - rect.left, 0, width),
        y: clampValue(pointerGlobal.y - rect.top, 0, height),
      };

      const wasPinching = previousPinchRef.current;
      const nowPinching = Boolean(pinchRef.current);

      if (!wasPinching && nowPinching && pointerInside) {
        const nearToFar = [...state.spheres].sort((first, second) => first.z - second.z);
        for (const sphere of nearToFar) {
          const projected = projectWorldPoint(sphere.x, sphere.y, sphere.z, width, height);
          const radiusPx = Math.max(6, sphere.radius * projected.radiusScale);
          const distance = Math.hypot(pointerLocal.x - projected.x, pointerLocal.y - projected.y);
          if (distance <= radiusPx * 1.12) {
            state.grabbedId = sphere.id;
            setMessage(`Sphere ${sphere.id} grabbed. Release to throw; faster flicks add speed.`);
            break;
          }
        }
      }

      if (wasPinching && !nowPinching && state.grabbedId !== null) {
        const releasedSphere = state.spheres.find((sphere) => sphere.id === state.grabbedId);
        if (releasedSphere) {
          const backLaunchSpeed = computeConveyorBackLaunchSpeed(
            releasedSphere.vx,
            releasedSphere.vy,
          );
          releasedSphere.vz = backLaunchSpeed;
          state.lastBackLaunch = backLaunchSpeed;
          state.throwCount += 1;
          setMessage(`Auto-throw triggered: launched at ${backLaunchSpeed} u/s.`);
        }
        state.grabbedId = null;
      }

      if (nowPinching && state.grabbedId !== null && pointerInside) {
        const grabbedSphere = state.spheres.find((sphere) => sphere.id === state.grabbedId);
        if (grabbedSphere) {
          const targetZ = SCREEN_SURFACE_Z;
          const horizontalSpan = lerpValue(
            X_BOUND * 0.48,
            X_BOUND * 1.14,
            targetZ / MAX_WORLD_Z,
          );
          const targetX = ((pointerLocal.x / width) - 0.5) * 2 * horizontalSpan;
          const maxLiftY = Math.max(WORLD_TOP_Y, grabbedSphere.radius * 11);
          const targetY = clampValue(
            lerpValue(maxLiftY, grabbedSphere.radius + 22, pointerLocal.y / height),
            grabbedSphere.radius + 8,
            maxLiftY,
          );

          const safeStep = Math.max(1 / 120, dtSeconds);
          const nextVx = (targetX - grabbedSphere.x) / safeStep;
          const nextVy = (targetY - grabbedSphere.y) / safeStep;

          grabbedSphere.vx = clampValue(lerpValue(grabbedSphere.vx, nextVx, 0.62), -920, 920);
          grabbedSphere.vy = clampValue(lerpValue(grabbedSphere.vy, nextVy, 0.62), -920, 920);
          grabbedSphere.vz = 0;

          grabbedSphere.x = targetX;
          grabbedSphere.y = targetY;
          grabbedSphere.z = targetZ;
        }
      }

      previousPinchRef.current = nowPinching;

      for (const sphere of state.spheres) {
        if (sphere.id === state.grabbedId) {
          continue;
        }

        sphere.z += sphere.vz * dtSeconds;
        sphere.z -= CONVEYOR_SPEED * dtSeconds;
        sphere.x += sphere.vx * dtSeconds;
        sphere.y += sphere.vy * dtSeconds;
        sphere.vy -= GRAVITY * dtSeconds;

        sphere.vx *= AIR_DRAG;
        sphere.vy *= AIR_DRAG;
        sphere.vz *= FORWARD_DRAG;

        if (sphere.y < sphere.radius) {
          sphere.y = sphere.radius;
          if (sphere.vy < 0) {
            sphere.vy = -sphere.vy * FLOOR_BOUNCE;
            sphere.vx *= FLOOR_FRICTION;
            sphere.vz *= FLOOR_FRICTION;
          }
          if (Math.abs(sphere.vy) < 28) {
            sphere.vy = 0;
          }
        } else if (sphere.y > WORLD_TOP_Y) {
          sphere.y = WORLD_TOP_Y;
          if (sphere.vy > 0) {
            sphere.vy = -sphere.vy * 0.42;
          }
        }

        if (sphere.x < -X_BOUND) {
          const hitSpeed = sphere.vx;
          sphere.x = -X_BOUND;
          if (hitSpeed < 0) {
            pushWallImpact({
              wall: "left",
              x: -X_BOUND,
              y: clampValue(sphere.y, sphere.radius, WORLD_TOP_Y),
              z: clampValue(sphere.z, SCREEN_SURFACE_Z, BACK_WALL_Z),
              strength: clampValue(Math.abs(hitSpeed) / 720, 0.2, 1.4),
            });
            sphere.vx = -hitSpeed * SIDE_BOUNCE;
          }
        } else if (sphere.x > X_BOUND) {
          const hitSpeed = sphere.vx;
          sphere.x = X_BOUND;
          if (hitSpeed > 0) {
            pushWallImpact({
              wall: "right",
              x: X_BOUND,
              y: clampValue(sphere.y, sphere.radius, WORLD_TOP_Y),
              z: clampValue(sphere.z, SCREEN_SURFACE_Z, BACK_WALL_Z),
              strength: clampValue(Math.abs(hitSpeed) / 720, 0.2, 1.4),
            });
            sphere.vx = -hitSpeed * SIDE_BOUNCE;
          }
        }

        if (sphere.z < SCREEN_SURFACE_Z) {
          sphere.z = SCREEN_SURFACE_Z;
          if (sphere.vz < 0) {
            sphere.vz = -sphere.vz * 0.22;
          }
        } else if (sphere.z > BACK_WALL_Z) {
          pushWallImpact({
            wall: "back",
            x: sphere.x,
            y: clampValue(sphere.y, sphere.radius, WORLD_TOP_Y),
            z: BACK_WALL_Z,
            strength: clampValue(
              Math.abs(sphere.vz) / CONVEYOR_AUTO_THROW_BACK_SPEED,
              0.2,
              1.6,
            ),
          });

          sphere.z = BACK_WALL_Z;
          if (sphere.vz > 0) {
            sphere.vz = -sphere.vz * 0.38;
          }
          sphere.vx *= 0.96;
          sphere.vy *= 0.96;
        }
      }

      const skyGradient = context.createLinearGradient(0, 0, 0, height * 0.5);
      skyGradient.addColorStop(0, "#121d35");
      skyGradient.addColorStop(1, "#1f3254");
      context.fillStyle = skyGradient;
      context.fillRect(0, 0, width, height);

      const horizonY = height * 0.24;
      const floorY = height * 0.93;
      const farLeft = projectWorldPoint(-X_BOUND, 0, BACK_WALL_Z, width, height);
      const farRight = projectWorldPoint(X_BOUND, 0, BACK_WALL_Z, width, height);
      const backWallTopLeft = projectWorldPoint(-X_BOUND, WORLD_TOP_Y, BACK_WALL_Z, width, height);
      const backWallTopRight = projectWorldPoint(X_BOUND, WORLD_TOP_Y, BACK_WALL_Z, width, height);
      const nearLeft = projectWorldPoint(-X_BOUND, 0, NEAR_WORLD_Z, width, height);
      const nearRight = projectWorldPoint(X_BOUND, 0, NEAR_WORLD_Z, width, height);
      const nearWallTopLeft = projectWorldPoint(-X_BOUND, WORLD_TOP_Y, NEAR_WORLD_Z, width, height);
      const nearWallTopRight = projectWorldPoint(X_BOUND, WORLD_TOP_Y, NEAR_WORLD_Z, width, height);

      context.fillStyle = "#2b4161";
      context.beginPath();
      context.moveTo(backWallTopLeft.x, backWallTopLeft.y);
      context.lineTo(backWallTopRight.x, backWallTopRight.y);
      context.lineTo(farRight.x, farRight.groundY);
      context.lineTo(farLeft.x, farLeft.groundY);
      context.closePath();
      context.fill();

      context.fillStyle = "rgba(38, 59, 89, 0.92)";
      context.beginPath();
      context.moveTo(nearWallTopLeft.x, nearWallTopLeft.y);
      context.lineTo(backWallTopLeft.x, backWallTopLeft.y);
      context.lineTo(farLeft.x, farLeft.groundY);
      context.lineTo(nearLeft.x, nearLeft.groundY);
      context.closePath();
      context.fill();

      context.fillStyle = "rgba(35, 54, 82, 0.92)";
      context.beginPath();
      context.moveTo(nearWallTopRight.x, nearWallTopRight.y);
      context.lineTo(backWallTopRight.x, backWallTopRight.y);
      context.lineTo(farRight.x, farRight.groundY);
      context.lineTo(nearRight.x, nearRight.groundY);
      context.closePath();
      context.fill();

      const drawProjectedWallCircle = (wallX, centerY, centerZ, radiusWorld, fill) => {
        const segmentCount = 28;
        context.beginPath();
        for (let segment = 0; segment <= segmentCount; segment += 1) {
          const angle = (segment / segmentCount) * Math.PI * 2;
          const sampleY = clampValue(
            centerY + Math.sin(angle) * radiusWorld,
            BASE_SPHERE_RADIUS,
            WORLD_TOP_Y,
          );
          const sampleZ = clampValue(
            centerZ + Math.cos(angle) * radiusWorld,
            SCREEN_SURFACE_Z,
            BACK_WALL_Z,
          );
          const point = projectWorldPoint(wallX, sampleY, sampleZ, width, height);
          if (segment === 0) {
            context.moveTo(point.x, point.y);
          } else {
            context.lineTo(point.x, point.y);
          }
        }
        context.closePath();
        if (fill) {
          context.fill();
          return;
        }
        context.stroke();
      };

      const activeImpacts = [];
      for (const impact of state.wallImpacts) {
        const ageMs = timestamp - impact.createdAt;
        if (ageMs >= WALL_IMPACT_FADE_MS) {
          continue;
        }
        activeImpacts.push(impact);
        const wall = impact.wall || "back";
        const t = ageMs / WALL_IMPACT_FADE_MS;
        const alpha = 1 - t;
        if (wall === "left" || wall === "right") {
          const wallX = wall === "left" ? -X_BOUND : X_BOUND;
          const centerY = clampValue(impact.y, BASE_SPHERE_RADIUS, WORLD_TOP_Y);
          const centerZ = clampValue(impact.z, SCREEN_SURFACE_Z, BACK_WALL_Z);
          const centerPoint = projectWorldPoint(wallX, centerY, centerZ, width, height);
          const baseWorldRadius = lerpValue(
            BASE_SPHERE_RADIUS * 0.46,
            BASE_SPHERE_RADIUS * 0.96,
            clampValue(impact.strength, 0, 1.8),
          );
          const ringWorldRadius = lerpValue(baseWorldRadius * 0.32, baseWorldRadius * 2.2, t);
          context.strokeStyle = `rgba(229, 245, 255, ${(0.86 * alpha).toFixed(3)})`;
          context.lineWidth = Math.max(1, lerpValue(4.1, 1.2, t) * centerPoint.radiusScale);
          drawProjectedWallCircle(wallX, centerY, centerZ, ringWorldRadius, false);
          context.fillStyle = `rgba(176, 222, 255, ${(0.2 * alpha).toFixed(3)})`;
          drawProjectedWallCircle(wallX, centerY, centerZ, ringWorldRadius * 0.45, true);
          continue;
        }

        const impactPoint = projectWorldPoint(impact.x, impact.y, BACK_WALL_Z, width, height);
        const depthRadiusScale = impactPoint.radiusScale;
        const baseRadius = Math.max(
          10,
          depthRadiusScale * lerpValue(42, 86, clampValue(impact.strength, 0, 1.8)),
        );
        const ringRadius = lerpValue(baseRadius * 0.35, baseRadius * 2.4, t);
        context.strokeStyle = `rgba(229, 245, 255, ${(0.88 * alpha).toFixed(3)})`;
        context.lineWidth = Math.max(1, lerpValue(4.2, 1.1, t) * depthRadiusScale);
        context.beginPath();
        context.arc(impactPoint.x, impactPoint.y, ringRadius, 0, Math.PI * 2);
        context.stroke();
        context.fillStyle = `rgba(176, 222, 255, ${(0.22 * alpha).toFixed(3)})`;
        context.beginPath();
        context.arc(impactPoint.x, impactPoint.y, ringRadius * 0.45, 0, Math.PI * 2);
        context.fill();
      }
      state.wallImpacts = activeImpacts;

      const floorGradient = context.createLinearGradient(0, horizonY, 0, floorY);
      floorGradient.addColorStop(0, "rgba(35, 58, 92, 0.9)");
      floorGradient.addColorStop(1, "rgba(17, 29, 44, 0.98)");
      context.fillStyle = floorGradient;
      context.beginPath();
      context.moveTo(farLeft.x, farLeft.groundY);
      context.lineTo(farRight.x, farRight.groundY);
      context.lineTo(nearRight.x, nearRight.groundY);
      context.lineTo(nearLeft.x, nearLeft.groundY);
      context.closePath();
      context.fill();

      context.strokeStyle = "rgba(180, 214, 255, 0.3)";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(farLeft.x, farLeft.groundY);
      context.lineTo(nearLeft.x, nearLeft.groundY);
      context.moveTo(farRight.x, farRight.groundY);
      context.lineTo(nearRight.x, nearRight.groundY);
      context.stroke();

      for (let stripeIndex = 0; stripeIndex < 18; stripeIndex += 1) {
        const stripeTravel =
          (stripeIndex * STRIPE_STEP_Z + state.conveyorOffset) % (FAR_WORLD_Z - NEAR_WORLD_Z);
        const stripeZ = FAR_WORLD_Z - stripeTravel;
        const stripeLeft = projectWorldPoint(-X_BOUND, 0, stripeZ, width, height);
        const stripeRight = projectWorldPoint(X_BOUND, 0, stripeZ, width, height);
        context.strokeStyle = `rgba(145, 196, 255, ${lerpValue(0.1, 0.42, stripeLeft.depthT).toFixed(
          3,
        )})`;
        context.lineWidth = lerpValue(0.8, 2.8, stripeLeft.depthT);
        context.beginPath();
        context.moveTo(stripeLeft.x, stripeLeft.groundY);
        context.lineTo(stripeRight.x, stripeRight.groundY);
        context.stroke();
      }

      for (const laneOffset of [-0.5, 0, 0.5]) {
        const laneX = laneOffset * X_BOUND;
        const laneFar = projectWorldPoint(laneX, 0, FAR_WORLD_Z, width, height);
        const laneNear = projectWorldPoint(laneX, 0, NEAR_WORLD_Z, width, height);
        context.strokeStyle = "rgba(126, 179, 255, 0.26)";
        context.lineWidth = 1.35;
        context.beginPath();
        context.moveTo(laneFar.x, laneFar.groundY);
        context.lineTo(laneNear.x, laneNear.groundY);
        context.stroke();
      }

      const drawGridLine = (a, b, alpha = 0.2, widthPx = 1) => {
        context.strokeStyle = `rgba(206, 232, 255, ${alpha})`;
        context.lineWidth = widthPx;
        context.beginPath();
        context.moveTo(a.x, a.y);
        context.lineTo(b.x, b.y);
        context.stroke();
      };

      // Wireframe cage: shows full 3D simulation volume.
      const nearZ = SCREEN_SURFACE_Z;
      const farZ = FAR_WORLD_Z;
      const nearBottomLeft = projectWorldPoint(-X_BOUND, 0, nearZ, width, height);
      const nearBottomRight = projectWorldPoint(X_BOUND, 0, nearZ, width, height);
      const farBottomLeft = projectWorldPoint(-X_BOUND, 0, farZ, width, height);
      const farBottomRight = projectWorldPoint(X_BOUND, 0, farZ, width, height);
      const nearTopLeft = projectWorldPoint(-X_BOUND, WORLD_TOP_Y, nearZ, width, height);
      const nearTopRight = projectWorldPoint(X_BOUND, WORLD_TOP_Y, nearZ, width, height);
      const farTopLeft = projectWorldPoint(-X_BOUND, WORLD_TOP_Y, farZ, width, height);
      const farTopRight = projectWorldPoint(X_BOUND, WORLD_TOP_Y, farZ, width, height);

      drawGridLine(nearBottomLeft, nearBottomRight, 0.27, 1.5);
      drawGridLine(farBottomLeft, farBottomRight, 0.19, 1.1);
      drawGridLine(nearTopLeft, nearTopRight, 0.26, 1.3);
      drawGridLine(farTopLeft, farTopRight, 0.18, 1.0);
      drawGridLine(nearBottomLeft, nearTopLeft, 0.24, 1.2);
      drawGridLine(nearBottomRight, nearTopRight, 0.24, 1.2);
      drawGridLine(farBottomLeft, farTopLeft, 0.17, 1.0);
      drawGridLine(farBottomRight, farTopRight, 0.17, 1.0);
      drawGridLine(nearBottomLeft, farBottomLeft, 0.22, 1.1);
      drawGridLine(nearBottomRight, farBottomRight, 0.22, 1.1);
      drawGridLine(nearTopLeft, farTopLeft, 0.2, 1.0);
      drawGridLine(nearTopRight, farTopRight, 0.2, 1.0);

      for (let depthStep = 1; depthStep < GRID_DEPTH_STEPS; depthStep += 1) {
        const depthT = depthStep / GRID_DEPTH_STEPS;
        const z = lerpValue(nearZ, farZ, depthT);
        const alpha = lerpValue(0.22, 0.08, depthT);
        const floorLeft = projectWorldPoint(-X_BOUND, 0, z, width, height);
        const floorRight = projectWorldPoint(X_BOUND, 0, z, width, height);
        const topLeft = projectWorldPoint(-X_BOUND, WORLD_TOP_Y, z, width, height);
        const topRight = projectWorldPoint(X_BOUND, WORLD_TOP_Y, z, width, height);
        drawGridLine(floorLeft, floorRight, alpha, 1);
        drawGridLine(topLeft, topRight, alpha * 0.95, 1);
      }

      for (let heightStep = 1; heightStep < GRID_HEIGHT_STEPS; heightStep += 1) {
        const heightT = heightStep / GRID_HEIGHT_STEPS;
        const y = lerpValue(0, WORLD_TOP_Y, heightT);
        const alpha = lerpValue(0.2, 0.1, heightT);
        const leftNear = projectWorldPoint(-X_BOUND, y, nearZ, width, height);
        const leftFar = projectWorldPoint(-X_BOUND, y, farZ, width, height);
        const rightNear = projectWorldPoint(X_BOUND, y, nearZ, width, height);
        const rightFar = projectWorldPoint(X_BOUND, y, farZ, width, height);
        drawGridLine(leftNear, leftFar, alpha, 1);
        drawGridLine(rightNear, rightFar, alpha, 1);
      }

      for (let widthStep = 1; widthStep < GRID_WIDTH_STEPS; widthStep += 1) {
        const widthT = widthStep / GRID_WIDTH_STEPS;
        const x = lerpValue(-X_BOUND, X_BOUND, widthT);
        const alpha = 0.11;
        const floorNear = projectWorldPoint(x, 0, nearZ, width, height);
        const floorFar = projectWorldPoint(x, 0, farZ, width, height);
        const topNear = projectWorldPoint(x, WORLD_TOP_Y, nearZ, width, height);
        const topFar = projectWorldPoint(x, WORLD_TOP_Y, farZ, width, height);
        drawGridLine(floorNear, floorFar, alpha, 1);
        drawGridLine(topNear, topFar, alpha, 1);
      }

      const farToNear = [...state.spheres].sort((first, second) => second.z - first.z);
      for (const sphere of farToNear) {
        const projected = projectWorldPoint(sphere.x, sphere.y, sphere.z, width, height);
        const radiusPx = Math.max(6, sphere.radius * projected.radiusScale);

        if (
          projected.x < -radiusPx * 2 ||
          projected.x > width + radiusPx * 2 ||
          projected.y < horizonY - radiusPx * 4 ||
          projected.y > height + radiusPx * 2
        ) {
          continue;
        }

        const shadowPoint = projectWorldPoint(sphere.x, 0, sphere.z, width, height);
        context.fillStyle = "rgba(7, 12, 22, 0.36)";
        context.beginPath();
        context.ellipse(
          shadowPoint.x,
          shadowPoint.groundY,
          radiusPx * 1.24,
          radiusPx * 0.46,
          0,
          0,
          Math.PI * 2,
        );
        context.fill();

        const highlightX = projected.x - radiusPx * 0.3;
        const highlightY = projected.y - radiusPx * 0.34;
        const gradient = context.createRadialGradient(
          highlightX,
          highlightY,
          radiusPx * 0.12,
          projected.x,
          projected.y,
          radiusPx,
        );
        gradient.addColorStop(0, "rgba(255, 255, 255, 0.92)");
        gradient.addColorStop(0.35, sphere.color);
        gradient.addColorStop(1, "rgba(7, 13, 25, 0.92)");

        context.fillStyle = gradient;
        context.strokeStyle = "rgba(233, 246, 255, 0.56)";
        context.lineWidth = Math.max(1, radiusPx * 0.12);
        context.beginPath();
        context.arc(projected.x, projected.y, radiusPx, 0, Math.PI * 2);
        context.fill();
        context.stroke();

        if (sphere.id === state.grabbedId) {
          context.strokeStyle = "rgba(255, 232, 149, 0.96)";
          context.lineWidth = 3;
          context.beginPath();
          context.arc(projected.x, projected.y, radiusPx * 1.24, 0, Math.PI * 2);
          context.stroke();
        }
      }

      if (timestamp - state.hudTimestamp >= 90) {
        state.hudTimestamp = timestamp;
        setHud({
          grabbedId: state.grabbedId,
          throwCount: state.throwCount,
          lastBackLaunch: Math.round(state.lastBackLaunch),
          pinchActive: nowPinching,
        });
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);

    return () => {
      unmounted = true;
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, []);

  return (
    <section className="card panel conveyor-panel">
      <h2>Conveyor Sphere Toss</h2>
      <p className="small-text">
        Conveyor floor drifts toward you continuously. Pinch to grab on the front plane, then
        release to auto-throw backward. Faster flicks add launch speed.
      </p>
      <p className="small-text">{message}</p>

      <div className="conveyor-stage" ref={stageRef}>
        <canvas className="conveyor-canvas" ref={canvasRef} />
        <div className="conveyor-hud">
          <span>Throws: {hud.throwCount}</span>
          <span>Grabbed: {hud.grabbedId ?? "none"}</span>
          <span>Back Launch: {hud.lastBackLaunch}</span>
          <span>Throw: auto</span>
          <span>Pinch: {hud.pinchActive ? "active" : "idle"}</span>
        </div>
      </div>

      <div className="button-row">
        <button type="button" onClick={() => resetSimulation("manual_reset")}>Reset Spheres</button>
        <button className="secondary" type="button" onClick={onBack}>Back to Input Test</button>
      </div>
    </section>
  );
}

import { useEffect, useRef, useState } from "react";

const SPHERE_COUNT = 4;
const BASE_SPHERE_RADIUS = 72;
const MAX_WORLD_Z = 1500;
const NEAR_WORLD_Z = 120;
const FAR_WORLD_Z = 1320;
const SCREEN_SURFACE_Z = NEAR_WORLD_Z;
const BACK_STOP_Z = FAR_WORLD_Z + 520;
const CONVEYOR_SPEED = 190;
const GRAVITY = 880;
const AIR_DRAG = 0.994;
const FORWARD_DRAG = 0.991;
const FLOOR_BOUNCE = 0.72;
const FLOOR_FRICTION = 0.94;
const SIDE_BOUNCE = 0.78;
const X_BOUND = 260;
const MAX_STEP_SECONDS = 0.05;
const HISTORY_WINDOW_MS = 220;
const THROW_DETECTION_SPEED = 800;
const THROW_FORWARD_MIN = 520;
const THROW_FORWARD_MAX = 1320;
const MIN_GRAB_Z = 180;
const MAX_GRAB_Z = 1060;
const STRIPE_STEP_Z = 92;
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

function getPointerVelocity(history) {
  if (!Array.isArray(history) || history.length < 2) {
    return { vx: 0, vy: 0, speed: 0 };
  }
  const first = history[0];
  const last = history[history.length - 1];
  const elapsed = Math.max(1 / 120, (last.timestamp - first.timestamp) / 1000);
  const vx = (last.x - first.x) / elapsed;
  const vy = (last.y - first.y) / elapsed;
  return {
    vx,
    vy,
    speed: Math.hypot(vx, vy),
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
    pointerHistory: [],
    lastTimestamp: 0,
    conveyorOffset: 0,
    throwCount: 0,
    lastReleaseSpeed: 0,
    lastForwardBoost: 0,
    lastThrowDetected: false,
    hudTimestamp: 0,
  });

  const [hud, setHud] = useState({
    grabbedId: null,
    throwCount: 0,
    releaseSpeed: 0,
    forwardBoost: 0,
    throwDetected: false,
    pinchActive: false,
  });
  const [message, setMessage] = useState(
    "Pinch a sphere to grab it. Flick and release to throw toward the screen.",
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
      pointerHistory: [],
      lastTimestamp: 0,
      conveyorOffset: 0,
      throwCount: 0,
      lastReleaseSpeed: 0,
      lastForwardBoost: 0,
      lastThrowDetected: false,
      hudTimestamp: 0,
    };
    previousPinchRef.current = pinchRef.current;
    setHud({
      grabbedId: null,
      throwCount: 0,
      releaseSpeed: 0,
      forwardBoost: 0,
      throwDetected: false,
      pinchActive: Boolean(pinchRef.current),
    });
    setMessage(
      reason === "manual_reset"
        ? "Conveyor reset. Grab a sphere, then release with a fast flick to throw it."
        : "Pinch a sphere to grab it. Flick and release to throw toward the screen. Spheres stop at the front surface.",
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

      if (pointerInside) {
        state.pointerHistory.push({
          x: pointerLocal.x,
          y: pointerLocal.y,
          timestamp,
        });
      } else {
        state.pointerHistory = [];
      }
      while (
        state.pointerHistory.length > 0 &&
        timestamp - state.pointerHistory[0].timestamp > HISTORY_WINDOW_MS
      ) {
        state.pointerHistory.shift();
      }
      while (state.pointerHistory.length > 8) {
        state.pointerHistory.shift();
      }

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
            setMessage(`Sphere ${sphere.id} grabbed. Flick and release to throw.`);
            break;
          }
        }
      }

      if (wasPinching && !nowPinching && state.grabbedId !== null) {
        const releasedSphere = state.spheres.find((sphere) => sphere.id === state.grabbedId);
        if (releasedSphere) {
          const pointerVelocity = getPointerVelocity(state.pointerHistory);
          const throwDetected = pointerVelocity.speed >= THROW_DETECTION_SPEED;
          const throwStrength = clampValue(
            (pointerVelocity.speed - THROW_DETECTION_SPEED) / 1200,
            0,
            1,
          );
          const downwardBias = clampValue((pointerVelocity.vy + 280) / 1100, 0, 1);
          const forwardBoost = throwDetected
            ? lerpValue(
                THROW_FORWARD_MIN,
                THROW_FORWARD_MAX,
                throwStrength * 0.65 + downwardBias * 0.35,
              )
            : 0;

          const lateralImpulse = clampValue(pointerVelocity.vx * 0.18, -560, 560);
          const verticalImpulse = clampValue(-pointerVelocity.vy * 0.23, -360, 720);

          releasedSphere.vx = clampValue(releasedSphere.vx * 0.42 + lateralImpulse, -900, 900);
          releasedSphere.vy = clampValue(releasedSphere.vy * 0.42 + verticalImpulse, -760, 920);
          releasedSphere.vz = clampValue(
            releasedSphere.vz * 0.38 - forwardBoost,
            -THROW_FORWARD_MAX * 1.25,
            540,
          );

          state.lastReleaseSpeed = pointerVelocity.speed;
          state.lastForwardBoost = forwardBoost;
          state.lastThrowDetected = throwDetected;
          if (throwDetected) {
            state.throwCount += 1;
            setMessage(
              `Throw detected at ${Math.round(pointerVelocity.speed)} px/s. Sphere launched forward.`,
            );
          } else {
            setMessage(
              `Release speed ${Math.round(pointerVelocity.speed)} px/s. Flick faster to throw farther.`,
            );
          }
        }
        state.grabbedId = null;
      }

      if (nowPinching && state.grabbedId !== null && pointerInside) {
        const grabbedSphere = state.spheres.find((sphere) => sphere.id === state.grabbedId);
        if (grabbedSphere) {
          const targetZ = clampValue(
            lerpValue(MAX_GRAB_Z, MIN_GRAB_Z, pointerLocal.y / height),
            MIN_GRAB_Z,
            MAX_GRAB_Z,
          );
          const horizontalSpan = lerpValue(X_BOUND * 0.48, X_BOUND * 1.14, targetZ / MAX_WORLD_Z);
          const targetX = ((pointerLocal.x / width) - 0.5) * 2 * horizontalSpan;
          const targetY = clampValue(
            lerpValue(240, grabbedSphere.radius + 22, pointerLocal.y / height),
            grabbedSphere.radius + 8,
            280,
          );

          const safeStep = Math.max(1 / 120, dtSeconds);
          const nextVx = (targetX - grabbedSphere.x) / safeStep;
          const nextVy = (targetY - grabbedSphere.y) / safeStep;
          const nextVz = (targetZ - grabbedSphere.z) / safeStep;

          grabbedSphere.vx = clampValue(lerpValue(grabbedSphere.vx, nextVx, 0.62), -920, 920);
          grabbedSphere.vy = clampValue(lerpValue(grabbedSphere.vy, nextVy, 0.62), -920, 920);
          grabbedSphere.vz = clampValue(lerpValue(grabbedSphere.vz, nextVz, 0.62), -920, 920);

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
        }

        if (sphere.x < -X_BOUND) {
          sphere.x = -X_BOUND;
          if (sphere.vx < 0) {
            sphere.vx = -sphere.vx * SIDE_BOUNCE;
          }
        } else if (sphere.x > X_BOUND) {
          sphere.x = X_BOUND;
          if (sphere.vx > 0) {
            sphere.vx = -sphere.vx * SIDE_BOUNCE;
          }
        }

        if (sphere.z < SCREEN_SURFACE_Z) {
          sphere.z = SCREEN_SURFACE_Z;
          if (sphere.vz < 0) {
            sphere.vz = -sphere.vz * 0.22;
          }
        } else if (sphere.z > BACK_STOP_Z) {
          sphere.z = BACK_STOP_Z;
          if (sphere.vz > 0) {
            sphere.vz = -sphere.vz * 0.45;
          }
        }
      }

      const skyGradient = context.createLinearGradient(0, 0, 0, height * 0.5);
      skyGradient.addColorStop(0, "#121d35");
      skyGradient.addColorStop(1, "#1f3254");
      context.fillStyle = skyGradient;
      context.fillRect(0, 0, width, height);

      const horizonY = height * 0.24;
      const floorY = height * 0.93;
      const farLeft = projectWorldPoint(-X_BOUND, 0, FAR_WORLD_Z, width, height);
      const farRight = projectWorldPoint(X_BOUND, 0, FAR_WORLD_Z, width, height);
      const nearLeft = projectWorldPoint(-X_BOUND, 0, NEAR_WORLD_Z, width, height);
      const nearRight = projectWorldPoint(X_BOUND, 0, NEAR_WORLD_Z, width, height);

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
        const stripeZ =
          NEAR_WORLD_Z +
          ((stripeIndex * STRIPE_STEP_Z + state.conveyorOffset) % (FAR_WORLD_Z - NEAR_WORLD_Z));
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
          releaseSpeed: Math.round(state.lastReleaseSpeed),
          forwardBoost: Math.round(state.lastForwardBoost),
          throwDetected: state.lastThrowDetected,
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
        Conveyor floor drifts toward you continuously. Pinch to grab, move, and release with a fast flick to throw.
      </p>
      <p className="small-text">{message}</p>

      <div className="conveyor-stage" ref={stageRef}>
        <canvas className="conveyor-canvas" ref={canvasRef} />
        <div className="conveyor-hud">
          <span>Throws: {hud.throwCount}</span>
          <span>Grabbed: {hud.grabbedId ?? "none"}</span>
          <span>Release: {hud.releaseSpeed} px/s</span>
          <span>Forward: {hud.forwardBoost}</span>
          <span>Throw: {hud.throwDetected ? "detected" : "idle"}</span>
          <span>Pinch: {hud.pinchActive ? "active" : "idle"}</span>
        </div>
      </div>

      <div className="button-row">
        <button type="button" onClick={() => resetSimulation("manual_reset")}>Reset Spheres</button>
        <button className="secondary" type="button" onClick={onBack}>Back to Main Game</button>
      </div>
    </section>
  );
}

function hsla(h, s, l, a = 1) {
  return `hsla(${h.toFixed(1)}, ${s.toFixed(1)}%, ${l.toFixed(1)}%, ${a})`;
}

function wrapHue(value) {
  let hue = value;
  while (hue < 0) {
    hue += 360;
  }
  while (hue >= 360) {
    hue -= 360;
  }
  return hue;
}

function randomSigned() {
  return (Math.random() - 0.5) * 2;
}

function createParticle(attractor, parameters, width, height, mode) {
  const cx = attractor ? attractor.x * width : width * 0.5;
  const cy = attractor ? attractor.y * height : height * 0.5;
  return {
    x: cx + randomSigned() * 20,
    y: cy + randomSigned() * 20,
    vx: randomSigned() * 30,
    vy: randomSigned() * 30,
    life: 0,
    ttl: 0.8 + Math.random() * 2.6,
    hue: wrapHue(parameters.hueRotation + randomSigned() * 45),
    size: Math.max(1.2, parameters.brushThickness * (0.22 + Math.random() * 0.5)),
    mode,
  };
}

function updateParticle(particle, dt, attractor, parameters, width, height, mode, time) {
  const targetX = attractor ? attractor.x * width : width * 0.5;
  const targetY = attractor ? attractor.y * height : height * 0.5;
  const dx = targetX - particle.x;
  const dy = targetY - particle.y;
  const distance = Math.hypot(dx, dy) + 1e-4;

  if (mode === "attractor") {
    const force = 260 * parameters.zoom;
    particle.vx += (dx / distance) * force * dt;
    particle.vy += (dy / distance) * force * dt;
  } else if (mode === "lissajous") {
    const phase = time * 0.0018;
    particle.vx += Math.sin(phase + particle.life * 8) * 44 * dt;
    particle.vy += Math.sin(phase * 1.7 + particle.life * 6) * 44 * dt;
  } else if (mode === "flow") {
    const n = Math.sin((particle.x * 0.006) + time * 0.00045) + Math.cos((particle.y * 0.0065) - time * 0.0004);
    particle.vx += Math.cos(n * Math.PI) * 90 * dt;
    particle.vy += Math.sin(n * Math.PI) * 90 * dt;
  } else {
    const swirl = Math.atan2(dy, dx) + Math.PI * 0.5;
    particle.vx += Math.cos(swirl) * 75 * dt;
    particle.vy += Math.sin(swirl) * 75 * dt;
  }

  particle.vx *= 0.985;
  particle.vy *= 0.985;
  particle.x += particle.vx * dt;
  particle.y += particle.vy * dt;
  particle.life += dt;

  if (particle.x < -60 || particle.x > width + 60 || particle.y < -60 || particle.y > height + 60) {
    particle.life = particle.ttl + 1;
  }
}

export function createArtEngineState() {
  return {
    particles: [],
    compositeIndex: 0,
    lastClearAt: 0,
    freezeLockedUntil: 0,
  };
}

export function renderArtFrame(ctx, state, frame) {
  const { width, height, parameters, mode, now, dt, frozen } = frame;
  const composites = ["screen", "lighter", "overlay", "soft-light"];

  if (parameters.clearRequested && now - state.lastClearAt > 800) {
    state.lastClearAt = now;
    state.particles = [];
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(4, 8, 18, 1)";
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = frozen ? "rgba(3, 8, 16, 0.03)" : "rgba(3, 8, 16, 0.08)";
  ctx.fillRect(0, 0, width, height);
  ctx.translate(width * 0.5, height * 0.5);
  ctx.scale(parameters.zoom, parameters.zoom);
  ctx.rotate(parameters.fieldRotation);
  ctx.translate(-width * 0.5, -height * 0.5);

  const budget = Math.floor(parameters.emissionRate);
  if (!frozen && parameters.attractor) {
    for (let index = 0; index < budget; index += 1) {
      if (state.particles.length > 2600) {
        state.particles.shift();
      }
      state.particles.push(createParticle(parameters.attractor, parameters, width, height, mode));
    }
  }

  state.compositeIndex = (state.compositeIndex + 1) % composites.length;
  ctx.globalCompositeOperation = composites[state.compositeIndex];

  const baseHue = parameters.hueRotation;
  for (const particle of state.particles) {
    if (!frozen) {
      updateParticle(particle, dt, parameters.attractor, parameters, width, height, mode, now);
    }
    const lifeT = 1 - particle.life / particle.ttl;
    if (lifeT <= 0) {
      continue;
    }
    const hue = wrapHue(baseHue + particle.hue * (0.4 + parameters.paletteMix));
    ctx.fillStyle = hsla(
      hue,
      70 + parameters.paletteMix * 20,
      48 + (1 - parameters.paletteMix) * 20,
      Math.max(0.04, lifeT * 0.36),
    );
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  }

  state.particles = state.particles.filter((particle) => particle.life < particle.ttl);
  ctx.restore();
}

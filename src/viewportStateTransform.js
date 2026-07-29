export const VIEWPORT_FIT_MODES = Object.freeze({
  STRETCH: "stretch",
  CONTAIN: "contain",
  COVER: "cover",
});

export const GEOMETRY_OPERATIONS = Object.freeze({
  POINT: "point",
  VELOCITY: "velocity",
  RECTANGLE: "rectangle",
});

export const GEOMETRY_AXES = Object.freeze({
  X: "x",
  Y: "y",
  UNIFORM: "uniform",
  MAX: "max",
});

function finite(value, fallback = null) {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeViewport(value, label) {
  const width = finite(value?.width);
  const height = finite(value?.height);
  if (width === null || height === null || width <= 0 || height <= 0) {
    throw new TypeError(`${label} must have finite, positive width and height.`);
  }
  return Object.freeze({
    x: finite(value?.x, finite(value?.left, 0)),
    y: finite(value?.y, finite(value?.top, 0)),
    width,
    height,
  });
}

function getAxisScale(transform, axis) {
  switch (axis) {
    case GEOMETRY_AXES.X:
      return transform.scaleX;
    case GEOMETRY_AXES.Y:
      return transform.scaleY;
    case GEOMETRY_AXES.MAX:
      return Math.max(Math.abs(transform.scaleX), Math.abs(transform.scaleY));
    case GEOMETRY_AXES.UNIFORM:
      return transform.uniformScale;
    default:
      throw new RangeError(`Unknown geometry axis: ${axis}`);
  }
}

/**
 * Creates an invertible affine transform between two rectangular coordinate
 * systems. Stretch fills the target; contain and cover preserve aspect ratio.
 */
export function createViewportTransform(
  fromViewport,
  toViewport,
  {
    fit = VIEWPORT_FIT_MODES.STRETCH,
    anchorX = 0.5,
    anchorY = 0.5,
  } = {},
) {
  const source = normalizeViewport(fromViewport, "fromViewport");
  const target = normalizeViewport(toViewport, "toViewport");
  if (!Object.values(VIEWPORT_FIT_MODES).includes(fit)) {
    throw new RangeError(`Unknown viewport fit mode: ${fit}`);
  }

  const rawScaleX = target.width / source.width;
  const rawScaleY = target.height / source.height;
  const safeAnchorX = clamp(finite(anchorX, 0.5), 0, 1);
  const safeAnchorY = clamp(finite(anchorY, 0.5), 0, 1);
  let scaleX = rawScaleX;
  let scaleY = rawScaleY;
  if (fit !== VIEWPORT_FIT_MODES.STRETCH) {
    const scale =
      fit === VIEWPORT_FIT_MODES.COVER
        ? Math.max(rawScaleX, rawScaleY)
        : Math.min(rawScaleX, rawScaleY);
    scaleX = scale;
    scaleY = scale;
  }

  const renderedWidth = source.width * scaleX;
  const renderedHeight = source.height * scaleY;
  const offsetX = target.x + (target.width - renderedWidth) * safeAnchorX;
  const offsetY = target.y + (target.height - renderedHeight) * safeAnchorY;
  const uniformScale = Math.min(Math.abs(scaleX), Math.abs(scaleY));

  function mapX(value) {
    return Number.isFinite(value)
      ? offsetX + (value - source.x) * scaleX
      : value;
  }

  function mapY(value) {
    return Number.isFinite(value)
      ? offsetY + (value - source.y) * scaleY
      : value;
  }

  function unmapX(value) {
    return Number.isFinite(value)
      ? source.x + (value - offsetX) / scaleX
      : value;
  }

  function unmapY(value) {
    return Number.isFinite(value)
      ? source.y + (value - offsetY) / scaleY
      : value;
  }

  function mapPoint(point) {
    if (!point || typeof point !== "object") {
      return point;
    }
    return {
      ...point,
      ...(Number.isFinite(point.x) ? { x: mapX(point.x) } : {}),
      ...(Number.isFinite(point.y) ? { y: mapY(point.y) } : {}),
    };
  }

  function unmapPoint(point) {
    if (!point || typeof point !== "object") {
      return point;
    }
    return {
      ...point,
      ...(Number.isFinite(point.x) ? { x: unmapX(point.x) } : {}),
      ...(Number.isFinite(point.y) ? { y: unmapY(point.y) } : {}),
    };
  }

  function mapVelocity(velocity) {
    if (!velocity || typeof velocity !== "object") {
      return velocity;
    }
    return {
      ...velocity,
      ...(Number.isFinite(velocity.vx)
        ? { vx: velocity.vx * scaleX }
        : {}),
      ...(Number.isFinite(velocity.vy)
        ? { vy: velocity.vy * scaleY }
        : {}),
    };
  }

  function unmapVelocity(velocity) {
    if (!velocity || typeof velocity !== "object") {
      return velocity;
    }
    return {
      ...velocity,
      ...(Number.isFinite(velocity.vx)
        ? { vx: velocity.vx / scaleX }
        : {}),
      ...(Number.isFinite(velocity.vy)
        ? { vy: velocity.vy / scaleY }
        : {}),
    };
  }

  function mapScalar(value, axis = GEOMETRY_AXES.UNIFORM) {
    return Number.isFinite(value) ? value * getAxisScale(transform, axis) : value;
  }

  function unmapScalar(value, axis = GEOMETRY_AXES.UNIFORM) {
    return Number.isFinite(value) ? value / getAxisScale(transform, axis) : value;
  }

  function mapCoordinate(value, axis) {
    return axis === GEOMETRY_AXES.X
      ? mapX(value)
      : axis === GEOMETRY_AXES.Y
        ? mapY(value)
        : (() => {
            throw new RangeError(`Coordinates require an x or y axis, received: ${axis}`);
          })();
  }

  function unmapCoordinate(value, axis) {
    return axis === GEOMETRY_AXES.X
      ? unmapX(value)
      : axis === GEOMETRY_AXES.Y
        ? unmapY(value)
        : (() => {
            throw new RangeError(`Coordinates require an x or y axis, received: ${axis}`);
          })();
  }

  function mapRectangle(rectangle) {
    if (!rectangle || typeof rectangle !== "object") {
      return rectangle;
    }
    return {
      ...rectangle,
      ...(Number.isFinite(rectangle.x) ? { x: mapX(rectangle.x) } : {}),
      ...(Number.isFinite(rectangle.y) ? { y: mapY(rectangle.y) } : {}),
      ...(Number.isFinite(rectangle.left)
        ? { left: mapX(rectangle.left) }
        : {}),
      ...(Number.isFinite(rectangle.top)
        ? { top: mapY(rectangle.top) }
        : {}),
      ...(Number.isFinite(rectangle.width)
        ? { width: rectangle.width * scaleX }
        : {}),
      ...(Number.isFinite(rectangle.height)
        ? { height: rectangle.height * scaleY }
        : {}),
    };
  }

  function unmapRectangle(rectangle) {
    if (!rectangle || typeof rectangle !== "object") {
      return rectangle;
    }
    return {
      ...rectangle,
      ...(Number.isFinite(rectangle.x) ? { x: unmapX(rectangle.x) } : {}),
      ...(Number.isFinite(rectangle.y) ? { y: unmapY(rectangle.y) } : {}),
      ...(Number.isFinite(rectangle.left)
        ? { left: unmapX(rectangle.left) }
        : {}),
      ...(Number.isFinite(rectangle.top)
        ? { top: unmapY(rectangle.top) }
        : {}),
      ...(Number.isFinite(rectangle.width)
        ? { width: rectangle.width / scaleX }
        : {}),
      ...(Number.isFinite(rectangle.height)
        ? { height: rectangle.height / scaleY }
        : {}),
    };
  }

  const transform = {
    source,
    target,
    fit,
    anchorX: safeAnchorX,
    anchorY: safeAnchorY,
    scaleX,
    scaleY,
    uniformScale,
    offsetX,
    offsetY,
    renderedWidth,
    renderedHeight,
    mapX,
    mapY,
    unmapX,
    unmapY,
    mapPoint,
    unmapPoint,
    mapVelocity,
    unmapVelocity,
    mapScalar,
    unmapScalar,
    mapCoordinate,
    unmapCoordinate,
    mapRectangle,
    unmapRectangle,
  };
  return Object.freeze(transform);
}

/**
 * Keeps simulation coordinates fixed while the render viewport changes.
 * Recreate this transform on resize; do not mutate logical game state.
 */
export function createLogicalPlayfieldTransform(
  logicalPlayfield,
  renderViewport,
  options = {},
) {
  const logical = normalizeViewport(
    {
      x: 0,
      y: 0,
      width: logicalPlayfield?.width,
      height: logicalPlayfield?.height,
    },
    "logicalPlayfield",
  );
  return createViewportTransform(logical, renderViewport, {
    fit: VIEWPORT_FIT_MODES.CONTAIN,
    ...options,
  });
}

export function remapArray(values, mapper) {
  if (!Array.isArray(values)) {
    return values;
  }
  if (typeof mapper !== "function") {
    throw new TypeError("remapArray requires a mapper function.");
  }
  return values.map((value, index) => mapper(value, index));
}

function remapSchemaNode(value, schema, transform) {
  if (!schema || value === null || value === undefined) {
    return value;
  }

  if (schema.items) {
    return remapArray(value, (item) => remapSchemaNode(item, schema.items, transform));
  }
  if (typeof value !== "object") {
    return value;
  }

  let next = value;
  for (const operation of schema.operations ?? []) {
    if (operation === GEOMETRY_OPERATIONS.POINT) {
      next = transform.mapPoint(next);
    } else if (operation === GEOMETRY_OPERATIONS.VELOCITY) {
      next = transform.mapVelocity(next);
    } else if (operation === GEOMETRY_OPERATIONS.RECTANGLE) {
      next = transform.mapRectangle(next);
    } else {
      throw new RangeError(`Unknown geometry operation: ${operation}`);
    }
  }

  const coordinates = schema.coordinates ?? {};
  const scalars = schema.scalars ?? {};
  const fields = schema.fields ?? {};
  if (
    Object.keys(coordinates).length > 0 ||
    Object.keys(scalars).length > 0 ||
    Object.keys(fields).length > 0
  ) {
    next = { ...next };
  }

  for (const [field, axis] of Object.entries(coordinates)) {
    if (Number.isFinite(next[field])) {
      next[field] = transform.mapCoordinate(next[field], axis);
    }
  }
  for (const [field, axis] of Object.entries(scalars)) {
    if (Number.isFinite(next[field])) {
      next[field] = transform.mapScalar(next[field], axis);
    }
  }
  for (const [field, fieldSchema] of Object.entries(fields)) {
    if (field in next) {
      next[field] = remapSchemaNode(next[field], fieldSchema, transform);
    }
  }
  return next;
}

/**
 * Remaps only geometry declared by the schema. Scores, timers, statuses, IDs,
 * and all other gameplay data are retained by reference or value.
 */
export function remapPositionalState(
  state,
  transform,
  schema,
  { layout } = {},
) {
  if (!state || typeof state !== "object") {
    return state;
  }
  if (!transform?.mapPoint || !transform?.mapVelocity) {
    throw new TypeError("remapPositionalState requires a viewport transform.");
  }
  const remapped = remapSchemaNode(state, schema, transform);
  return layout === undefined ? remapped : { ...remapped, layout };
}

export function resizePositionalState(
  state,
  nextLayout,
  schema,
  options,
) {
  if (!state?.layout) {
    throw new TypeError("A positional game state with a layout is required.");
  }
  const transform = createViewportTransform(state.layout, nextLayout, options);
  return remapPositionalState(state, transform, schema, { layout: nextLayout });
}

const POINT = Object.freeze({
  operations: Object.freeze([GEOMETRY_OPERATIONS.POINT]),
});
const POINT_VELOCITY = Object.freeze({
  operations: Object.freeze([
    GEOMETRY_OPERATIONS.POINT,
    GEOMETRY_OPERATIONS.VELOCITY,
  ]),
});
const RECTANGLE = Object.freeze({
  operations: Object.freeze([GEOMETRY_OPERATIONS.RECTANGLE]),
});
const RECTANGLE_VELOCITY = Object.freeze({
  operations: Object.freeze([
    GEOMETRY_OPERATIONS.RECTANGLE,
    GEOMETRY_OPERATIONS.VELOCITY,
  ]),
});
const POINT_WITH_SIZE = Object.freeze({
  operations: POINT.operations,
  scalars: Object.freeze({
    width: GEOMETRY_AXES.X,
    height: GEOMETRY_AXES.Y,
  }),
});
const POINT_VELOCITY_WITH_SIZE = Object.freeze({
  operations: POINT_VELOCITY.operations,
  scalars: POINT_WITH_SIZE.scalars,
});
const POINT_VELOCITY_RADIUS = Object.freeze({
  operations: POINT_VELOCITY.operations,
  scalars: Object.freeze({ radius: GEOMETRY_AXES.UNIFORM }),
});

const HAND_BOUNCE_SCHEMA = {
  fields: {
    ball: POINT_VELOCITY_RADIUS,
    paddle: POINT_VELOCITY_WITH_SIZE,
  },
};

const BRICK_DODGER_SCHEMA = {
  fields: {
    player: POINT,
    hazards: { items: RECTANGLE_VELOCITY },
    bonuses: {
      items: {
        operations: POINT_VELOCITY.operations,
        scalars: { size: GEOMETRY_AXES.UNIFORM },
      },
    },
  },
};

const BREAKOUT_SCHEMA = {
  fields: {
    paddle: POINT,
    balls: { items: POINT_VELOCITY_RADIUS },
    capsules: { items: POINT_VELOCITY_WITH_SIZE },
    bricks: { items: RECTANGLE },
  },
};

const BREAKOUT_COOP_SCHEMA = {
  fields: {
    paddle: POINT,
    balls: { items: POINT_VELOCITY_RADIUS },
    bricks: { items: RECTANGLE },
  },
};

const FINGER_PONG_SCHEMA = {
  fields: {
    player: POINT,
    opponent: POINT,
    ball: POINT_VELOCITY_RADIUS,
  },
};

const FRUIT_NINJA_SCHEMA = {
  fields: {
    targets: { items: POINT_VELOCITY_RADIUS },
    splitPieces: { items: POINT_VELOCITY_RADIUS },
    particles: { items: POINT_VELOCITY_RADIUS },
    popups: { items: POINT },
    bladeTrail: { items: POINT },
    swipeSegments: {
      items: {
        fields: {
          start: POINT,
          end: POINT,
        },
      },
    },
  },
};

const SKY_PATROL_SCHEMA = {
  scalars: {
    scrollOffset: GEOMETRY_AXES.Y,
  },
  fields: {
    ship: POINT_WITH_SIZE,
    airEnemies: {
      items: {
        operations: POINT_WITH_SIZE.operations,
        coordinates: { startX: GEOMETRY_AXES.X },
        scalars: {
          width: GEOMETRY_AXES.X,
          height: GEOMETRY_AXES.Y,
          speedY: GEOMETRY_AXES.Y,
          swayAmplitude: GEOMETRY_AXES.X,
          driftX: GEOMETRY_AXES.X,
        },
      },
    },
    groundTargets: { items: POINT_WITH_SIZE },
    playerShots: { items: POINT_VELOCITY_WITH_SIZE },
    enemyShots: { items: POINT_VELOCITY_WITH_SIZE },
    explosions: { items: POINT },
    scoreBursts: { items: POINT },
  },
};

const INVADERS_SCHEMA = {
  fields: {
    ship: POINT_WITH_SIZE,
    enemies: { items: RECTANGLE },
    playerShots: { items: RECTANGLE_VELOCITY },
    enemyShots: { items: RECTANGLE_VELOCITY },
  },
};

const FLAPPY_SCHEMA = {
  fields: {
    bird: POINT_VELOCITY_RADIUS,
    pipes: {
      items: {
        coordinates: {
          x: GEOMETRY_AXES.X,
          gapTop: GEOMETRY_AXES.Y,
        },
        scalars: {
          width: GEOMETRY_AXES.X,
          gapHeight: GEOMETRY_AXES.Y,
        },
      },
    },
  },
};

const MISSILE_COMMAND_SCHEMA = {
  fields: {
    structures: { items: POINT_WITH_SIZE },
    threats: {
      items: {
        operations: POINT_VELOCITY.operations,
        coordinates: {
          startX: GEOMETRY_AXES.X,
          startY: GEOMETRY_AXES.Y,
          targetX: GEOMETRY_AXES.X,
          targetY: GEOMETRY_AXES.Y,
        },
      },
    },
    interceptors: {
      items: {
        operations: POINT_VELOCITY.operations,
        coordinates: {
          originX: GEOMETRY_AXES.X,
          originY: GEOMETRY_AXES.Y,
          targetX: GEOMETRY_AXES.X,
          targetY: GEOMETRY_AXES.Y,
        },
      },
    },
    explosions: {
      items: {
        operations: POINT.operations,
        scalars: { maxRadius: GEOMETRY_AXES.UNIFORM },
      },
    },
    scoreBursts: { items: POINT },
  },
};

const TIC_TAC_TOE_SCHEMA = {
  fields: {
    draggingPiece: {
      operations: POINT.operations,
      scalars: { size: GEOMETRY_AXES.UNIFORM },
    },
  },
};

export const FULLSCREEN_GAME_RESIZE_SCHEMAS = Object.freeze({
  "hand-bounce": HAND_BOUNCE_SCHEMA,
  "brick-dodger": BRICK_DODGER_SCHEMA,
  breakout: BREAKOUT_SCHEMA,
  classic: BREAKOUT_SCHEMA,
  "find-your-grind-breakout": BREAKOUT_SCHEMA,
  "breakout-coop": BREAKOUT_COOP_SCHEMA,
  "finger-pong": FINGER_PONG_SCHEMA,
  "fruit-ninja": FRUIT_NINJA_SCHEMA,
  "sky-patrol": SKY_PATROL_SCHEMA,
  invaders: INVADERS_SCHEMA,
  flappy: FLAPPY_SCHEMA,
  "missile-command": MISSILE_COMMAND_SCHEMA,
  "tic-tac-toe": TIC_TAC_TOE_SCHEMA,
});

export const FULLSCREEN_GAME_RESIZE_MODE_IDS = Object.freeze(
  Object.keys(FULLSCREEN_GAME_RESIZE_SCHEMAS).sort(),
);

export function resizeFullscreenGameState(
  fullscreenMode,
  state,
  nextLayout,
  options,
) {
  const schema = FULLSCREEN_GAME_RESIZE_SCHEMAS[fullscreenMode];
  if (!schema) {
    throw new RangeError(`No fullscreen resize schema exists for ${fullscreenMode}.`);
  }
  return resizePositionalState(state, nextLayout, schema, options);
}

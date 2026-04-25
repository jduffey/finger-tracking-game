import {
  FINGERPRINT_WORLD_ADJACENCY,
  FINGERPRINT_WORLD_TILES,
  WFC_DIRECTIONS,
  getWfcDirectionDelta,
} from "./wfcTiles.js";

function clampIndex(value, max) {
  return Math.min(max - 1, Math.max(0, value));
}

function getCellIndex(state, col, row) {
  return row * state.cols + col;
}

function isInBounds(state, col, row) {
  return col >= 0 && col < state.cols && row >= 0 && row < state.rows;
}

function uniqueInTileOrder(values, tileIds) {
  const valueSet = new Set(values);
  return tileIds.filter((tileId) => valueSet.has(tileId));
}

function cloneState(state, overrides = {}) {
  return {
    ...state,
    domains: state.domains.map((domain) => [...domain]),
    constraints: state.constraints.map((constraint) => ({ ...constraint })),
    contradictionCells: (state.contradictionCells ?? []).map((cell) => ({ ...cell })),
    changedCells: (state.changedCells ?? []).map((cell) => ({ ...cell })),
    ...overrides,
  };
}

function getTileWeight(state, tileId) {
  return state.tilesById[tileId]?.weight ?? 1;
}

function chooseWeightedTile(state, domain, rng = Math.random) {
  const totalWeight = domain.reduce((sum, tileId) => sum + getTileWeight(state, tileId), 0);
  if (totalWeight <= 0) {
    return domain[0] ?? null;
  }
  let threshold = rng() * totalWeight;
  for (const tileId of domain) {
    threshold -= getTileWeight(state, tileId);
    if (threshold <= 0) {
      return tileId;
    }
  }
  return domain[domain.length - 1] ?? null;
}

function domainsEqual(a, b) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function markCompleteIfSolved(state) {
  if (state.status === "contradiction") {
    return state;
  }
  const complete = state.domains.every((domain) => domain.length === 1);
  return complete ? { ...state, status: "complete" } : state;
}

function propagateDomains(sourceState, queue) {
  const state = cloneState(sourceState, {
    changedCells: [],
    contradictionCells: [],
    status: sourceState.status === "complete" ? "ready" : sourceState.status,
  });
  const pending = [...queue];

  while (pending.length > 0) {
    const { col, row } = pending.shift();
    if (!isInBounds(state, col, row)) {
      continue;
    }
    const domain = state.domains[getCellIndex(state, col, row)];
    if (domain.length === 0) {
      return {
        ...state,
        status: "contradiction",
        contradictionCells: [{ col, row }],
      };
    }

    for (const direction of WFC_DIRECTIONS) {
      const delta = getWfcDirectionDelta(direction, row);
      const nextCol = col + delta.dc;
      const nextRow = row + delta.dr;
      if (!isInBounds(state, nextCol, nextRow)) {
        continue;
      }

      const neighborIndex = getCellIndex(state, nextCol, nextRow);
      const neighborDomain = state.domains[neighborIndex];
      const allowedNeighbors = new Set();
      for (const tileId of domain) {
        for (const neighborId of state.adjacency[tileId]?.[direction] ?? []) {
          allowedNeighbors.add(neighborId);
        }
      }
      const reducedDomain = uniqueInTileOrder(
        neighborDomain.filter((tileId) => allowedNeighbors.has(tileId)),
        state.tileIds,
      );

      if (reducedDomain.length === 0) {
        return {
          ...state,
          status: "contradiction",
          contradictionCells: [{ col: nextCol, row: nextRow }],
        };
      }
      if (!domainsEqual(neighborDomain, reducedDomain)) {
        state.domains[neighborIndex] = reducedDomain;
        state.changedCells.push({ col: nextCol, row: nextRow });
        pending.push({ col: nextCol, row: nextRow });
      }
    }
  }

  return markCompleteIfSolved(state);
}

export function createWfcState({
  cols,
  rows,
  tiles = FINGERPRINT_WORLD_TILES,
  adjacency = FINGERPRINT_WORLD_ADJACENCY,
} = {}) {
  const safeCols = Math.max(1, Math.floor(Number.isFinite(cols) ? cols : 1));
  const safeRows = Math.max(1, Math.floor(Number.isFinite(rows) ? rows : 1));
  const tileIds = tiles.map((tile) => tile.id);

  return {
    cols: safeCols,
    rows: safeRows,
    tileIds,
    tilesById: Object.fromEntries(tiles.map((tile) => [tile.id, tile])),
    adjacency,
    domains: Array.from({ length: safeCols * safeRows }, () => [...tileIds]),
    constraints: [],
    contradictionCells: [],
    changedCells: [],
    status: "ready",
    stepCount: 0,
  };
}

export function getWfcCellDomain(state, col, row) {
  if (!state || !isInBounds(state, col, row)) {
    return [];
  }
  return [...state.domains[getCellIndex(state, col, row)]];
}

export function setWfcConstraint(state, col, row, tileId) {
  if (!state || !isInBounds(state, col, row) || !state.tileIds.includes(tileId)) {
    return state;
  }

  const cellIndex = getCellIndex(state, col, row);
  const currentDomain = state.domains[cellIndex] ?? [];
  if (!currentDomain.includes(tileId)) {
    return cloneState(state, {
      status: "contradiction",
      contradictionCells: [{ col, row }],
      changedCells: [],
    });
  }

  const nextState = cloneState(state, {
    status: "ready",
    changedCells: [{ col, row }],
    contradictionCells: [],
  });
  nextState.domains[cellIndex] = [tileId];
  nextState.constraints = [
    ...nextState.constraints.filter((constraint) => constraint.col !== col || constraint.row !== row),
    { col, row, tileId },
  ];

  return propagateDomains(nextState, [{ col, row }]);
}

export function stepWfc(state, rng = Math.random) {
  if (!state || state.status === "contradiction" || state.status === "complete") {
    return state;
  }

  let bestIndex = -1;
  let bestDomain = null;
  for (let index = 0; index < state.domains.length; index += 1) {
    const domain = state.domains[index];
    if (domain.length <= 1) {
      continue;
    }
    if (!bestDomain || domain.length < bestDomain.length) {
      bestIndex = index;
      bestDomain = domain;
    }
  }

  if (bestIndex < 0 || !bestDomain) {
    return { ...state, status: "complete" };
  }

  const col = bestIndex % state.cols;
  const row = Math.floor(bestIndex / state.cols);
  const tileId = chooseWeightedTile(state, bestDomain, rng);
  const nextState = cloneState(state, {
    status: "ready",
    stepCount: state.stepCount + 1,
    changedCells: [{ col, row }],
    contradictionCells: [],
  });
  nextState.domains[bestIndex] = [tileId];

  return propagateDomains(nextState, [{ col, row }]);
}

export function runWfc(state, { maxSteps = 1000, rng = Math.random } = {}) {
  let nextState = state;
  for (let step = 0; step < maxSteps; step += 1) {
    if (!nextState || nextState.status === "complete" || nextState.status === "contradiction") {
      return nextState;
    }
    nextState = stepWfc(nextState, rng);
  }
  return nextState?.status === "ready" ? { ...nextState, status: "running" } : nextState;
}

export function getWfcGrid(state) {
  if (!state) {
    return [];
  }
  return Array.from({ length: state.rows }, (_, row) =>
    Array.from({ length: state.cols }, (_, col) => {
      const domain = state.domains[getCellIndex(state, col, row)] ?? [];
      return domain.length === 1 ? domain[0] : null;
    }),
  );
}

export function isWfcGridValid(grid, adjacency = FINGERPRINT_WORLD_ADJACENCY) {
  if (!Array.isArray(grid) || grid.length === 0) {
    return false;
  }
  for (let row = 0; row < grid.length; row += 1) {
    const cells = grid[row];
    if (!Array.isArray(cells)) {
      return false;
    }
    for (let col = 0; col < cells.length; col += 1) {
      const tileId = cells[col];
      if (!tileId) {
        return false;
      }
      for (const direction of WFC_DIRECTIONS) {
        const delta = getWfcDirectionDelta(direction, row);
        const neighbor = grid[row + delta.dr]?.[col + delta.dc];
        if (neighbor && !adjacency[tileId]?.[direction]?.includes(neighbor)) {
          return false;
        }
      }
    }
  }
  return true;
}

export function clampWfcCell(state, col, row) {
  return {
    col: clampIndex(col, state.cols),
    row: clampIndex(row, state.rows),
  };
}

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

function isGridCellInBounds(grid, col, row) {
  return row >= 0 && row < grid.length && col >= 0 && col < (grid[row]?.length ?? 0);
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

function orderWeightedTiles(state, domain, rng = Math.random) {
  const remaining = [...domain];
  const ordered = [];
  while (remaining.length > 0) {
    const tileId = chooseWeightedTile(state, remaining, rng);
    if (!tileId) {
      break;
    }
    ordered.push(tileId);
    remaining.splice(remaining.indexOf(tileId), 1);
  }
  return ordered;
}

function domainsEqual(a, b) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function hasAdjacentGrassBridgeBanks(assignments) {
  return assignments.some(
    (tileId, index) => tileId === "grass" && assignments[(index + 1) % assignments.length] === "grass",
  );
}

function hasValidBridgeNeighborAssignment(neighbors, index = 0, assignments = []) {
  if (index >= neighbors.length) {
    const grassCount = assignments.filter((tileId) => tileId === "grass").length;
    return grassCount >= 2 && grassCount <= 3 && !hasAdjacentGrassBridgeBanks(assignments);
  }

  for (const tileId of neighbors[index].choices) {
    assignments[index] = tileId;
    if (hasValidBridgeNeighborAssignment(neighbors, index + 1, assignments)) {
      assignments.length = index;
      return true;
    }
  }
  assignments.length = index;
  return false;
}

function getBridgeNeighborDomainOptions(state, col, row) {
  const neighbors = [];
  for (const direction of WFC_DIRECTIONS) {
    const delta = getWfcDirectionDelta(direction, row);
    const nextCol = col + delta.dc;
    const nextRow = row + delta.dr;
    if (!isInBounds(state, nextCol, nextRow)) {
      return null;
    }

    const domain = state.domains[getCellIndex(state, nextCol, nextRow)] ?? [];
    const choices = ["grass", "water"].filter((tileId) => domain.includes(tileId));
    if (choices.length === 0) {
      return null;
    }
    neighbors.push({ col: nextCol, row: nextRow, choices });
  }
  return neighbors;
}

function canCellBeBridge(state, col, row) {
  const neighbors = getBridgeNeighborDomainOptions(state, col, row);
  return Boolean(neighbors) && hasValidBridgeNeighborAssignment(neighbors);
}

function applyBridgeDomainRules(state) {
  const changedCells = [];
  for (let row = 0; row < state.rows; row += 1) {
    for (let col = 0; col < state.cols; col += 1) {
      const index = getCellIndex(state, col, row);
      const domain = state.domains[index] ?? [];
      if (!domain.includes("bridge") || canCellBeBridge(state, col, row)) {
        continue;
      }

      const reducedDomain = domain.filter((tileId) => tileId !== "bridge");
      if (reducedDomain.length === 0) {
        return {
          status: "contradiction",
          contradictionCells: [{ col, row }],
          changedCells,
        };
      }
      state.domains[index] = reducedDomain;
      changedCells.push({ col, row });
    }
  }
  return { status: "ready", changedCells };
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

  while (true) {
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

    const bridgeResult = applyBridgeDomainRules(state);
    if (bridgeResult.status === "contradiction") {
      return {
        ...state,
        status: "contradiction",
        contradictionCells: bridgeResult.contradictionCells,
      };
    }
    if (bridgeResult.changedCells.length === 0) {
      break;
    }
    state.changedCells.push(...bridgeResult.changedCells);
    pending.push(...bridgeResult.changedCells);
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
  for (const tileId of orderWeightedTiles(state, bestDomain, rng)) {
    const nextState = cloneState(state, {
      status: "ready",
      stepCount: state.stepCount + 1,
      changedCells: [{ col, row }],
      contradictionCells: [],
    });
    nextState.domains[bestIndex] = [tileId];
    const propagated = propagateDomains(nextState, [{ col, row }]);
    if (propagated.status !== "contradiction") {
      return propagated;
    }
  }

  return {
    ...state,
    status: "contradiction",
    contradictionCells: [{ col, row }],
    changedCells: [],
  };
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
      if (tileId === "bridge" && !isWfcGridBridgeValid(grid, col, row)) {
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

function isWfcGridBridgeValid(grid, col, row) {
  const neighbors = [];
  for (const direction of WFC_DIRECTIONS) {
    const delta = getWfcDirectionDelta(direction, row);
    const nextCol = col + delta.dc;
    const nextRow = row + delta.dr;
    if (!isGridCellInBounds(grid, nextCol, nextRow)) {
      return false;
    }
    const tileId = grid[nextRow][nextCol];
    if (tileId !== "grass" && tileId !== "water") {
      return false;
    }
    neighbors.push(tileId);
  }

  const grassCount = neighbors.filter((tileId) => tileId === "grass").length;
  return grassCount >= 2 && grassCount <= 3 && !hasAdjacentGrassBridgeBanks(neighbors);
}

export function clampWfcCell(state, col, row) {
  return {
    col: clampIndex(col, state.cols),
    row: clampIndex(row, state.rows),
  };
}

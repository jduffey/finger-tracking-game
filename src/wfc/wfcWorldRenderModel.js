export function getWfcWorldCellIndex(layout, cell) {
  const cols = layout?.cols;
  const rows = layout?.rows;
  const col = cell?.col;
  const row = cell?.row;
  if (
    !Number.isInteger(cols) ||
    !Number.isInteger(rows) ||
    !Number.isInteger(col) ||
    !Number.isInteger(row) ||
    cols <= 0 ||
    rows <= 0 ||
    col < 0 ||
    col >= cols ||
    row < 0 ||
    row >= rows
  ) {
    return -1;
  }
  return row * cols + col;
}

export function getWfcWorldCellVisualState(
  domain,
  { changed = false, conflict = false, constrained = false } = {},
) {
  const safeDomain = Array.isArray(domain) ? domain : [];
  return {
    tileId: safeDomain.length === 1 ? safeDomain[0] : null,
    domainSize: safeDomain.length,
    changed: Boolean(changed),
    conflict: Boolean(conflict),
    constrained: Boolean(constrained),
  };
}

export function areWfcWorldCellVisualStatesEqual(previous, next) {
  return (
    previous?.tileId === next?.tileId &&
    previous?.domainSize === next?.domainSize &&
    previous?.changed === next?.changed &&
    previous?.conflict === next?.conflict &&
    previous?.constrained === next?.constrained
  );
}

export function getWfcWorldCellClassName({
  tileId,
  changed,
  conflict,
  constrained,
}) {
  return [
    "fullscreen-camera-wfc-cell",
    tileId ? "collapsed" : "unresolved",
    changed ? "changed" : "",
    conflict ? "conflict" : "",
    constrained ? "constrained" : "",
    tileId ? `tile-${tileId}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

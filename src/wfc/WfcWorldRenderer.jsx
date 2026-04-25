import { getWfcGrid } from "./wfcSolver.js";
import { getWfcWorldCellCenter } from "./wfcWorldGame.js";
import { FINGERPRINT_WORLD_TILES } from "./wfcTiles.js";

const TILE_BY_ID = Object.fromEntries(FINGERPRINT_WORLD_TILES.map((tile) => [tile.id, tile]));

function getCellKey(col, row) {
  return `${col}-${row}`;
}

function isSameCell(a, b) {
  return a?.col === b?.col && a?.row === b?.row;
}

function getPhaseLabel(phase) {
  switch (phase) {
    case "collapsing":
      return "Collapsing";
    case "complete":
      return "World complete";
    case "conflict":
      return "Rule conflict";
    default:
      return "Seed rules";
  }
}

export function WfcWorldRenderer({
  game,
  style,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
}) {
  if (!game?.layout) {
    return null;
  }

  const grid = getWfcGrid(game.wfc);
  const changedKeys = new Set((game.wfc.changedCells ?? []).map((cell) => getCellKey(cell.col, cell.row)));
  const contradictionKeys = new Set(
    (game.wfc.contradictionCells ?? []).map((cell) => getCellKey(cell.col, cell.row)),
  );
  const constraintKeys = new Map(
    game.constraints.map((constraint) => [getCellKey(constraint.col, constraint.row), constraint.tileId]),
  );
  const cells = [];

  for (let row = 0; row < game.layout.rows; row += 1) {
    for (let col = 0; col < game.layout.cols; col += 1) {
      const tileId = grid[row]?.[col] ?? null;
      const domain = game.wfc.domains[row * game.layout.cols + col] ?? [];
      const tile = TILE_BY_ID[tileId] ?? null;
      const key = getCellKey(col, row);
      const constrainedTileId = constraintKeys.get(key);
      const center = getWfcWorldCellCenter(game.layout, col, row);

      cells.push(
        <span
          key={key}
          className={[
            "fullscreen-camera-wfc-cell",
            tileId ? "collapsed" : "unresolved",
            isSameCell(game.hoverCell, { col, row }) ? "hovered" : "",
            changedKeys.has(key) ? "changed" : "",
            contradictionKeys.has(key) ? "conflict" : "",
            constrainedTileId ? "constrained" : "",
            tileId ? `tile-${tileId}` : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={{
            "--wfc-cell-left": `${center.x - game.layout.grid.cellWidth / 2}px`,
            "--wfc-cell-top": `${center.y - game.layout.grid.cellHeight / 2}px`,
            "--wfc-cell-width": `${game.layout.grid.cellWidth}px`,
            "--wfc-cell-height": `${game.layout.grid.cellHeight}px`,
            "--wfc-tile-color": tile?.color ?? "rgba(233, 240, 248, 0.2)",
            "--wfc-tile-accent": tile?.accent ?? "rgba(233, 240, 248, 0.36)",
            "--wfc-tile-text": tile?.textColor ?? "#f5f8ff",
          }}
        >
          <span className="fullscreen-camera-wfc-cell-mark">
            {tile?.icon ?? domain.length}
          </span>
          {constrainedTileId ? <span className="fullscreen-camera-wfc-cell-lock" /> : null}
        </span>,
      );
    }
  }

  return (
    <div
      className={`fullscreen-camera-wfc-world ${game.phase}`}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      style={style}
    >
      <div className="fullscreen-camera-wfc-title">
        <strong>Fingerprint Worlds</strong>
        <span>{getPhaseLabel(game.phase)}</span>
      </div>
      <div className="fullscreen-camera-wfc-grid" aria-hidden="true">
        {cells}
      </div>
      <div className="fullscreen-camera-wfc-panel">
        <div className="fullscreen-camera-wfc-palette">
          {game.layout.palette.map((tile) => (
            <span
              key={tile.id}
              className={`fullscreen-camera-wfc-palette-tile ${
                tile.id === game.selectedTileId ? "selected" : ""
              }`}
              style={{
                left: `${tile.left}px`,
                top: `${tile.top}px`,
                width: `${tile.width}px`,
                height: `${tile.height}px`,
                "--wfc-tile-color": tile.color,
                "--wfc-tile-accent": tile.accent,
                "--wfc-tile-text": tile.textColor,
              }}
            >
              <span>{tile.icon}</span>
              <strong>{tile.label}</strong>
            </span>
          ))}
        </div>
        <div className="fullscreen-camera-wfc-controls">
          {game.layout.controls.map((control) => (
            <span
              key={control.id}
              className={`fullscreen-camera-wfc-control ${control.id}`}
              style={{
                left: `${control.left}px`,
                top: `${control.top}px`,
                width: `${control.width}px`,
                height: `${control.height}px`,
              }}
            >
              {control.label}
            </span>
          ))}
        </div>
      </div>
      <div className="fullscreen-camera-wfc-status">
        <span>{game.message}</span>
        <strong>{game.constraints.length} rules</strong>
      </div>
    </div>
  );
}

import { memo, useLayoutEffect, useMemo, useRef } from "react";
import {
  getWfcWorldCellCenter,
  normalizeWfcWorldSeed,
} from "./wfcWorldGame.js";
import {
  areWfcWorldCellVisualStatesEqual,
  getWfcWorldCellClassName,
  getWfcWorldCellIndex,
  getWfcWorldCellVisualState,
} from "./wfcWorldRenderModel.js";
import { FINGERPRINT_WORLD_TILES } from "./wfcTiles.js";

const TILE_BY_ID = Object.fromEntries(FINGERPRINT_WORLD_TILES.map((tile) => [tile.id, tile]));

function createCellGeometries(layout) {
  const cells = [];
  for (let row = 0; row < layout.rows; row += 1) {
    for (let col = 0; col < layout.cols; col += 1) {
      const center = getWfcWorldCellCenter(layout, col, row);
      cells.push({
        left: center.x - layout.grid.cellWidth / 2,
        top: center.y - layout.grid.cellHeight / 2,
        width: layout.grid.cellWidth,
        height: layout.grid.cellHeight,
      });
    }
  }
  return cells;
}

function getIndexedCells(layout, cells) {
  const indexes = new Set();
  for (const cell of cells ?? []) {
    const index = getWfcWorldCellIndex(layout, cell);
    if (index >= 0) {
      indexes.add(index);
    }
  }
  return indexes;
}

const WfcWorldCell = memo(
  function WfcWorldCell({
    geometry,
    tileId,
    domainSize,
    changed,
    conflict,
    constrained,
  }) {
    const tile = TILE_BY_ID[tileId] ?? null;
    return (
      <span
        className={getWfcWorldCellClassName({
          tileId,
          changed,
          conflict,
          constrained,
        })}
        style={{
          "--wfc-cell-left": `${geometry.left}px`,
          "--wfc-cell-top": `${geometry.top}px`,
          "--wfc-cell-width": `${geometry.width}px`,
          "--wfc-cell-height": `${geometry.height}px`,
          "--wfc-tile-color": tile?.color ?? "rgba(233, 240, 248, 0.2)",
          "--wfc-tile-accent": tile?.accent ?? "rgba(233, 240, 248, 0.36)",
          "--wfc-tile-text": tile?.textColor ?? "#f5f8ff",
        }}
      >
        <span className="fullscreen-camera-wfc-cell-mark">
          {tile?.icon ?? domainSize}
        </span>
        {constrained ? <span className="fullscreen-camera-wfc-cell-lock" /> : null}
      </span>
    );
  },
  (previous, next) =>
    previous.geometry === next.geometry &&
    areWfcWorldCellVisualStatesEqual(previous, next),
);

const WfcWorldGridCells = memo(function WfcWorldGridCells({
  layout,
  wfc,
  constraints,
}) {
  const geometries = useMemo(() => createCellGeometries(layout), [layout]);
  const changedIndexes = getIndexedCells(layout, wfc?.changedCells);
  const contradictionIndexes = getIndexedCells(layout, wfc?.contradictionCells);
  const constraintIndexes = new Set(
    (constraints ?? [])
      .map((constraint) => getWfcWorldCellIndex(layout, constraint))
      .filter((index) => index >= 0),
  );

  return geometries.map((geometry, index) => {
    const visualState = getWfcWorldCellVisualState(wfc?.domains?.[index], {
      changed: changedIndexes.has(index),
      conflict: contradictionIndexes.has(index),
      constrained: constraintIndexes.has(index),
    });
    return (
      <WfcWorldCell
        {...visualState}
        geometry={geometry}
        key={index}
      />
    );
  });
});

function WfcWorldGridHover({
  gridRef,
  layout,
  hoverCell,
  cellRevision,
  constraintRevision,
}) {
  const hoverIndex = getWfcWorldCellIndex(layout, hoverCell);

  useLayoutEffect(() => {
    const hoveredCell = hoverIndex >= 0 ? gridRef.current?.children?.[hoverIndex] : null;
    hoveredCell?.classList.add("hovered");
    return () => hoveredCell?.classList.remove("hovered");
  }, [cellRevision, constraintRevision, gridRef, hoverIndex, layout]);

  return null;
}

export function WfcWorldRenderer({
  game,
  style,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
  onSelectTile,
  onGenerate,
  onClear,
}) {
  const gridRef = useRef(null);

  if (!game?.layout) {
    return null;
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
      <div
        className="fullscreen-camera-wfc-grid"
        aria-hidden="true"
        ref={gridRef}
      >
        <WfcWorldGridCells
          constraints={game.constraints}
          layout={game.layout}
          wfc={game.wfc}
        />
        <WfcWorldGridHover
          cellRevision={game.wfc}
          constraintRevision={game.constraints}
          gridRef={gridRef}
          hoverCell={game.hoverCell}
          layout={game.layout}
        />
      </div>
      <div className="fullscreen-camera-wfc-panel">
        <div className="fullscreen-camera-wfc-palette">
          {game.layout.palette.map((tile) => (
            <button
              aria-label={`${tile.ariaLabel}. ${tile.accessibility?.description ?? ""}`}
              aria-pressed={tile.id === game.selectedTileId}
              key={tile.id}
              className={`fullscreen-camera-wfc-palette-tile ${
                tile.id === game.selectedTileId ? "selected" : ""
              }`}
              onClick={() => onSelectTile?.(tile.id)}
              onMouseDown={(event) => event.stopPropagation()}
              onMouseUp={(event) => event.stopPropagation()}
              style={{
                left: `${tile.left}px`,
                top: `${tile.top}px`,
                width: `${tile.width}px`,
                height: `${tile.height}px`,
                "--wfc-tile-color": tile.color,
                "--wfc-tile-accent": tile.accent,
                "--wfc-tile-text": tile.textColor,
              }}
              type="button"
            >
              <span aria-hidden="true">{tile.icon}</span>
              <strong>{tile.label}</strong>
              <small>{tile.accessibility?.shortcut}</small>
            </button>
          ))}
        </div>
        <div className="fullscreen-camera-wfc-controls">
          {game.layout.controls.map((control) => (
            <button
              aria-label={
                control.id === "generate"
                  ? "Generate a complete world from the placed terrain rules"
                  : "Clear every placed terrain rule and start a new world"
              }
              disabled={control.id === "generate" && game.phase === "collapsing"}
              key={control.id}
              className={`fullscreen-camera-wfc-control ${control.id}`}
              onClick={
                control.id === "generate"
                  ? () => onGenerate?.()
                  : () => onClear?.()
              }
              onMouseDown={(event) => event.stopPropagation()}
              onMouseUp={(event) => event.stopPropagation()}
              style={{
                left: `${control.left}px`,
                top: `${control.top}px`,
                width: `${control.width}px`,
                height: `${control.height}px`,
              }}
              type="button"
            >
              {control.label}
            </button>
          ))}
        </div>
      </div>
      <div
        aria-atomic="true"
        aria-live="polite"
        className="fullscreen-camera-wfc-status"
        role="status"
      >
        <span>{game.message}</span>
        <strong>
          {game.constraints.length} rules · Seed{" "}
          {normalizeWfcWorldSeed(game.seed)}
        </strong>
      </div>
    </div>
  );
}

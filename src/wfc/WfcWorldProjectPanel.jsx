import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  applyWfcWorldTemplate,
  createWfcWorldSeed,
  getWfcWorldGoalModel,
  getWfcWorldQualitySummary,
  normalizeWfcWorldSeed,
  setWfcWorldSeed,
} from "./wfcWorldGame.js";
import {
  WFC_WORLD_LIBRARY_STORAGE_KEY,
  WFC_WORLD_PERSISTENCE_STATUS,
  createEmptyWfcWorldLibrary,
  createWfcWorldSnapshot,
  exportWfcWorldSnapshotJSON,
  exportWfcWorldSnapshotText,
  importWfcWorldSnapshotJSON,
  parseWfcWorldLibraryJSON,
  removeWfcWorldSnapshot,
  restoreWfcWorldSnapshot,
  reviseWfcWorldSnapshot,
  serializeWfcWorldLibrary,
  upsertWfcWorldSnapshot,
  validateWfcWorldLibrary,
} from "./wfcWorldPersistence.js";
import {
  WFC_WORLD_BLANK_TEMPLATE_ID,
  WFC_WORLD_STARTER_TEMPLATES,
  getWfcWorldStarterTemplate,
} from "./wfcWorldTemplates.js";

import "./WfcWorldProjectPanel.css";

function resolveStorage(storage) {
  if (storage !== undefined) {
    return storage;
  }
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function loadInitialLibrary(storage, storageKey) {
  if (!storage?.getItem) {
    return {
      library: createEmptyWfcWorldLibrary(),
      message: "Projects stay in this session until browser storage is available.",
      tone: "neutral",
    };
  }
  try {
    const result = parseWfcWorldLibraryJSON(storage.getItem(storageKey));
    if (result.ok) {
      return {
        library: result.library,
        message:
          result.status === WFC_WORLD_PERSISTENCE_STATUS.EMPTY
            ? "No saved worlds yet."
            : `${result.library.snapshots.length} saved ${
                result.library.snapshots.length === 1 ? "world" : "worlds"
              } loaded.`,
        tone: "neutral",
      };
    }
  } catch {
    // The in-memory library below keeps the creative session usable.
  }
  return {
    library: createEmptyWfcWorldLibrary(),
    message: "Saved worlds could not be read. A fresh local library is ready.",
    tone: "warning",
  };
}

function resolveNow(now) {
  const value = typeof now === "function" ? now() : now;
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === "string" && Number.isFinite(Date.parse(value))) {
    return new Date(value).toISOString();
  }
  return new Date().toISOString();
}

function formatSavedAt(value) {
  if (!value) {
    return "Session only";
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "Unknown time";
  }
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function safeFileName(name) {
  const slug = String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return slug || "fingerprint-world";
}

function downloadTextFile(content, fileName, mediaType) {
  if (
    typeof document === "undefined" ||
    typeof URL === "undefined" ||
    typeof URL.createObjectURL !== "function"
  ) {
    return false;
  }
  const blob = new Blob([content], { type: mediaType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return true;
}

function getUniqueSnapshotId(baseId, library) {
  const existingIds = new Set(
    library.snapshots.map((snapshot) => snapshot.id),
  );
  if (!existingIds.has(baseId)) {
    return baseId;
  }
  let suffix = 2;
  while (existingIds.has(`${baseId}-${suffix}`)) {
    suffix += 1;
  }
  return `${baseId}-${suffix}`;
}

function ProjectMetric({ label, value, detail }) {
  return (
    <div className="wfc-project-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

/**
 * Project UI for Fingerprint Worlds.
 *
 * Pass `game` and update it in `onRestore`. The library can be controlled with
 * `library` + `onLibraryChange`, or left uncontrolled to use localStorage.
 * `onWorldChange` can publish seed/template setup without using the restore
 * callback; when omitted, setup falls back to `onRestore` for compatibility.
 * Export/share callbacks receive the generated content even when browser
 * download or clipboard APIs are unavailable.
 */
export function WfcWorldProjectPanel({
  game,
  library: controlledLibrary,
  onLibraryChange,
  onRestore,
  onWorldChange,
  onSave,
  onDelete,
  onImport,
  onExport,
  onStatusChange,
  storage,
  storageKey = WFC_WORLD_LIBRARY_STORAGE_KEY,
  now,
  defaultName = "Untitled World",
  downloadExports = true,
  className = "",
}) {
  const headingId = useId();
  const nameId = useId();
  const importId = useId();
  const shareId = useId();
  const seedId = useId();
  const seedHelpId = useId();
  const templateId = useId();
  const templateHelpId = useId();
  const resolvedStorage = useMemo(() => resolveStorage(storage), [storage]);
  const isControlled = controlledLibrary !== undefined;
  const initialReadRef = useRef(null);
  if (initialReadRef.current === null) {
    initialReadRef.current = isControlled
      ? {
          library: createEmptyWfcWorldLibrary(),
          message: "Project library connected.",
          tone: "neutral",
        }
      : loadInitialLibrary(resolvedStorage, storageKey);
  }

  const [internalLibrary, setInternalLibrary] = useState(
    initialReadRef.current.library,
  );
  const controlledValidation = useMemo(
    () =>
      isControlled
        ? validateWfcWorldLibrary(controlledLibrary)
        : null,
    [controlledLibrary, isControlled],
  );
  const library =
    controlledValidation?.ok === true
      ? controlledValidation.library
      : isControlled
        ? createEmptyWfcWorldLibrary()
        : internalLibrary;
  const controlledLibraryError =
    isControlled && controlledValidation?.ok === false
      ? controlledValidation.errors[0] ??
        "The connected project library is invalid."
      : null;
  const [projectName, setProjectName] = useState(
    game?.snapshot?.name ?? defaultName,
  );
  const [seedDraft, setSeedDraft] = useState(game?.seed ?? "");
  const [starterTemplateId, setStarterTemplateId] = useState(
    getWfcWorldStarterTemplate(game?.templateId)?.id ??
      WFC_WORLD_BLANK_TEMPLATE_ID,
  );
  const [activeSnapshotId, setActiveSnapshotId] = useState(
    game?.snapshot?.id ?? null,
  );
  const [selectedSnapshotId, setSelectedSnapshotId] = useState(
    game?.snapshot?.id ?? library.snapshots[0]?.id ?? null,
  );
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [importText, setImportText] = useState("");
  const [shareText, setShareText] = useState("");
  const [feedback, setFeedback] = useState({
    sequence: 0,
    tone: initialReadRef.current.tone,
    message: initialReadRef.current.message,
  });

  const goal = useMemo(() => getWfcWorldGoalModel(game), [game]);
  const quality = useMemo(
    () => getWfcWorldQualitySummary(game),
    [game],
  );
  const selectedSnapshot =
    library.snapshots.find(
      (snapshot) => snapshot.id === selectedSnapshotId,
    ) ?? library.snapshots[0] ?? null;
  const activeSnapshot =
    library.snapshots.find(
      (snapshot) => snapshot.id === activeSnapshotId,
    ) ?? null;
  const selectedStarterTemplate =
    getWfcWorldStarterTemplate(starterTemplateId) ??
    WFC_WORLD_STARTER_TEMPLATES[0];

  const announce = useCallback(
    (message, tone = "neutral") => {
      setFeedback((previous) => ({
        sequence: previous.sequence + 1,
        tone,
        message,
      }));
      onStatusChange?.({ message, tone });
    },
    [onStatusChange],
  );

  const commitLibrary = useCallback(
    (nextLibrary, event) => {
      if (!isControlled) {
        setInternalLibrary(nextLibrary);
      }
      onLibraryChange?.(nextLibrary, event);
      if (isControlled) {
        return true;
      }
      const serialized = serializeWfcWorldLibrary(nextLibrary);
      if (!serialized.ok || !resolvedStorage?.setItem) {
        return false;
      }
      try {
        resolvedStorage.setItem(storageKey, serialized.json);
        return true;
      } catch {
        return false;
      }
    },
    [
      isControlled,
      onLibraryChange,
      resolvedStorage,
      storageKey,
    ],
  );

  useEffect(() => {
    if (!game?.snapshot?.id) {
      return;
    }
    setActiveSnapshotId(game.snapshot.id);
    setSelectedSnapshotId(game.snapshot.id);
    if (game.snapshot.name) {
      setProjectName(game.snapshot.name);
    }
  }, [game?.snapshot?.id, game?.snapshot?.name]);

  useEffect(() => {
    setSeedDraft(game?.seed ?? "");
    setStarterTemplateId(
      getWfcWorldStarterTemplate(game?.templateId)?.id ??
        WFC_WORLD_BLANK_TEMPLATE_ID,
    );
  }, [game?.seed, game?.templateId]);

  useEffect(() => {
    if (
      selectedSnapshotId &&
      !library.snapshots.some(
        (snapshot) => snapshot.id === selectedSnapshotId,
      )
    ) {
      setSelectedSnapshotId(library.snapshots[0]?.id ?? null);
    }
  }, [library.snapshots, selectedSnapshotId]);

  useEffect(() => {
    if (controlledLibraryError) {
      announce(controlledLibraryError, "warning");
    }
  }, [announce, controlledLibraryError]);

  const publishWorldSetup = useCallback(
    (nextGame, event) => {
      if (onWorldChange) {
        onWorldChange(nextGame, event);
      } else {
        onRestore?.(nextGame, null);
      }
    },
    [onRestore, onWorldChange],
  );

  const applySeed = useCallback(() => {
    if (!seedDraft.trim()) {
      announce("Enter a world seed first.", "warning");
      return;
    }
    const nextGame = setWfcWorldSeed(game, seedDraft);
    if (!nextGame) {
      announce("This seed could not be applied.", "warning");
      return;
    }
    setSeedDraft(nextGame.seed);
    publishWorldSetup(nextGame, {
      type: "seed",
      seed: nextGame.seed,
    });
    announce(
      `Seed ${nextGame.seed} applied. Your current terrain rules are ready to generate.`,
      "success",
    );
  }, [announce, game, publishWorldSetup, seedDraft]);

  const applyStarterTemplate = useCallback(() => {
    if (!seedDraft.trim()) {
      announce("Enter a world seed first.", "warning");
      return;
    }
    const nextGame = applyWfcWorldTemplate(game, starterTemplateId, {
      seed: seedDraft,
    });
    if (!nextGame) {
      announce("This starter could not be applied.", "warning");
      return;
    }
    setActiveSnapshotId(null);
    setSeedDraft(nextGame.seed);
    setProjectName(defaultName);
    publishWorldSetup(nextGame, {
      type: "template",
      seed: nextGame.seed,
      templateId: nextGame.templateId,
    });
    announce(
      `${selectedStarterTemplate.name} started with seed ${nextGame.seed}.`,
      "success",
    );
  }, [
    announce,
    defaultName,
    game,
    publishWorldSetup,
    seedDraft,
    selectedStarterTemplate.name,
    starterTemplateId,
  ]);

  const suggestSeed = useCallback(() => {
    const nextSeed = createWfcWorldSeed();
    setSeedDraft(nextSeed);
    announce(
      `Seed ${nextSeed} is ready. Apply it or start from a template.`,
      "neutral",
    );
  }, [announce]);

  const saveProject = useCallback(
    ({ asNew = false } = {}) => {
      const timestamp = resolveNow(now);
      let created;
      if (!asNew && activeSnapshot) {
        created = reviseWfcWorldSnapshot(activeSnapshot, game, {
          name: projectName,
          updatedAt: timestamp,
        });
      } else {
        created = createWfcWorldSnapshot(game, {
          name: projectName,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        if (
          created.ok &&
          asNew &&
          library.snapshots.some(
            (snapshot) => snapshot.id === created.snapshot.id,
          )
        ) {
          created = createWfcWorldSnapshot(game, {
            id: getUniqueSnapshotId(created.snapshot.id, library),
            name: projectName,
            createdAt: timestamp,
            updatedAt: timestamp,
          });
        }
      }
      if (!created.ok) {
        announce(
          created.errors[0] ?? "This world could not be saved.",
          "warning",
        );
        return;
      }
      const saved = upsertWfcWorldSnapshot(library, created.snapshot);
      if (!saved.ok) {
        announce(
          saved.errors[0] ?? "This world could not be added to the library.",
          "warning",
        );
        return;
      }
      const persisted = commitLibrary(saved.library, {
        type: "save",
        snapshot: saved.snapshot,
      });
      setActiveSnapshotId(saved.snapshot.id);
      setSelectedSnapshotId(saved.snapshot.id);
      setPendingDeleteId(null);
      onSave?.(saved.snapshot, saved.library);
      announce(
        isControlled
          ? `${saved.snapshot.name}, revision ${saved.snapshot.revision}, saved to the project library.`
          : persisted
          ? `${saved.snapshot.name}, revision ${saved.snapshot.revision}, saved locally.`
          : `${saved.snapshot.name} saved for this session. Browser storage was unavailable.`,
        persisted ? "success" : "warning",
      );
    },
    [
      activeSnapshot,
      announce,
      commitLibrary,
      game,
      isControlled,
      library,
      now,
      onSave,
      projectName,
    ],
  );

  const restoreSelected = useCallback(() => {
    if (!selectedSnapshot) {
      announce("Choose a saved world to restore.", "warning");
      return;
    }
    const restored = restoreWfcWorldSnapshot(selectedSnapshot, {
      width: game?.layout?.width ?? 1280,
      height: game?.layout?.height ?? 720,
    });
    if (!restored.ok) {
      announce(
        restored.errors[0] ?? "This saved world could not be restored.",
        "warning",
      );
      return;
    }
    setActiveSnapshotId(restored.snapshot.id);
    setProjectName(restored.snapshot.name);
    setPendingDeleteId(null);
    onRestore?.(restored.game, restored.snapshot);
    announce(
      `${restored.snapshot.name}, revision ${restored.snapshot.revision}, restored.`,
      "success",
    );
  }, [announce, game?.layout?.height, game?.layout?.width, onRestore, selectedSnapshot]);

  const deleteSelected = useCallback(() => {
    if (!selectedSnapshot) {
      return;
    }
    if (pendingDeleteId !== selectedSnapshot.id) {
      setPendingDeleteId(selectedSnapshot.id);
      announce(
        `Press Confirm delete to remove ${selectedSnapshot.name}.`,
        "warning",
      );
      return;
    }
    const removed = removeWfcWorldSnapshot(
      library,
      selectedSnapshot.id,
    );
    if (!removed.ok) {
      announce(
        removed.errors[0] ?? "This saved world could not be deleted.",
        "warning",
      );
      return;
    }
    const persisted = commitLibrary(removed.library, {
      type: "delete",
      snapshot: selectedSnapshot,
    });
    if (activeSnapshotId === selectedSnapshot.id) {
      setActiveSnapshotId(null);
    }
    setSelectedSnapshotId(removed.library.snapshots[0]?.id ?? null);
    setPendingDeleteId(null);
    onDelete?.(selectedSnapshot, removed.library);
    announce(
      isControlled
        ? `${selectedSnapshot.name} removed from the project library.`
        : persisted
        ? `${selectedSnapshot.name} deleted from this browser.`
        : `${selectedSnapshot.name} removed from this session.`,
      "neutral",
    );
  }, [
    activeSnapshotId,
    announce,
    commitLibrary,
    isControlled,
    library,
    onDelete,
    pendingDeleteId,
    selectedSnapshot,
  ]);

  const exportSelectedJson = useCallback(() => {
    if (!selectedSnapshot) {
      announce("Choose a saved world to export.", "warning");
      return;
    }
    const exported = exportWfcWorldSnapshotJSON(selectedSnapshot, {
      exportedAt: resolveNow(now),
    });
    if (!exported.ok) {
      announce(
        exported.errors[0] ?? "This world could not be exported.",
        "warning",
      );
      return;
    }
    onExport?.({
      format: "json",
      content: exported.json,
      snapshot: exported.snapshot,
    });
    const downloaded =
      downloadExports &&
      downloadTextFile(
        exported.json,
        `${safeFileName(exported.snapshot.name)}.fingerprint-world.json`,
        "application/json",
      );
    announce(
      downloaded
        ? `${exported.snapshot.name} JSON downloaded.`
        : `${exported.snapshot.name} JSON prepared for export.`,
      "success",
    );
  }, [
    announce,
    downloadExports,
    now,
    onExport,
    selectedSnapshot,
  ]);

  const shareSelected = useCallback(async () => {
    if (!selectedSnapshot) {
      announce("Choose a saved world to share.", "warning");
      return;
    }
    const exported = exportWfcWorldSnapshotText(selectedSnapshot);
    if (!exported.ok) {
      announce(
        exported.errors[0] ?? "This world summary could not be prepared.",
        "warning",
      );
      return;
    }
    setShareText(exported.text);
    onExport?.({
      format: "text",
      content: exported.text,
      snapshot: exported.snapshot,
    });
    try {
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard?.writeText
      ) {
        await navigator.clipboard.writeText(exported.text);
        announce("World summary copied to the clipboard.", "success");
        return;
      }
    } catch {
      // The visible read-only field remains a reliable copy fallback.
    }
    announce("World summary is ready to copy below.", "neutral");
  }, [announce, onExport, selectedSnapshot]);

  const importProject = useCallback(() => {
    const imported = importWfcWorldSnapshotJSON(importText);
    if (!imported.ok) {
      announce(
        imported.errors[0] ?? "That world file could not be imported.",
        "warning",
      );
      return;
    }
    const saved = upsertWfcWorldSnapshot(library, imported.snapshot);
    if (!saved.ok) {
      announce(
        saved.errors[0] ?? "That world could not be added to the library.",
        "warning",
      );
      return;
    }
    const persisted = commitLibrary(saved.library, {
      type: "import",
      snapshot: imported.snapshot,
    });
    setSelectedSnapshotId(imported.snapshot.id);
    setPendingDeleteId(null);
    setImportText("");
    onImport?.(imported.snapshot, saved.library);
    announce(
      isControlled
        ? `${imported.snapshot.name} imported into the project library.`
        : persisted
        ? `${imported.snapshot.name} imported and saved locally.`
        : `${imported.snapshot.name} imported for this session.`,
      "success",
    );
  }, [
    announce,
    commitLibrary,
    importText,
    isControlled,
    library,
    onImport,
  ]);

  const readImportFile = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) {
        return;
      }
      try {
        const text = await file.text();
        setImportText(text);
        announce(`${file.name} is ready to import.`, "neutral");
      } catch {
        announce("That file could not be read.", "warning");
      }
    },
    [announce],
  );

  const rootClassName = ["wfc-project", className]
    .filter(Boolean)
    .join(" ");
  const canSave = Boolean(game?.layout && projectName.trim());
  const projectStateLabel =
    game?.phase === "complete" ? "Complete world" : "Working draft";

  return (
    <aside
      aria-labelledby={headingId}
      className={rootClassName}
      data-project-state={game?.phase ?? "unavailable"}
    >
      <header className="wfc-project-header">
        <div>
          <p className="wfc-project-eyebrow">Fingerprint Worlds</p>
          <h2 id={headingId}>World project</h2>
          <p>
            Name your landscape, save its history, and share the finished
            world.
          </p>
        </div>
        <span className="wfc-project-state">{projectStateLabel}</span>
      </header>

      <section
        aria-labelledby={`${headingId}-generator`}
        className="wfc-project-card wfc-project-generator"
      >
        <div className="wfc-project-card-heading">
          <div>
            <p className="wfc-project-eyebrow">Reproducible setup</p>
            <h3 id={`${headingId}-generator`}>Seed and starter</h3>
          </div>
          <span
            aria-label={`Current seed ${normalizeWfcWorldSeed(game?.seed)}`}
            className="wfc-project-seed-value"
          >
            {normalizeWfcWorldSeed(game?.seed)}
          </span>
        </div>
        <p className="wfc-project-generator-copy">
          The same seed, starter, and terrain rules always grow the same
          landscape.
        </p>
        <div className="wfc-project-generator-fields">
          <label
            className="wfc-project-field wfc-project-field--compact"
            htmlFor={seedId}
          >
            <span>World seed</span>
            <input
              aria-describedby={seedHelpId}
              autoComplete="off"
              id={seedId}
              maxLength="48"
              onChange={(event) => setSeedDraft(event.target.value)}
              placeholder="quiet-meadow-001"
              spellCheck="false"
              type="text"
              value={seedDraft}
            />
            <small id={seedHelpId}>
              Share this seed to reproduce your generated layout.
            </small>
          </label>
          <label
            className="wfc-project-field wfc-project-field--compact"
            htmlFor={templateId}
          >
            <span>Starter template</span>
            <select
              aria-describedby={templateHelpId}
              id={templateId}
              onChange={(event) =>
                setStarterTemplateId(event.target.value)
              }
              value={starterTemplateId}
            >
              {WFC_WORLD_STARTER_TEMPLATES.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
            <small id={templateHelpId}>
              {selectedStarterTemplate.description}
            </small>
          </label>
        </div>
        <div className="wfc-project-actions">
          <button
            className="wfc-project-button wfc-project-button--primary"
            disabled={!seedDraft.trim()}
            onClick={applyStarterTemplate}
            type="button"
          >
            Start from template
          </button>
          <button
            className="wfc-project-button"
            disabled={!seedDraft.trim()}
            onClick={applySeed}
            type="button"
          >
            Apply seed to current rules
          </button>
          <button
            className="wfc-project-button"
            onClick={suggestSeed}
            type="button"
          >
            Surprise me
          </button>
        </div>
        <p className="wfc-project-generator-note">
          Applying a seed resets the current generation but keeps its rules.
          Starting from a template replaces unsaved rules; saved projects stay
          untouched.
        </p>
      </section>

      <section
        aria-labelledby={`${headingId}-goal`}
        className="wfc-project-card wfc-project-goal"
      >
        <div className="wfc-project-card-heading">
          <div>
            <p className="wfc-project-eyebrow">Creative goal</p>
            <h3 id={`${headingId}-goal`}>{goal.title}</h3>
          </div>
          <strong aria-label={`${goal.progress.overallPercent} percent complete`}>
            {goal.progress.overallPercent}%
          </strong>
        </div>
        <progress
          aria-label="World creation progress"
          max="100"
          value={goal.progress.overallPercent}
        />
        <p className="wfc-project-stage">
          <strong>{goal.progress.stageLabel}</strong>
          <span>{goal.progress.instruction}</span>
        </p>
        <ol aria-label="World goal milestones" className="wfc-project-milestones">
          {goal.milestones.map((milestone) => (
            <li
              className={milestone.complete ? "is-complete" : undefined}
              key={milestone.id}
            >
              <span aria-hidden="true">
                {milestone.complete ? "✓" : `${milestone.current}/${milestone.target}`}
              </span>
              {milestone.label}
            </li>
          ))}
        </ol>
      </section>

      <section
        aria-labelledby={`${headingId}-quality`}
        className="wfc-project-card"
      >
        <div className="wfc-project-card-heading">
          <div>
            <p className="wfc-project-eyebrow">World character</p>
            <h3 id={`${headingId}-quality`}>
              {quality.complete ? quality.tierLabel : "Taking shape"}
            </h3>
          </div>
          <strong className="wfc-project-score">
            {quality.score}
            <small>/100</small>
          </strong>
        </div>
        <div className="wfc-project-metrics">
          <ProjectMetric
            detail={`${quality.resolvedCells}/${quality.totalCells} cells`}
            label="Resolved"
            value={`${Math.round(quality.coverage * 100)}%`}
          />
          <ProjectMetric
            detail="Color and pattern"
            label="Terrain types"
            value={quality.terrainTypes}
          />
          <ProjectMetric
            detail="Castles and bridges"
            label="Landmarks"
            value={quality.landmarkCount}
          />
          <ProjectMetric
            detail="Your anchor cells"
            label="Rules"
            value={quality.constraintCount}
          />
        </div>
      </section>

      <section
        aria-labelledby={`${headingId}-save`}
        className="wfc-project-card"
      >
        <div className="wfc-project-card-heading">
          <div>
            <p className="wfc-project-eyebrow">Project history</p>
            <h3 id={`${headingId}-save`}>
              {activeSnapshot ? "Save a revision" : "Save this world"}
            </h3>
          </div>
          {activeSnapshot ? (
            <span className="wfc-project-revision">
              Revision {activeSnapshot.revision}
            </span>
          ) : null}
        </div>
        <label className="wfc-project-field" htmlFor={nameId}>
          <span>World name</span>
          <input
            autoComplete="off"
            id={nameId}
            maxLength="64"
            onChange={(event) => setProjectName(event.target.value)}
            placeholder="Name this landscape"
            type="text"
            value={projectName}
          />
        </label>
        <div className="wfc-project-actions">
          <button
            className="wfc-project-button wfc-project-button--primary"
            disabled={!canSave}
            onClick={() => saveProject()}
            type="button"
          >
            {activeSnapshot ? "Save revision" : "Save project"}
          </button>
          <button
            className="wfc-project-button"
            disabled={!canSave}
            onClick={() => saveProject({ asNew: true })}
            type="button"
          >
            Save as new
          </button>
        </div>
      </section>

      <section
        aria-labelledby={`${headingId}-library`}
        className="wfc-project-card wfc-project-library"
      >
        <div className="wfc-project-card-heading">
          <div>
            <p className="wfc-project-eyebrow">On this device</p>
            <h3 id={`${headingId}-library`}>Saved worlds</h3>
          </div>
          <span className="wfc-project-count">
            {library.snapshots.length}/24
          </span>
        </div>

        {library.snapshots.length > 0 ? (
          <>
            <ul className="wfc-project-list">
              {library.snapshots.map((snapshot) => {
                const selected = snapshot.id === selectedSnapshot?.id;
                return (
                  <li key={snapshot.id}>
                    <button
                      aria-pressed={selected}
                      className={selected ? "is-selected" : undefined}
                      onClick={() => {
                        setSelectedSnapshotId(snapshot.id);
                        setPendingDeleteId(null);
                      }}
                      type="button"
                    >
                      <span>
                        <strong>{snapshot.name}</strong>
                        <small>
                          {snapshot.state === "complete"
                            ? "Complete"
                            : "Draft"}{" "}
                          · Revision {snapshot.revision}
                        </small>
                      </span>
                      <time dateTime={snapshot.updatedAt ?? undefined}>
                        {formatSavedAt(snapshot.updatedAt)}
                      </time>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="wfc-project-actions wfc-project-actions--library">
              <button
                className="wfc-project-button wfc-project-button--primary"
                onClick={restoreSelected}
                type="button"
              >
                Restore selected
              </button>
              <button
                className="wfc-project-button"
                onClick={exportSelectedJson}
                type="button"
              >
                Export JSON
              </button>
              <button
                className="wfc-project-button"
                onClick={() => void shareSelected()}
                type="button"
              >
                Copy summary
              </button>
              <button
                className="wfc-project-button wfc-project-button--danger"
                onClick={deleteSelected}
                type="button"
              >
                {pendingDeleteId === selectedSnapshot?.id
                  ? "Confirm delete"
                  : "Delete"}
              </button>
            </div>
          </>
        ) : (
          <p className="wfc-project-empty">
            No saved worlds yet. Place a few rules and save your first draft.
          </p>
        )}

        {shareText ? (
          <label className="wfc-project-field" htmlFor={shareId}>
            <span>Share summary</span>
            <textarea
              id={shareId}
              onFocus={(event) => event.target.select()}
              readOnly
              rows="6"
              value={shareText}
            />
          </label>
        ) : null}
      </section>

      <details className="wfc-project-card wfc-project-import">
        <summary>Import a world</summary>
        <div className="wfc-project-import-body">
          <p>
            Choose a Fingerprint Worlds JSON file or paste its contents. Files
            are checked before anything is added to your library.
          </p>
          <label className="wfc-project-file">
            <span>Choose JSON file</span>
            <input
              accept=".json,application/json"
              onChange={(event) => void readImportFile(event)}
              type="file"
            />
          </label>
          <label className="wfc-project-field" htmlFor={importId}>
            <span>World JSON</span>
            <textarea
              id={importId}
              onChange={(event) => setImportText(event.target.value)}
              placeholder='Paste a "fingerprint-world-export" file here'
              rows="7"
              spellCheck="false"
              value={importText}
            />
          </label>
          <button
            className="wfc-project-button wfc-project-button--primary"
            disabled={!importText.trim()}
            onClick={importProject}
            type="button"
          >
            Validate and import
          </button>
        </div>
      </details>

      <p
        aria-atomic="true"
        aria-live="polite"
        className={`wfc-project-status is-${feedback.tone}`}
        key={feedback.sequence}
        role="status"
      >
        {feedback.message}
      </p>
    </aside>
  );
}

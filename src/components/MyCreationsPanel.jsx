import { useEffect, useId, useMemo, useRef, useState } from "react";

import {
  CREATIVE_GALLERY_STATUS,
  createCreativeGalleryStore,
} from "../creativeGallery.js";
import {
  deleteCreativeAsset,
  readCreativeAsset,
} from "../creativeAssetStorage.js";
import {
  MY_CREATION_KINDS,
  MY_CREATIONS_SOURCE_STATUS,
  createMyCreationItems,
  filterMyCreationItems,
  persistWorldCreationLibrary,
  readMyCreationLibraries,
  renameWorldCreation,
} from "../myCreationsModel.js";
import {
  exportWfcWorldSnapshotJSON,
  removeWfcWorldSnapshot,
} from "../wfc/wfcWorldPersistence.js";

import "./MyCreationsPanel.css";

const FILTERS = [
  { id: "all", label: "All" },
  { id: MY_CREATION_KINDS.LIGHT_PAINTING, label: "Light Paintings" },
  { id: MY_CREATION_KINDS.WORLD, label: "Worlds" },
];

function resolveStorage(storage) {
  if (storage !== undefined) {
    return storage;
  }
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function formatDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "Date unavailable";
  }
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year:
      date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

function safeFileName(value, fallback) {
  const name = String(value ?? "")
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 56);
  return name || fallback;
}

function downloadBlob(blob, fileName) {
  if (
    typeof document === "undefined" ||
    typeof URL === "undefined" ||
    typeof URL.createObjectURL !== "function"
  ) {
    return false;
  }
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

function isDurablySaved(status) {
  return status === CREATIVE_GALLERY_STATUS.SAVED;
}

function getSourceNotice(creativeStatus, worldStatus) {
  const statuses = [creativeStatus, worldStatus];
  if (statuses.includes(MY_CREATIONS_SOURCE_STATUS.UNSUPPORTED)) {
    return {
      tone: "warning",
      message:
        "Some creations were saved by a newer app version. They are left untouched, but cannot be managed here.",
    };
  }
  if (statuses.includes(MY_CREATIONS_SOURCE_STATUS.INVALID)) {
    return {
      tone: "warning",
      message:
        "Some saved creation metadata could not be read. Existing browser data has not been overwritten.",
    };
  }
  if (statuses.includes(MY_CREATIONS_SOURCE_STATUS.UNAVAILABLE)) {
    return {
      tone: "warning",
      message:
        "Browser storage is unavailable. Creations may only remain for this session.",
    };
  }
  if (statuses.includes(MY_CREATIONS_SOURCE_STATUS.RECOVERED)) {
    return {
      tone: "neutral",
      message:
        "Readable creations were recovered. A few invalid metadata fields were skipped.",
    };
  }
  return null;
}

export default function MyCreationsPanel({
  onClose,
  onOpenMode,
  storage,
}) {
  const headingId = useId();
  const searchId = useId();
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const resolvedStorageRef = useRef(resolveStorage(storage));
  const galleryStoreRef = useRef(null);
  if (!galleryStoreRef.current) {
    galleryStoreRef.current = createCreativeGalleryStore({
      storage: resolvedStorageRef.current,
    });
  }
  const initialReadRef = useRef(null);
  if (!initialReadRef.current) {
    initialReadRef.current = readMyCreationLibraries(
      resolvedStorageRef.current,
    );
  }

  const [galleryEntries, setGalleryEntries] = useState(() =>
    galleryStoreRef.current.list({ modeId: "gesture-art" }),
  );
  const [worldLibrary, setWorldLibrary] = useState(
    initialReadRef.current.worldLibrary,
  );
  const [creativeStatus, setCreativeStatus] = useState(
    initialReadRef.current.creativeStatus,
  );
  const [worldStatus, setWorldStatus] = useState(
    initialReadRef.current.worldStatus,
  );
  const [activeFilter, setActiveFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [editingKey, setEditingKey] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [pendingDeleteKey, setPendingDeleteKey] = useState(null);
  const [busyKey, setBusyKey] = useState(null);
  const [feedback, setFeedback] = useState({
    tone: "neutral",
    message: "Your saved work stays in this browser until you export or delete it.",
  });

  useEffect(
    () =>
      galleryStoreRef.current.subscribe((gallery) => {
        setGalleryEntries(
          gallery.entries.filter((entry) => entry.modeId === "gesture-art"),
        );
      }),
    [],
  );

  useEffect(() => {
    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const items = useMemo(
    () =>
      createMyCreationItems({
        galleryEntries,
        worldSnapshots: worldLibrary.snapshots,
      }),
    [galleryEntries, worldLibrary.snapshots],
  );
  const filteredItems = useMemo(
    () =>
      filterMyCreationItems(items, {
        kind: activeFilter,
        query,
      }),
    [activeFilter, items, query],
  );
  const lightPaintingCount = items.filter(
    (item) => item.kind === MY_CREATION_KINDS.LIGHT_PAINTING,
  ).length;
  const worldCount = items.length - lightPaintingCount;
  const sourceNotice = getSourceNotice(creativeStatus, worldStatus);

  function announce(message, tone = "neutral") {
    setFeedback({ message, tone });
  }

  function handleDialogKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose?.();
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) {
      return;
    }
    const focusable = [
      ...dialogRef.current.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ),
    ].filter((element) => !element.hidden);
    if (focusable.length === 0) {
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function beginRename(item) {
    setPendingDeleteKey(null);
    setEditingKey(item.key);
    setEditingTitle(item.title);
  }

  function cancelRename() {
    setEditingKey(null);
    setEditingTitle("");
    closeButtonRef.current?.focus();
  }

  function submitRename(event, item) {
    event.preventDefault();
    const nextTitle = editingTitle.trim();
    if (!nextTitle) {
      announce("Give this creation a name before saving.", "warning");
      return;
    }

    if (item.kind === MY_CREATION_KINDS.LIGHT_PAINTING) {
      const result = galleryStoreRef.current.rename(item.sourceId, nextTitle);
      if (!result.ok) {
        announce("That Light Painting could not be renamed.", "warning");
        return;
      }
      setCreativeStatus(
        isDurablySaved(result.persistenceStatus)
          ? MY_CREATIONS_SOURCE_STATUS.READY
          : MY_CREATIONS_SOURCE_STATUS.UNAVAILABLE,
      );
      announce(
        isDurablySaved(result.persistenceStatus)
          ? `Renamed to “${result.entry.title}”.`
          : `Renamed to “${result.entry.title}” for this session. Browser storage could not be updated.`,
        isDurablySaved(result.persistenceStatus) ? "success" : "warning",
      );
    } else {
      const result = renameWorldCreation(
        worldLibrary,
        item.sourceId,
        nextTitle,
      );
      if (!result.ok) {
        announce(
          result.errors?.[0] ?? "That world could not be renamed.",
          "warning",
        );
        return;
      }
      setWorldLibrary(result.library);
      const persisted = persistWorldCreationLibrary(
        resolvedStorageRef.current,
        result.library,
      );
      setWorldStatus(
        persisted.ok
          ? MY_CREATIONS_SOURCE_STATUS.READY
          : MY_CREATIONS_SOURCE_STATUS.UNAVAILABLE,
      );
      announce(
        persisted.ok
          ? `Renamed to “${result.snapshot.name}” and saved as revision ${result.snapshot.revision}.`
          : `Renamed to “${result.snapshot.name}” for this session. Browser storage could not be updated.`,
        persisted.ok ? "success" : "warning",
      );
    }
    cancelRename();
  }

  async function deleteItem(item) {
    if (pendingDeleteKey !== item.key) {
      setEditingKey(null);
      setPendingDeleteKey(item.key);
      announce(
        `Press Confirm delete to permanently remove “${item.title}” from this browser.`,
        "warning",
      );
      return;
    }

    setBusyKey(item.key);
    if (item.kind === MY_CREATION_KINDS.LIGHT_PAINTING) {
      const reference = item.value.dataRef;
      const referenceIsShared = galleryEntries.some(
        (entry) =>
          entry.id !== item.sourceId &&
          entry.dataRef?.kind === reference?.kind &&
          entry.dataRef?.key === reference?.key,
      );
      const result = galleryStoreRef.current.delete(item.sourceId);
      if (!result.ok) {
        announce("That Light Painting could not be deleted.", "warning");
      } else {
        const persisted = isDurablySaved(result.persistenceStatus);
        let assetCleared = true;
        if (
          persisted &&
          reference &&
          reference.availability !== "unresolved" &&
          !referenceIsShared
        ) {
          try {
            assetCleared = await deleteCreativeAsset(reference);
          } catch {
            assetCleared = false;
          }
        }
        setCreativeStatus(
          persisted
            ? MY_CREATIONS_SOURCE_STATUS.READY
            : MY_CREATIONS_SOURCE_STATUS.UNAVAILABLE,
        );
        announce(
          persisted && assetCleared
            ? `Deleted “${item.title}” from this browser.`
            : persisted
              ? `Removed “${item.title}” from the gallery, but its saved image could not be cleared.`
              : `Removed “${item.title}” for this session. Browser storage could not be updated, so its saved image was left intact.`,
          persisted && assetCleared ? "success" : "warning",
        );
      }
    } else {
      const result = removeWfcWorldSnapshot(worldLibrary, item.sourceId);
      if (!result.ok) {
        announce(
          result.errors?.[0] ?? "That world could not be deleted.",
          "warning",
        );
      } else {
        setWorldLibrary(result.library);
        const persisted = persistWorldCreationLibrary(
          resolvedStorageRef.current,
          result.library,
        );
        setWorldStatus(
          persisted.ok
            ? MY_CREATIONS_SOURCE_STATUS.READY
            : MY_CREATIONS_SOURCE_STATUS.UNAVAILABLE,
        );
        announce(
          persisted.ok
            ? `Deleted “${item.title}” from this browser.`
            : `Removed “${item.title}” for this session. Browser storage could not be updated.`,
          persisted.ok ? "success" : "warning",
        );
      }
    }
    setPendingDeleteKey(null);
    setBusyKey(null);
    closeButtonRef.current?.focus();
  }

  async function exportItem(item) {
    setBusyKey(item.key);
    if (item.kind === MY_CREATION_KINDS.LIGHT_PAINTING) {
      try {
        const blob = await readCreativeAsset(item.value.dataRef);
        if (!blob) {
          announce(
            "The saved image is not available in this browser. Its gallery metadata is still intact.",
            "warning",
          );
        } else {
          const extension = blob.type === "image/webp" ? "webp" : "png";
          const downloaded = downloadBlob(
            blob,
            `${safeFileName(item.title, "light-painting")}.${extension}`,
          );
          announce(
            downloaded
              ? `Exported “${item.title}”.`
              : "This browser could not start the image download.",
            downloaded ? "success" : "warning",
          );
        }
      } catch {
        announce(
          "The saved image could not be opened from browser storage.",
          "warning",
        );
      }
    } else {
      const exported = exportWfcWorldSnapshotJSON(item.value, {
        exportedAt: new Date().toISOString(),
      });
      if (!exported.ok) {
        announce(
          exported.errors?.[0] ?? "That world could not be exported.",
          "warning",
        );
      } else {
        const downloaded = downloadBlob(
          new Blob([exported.json], { type: "application/json" }),
          `${safeFileName(item.title, "fingerprint-world")}.fingerprint-world.json`,
        );
        announce(
          downloaded
            ? `Exported “${item.title}” as a restorable world file.`
            : "This browser could not start the world download.",
          downloaded ? "success" : "warning",
        );
      }
    }
    setBusyKey(null);
  }

  function openItem(item) {
    onOpenMode?.(item.modeId);
  }

  function clearFilters() {
    setActiveFilter("all");
    setQuery("");
  }

  return (
    <div
      className="my-creations-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <section
        aria-labelledby={headingId}
        aria-modal="true"
        className="my-creations-dialog"
        onKeyDown={handleDialogKeyDown}
        ref={dialogRef}
        role="dialog"
      >
        <header className="my-creations-header">
          <div>
            <span className="my-creations-kicker">Your local creative shelf</span>
            <h2 id={headingId}>My Creations</h2>
            <p>
              Browse Light Paintings and Fingerprint Worlds saved in this
              browser.
            </p>
          </div>
          <div className="my-creations-header-actions">
            <span className="my-creations-local-chip">
              <span aria-hidden="true">●</span> Local only
            </span>
            <button
              aria-label="Close My Creations"
              className="my-creations-close"
              onClick={onClose}
              ref={closeButtonRef}
              type="button"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </header>

        <div className="my-creations-toolbar">
          <label htmlFor={searchId}>
            <span className="my-creations-sr-only">Search creations</span>
            <input
              id={searchId}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search your creations"
              type="search"
              value={query}
            />
          </label>
          <div
            aria-label="Filter creations"
            className="my-creations-filters"
            role="group"
          >
            {FILTERS.map((filter) => (
              <button
                aria-pressed={activeFilter === filter.id}
                className={activeFilter === filter.id ? "is-active" : ""}
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                type="button"
              >
                {filter.label}
              </button>
            ))}
          </div>
          <p className="my-creations-count">
            {lightPaintingCount}{" "}
            {lightPaintingCount === 1 ? "painting" : "paintings"} ·{" "}
            {worldCount} {worldCount === 1 ? "world" : "worlds"}
          </p>
        </div>

        {sourceNotice ? (
          <div
            className={`my-creations-notice ${sourceNotice.tone}`}
            role="note"
          >
            {sourceNotice.message}
          </div>
        ) : null}

        <div className="my-creations-content">
          {items.length === 0 ? (
            <div className="my-creations-empty">
              <span aria-hidden="true">✦</span>
              <h3>Your creative shelf is ready.</h3>
              <p>
                Save a Light Painting or a Fingerprint World and it will appear
                here on this device.
              </p>
              <div>
                <button
                  onClick={() => onOpenMode?.("gesture-art")}
                  type="button"
                >
                  Create a Light Painting
                </button>
                <button
                  onClick={() => onOpenMode?.("world-painter")}
                  type="button"
                >
                  Create a World
                </button>
              </div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="my-creations-empty compact">
              <h3>No creations match.</h3>
              <p>Try a different search or show every creation.</p>
              <button onClick={clearFilters} type="button">
                Clear filters
              </button>
            </div>
          ) : (
            <div
              aria-label={`${filteredItems.length} saved ${
                filteredItems.length === 1 ? "creation" : "creations"
              }`}
              className="my-creations-grid"
              role="list"
            >
              {filteredItems.map((item) => {
                const editing = editingKey === item.key;
                const confirmingDelete = pendingDeleteKey === item.key;
                const busy = busyKey === item.key;
                const gradient = `linear-gradient(135deg, ${item.palette.join(
                  ", ",
                )})`;

                return (
                  <article
                    className={`my-creation-card ${item.kind}`}
                    key={item.key}
                    role="listitem"
                  >
                    <div
                      aria-hidden="true"
                      className="my-creation-preview"
                      style={{ background: gradient }}
                    >
                      <span>
                        {item.kind === MY_CREATION_KINDS.WORLD ? "◇" : "✦"}
                      </span>
                    </div>
                    <div className="my-creation-copy">
                      <div className="my-creation-heading">
                        <span>{item.typeLabel}</span>
                        <time dateTime={item.updatedAt}>
                          {formatDate(item.updatedAt)}
                        </time>
                      </div>

                      {editing ? (
                        <form
                          className="my-creation-rename"
                          onSubmit={(event) => submitRename(event, item)}
                        >
                          <label>
                            <span>Creation name</span>
                            <input
                              autoFocus
                              maxLength={
                                item.kind === MY_CREATION_KINDS.WORLD ? 64 : 80
                              }
                              onChange={(event) =>
                                setEditingTitle(event.target.value)
                              }
                              value={editingTitle}
                            />
                          </label>
                          <div>
                            <button className="primary" type="submit">
                              Save name
                            </button>
                            <button onClick={cancelRename} type="button">
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <h3>{item.title}</h3>
                          <p>{item.description}</p>
                          <small>{item.metadataLabel}</small>
                          <span className="my-creation-open-note">
                            {item.kind === MY_CREATION_KINDS.WORLD
                              ? "Restore this revision from World Painter’s project library."
                              : "Export downloads this image; Light Painting opens with a new canvas."}
                          </span>
                        </>
                      )}
                    </div>

                    {!editing ? (
                      <div className="my-creation-actions">
                        <button
                          className="primary"
                          onClick={() => openItem(item)}
                          type="button"
                        >
                          {item.kind === MY_CREATION_KINDS.WORLD
                            ? "Open World Painter"
                            : "Open Light Painting"}
                        </button>
                        <button onClick={() => beginRename(item)} type="button">
                          Rename
                        </button>
                        <button
                          disabled={!item.canExport || busy}
                          onClick={() => void exportItem(item)}
                          title={
                            item.canExport
                              ? undefined
                              : "Image content is not available in this browser"
                          }
                          type="button"
                        >
                          {busy ? "Working…" : "Export"}
                        </button>
                        <button
                          aria-label={`${
                            confirmingDelete ? "Confirm deletion of" : "Delete"
                          } ${item.title}`}
                          className={confirmingDelete ? "danger" : ""}
                          disabled={busy}
                          onClick={() => void deleteItem(item)}
                          type="button"
                        >
                          {confirmingDelete ? "Confirm delete" : "Delete"}
                        </button>
                        {confirmingDelete ? (
                          <button
                            onClick={() => setPendingDeleteKey(null)}
                            type="button"
                          >
                            Cancel
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div
          aria-atomic="true"
          aria-live="polite"
          className={`my-creations-feedback ${feedback.tone}`}
          role="status"
        >
          {feedback.message}
        </div>
      </section>
    </div>
  );
}

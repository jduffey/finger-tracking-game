import { Suspense, lazy, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { getModeById } from "../modeRegistry.js";

const MyCreationsPanel = lazy(() => import("./MyCreationsPanel.jsx"));

export default function MyCreationsLauncher({ onSelectMode }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);

  function close({ restoreFocus = true } = {}) {
    setOpen(false);
    if (!restoreFocus) {
      return;
    }
    const restore = () => buttonRef.current?.focus();
    if (typeof globalThis.requestAnimationFrame === "function") {
      globalThis.requestAnimationFrame(restore);
    } else {
      restore();
    }
  }

  function openMode(modeId) {
    const mode = getModeById(modeId);
    if (!mode) {
      return;
    }
    close({ restoreFocus: false });
    onSelectMode?.(mode);
  }

  const panel =
    open && typeof document !== "undefined"
      ? createPortal(
          <Suspense
            fallback={
              <div
                aria-live="polite"
                className="product-home-creations-loading"
                role="status"
              >
                Opening My Creations…
              </div>
            }
          >
            <MyCreationsPanel
              onClose={() => close()}
              onOpenMode={openMode}
            />
          </Suspense>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Open My Creations"
        className="product-home-icon-button product-home-creations-button"
        onClick={() => setOpen(true)}
        ref={buttonRef}
        type="button"
      >
        <span aria-hidden="true">✦</span>
        <span className="product-home-creations-label">My creations</span>
      </button>
      {panel}
    </>
  );
}

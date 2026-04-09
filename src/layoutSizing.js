export const RESIZABLE_LEFT_PANE_MIN_WIDTH_PX = 280;
export const RESIZABLE_RIGHT_PANE_MIN_WIDTH_PX = 280;
export const RESIZABLE_LEFT_PANE_HANDLE_WIDTH_PX = 18;

export function clampResizableLeftPaneWidth(
  requestedWidth,
  containerWidth,
  {
    handleWidth = RESIZABLE_LEFT_PANE_HANDLE_WIDTH_PX,
    minLeftPaneWidth = RESIZABLE_LEFT_PANE_MIN_WIDTH_PX,
    minRightPaneWidth = RESIZABLE_RIGHT_PANE_MIN_WIDTH_PX,
  } = {},
) {
  const safeContainerWidth = Number.isFinite(containerWidth)
    ? containerWidth
    : minLeftPaneWidth + minRightPaneWidth + handleWidth;
  const safeRequestedWidth = Number.isFinite(requestedWidth)
    ? requestedWidth
    : minLeftPaneWidth;
  const maxWidth = Math.max(
    minLeftPaneWidth,
    safeContainerWidth - minRightPaneWidth - handleWidth,
  );

  return Math.min(Math.max(safeRequestedWidth, minLeftPaneWidth), maxWidth);
}

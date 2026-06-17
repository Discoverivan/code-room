import { type CSSProperties, useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { drawSelection, EditorView, highlightActiveLine, keymap, lineNumbers } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { yCollab } from "y-codemirror.next";
import type { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";
import type { Theme } from "./App";

type CursorPosition = { line: number; column: number };
type RemoteLabelPlacement = { rect: DOMRect };

function rectsOverlap(first: DOMRect, second: DOMRect, padding = 0) {
  return first.left - padding < second.right &&
    first.right + padding > second.left &&
    first.top - padding < second.bottom &&
    first.bottom + padding > second.top;
}

function moveRect(rect: DOMRect, y: number) {
  return new DOMRect(rect.x, rect.y + y, rect.width, rect.height);
}

export function Editor({
  document,
  provider,
  theme,
  localCursorColor,
  showRemoteNames,
  onCursor
}: {
  document: Y.Doc;
  provider: WebsocketProvider;
  theme: Theme;
  localCursorColor: string;
  showRemoteNames: boolean;
  onCursor: (position: CursorPosition) => void;
}) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;
    const text = document.getText("content");
    const state = EditorState.create({
      doc: text.toString(),
      extensions: [
        lineNumbers(),
        history(),
        drawSelection(),
        highlightActiveLine(),
        keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
        yCollab(text, provider.awareness, { undoManager: new Y.UndoManager(text) }),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (!update.selectionSet && !update.docChanged) return;
          scheduleRemoteLabelLayout();
          const head = update.state.selection.main.head;
          const line = update.state.doc.lineAt(head);
          onCursor({ line: line.number, column: head - line.from + 1 });
        })
      ]
    });
    const view = new EditorView({ state, parent: container.current });
    let hoveredRemoteCaret: Element | null = null;
    let layoutFrame = 0;
    const clearRemoteLabelLayout = () => {
      view.dom.querySelectorAll<HTMLElement>(".cm-ySelectionInfo").forEach((label) => {
        label.style.removeProperty("--remote-label-offset");
        label.closest(".cm-ySelectionCaret")?.classList.remove("remote-cursor-label-near-local");
      });
    };
    const layoutRemoteLabels = () => {
      layoutFrame = 0;
      if (!container.current?.classList.contains("remote-cursor-names")) {
        clearRemoteLabelLayout();
        return;
      }
      const labels = [...view.dom.querySelectorAll<HTMLElement>(".cm-ySelectionInfo")];
      const localRects = [...view.dom.querySelectorAll<HTMLElement>(".cm-cursor, .cm-selectionBackground")]
        .flatMap((element) => [...element.getClientRects()])
        .filter((rect) => rect.width > 0 || rect.height > 0);
      const placed: RemoteLabelPlacement[] = [];
      labels
        .sort((first, second) => first.getBoundingClientRect().top - second.getBoundingClientRect().top)
        .forEach((label) => {
          label.style.removeProperty("--remote-label-offset");
          label.closest(".cm-ySelectionCaret")?.classList.remove("remote-cursor-label-near-local");
          const rect = label.getBoundingClientRect();
          let offset = 0;
          while (placed.some((placement) => rectsOverlap(moveRect(rect, offset), placement.rect, 4))) {
            offset += rect.height + 4;
          }
          if (offset > 0) label.style.setProperty("--remote-label-offset", `${offset}px`);
          const placedRect = moveRect(rect, offset);
          placed.push({ rect: placedRect });
          if (localRects.some((localRect) => rectsOverlap(placedRect, localRect, 6))) {
            label.closest(".cm-ySelectionCaret")?.classList.add("remote-cursor-label-near-local");
          }
        });
    };
    const scheduleRemoteLabelLayout = () => {
      if (!layoutFrame) layoutFrame = window.requestAnimationFrame(layoutRemoteLabels);
    };
    const updateHoveredRemoteLabel = (event: MouseEvent) => {
      if (!container.current?.classList.contains("remote-cursor-names")) {
        hoveredRemoteCaret?.classList.remove("remote-cursor-label-hover");
        hoveredRemoteCaret = null;
        return;
      }
      const hoverPadding = 10;
      const labels = view.dom.querySelectorAll(".cm-ySelectionInfo");
      const label = [...labels].find((element) => {
        const rect = element.getBoundingClientRect();
        return event.clientX >= rect.left - hoverPadding &&
          event.clientX <= rect.right + hoverPadding &&
          event.clientY >= rect.top - hoverPadding &&
          event.clientY <= rect.bottom + hoverPadding;
      });
      const caret = label?.closest(".cm-ySelectionCaret") ?? null;
      if (caret === hoveredRemoteCaret) return;
      hoveredRemoteCaret?.classList.remove("remote-cursor-label-hover");
      caret?.classList.add("remote-cursor-label-hover");
      hoveredRemoteCaret = caret;
    };
    const clearHoveredRemoteLabel = () => {
      hoveredRemoteCaret?.classList.remove("remote-cursor-label-hover");
      hoveredRemoteCaret = null;
    };
    view.dom.addEventListener("mousemove", updateHoveredRemoteLabel);
    view.dom.addEventListener("mouseleave", clearHoveredRemoteLabel);
    view.scrollDOM.addEventListener("scroll", scheduleRemoteLabelLayout);
    provider.awareness.on("change", scheduleRemoteLabelLayout);
    window.addEventListener("resize", scheduleRemoteLabelLayout);
    scheduleRemoteLabelLayout();
    onCursor({ line: 1, column: 1 });
    return () => {
      if (layoutFrame) window.cancelAnimationFrame(layoutFrame);
      view.dom.removeEventListener("mousemove", updateHoveredRemoteLabel);
      view.dom.removeEventListener("mouseleave", clearHoveredRemoteLabel);
      view.scrollDOM.removeEventListener("scroll", scheduleRemoteLabelLayout);
      provider.awareness.off("change", scheduleRemoteLabelLayout);
      window.removeEventListener("resize", scheduleRemoteLabelLayout);
      view.destroy();
    };
  }, [document, provider, theme, onCursor]);

  return (
    <div
      className={`editor${showRemoteNames ? " remote-cursor-names" : ""}`}
      ref={container}
      style={{ "--local-cursor": localCursorColor } as CSSProperties}
    />
  );
}

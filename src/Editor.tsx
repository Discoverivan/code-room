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
type RemoteCaretGroup = { caret: Element; rect: DOMRect };

function rectsOverlap(first: DOMRect, second: DOMRect, padding = 0) {
  return first.left - padding < second.right &&
    first.right + padding > second.left &&
    first.top - padding < second.bottom &&
    first.bottom + padding > second.top;
}

function rectContainsPoint(rect: DOMRect, x: number, y: number, padding = 0) {
  return x >= rect.left - padding &&
    x <= rect.right + padding &&
    y >= rect.top - padding &&
    y <= rect.bottom + padding;
}

function moveRect(rect: DOMRect, y: number) {
  return new DOMRect(rect.x, rect.y + y, rect.width, rect.height);
}

function caretPositionRect(caret: Element) {
  const dot = caret.querySelector(".cm-ySelectionCaretDot");
  const dotRect = dot?.getBoundingClientRect();
  if (dotRect && (dotRect.width > 1 || dotRect.height > 1)) return dotRect;
  const caretRect = caret.getBoundingClientRect();
  if (caretRect.width > 1 || caretRect.height > 1) return caretRect;
  const labelRect = caret.querySelector(".cm-ySelectionInfo")?.getBoundingClientRect();
  return labelRect ? new DOMRect(labelRect.left, labelRect.bottom - 8, 8, 8) : caretRect;
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
    let hoveredRemoteCarets: Element[] = [];
    let layoutFrame = 0;
    const setHoveredRemoteCarets = (carets: Element[]) => {
      hoveredRemoteCarets.forEach((caret) => caret.classList.remove(
        "remote-cursor-label-hover",
        "remote-cursor-label-group-hover"
      ));
      carets.forEach((caret) => caret.classList.add(
        container.current?.classList.contains("remote-cursor-names")
          ? "remote-cursor-label-hover"
          : "remote-cursor-label-group-hover"
      ));
      hoveredRemoteCarets = carets;
      scheduleRemoteLabelLayout();
    };
    const clearRemoteLabelLayout = () => {
      view.dom.querySelectorAll<HTMLElement>(".cm-ySelectionInfo").forEach((label) => {
        label.style.removeProperty("--remote-label-offset");
        label.closest(".cm-ySelectionCaret")?.classList.remove("remote-cursor-label-near-local");
      });
    };
    const layoutRemoteLabels = () => {
      layoutFrame = 0;
      const isNameMode = container.current?.classList.contains("remote-cursor-names");
      const visibleLabels = isNameMode
        ? view.dom.querySelectorAll<HTMLElement>(".cm-ySelectionInfo")
        : view.dom.querySelectorAll<HTMLElement>(".remote-cursor-label-group-hover > .cm-ySelectionInfo");
      if (!isNameMode && visibleLabels.length === 0) {
        clearRemoteLabelLayout();
        return;
      }
      const labels = [...visibleLabels];
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
      const isNameMode = container.current?.classList.contains("remote-cursor-names");
      const hoverPadding = isNameMode ? 10 : 18;
      const caret = isNameMode
        ? [...view.dom.querySelectorAll(".cm-ySelectionInfo")]
          .find((label) => rectContainsPoint(label.getBoundingClientRect(), event.clientX, event.clientY, hoverPadding))
          ?.closest(".cm-ySelectionCaret") ?? null
        : [...view.dom.querySelectorAll(".cm-ySelectionCaret")]
          .find((remoteCaret) => rectContainsPoint(caretPositionRect(remoteCaret), event.clientX, event.clientY, hoverPadding)) ?? null;
      if (!caret) {
        if (hoveredRemoteCarets.length > 0) setHoveredRemoteCarets([]);
        return;
      }
      if (isNameMode) {
        if (hoveredRemoteCarets.length === 1 && hoveredRemoteCarets[0] === caret) return;
        setHoveredRemoteCarets([caret]);
        return;
      }
      const rect = caretPositionRect(caret);
      const groupedCarets = [...view.dom.querySelectorAll(".cm-ySelectionCaret")]
        .map((remoteCaret): RemoteCaretGroup => ({ caret: remoteCaret, rect: caretPositionRect(remoteCaret) }))
        .filter((group) => rectsOverlap(rect, group.rect, 4))
        .map((group) => group.caret);
      if (
        groupedCarets.length === hoveredRemoteCarets.length &&
        groupedCarets.every((groupedCaret) => hoveredRemoteCarets.includes(groupedCaret))
      ) return;
      setHoveredRemoteCarets(groupedCarets);
    };
    const clearHoveredRemoteLabel = () => {
      setHoveredRemoteCarets([]);
    };
    const handleEditorModeChange = () => {
      setHoveredRemoteCarets([]);
      scheduleRemoteLabelLayout();
    };
    const classObserver = new MutationObserver(handleEditorModeChange);
    classObserver.observe(container.current, { attributeFilter: ["class"] });
    view.scrollDOM.addEventListener("pointermove", updateHoveredRemoteLabel);
    view.scrollDOM.addEventListener("mousemove", updateHoveredRemoteLabel);
    view.scrollDOM.addEventListener("pointerleave", clearHoveredRemoteLabel);
    view.scrollDOM.addEventListener("mouseleave", clearHoveredRemoteLabel);
    view.scrollDOM.addEventListener("scroll", scheduleRemoteLabelLayout);
    provider.awareness.on("change", scheduleRemoteLabelLayout);
    window.addEventListener("resize", scheduleRemoteLabelLayout);
    scheduleRemoteLabelLayout();
    onCursor({ line: 1, column: 1 });
    return () => {
      if (layoutFrame) window.cancelAnimationFrame(layoutFrame);
      classObserver.disconnect();
      view.scrollDOM.removeEventListener("pointermove", updateHoveredRemoteLabel);
      view.scrollDOM.removeEventListener("mousemove", updateHoveredRemoteLabel);
      view.scrollDOM.removeEventListener("pointerleave", clearHoveredRemoteLabel);
      view.scrollDOM.removeEventListener("mouseleave", clearHoveredRemoteLabel);
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

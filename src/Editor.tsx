import { type CSSProperties, useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { drawSelection, EditorView, highlightActiveLine, keymap, lineNumbers } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { yCollab } from "y-codemirror.next";
import type { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";
import type { Theme } from "./App";

type CursorPosition = { line: number; column: number };

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
          const head = update.state.selection.main.head;
          const line = update.state.doc.lineAt(head);
          onCursor({ line: line.number, column: head - line.from + 1 });
        })
      ]
    });
    const view = new EditorView({ state, parent: container.current });
    let hoveredRemoteCaret: Element | null = null;
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
    onCursor({ line: 1, column: 1 });
    return () => {
      view.dom.removeEventListener("mousemove", updateHoveredRemoteLabel);
      view.dom.removeEventListener("mouseleave", clearHoveredRemoteLabel);
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

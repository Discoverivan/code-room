import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { drawSelection, EditorView, highlightActiveLine, keymap, lineNumbers } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { yCollab } from "y-codemirror.next";
import type { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";
import type { Theme } from "./App";

type CursorPosition = { line: number; column: number };

export function Editor({
  document,
  provider,
  theme,
  onCursor
}: {
  document: Y.Doc;
  provider: WebsocketProvider;
  theme: Theme;
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
        keymap.of([...defaultKeymap, ...historyKeymap]),
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
    onCursor({ line: 1, column: 1 });
    return () => view.destroy();
  }, [document, provider, theme, onCursor]);

  return <div className="editor" ref={container} />;
}

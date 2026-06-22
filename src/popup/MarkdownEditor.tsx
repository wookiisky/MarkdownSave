import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { basicSetup, EditorView } from "codemirror";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type ForwardedRef,
  type JSX
} from "react";

/** Markdown 编辑器对 App 暴露的稳定能力。 */
export interface MarkdownEditorHandle {
  /** 读取当前编辑器选中的 Markdown 文本，多选区用换行拼接。 */
  readSelectedText(): string;
  /** 判断当前编辑器是否存在非空选区。 */
  hasSelection(): boolean;
}

/** Markdown 编辑器组件参数。 */
export interface MarkdownEditorProps {
  /** 当前 Markdown 内容。 */
  value: string;
  /** Markdown 内容变更回调。 */
  onChange(value: string): void;
  /** 编辑器选区状态变更回调。 */
  onSelectionChange?(hasSelection: boolean): void;
  /** 无内容时展示的占位文案。 */
  placeholder: string;
  /** 稳定可访问名称，供 E2E 定位。 */
  ariaLabel: string;
  /** 外层容器 className。 */
  className?: string;
}

/** CodeMirror 6 Markdown 编辑器。 */
export const MarkdownEditor = forwardRef(function MarkdownEditor(
  props: MarkdownEditorProps,
  ref: ForwardedRef<MarkdownEditorHandle>
): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const valueRef = useRef(props.value);
  const onChangeRef = useRef(props.onChange);
  const onSelectionChangeRef = useRef(props.onSelectionChange);

  onChangeRef.current = props.onChange;
  onSelectionChangeRef.current = props.onSelectionChange;

  useImperativeHandle(ref, () => ({
    readSelectedText() {
      const view = viewRef.current;

      if (view === null) {
        return "";
      }

      return view.state.selection.ranges
        .filter((range) => !range.empty)
        .map((range) => view.state.sliceDoc(range.from, range.to))
        .join("\n");
    },
    hasSelection() {
      const view = viewRef.current;

      return view !== null && view.state.selection.ranges.some((range) => !range.empty);
    }
  }));

  useEffect(() => {
    const parent = containerRef.current;

    if (parent === null) {
      return;
    }

    const view = new EditorView({
      state: EditorState.create({
        doc: valueRef.current,
        extensions: [
          basicSetup,
          markdown(),
          EditorView.lineWrapping,
          markdownEditorTheme,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              const nextValue = update.state.doc.toString();
              valueRef.current = nextValue;
              onChangeRef.current(nextValue);
            }

            if (update.selectionSet || update.docChanged) {
              onSelectionChangeRef.current?.(
                update.state.selection.ranges.some((range) => !range.empty)
              );
            }
          })
        ]
      }),
      parent
    });

    viewRef.current = view;
    onSelectionChangeRef.current?.(view.state.selection.ranges.some((range) => !range.empty));

    return () => {
      view.destroy();

      if (viewRef.current === view) {
        viewRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;

    if (view === null || valueRef.current === props.value) {
      return;
    }

    valueRef.current = props.value;
    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: props.value
      }
    });
    onSelectionChangeRef.current?.(view.state.selection.ranges.some((range) => !range.empty));
  }, [props.value]);

  return (
    <div
      aria-label={props.ariaLabel}
      className={props.className}
      data-placeholder={props.placeholder}
      ref={containerRef}
      role="textbox"
      spellCheck={false}
    />
  );
});

/** CodeMirror 主题，限制在 popup 编辑器内部。 */
const markdownEditorTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "12px"
  },
  ".cm-scroller": {
    height: "100%",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    lineHeight: "1.5"
  },
  ".cm-content": {
    padding: "10px"
  }
});

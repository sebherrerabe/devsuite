import {
  MDXEditor,
  type MDXEditorMethods,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  linkPlugin,
  linkDialogPlugin,
  codeBlockPlugin,
  codeMirrorPlugin,
  markdownShortcutPlugin,
  toolbarPlugin,
  UndoRedo,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  CreateLink,
  InsertCodeBlock,
  ListsToggle,
  CodeToggle,
} from '@mdxeditor/editor';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface MDXMarkdownEditorProps {
  markdown: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  minHeight?: string;
  readOnly?: boolean;
  className?: string;
}

export const MDXMarkdownEditor = forwardRef<
  MDXEditorMethods,
  MDXMarkdownEditorProps
>(
  (
    { markdown, onChange, placeholder, minHeight, readOnly, className },
    ref
  ) => {
    const editorRef = useRef<MDXEditorMethods>(null);

    useImperativeHandle(ref, () => editorRef.current!);

    return (
      <div
        className={cn(
          'rounded-md border border-input bg-background',
          'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
          className
        )}
        style={{ minHeight }}
      >
        <MDXEditor
          ref={editorRef}
          markdown={markdown}
          onChange={onChange}
          placeholder={placeholder}
          readOnly={readOnly}
          className="mdxeditor"
          contentEditableClassName={cn(
            'focus:outline-none',
            'min-h-[200px] p-4',
            'text-foreground'
          )}
          plugins={[
            headingsPlugin({ allowedHeadingLevels: [1, 2, 3, 4, 5, 6] }),
            listsPlugin(),
            quotePlugin(),
            linkPlugin(),
            linkDialogPlugin(),
            codeBlockPlugin({ defaultCodeBlockLanguage: 'txt' }),
            codeMirrorPlugin({
              codeBlockLanguages: {
                txt: 'Plain Text',
                js: 'JavaScript',
                ts: 'TypeScript',
                jsx: 'JSX',
                tsx: 'TSX',
                json: 'JSON',
                css: 'CSS',
                html: 'HTML',
                md: 'Markdown',
                py: 'Python',
                sh: 'Shell',
              },
            }),
            markdownShortcutPlugin(),
            toolbarPlugin({
              toolbarContents: () => (
                <>
                  <UndoRedo />
                  <BoldItalicUnderlineToggles />
                  <CodeToggle />
                  <BlockTypeSelect />
                  <ListsToggle />
                  <CreateLink />
                  <InsertCodeBlock />
                </>
              ),
            }),
          ]}
        />
      </div>
    );
  }
);

MDXMarkdownEditor.displayName = 'MDXMarkdownEditor';

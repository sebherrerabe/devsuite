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
import {
  forwardRef,
  useImperativeHandle,
  useRef,
  type CSSProperties,
} from 'react';
import { cn } from '@/lib/utils';

export interface MDXMarkdownEditorProps {
  markdown: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  minHeight?: string;
  readOnly?: boolean;
  className?: string;
  variant?: 'default' | 'minimal';
}

export const MDXMarkdownEditor = forwardRef<
  MDXEditorMethods,
  MDXMarkdownEditorProps
>(
  (
    {
      markdown,
      onChange,
      placeholder,
      minHeight,
      readOnly,
      className,
      variant,
    },
    ref
  ) => {
    const editorRef = useRef<MDXEditorMethods>(null);
    const isMinimal = variant === 'minimal';

    useImperativeHandle(ref, () => editorRef.current!);

    return (
      <div
        className={cn(
          !isMinimal && 'rounded-md border border-input bg-background',
          !isMinimal &&
            'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
          className
        )}
        style={{
          minHeight,
          ...(isMinimal
            ? ({
                color: 'hsl(var(--foreground))',
                ['--mdx-editor-text-color' as string]: 'hsl(var(--foreground))',
                ['--mdx-editor-foreground' as string]: 'hsl(var(--foreground))',
                ['--mdx-editor-secondary-text-color' as string]:
                  'hsl(var(--muted-foreground))',
              } as CSSProperties)
            : {}),
        }}
      >
        <MDXEditor
          ref={editorRef}
          markdown={markdown}
          onChange={onChange}
          placeholder={placeholder}
          readOnly={readOnly}
          className={cn(
            'mdxeditor',
            isMinimal && 'text-[color:hsl(var(--foreground))]'
          )}
          contentEditableClassName={cn(
            'focus:outline-none',
            isMinimal
              ? 'min-h-[200px] p-0 text-[color:hsl(var(--foreground))] !text-foreground'
              : 'min-h-[200px] p-4',
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
            ...(isMinimal
              ? []
              : [
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
                ]),
          ]}
        />
      </div>
    );
  }
);

MDXMarkdownEditor.displayName = 'MDXMarkdownEditor';

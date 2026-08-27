import { useEditor, EditorContent, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Mention from '@tiptap/extension-mention'
import { Bold, Italic, List, ListOrdered, Heading2 } from 'lucide-react'
import { cn } from '#/utils/cn'
import { mentionSuggestion } from './MentionSuggestion'

export interface ContractPlaceholder {
    id: string
    label: string
}

export const CONTRACT_PLACEHOLDERS: ContractPlaceholder[] = [
    { id: 'reserver_name', label: 'Varaajan nimi' },
    { id: 'reserver_email', label: 'Varaajan sähköposti' },
    { id: 'resource_name', label: 'Resurssin nimi' },
    { id: 'start_time', label: 'Varausalkuaika' },
    { id: 'end_time', label: 'Varausloppuaika' },
    { id: 'total_price', label: 'Hinta yhteensä' },
]

interface ContractEditorProps {
    value: string
    onChange: (html: string) => void
}

/** Compact toolbar icon button with explicit active highlight */
function EditorButton({
    active,
    onClick,
    children,
    title,
}: {
    active?: boolean
    onClick: () => void
    children: React.ReactNode
    title?: string
}) {
    return (
        <button
            type="button"
            title={title}
            onMouseDown={(e) => {
                // Prevent button click from taking focus away from editor text selection
                e.preventDefault()
                onClick()
            }}
            className={cn(
                'p-1.5 rounded-sm transition-colors',
                active
                    ? 'bg-stone-300 dark:bg-stone-700 text-stone-950 dark:text-stone-50 font-bold'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200/60 dark:hover:bg-stone-800/60'
            )}
        >
            {children}
        </button>
    )
}

export function ContractEditor({ value, onChange }: ContractEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: {
                    levels: [2],
                },
            }),
            Mention.configure({
                HTMLAttributes: {
                    class:
                        'inline-flex items-center px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 text-xs font-mono font-semibold border border-amber-300 dark:border-amber-700 select-none',
                },
                suggestion: mentionSuggestion,
                renderText({ node }) {
                    return `[[${node.attrs.id}]]`
                },
                renderHTML({ node }) {
                    return [
                        'span',
                        {
                            'data-type': 'mention',
                            'data-id': node.attrs.id,
                            class:
                                'inline-flex items-center px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 text-xs font-mono font-semibold border border-amber-300 dark:border-amber-700 select-none',
                        },
                        `[[${node.attrs.id}]]`,
                    ]
                },
            })
        ],
        content: value,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML())
        },
        editorProps: {
            attributes: {
                class: cn(
                    'min-h-[300px] p-4 border-none outline-none focus:outline-none focus:ring-0 bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-stone-100',
                    '[&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-1 [&_h2]:text-stone-900 [&_h2]:dark:text-stone-100',
                    '[&_p]:my-1 [&_p]:leading-normal',
                    '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ul]:space-y-0.5',
                    '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_ol]:space-y-0.5',
                    '[&_li_p]:m-0 [&_li_p]:inline',
                    '[&_strong]:font-bold [&_em]:italic'
                ),
            },
        },
    })

    // Read active state directly from editor state selector to ensure active buttons react live
    const activeStates = useEditorState({
        editor,
        selector: (ctx) => ({
            isBold: ctx.editor.isActive('bold'),
            isItalic: ctx.editor.isActive('italic'),
            isH2: ctx.editor.isActive('heading', { level: 2 }),
            isBulletList: ctx.editor.isActive('bulletList'),
            isOrderedList: ctx.editor.isActive('orderedList'),
        }),
    })

    if (!editor) {
        return null
    }

    const insertPlaceholder = (id: string) => {
        editor
            .chain()
            .focus()
            .insertContent({
                type: 'mention',
                attrs: { id },
            })
            .run()
    }

    return (
        <div className="flex flex-col border border-stone-200 dark:border-stone-800 rounded-sm focus-within:border-stone-700 dark:focus-within:border-stone-600 transition-colors">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-0.5 p-1 bg-stone-100 dark:bg-stone-950 border-b border-stone-200 dark:border-stone-800 rounded-t-sm">
                <EditorButton
                    title="Lihavointi"
                    active={activeStates?.isBold}
                    onClick={() => editor.chain().focus().toggleBold().run()}
                >
                    <Bold size={16} />
                </EditorButton>

                <EditorButton
                    title="Kursiivi"
                    active={activeStates?.isItalic}
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                >
                    <Italic size={16} />
                </EditorButton>

                <EditorButton
                    title="Otsikko 2"
                    active={activeStates?.isH2}
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                >
                    <Heading2 size={16} />
                </EditorButton>

                <div className="w-px h-4 bg-stone-300 dark:bg-stone-800 mx-1" />

                <EditorButton
                    title="Luettelo"
                    active={activeStates?.isBulletList}
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                >
                    <List size={16} />
                </EditorButton>

                <EditorButton
                    title="Numeroitu luettelo"
                    active={activeStates?.isOrderedList}
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                >
                    <ListOrdered size={16} />
                </EditorButton>

                {/* Placeholder Variable Selector */}
                <div className="ml-auto flex items-center gap-1.5">
                    <select
                        defaultValue=""
                        onChange={(e) => {
                            if (e.target.value) {
                                insertPlaceholder(e.target.value)
                                e.target.value = ''
                            }
                        }}
                        className="px-2 py-1 text-xs bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-md text-stone-900 dark:text-stone-100"
                    >
                        <option value="" disabled>
                            Lisää yhdistetty kenttä
                        </option>
                        {CONTRACT_PLACEHOLDERS.map((ph) => (
                            <option key={ph.id} value={ph.id}>
                                {ph.label} ({`${ph.id}`})
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Editor Content Area */}
            <EditorContent editor={editor} />
        </div>
    )
}

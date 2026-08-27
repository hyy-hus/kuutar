import { useEditor, EditorContent, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Mention from '@tiptap/extension-mention'
import Link from '@tiptap/extension-link'
import { Bold, Italic, List, ListOrdered, Link as LinkIcon, Unlink } from 'lucide-react'
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
                    levels: [1, 2, 3],
                },
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-amber-600 dark:text-amber-400 underline font-medium hover:text-amber-700 dark:hover:text-amber-300',
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
            }),
        ],
        content: value,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML())
        },
        editorProps: {
            attributes: {
                class: cn(
                    'min-h-[300px] p-4 border-none outline-none focus:outline-none focus:ring-0 bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-stone-100',
                    // Headings
                    '[&_h1]:text-2xl [&_h1]:font-extrabold [&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-stone-900 [&_h1]:dark:text-stone-100',
                    '[&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-1 [&_h2]:text-stone-900 [&_h2]:dark:text-stone-100',
                    '[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-stone-900 [&_h3]:dark:text-stone-100',
                    // Paragraphs & Inline elements
                    '[&_p]:my-1 [&_p]:leading-normal',
                    '[&_a]:text-amber-600 [&_a]:dark:text-amber-400 [&_a]:underline',
                    // Lists & List items
                    '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ul]:space-y-0.5',
                    '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_ol]:space-y-0.5',
                    '[&_li_p]:m-0 [&_li_p]:inline',
                    // Formatting marks
                    '[&_strong]:font-bold [&_em]:italic'
                ),
            },
        },
    })

    const activeStates = useEditorState({
        editor,
        selector: (ctx) => ({
            isBold: ctx.editor.isActive('bold'),
            isItalic: ctx.editor.isActive('italic'),
            headingLevel: ctx.editor.isActive('heading', { level: 1 })
                ? '1'
                : ctx.editor.isActive('heading', { level: 2 })
                    ? '2'
                    : ctx.editor.isActive('heading', { level: 3 })
                        ? '3'
                        : 'paragraph',
            isBulletList: ctx.editor.isActive('bulletList'),
            isOrderedList: ctx.editor.isActive('orderedList'),
            isLink: ctx.editor.isActive('link'),
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

    const handleHeadingChange = (value: string) => {
        if (value === 'paragraph') {
            editor.chain().focus().setParagraph().run()
        } else {
            const level = Number(value) as 1 | 2 | 3
            editor.chain().focus().toggleHeading({ level }).run()
        }
    }

    const setLink = () => {
        const previousUrl = editor.getAttributes('link').href
        const url = window.prompt('Syötä osoite (URL):', previousUrl)

        if (url === null) return

        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run()
            return
        }

        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    }

    return (
        <div className="flex flex-col border border-stone-200 dark:border-stone-800 rounded-sm focus-within:border-stone-700 dark:focus-within:border-stone-600 transition-colors">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-0.5 p-1 bg-stone-100 dark:bg-stone-950 border-b border-stone-200 dark:border-stone-800 rounded-t-sm">
                {/* Heading Dropdown */}
                <select
                    value={activeStates?.headingLevel ?? 'paragraph'}
                    onChange={(e) => handleHeadingChange(e.target.value)}
                    className="px-2 py-1 text-xs bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-md text-stone-900 dark:text-stone-100 mr-1 font-medium"
                >
                    <option value="paragraph">Tavallinen teksti</option>
                    <option value="1">Otsikko 1</option>
                    <option value="2">Otsikko 2</option>
                    <option value="3">Otsikko 3</option>
                </select>

                <div className="w-px h-4 bg-stone-300 dark:bg-stone-800 mx-1" />

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
                    title="Lisää linkki"
                    active={activeStates?.isLink}
                    onClick={setLink}
                >
                    <LinkIcon size={16} />
                </EditorButton>

                {activeStates?.isLink && (
                    <EditorButton
                        title="Poista linkki"
                        onClick={() => editor.chain().focus().unsetLink().run()}
                    >
                        <Unlink size={16} />
                    </EditorButton>
                )}

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
                                {ph.label} ({`[[${ph.id}]]`})
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

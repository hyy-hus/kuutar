import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Button } from '#/components/Button'
import { Bold, Italic, List, ListOrdered, Heading2 } from 'lucide-react'
import Mention from '@tiptap/extension-mention'

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

export function ContractEditor({ value, onChange }: ContractEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Mention.configure({
                HTMLAttributes: {
                    class:
                        'inline-flex items-center px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 text-xs font-mono font-semibold border border-amber-300 dark:border-amber-700 select-none',
                },
                suggestion: {
                    char: '@',
                    items: ({ query }) => {
                        return CONTRACT_PLACEHOLDERS.filter((item) =>
                            item.label.toLowerCase().includes(query.toLowerCase()) ||
                            item.id.toLowerCase().includes(query.toLowerCase())
                        )
                    },
                },
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
                // Stripped internal borders and focus outlines
                class:
                    'prose dark:prose-invert max-w-none min-h-[300px] p-4 border-none outline-none focus:outline-none focus:ring-0 bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-stone-100',
            },
        },
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
            <div className="flex flex-wrap items-center gap-1 p-2 bg-stone-100 dark:bg-stone-950 border-b border-stone-200 dark:border-stone-800 rounded-t-md">
                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={editor.isActive('bold') ? 'bg-stone-200 dark:bg-stone-800' : ''}
                >
                    <Bold size={16} />
                </Button>
                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={editor.isActive('italic') ? 'bg-stone-200 dark:bg-stone-800' : ''}
                >
                    <Italic size={16} />
                </Button>
                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    className={editor.isActive('heading', { level: 2 }) ? 'bg-stone-200 dark:bg-stone-800' : ''}
                >
                    <Heading2 size={16} />
                </Button>
                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={editor.isActive('bulletList') ? 'bg-stone-200 dark:bg-stone-800' : ''}
                >
                    <List size={16} />
                </Button>
                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={editor.isActive('orderedList') ? 'bg-stone-200 dark:bg-stone-800' : ''}
                >
                    <ListOrdered size={16} />
                </Button>

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

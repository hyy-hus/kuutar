import { ReactRenderer } from '@tiptap/react'
import tippy, { type Instance as TippyInstance } from 'tippy.js'
import { forwardRef, useImperativeHandle, useState } from 'react'
import { CONTRACT_PLACEHOLDERS, type ContractPlaceholder } from '#/components/ContractEditor'

// Popup Dropdown React Component
export const MentionList = forwardRef((props: { items: ContractPlaceholder[]; command: (item: { id: string }) => void }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0)

    const selectItem = (index: number) => {
        const item = props.items[index]
        if (item) {
            props.command({ id: item.id })
        }
    }

    useImperativeHandle(ref, () => ({
        onKeyDown: ({ event }: { event: KeyboardEvent }) => {
            if (event.key === 'ArrowUp') {
                setSelectedIndex((prev) => (prev + props.items.length - 1) % props.items.length)
                return true
            }
            if (event.key === 'ArrowDown') {
                setSelectedIndex((prev) => (prev + 1) % props.items.length)
                return true
            }
            if (event.key === 'Enter') {
                selectItem(selectedIndex)
                return true
            }
            return false
        },
    }))

    if (!props.items.length) {
        return (
            <div className="p-2 text-xs text-stone-400 bg-stone-900 border border-stone-800 rounded-md shadow-lg">
                Ei kenttiä
            </div>
        )
    }

    return (
        <div className="flex flex-col p-1 bg-stone-900 border border-stone-800 rounded-md shadow-xl min-w-[160px]">
            {props.items.map((item, index) => (
                <button
                    key={item.id}
                    type="button"
                    onClick={() => selectItem(index)}
                    className={`px-2 py-1 text-left text-xs rounded transition-colors ${index === selectedIndex
                        ? 'bg-amber-600 text-white font-medium'
                        : 'text-stone-300 hover:bg-stone-800'
                        }`}
                >
                    {item.label} <span className="opacity-60 font-mono">([[${item.id}]])</span>
                </button>
            ))}
        </div>
    )
})

MentionList.displayName = 'MentionList'

// Tippy Popup Glue Logic
export const mentionSuggestion = {
    items: ({ query }: { query: string }) => {
        return CONTRACT_PLACEHOLDERS.filter(
            (item) =>
                item.label.toLowerCase().includes(query.toLowerCase()) ||
                item.id.toLowerCase().includes(query.toLowerCase())
        )
    },
    render: () => {
        let component: ReactRenderer<any> | null = null
        let popup: TippyInstance[] | null = null

        return {
            onStart: (props: any) => {
                component = new ReactRenderer(MentionList, {
                    props,
                    editor: props.editor,
                })

                if (!props.clientRect) return

                popup = tippy('body', {
                    getReferenceClientRect: props.clientRect,
                    appendTo: () => document.body,
                    content: component.element,
                    showOnCreate: true,
                    interactive: true,
                    trigger: 'manual',
                    placement: 'bottom-start',
                })
            },

            onUpdate(props: any) {
                component?.updateProps(props)

                if (!props.clientRect) return

                popup?.[0]?.setProps({
                    getReferenceClientRect: props.clientRect,
                })
            },

            onKeyDown(props: any) {
                if (props.event.key === 'Escape') {
                    popup?.[0]?.hide()
                    return true
                }
                return component?.ref?.onKeyDown(props) ?? false
            },

            onExit() {
                popup?.[0]?.destroy()
                component?.destroy()
            },
        }
    },
}

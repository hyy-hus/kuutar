import type { JSONContent } from "@tiptap/core";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import {
	Bold,
	Italic,
	Link as LinkIcon,
	List,
	ListOrdered,
	Unlink,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "#/utils/cn";
import { richTextClassName, richTextExtensions } from "#/utils/richText";

interface RichTextEditorProps {
	value?: JSONContent;
	onChange: (doc: JSONContent) => void;
	/** Accessible name for the editable area */
	ariaLabel?: string;
}

/** Compact toolbar icon button with explicit active highlight */
function EditorButton({
	active,
	onClick,
	children,
	title,
}: {
	active?: boolean;
	onClick: () => void;
	children: React.ReactNode;
	title?: string;
}) {
	return (
		<button
			type="button"
			title={title}
			aria-label={title}
			aria-pressed={active}
			onMouseDown={(e) => {
				// Prevent button click from taking focus away from editor text selection
				e.preventDefault();
				onClick();
			}}
			className={cn(
				"p-1.5 rounded-sm transition-colors",
				active
					? "bg-stone-300 dark:bg-stone-700 text-stone-950 dark:text-stone-50 font-bold"
					: "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200/60 dark:hover:bg-stone-800/60",
			)}
		>
			{children}
		</button>
	);
}

/** Rich-text editor that reads and emits Tiptap JSON documents */
export function RichTextEditor({
	value,
	onChange,
	ariaLabel,
}: RichTextEditorProps) {
	const { t } = useTranslation();
	const editor = useEditor({
		extensions: richTextExtensions,
		content: value,
		onUpdate: ({ editor }) => {
			onChange(editor.getJSON());
		},
		editorProps: {
			attributes: {
				class: cn(
					"min-h-[160px] p-3 text-sm border-none outline-none focus:outline-none focus:ring-0 bg-stone-50 dark:bg-stone-900",
					richTextClassName,
				),
				...(ariaLabel ? { "aria-label": ariaLabel } : {}),
			},
		},
	});

	const activeStates = useEditorState({
		editor,
		selector: (ctx) => ({
			isBold: ctx.editor.isActive("bold"),
			isItalic: ctx.editor.isActive("italic"),
			headingLevel: ctx.editor.isActive("heading", { level: 1 })
				? "1"
				: ctx.editor.isActive("heading", { level: 2 })
					? "2"
					: ctx.editor.isActive("heading", { level: 3 })
						? "3"
						: "paragraph",
			isBulletList: ctx.editor.isActive("bulletList"),
			isOrderedList: ctx.editor.isActive("orderedList"),
			isLink: ctx.editor.isActive("link"),
		}),
	});

	if (!editor) {
		return null;
	}

	const handleHeadingChange = (level: string) => {
		if (level === "paragraph") {
			editor.chain().focus().setParagraph().run();
		} else {
			editor
				.chain()
				.focus()
				.toggleHeading({ level: Number(level) as 1 | 2 | 3 })
				.run();
		}
	};

	const setLink = () => {
		const previousUrl = editor.getAttributes("link").href;
		const url = window.prompt(
			t("syotaOsoite", "Syötä osoite (URL):"),
			previousUrl,
		);

		if (url === null) return;

		if (url === "") {
			editor.chain().focus().extendMarkRange("link").unsetLink().run();
			return;
		}

		editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
	};

	return (
		<div className="flex flex-col border border-stone-200 dark:border-stone-800 rounded-sm focus-within:border-stone-700 dark:focus-within:border-stone-600 transition-colors">
			{/* Toolbar */}
			<div className="flex flex-wrap items-center gap-0.5 p-1 bg-stone-100 dark:bg-stone-950 border-b border-stone-200 dark:border-stone-800 rounded-t-sm">
				<select
					aria-label={t("tekstityyli", "Tekstityyli")}
					value={activeStates?.headingLevel ?? "paragraph"}
					onChange={(e) => handleHeadingChange(e.target.value)}
					className="px-2 py-1 text-xs bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-md text-stone-900 dark:text-stone-100 mr-1 font-medium"
				>
					<option value="paragraph">
						{t("tavallinenTeksti", "Tavallinen teksti")}
					</option>
					<option value="1">{t("otsikko1", "Otsikko 1")}</option>
					<option value="2">{t("otsikko2", "Otsikko 2")}</option>
					<option value="3">{t("otsikko3", "Otsikko 3")}</option>
				</select>

				<div className="w-px h-4 bg-stone-300 dark:bg-stone-800 mx-1" />

				<EditorButton
					title={t("lihavointi", "Lihavointi")}
					active={activeStates?.isBold}
					onClick={() => editor.chain().focus().toggleBold().run()}
				>
					<Bold size={16} />
				</EditorButton>

				<EditorButton
					title={t("kursiivi", "Kursiivi")}
					active={activeStates?.isItalic}
					onClick={() => editor.chain().focus().toggleItalic().run()}
				>
					<Italic size={16} />
				</EditorButton>

				<EditorButton
					title={t("lisLinkki", "Lisää linkki")}
					active={activeStates?.isLink}
					onClick={setLink}
				>
					<LinkIcon size={16} />
				</EditorButton>

				{activeStates?.isLink && (
					<EditorButton
						title={t("poistaLinkki", "Poista linkki")}
						onClick={() => editor.chain().focus().unsetLink().run()}
					>
						<Unlink size={16} />
					</EditorButton>
				)}

				<div className="w-px h-4 bg-stone-300 dark:bg-stone-800 mx-1" />

				<EditorButton
					title={t("luettelo", "Luettelo")}
					active={activeStates?.isBulletList}
					onClick={() => editor.chain().focus().toggleBulletList().run()}
				>
					<List size={16} />
				</EditorButton>

				<EditorButton
					title={t("numeroituLuettelo", "Numeroitu luettelo")}
					active={activeStates?.isOrderedList}
					onClick={() => editor.chain().focus().toggleOrderedList().run()}
				>
					<ListOrdered size={16} />
				</EditorButton>
			</div>

			<EditorContent editor={editor} />
		</div>
	);
}

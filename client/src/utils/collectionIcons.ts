import {
	Bike,
	Book,
	Camera,
	Car,
	Dumbbell,
	Gamepad2,
	Hammer,
	House,
	Laptop,
	Layers,
	type LucideIcon,
	Mic,
	Monitor,
	Music,
	Palette,
	Printer,
	Projector,
	Shirt,
	Sofa,
	Tent,
	Trees,
	Truck,
	Users,
	Utensils,
	Wrench,
} from "lucide-react";

/** Icon keys offered for collections; keep in sync with `COLLECTION_ICONS` in the server's collections/models.rs */
export const COLLECTION_ICONS = [
	"layers",
	"wrench",
	"car",
	"home",
	"projector",
	"camera",
	"music",
	"utensils",
	"bike",
	"tent",
	"users",
	"monitor",
	"mic",
	"book",
	"gamepad",
	"palette",
	"hammer",
	"truck",
	"sofa",
	"trees",
	"dumbbell",
	"laptop",
	"printer",
	"shirt",
] as const;

export type CollectionIconKey = (typeof COLLECTION_ICONS)[number];

const ICON_COMPONENTS: Record<CollectionIconKey, LucideIcon> = {
	layers: Layers,
	wrench: Wrench,
	car: Car,
	home: House,
	projector: Projector,
	camera: Camera,
	music: Music,
	utensils: Utensils,
	bike: Bike,
	tent: Tent,
	users: Users,
	monitor: Monitor,
	mic: Mic,
	book: Book,
	gamepad: Gamepad2,
	palette: Palette,
	hammer: Hammer,
	truck: Truck,
	sofa: Sofa,
	trees: Trees,
	dumbbell: Dumbbell,
	laptop: Laptop,
	printer: Printer,
	shirt: Shirt,
};

/** Icon component for a stored key; falls back to the default `Layers` icon */
export function getCollectionIcon(key: string | null | undefined): LucideIcon {
	return (
		(key && Object.hasOwn(ICON_COMPONENTS, key)
			? ICON_COMPONENTS[key as CollectionIconKey]
			: undefined) ?? Layers
	);
}

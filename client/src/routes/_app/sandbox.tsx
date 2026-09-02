// src/routes/sandbox.tsx
import { createFileRoute } from '@tanstack/react-router'
import { Plus, RefreshCcw, Trash2, Search } from 'lucide-react'
import { Button } from '#/components/Button'
import { Input } from '#/components/Input'

export const Route = createFileRoute('/_app/sandbox')({
    component: SandboxPage,
})

function SandboxPage() {
    return (
        <div className="p-8 max-w-4xl space-y-12">
            <h1 className="text-2xl font-bold">Component Sandbox</h1>

            {/* Button Section */}
            <section className="space-y-4">
                <h2 className="text-lg font-semibold">Buttons</h2>
                <div className="flex flex-wrap gap-4 items-center">
                    <Button variant="default">Default</Button>
                    <Button variant="secondary">Secondary</Button>
                    <Button variant="outline">Outline</Button>
                    <Button variant="ghost">Ghost</Button>
                    <Button variant="danger">
                        <Trash2 size={16} />
                        <span>Poista</span>
                    </Button>
                    <Button>
                        <span>Päivitä</span>
                        <RefreshCcw size={16} />
                    </Button>
                    <Button size="icon"><Plus size={16} /></Button>
                    <Button size="sm"> small </Button>
                    <Button size="md"> medium </Button>
                    <Button size="lg"> large </Button>
                </div>
            </section>

            {/* Input Section */}
            <section className="space-y-6 max-w-lg">
                <h2 className="text-lg font-semibold">Inputs</h2>

                {/* Sizes */}
                <div className="space-y-3">
                    <span className="text-xs font-mono text-stone-500">Sizes (sm, md, lg)</span>
                    <Input size="sm" placeholder="Pieni syöte (sm)..." />
                    <Input size="md" placeholder="Normaali syöte (md)..." />
                    <Input size="lg" placeholder="Suuri syöte (lg)..." />
                </div>

                {/* States */}
                <div className="space-y-3">
                    <span className="text-xs font-mono text-stone-500">States (Error, Disabled)</span>
                    <Input isError defaultValue="Virheellinen sähköposti" placeholder="Syötä sähköposti..." />
                    <Input disabled value="Pois käytöstä" />
                </div>

                {/* Form Group Examples */}
                <div className="space-y-3">
                    <span className="text-xs font-mono text-stone-500">Inline Form Alignment</span>
                    <div className="flex gap-2">
                        <Input placeholder="Etsi..." />
                        <Button>
                            <Search size={16} />
                            <span>Hae</span>
                        </Button>
                    </div>
                </div>
            </section>
        </div>
    )
}

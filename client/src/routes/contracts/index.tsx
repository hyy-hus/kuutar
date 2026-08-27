import { ContractEditor } from '#/components/ContractEditor'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

export const Route = createFileRoute('/contracts/')({
    component: RouteComponent,
})

function RouteComponent() {
    const [text, setText] = useState("")
    return <div>
        <ContractEditor value={text} onChange={setText} />
    </div>
}

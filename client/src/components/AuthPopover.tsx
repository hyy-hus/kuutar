import { useState } from 'react'
import { Dialog } from 'radix-ui'
import { User, LogOut } from 'lucide-react'
import { Button } from '#/components/Button'
import { SignInForm } from '#/components/SignInForm'
import { useAuth } from '#/hooks/useAuth'

export function AuthDialog() {
    const [isOpen, setIsOpen] = useState(false)
    const { user, isAuthenticated, logout } = useAuth()

    return (
        <>
            <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
                <Dialog.Trigger asChild>
                    <Button variant="ghost" size="icon">
                        {isAuthenticated ? (
                            <span className="font-bold text-xs uppercase text-purple-600 dark:text-purple-400">
                                {user?.email[0]}
                            </span>
                        ) : (
                            <User size={20} />
                        )}
                    </Button>
                </Dialog.Trigger>

                <Dialog.Portal>
                    {/* Dark Screen Overlay */}
                    <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

                    {/* Centered Modal Content */}
                    <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-80 p-5 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg shadow-xl z-50 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
                        {isAuthenticated ? (
                            <div className="space-y-4">
                                <div className="border-b border-stone-200 dark:border-stone-800 pb-3">
                                    <p className="text-xs text-stone-500">Kirjautunut sisään</p>
                                    <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{user?.email}</p>
                                    <p className="text-xs font-mono capitalize text-stone-400">{user?.role}</p>
                                </div>

                                <Button
                                    variant="outline"
                                    className="w-full flex items-center justify-center gap-2"
                                    onClick={async () => {
                                        await logout()
                                        setIsOpen(false)
                                    }}
                                >
                                    <LogOut size={16} />
                                    <span>Kirjaudu ulos</span>
                                </Button>
                            </div>
                        ) : (
                            <div>
                                <Dialog.Title className="text-base font-semibold text-stone-900 dark:text-stone-100 mb-4">
                                    Kirjaudu sisään
                                </Dialog.Title>
                                <SignInForm onSuccess={() => setIsOpen(false)} />
                            </div>
                        )}
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root >
        </>
    )
}

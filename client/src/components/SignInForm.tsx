import { useForm } from '@tanstack/react-form'
import { Loader2, ArrowRight } from 'lucide-react'
import { Input } from '#/components/Input'
import { Button } from '#/components/Button'
import { useAuth } from '#/hooks/useAuth'
import type { components } from '#/api/schema'

type LoginPayload = components['schemas']['LoginPayload']

interface SignInFormProps {
    onSuccess?: () => void
}

export function SignInForm({ onSuccess }: SignInFormProps) {
    const { login, isLoggingIn, loginError } = useAuth()

    const form = useForm({
        defaultValues: {
            email: '',
            password: '',
        },
        onSubmit: async ({ value }) => {
            try {
                await login(value)
                onSuccess?.()
            } catch {
                // API errors are captured by `loginError` from `useAuth`
            }
        },
    })

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault()
                e.stopPropagation()
                form.handleSubmit()
            }}
            className="space-y-4"
        >
            {/* Backend API Error Banner */}
            {loginError && (
                <div className="p-2.5 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-md">
                    {loginError}
                </div>
            )}

            {/* Email Field */}
            <form.Field
                name="email"
                validators={{
                    onChange: ({ value }) =>
                        !value
                            ? 'Sähköposti on pakollinen'
                            : !/\S+@\S+\.\S+/.test(value)
                                ? 'Anna kelvollinen sähköpostiosoite'
                                : undefined,
                }}
            >
                {(field) => {
                    const hasError = Boolean(field.state.meta.errors.length)
                    return (
                        <div className="space-y-1">
                            <label htmlFor={field.name} className="text-xs font-medium text-stone-700 dark:text-stone-300">
                                Sähköposti
                            </label>
                            <Input
                                id={field.name}
                                type="email"
                                placeholder="nimi@esimerkki.fi"
                                value={field.state.value}
                                onChange={(e) => field.handleChange(e.target.value)}
                                onBlur={field.handleBlur}
                                isError={hasError}
                            />
                            {hasError && (
                                <p className="text-[11px] text-red-500">{field.state.meta.errors.join(', ')}</p>
                            )}
                        </div>
                    )
                }}
            </form.Field>

            {/* Password Field */}
            <form.Field
                name="password"
                validators={{
                    onChange: ({ value }) =>
                        !value ? 'Salasana on pakollinen' : undefined,
                }}
            >
                {(field) => {
                    const hasError = Boolean(field.state.meta.errors.length)
                    return (
                        <div className="space-y-1">
                            <label htmlFor={field.name} className="text-xs font-medium text-stone-700 dark:text-stone-300">
                                Salasana
                            </label>
                            <Input
                                id={field.name}
                                type="password"
                                placeholder="••••••••"
                                value={field.state.value}
                                onChange={(e) => field.handleChange(e.target.value)}
                                onBlur={field.handleBlur}
                                isError={hasError}
                            />
                            {hasError && (
                                <p className="text-[11px] text-red-500">{field.state.meta.errors.join(', ')}</p>
                            )}
                        </div>
                    )
                }}
            </form.Field>

            {/* Form Submission */}
            <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
                {([canSubmit, isSubmitting]) => (
                    <Button
                        type="submit"
                        disabled={!canSubmit || isLoggingIn || isSubmitting}
                        className="w-full mt-2"
                    >
                        {isLoggingIn || isSubmitting ? (
                            <Loader2 className="animate-spin" size={16} />
                        ) : (
                            <>
                                <span>Kirjaudu</span>
                                <ArrowRight size={16} />
                            </>
                        )}
                    </Button>
                )}
            </form.Subscribe>
        </form>
    )
}

export function QueryFeedback({
  pending,
  error,
  retry,
}: {
  pending: boolean
  error: Error | null
  retry: () => void
}) {
  if (pending)
    return (
      <p role="status" className="py-6 text-secondary">
        Carregando dados…
      </p>
    )
  if (error)
    return (
      <div
        role="alert"
        className="my-5 rounded-md border border-danger/30 bg-surface p-4 text-danger"
      >
        <p>{error.message}</p>
        <button type="button" className="min-h-10 underline" onClick={retry}>
          Tentar novamente
        </button>
      </div>
    )
  return null
}

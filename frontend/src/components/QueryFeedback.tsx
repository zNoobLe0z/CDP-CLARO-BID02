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
      <p role="status" className="py-6 text-slate-600">
        Carregando dados…
      </p>
    )
  if (error)
    return (
      <div
        role="alert"
        className="my-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"
      >
        <p>{error.message}</p>
        <button type="button" className="min-h-11 underline" onClick={retry}>
          Tentar novamente
        </button>
      </div>
    )
  return null
}

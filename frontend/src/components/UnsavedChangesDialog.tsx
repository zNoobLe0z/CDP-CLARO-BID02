import { useEffect, useRef } from 'react'
import { useBeforeUnload, useBlocker } from 'react-router'

export function UnsavedChangesDialog({ dirty }: { dirty: boolean }) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty &&
      currentLocation.pathname + currentLocation.search !==
        nextLocation.pathname + nextLocation.search,
  )
  const dialog = useRef<HTMLDialogElement>(null)
  useBeforeUnload((event) => {
    if (dirty) {
      event.preventDefault()
      event.returnValue = ''
    }
  })
  useEffect(() => {
    if (blocker.state === 'blocked' && !dialog.current?.open)
      dialog.current?.showModal()
  }, [blocker.state])
  if (blocker.state !== 'blocked') return null
  return (
    <dialog
      ref={dialog}
      aria-labelledby="unsaved-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md bg-surface p-6 backdrop:bg-overlay"
      onCancel={(event) => {
        event.preventDefault()
        blocker.reset()
      }}
    >
      <h2 id="unsaved-title" className="text-lg font-semibold">
        Descartar o preenchimento?
      </h2>
      <p className="my-4 text-secondary">
        Os dados ainda não foram salvos. Você pode continuar preenchendo ou sair
        desta tela.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="button-primary"
          onClick={() => blocker.reset()}
        >
          Continuar preenchendo
        </button>
        <button
          type="button"
          className="button-secondary"
          onClick={() => blocker.proceed()}
        >
          Descartar e sair
        </button>
      </div>
    </dialog>
  )
}

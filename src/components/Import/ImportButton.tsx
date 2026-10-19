import type { ReactNode } from 'react'
import { importIntoActiveBoard } from './importImages'
import { pickImageFiles } from './pickFiles'

export function ImportButton({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        const files = await pickImageFiles(true)
        await importIntoActiveBoard(files.map((file) => ({ file, path: file.name })))
      }}
    >
      {children}
    </button>
  )
}

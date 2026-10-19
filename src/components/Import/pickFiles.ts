import { ACCEPTED_MIME_TYPES } from '../../core/imageFiles'

/** Opens the system file picker; returns an empty list if cancelled. */
export function pickFiles(accept: string, multiple: boolean): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = multiple
    input.accept = accept
    input.addEventListener('change', () => resolve([...(input.files ?? [])]))
    input.addEventListener('cancel', () => resolve([]))
    input.click()
  })
}

export const pickImageFiles = (multiple: boolean): Promise<File[]> =>
  pickFiles(ACCEPTED_MIME_TYPES.join(','), multiple)

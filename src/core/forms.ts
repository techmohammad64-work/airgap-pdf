import {
  PDFCheckBox,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField,
  StandardFonts,
} from 'pdf-lib'
import { PdfError } from './errors'
import { loadPdf, savePdf } from './load'

export type FieldInfo =
  | { name: string; type: 'text'; value: string; multiline: boolean; maxLength?: number; readOnly: boolean }
  | { name: string; type: 'checkbox'; value: boolean; readOnly: boolean }
  | { name: string; type: 'dropdown' | 'radio'; value: string; options: string[]; readOnly: boolean }
  | { name: string; type: 'list'; value: string[]; options: string[]; readOnly: boolean }

export type FieldValue = string | boolean | string[]

/** Lists fillable fields. Buttons and signature fields are skipped. */
export async function listFields(bytes: Uint8Array): Promise<FieldInfo[]> {
  const doc = await loadPdf(bytes)
  const out: FieldInfo[] = []
  for (const f of doc.getForm().getFields()) {
    const name = f.getName()
    const readOnly = f.isReadOnly()
    if (f instanceof PDFTextField)
      out.push({ name, type: 'text', value: f.getText() ?? '', multiline: f.isMultiline(), maxLength: f.getMaxLength(), readOnly })
    else if (f instanceof PDFCheckBox) out.push({ name, type: 'checkbox', value: f.isChecked(), readOnly })
    else if (f instanceof PDFDropdown)
      out.push({ name, type: 'dropdown', value: f.getSelected()[0] ?? '', options: f.getOptions(), readOnly })
    else if (f instanceof PDFRadioGroup) out.push({ name, type: 'radio', value: f.getSelected() ?? '', options: f.getOptions(), readOnly })
    else if (f instanceof PDFOptionList) out.push({ name, type: 'list', value: f.getSelected(), options: f.getOptions(), readOnly })
  }
  return out
}

/** Writes values into form fields; optionally flattens so they can't be edited. */
export async function fillForm(bytes: Uint8Array, values: Record<string, FieldValue>, flatten: boolean): Promise<Uint8Array> {
  const doc = await loadPdf(bytes)
  const form = doc.getForm()
  for (const [name, value] of Object.entries(values)) {
    const f = form.getFieldMaybe(name)
    if (!f || f.isReadOnly()) continue
    if (f instanceof PDFTextField) f.setText(String(value ?? ''))
    else if (f instanceof PDFCheckBox) value ? f.check() : f.uncheck()
    else if (f instanceof PDFDropdown) value ? f.select(String(value)) : f.clear()
    else if (f instanceof PDFRadioGroup) value ? f.select(String(value)) : f.clear()
    else if (f instanceof PDFOptionList) Array.isArray(value) && value.length ? f.select(value) : f.clear()
  }
  try {
    form.updateFieldAppearances(await doc.embedFont(StandardFonts.Helvetica))
  } catch {
    throw new PdfError('unsupported-text', 'A field contains characters the standard PDF font cannot show.')
  }
  if (flatten) form.flatten()
  return savePdf(doc)
}

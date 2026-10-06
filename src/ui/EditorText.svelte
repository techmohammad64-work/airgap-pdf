<script lang="ts">
  // In-place editable text box for the PageEditor. Uses the same fonts and
  // line-height (1.2) as core/overlays.ts so the PDF matches what you see.
  import { FONT_CSS, measureText, type TextItem } from './EditorKit'

  let { item, scale, selected, placeholder = 'Type here' }: { item: TextItem; scale: number; selected: boolean; placeholder?: string } = $props()

  let ta: HTMLTextAreaElement

  // Size the box to its content.
  $effect(() => {
    const m = measureText(item.text || placeholder, item.font, item.size, item.bold)
    if (Math.abs(m.width - item.width) > 0.01) item.width = m.width
    if (Math.abs(m.height - item.height) > 0.01) item.height = m.height
  })

  $effect(() => {
    if (selected && ta && document.activeElement !== ta) {
      ta.focus({ preventScroll: true })
      ta.selectionStart = ta.selectionEnd = ta.value.length
    }
  })
</script>

<textarea
  bind:this={ta}
  bind:value={item.text}
  class="text"
  class:editing={selected}
  data-no-drag={selected ? '' : undefined}
  data-testid="editor-text"
  aria-label="Text"
  rows="1"
  wrap="off"
  spellcheck="false"
  {placeholder}
  style:font-family={FONT_CSS[item.font]}
  style:font-size={`${item.size * scale}px`}
  style:font-weight={item.bold ? 700 : 400}
  style:color={item.color}
></textarea>

<style>
  .text {
    display: block;
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    line-height: 1.2;
    resize: none;
    overflow: hidden;
    white-space: pre;
    outline: none;
    cursor: move;
    font-kerning: normal;
  }
  .text.editing {
    cursor: text;
    background: color-mix(in srgb, #1f5eff 6%, transparent);
  }
  .text::placeholder {
    color: #8592a6;
    opacity: 1;
  }
</style>

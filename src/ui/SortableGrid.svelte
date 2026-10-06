<script lang="ts" generics="T">
  import type { Snippet } from 'svelte'

  let {
    items,
    key,
    onmove,
    item,
    min = 150,
    label = 'Pages',
  }: {
    items: T[]
    key: (item: T) => string
    /** Move the item at `from` so it ends up at index `to`. */
    onmove: (from: number, to: number) => void
    item: Snippet<[T, number]>
    min?: number
    label?: string
  } = $props()

  let dragFrom = $state<number | null>(null)
  let dropAt = $state<number | null>(null)

  function over(e: DragEvent, i: number) {
    if (dragFrom === null) return
    e.preventDefault()
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    dropAt = e.clientX > r.left + r.width / 2 ? i + 1 : i
  }

  function drop(e: DragEvent) {
    e.preventDefault()
    if (dragFrom !== null && dropAt !== null) {
      const to = dropAt > dragFrom ? dropAt - 1 : dropAt
      if (to !== dragFrom) onmove(dragFrom, to)
    }
    dragFrom = dropAt = null
  }
</script>

<ul class="grid" style:--min={`${min}px`} aria-label={label}>
  {#each items as it, i (key(it))}
    <li
      class="cell"
      class:dragging={dragFrom === i}
      class:drop-before={dropAt === i && dragFrom !== null}
      class:drop-after={dropAt === i + 1 && i === items.length - 1 && dragFrom !== null}
      draggable="true"
      ondragstart={(e) => {
        dragFrom = i
        e.dataTransfer?.setData('text/plain', String(i))
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
      }}
      ondragover={(e) => over(e, i)}
      ondrop={drop}
      ondragend={() => (dragFrom = dropAt = null)}
    >
      {@render item(it, i)}
    </li>
  {/each}
</ul>

<style>
  .grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(var(--min), 1fr));
    gap: 16px;
  }
  .cell {
    position: relative;
    min-width: 0;
    cursor: grab;
  }
  .cell.dragging {
    opacity: 0.35;
  }
  .cell.drop-before::before,
  .cell.drop-after::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    width: 3px;
    border-radius: 2px;
    background: var(--primary);
  }
  .cell.drop-before::before {
    left: -10px;
  }
  .cell.drop-after::after {
    right: -10px;
  }
</style>

import type { CatalogEntry } from '../core/types.js'

export interface SearchOptions {
  readonly repo?: string
  readonly category?: string
  readonly limit?: number
}

/** 이름 > 카테고리 > 설명 순으로 가중치를 두어 카탈로그를 검색한다. */
export function searchCatalog(
  entries: readonly CatalogEntry[],
  query: string,
  options: SearchOptions = {},
): readonly CatalogEntry[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  const filtered = entries.filter(
    (entry) =>
      (options.repo === undefined || entry.repo === options.repo) &&
      (options.category === undefined || entry.category === options.category),
  )
  const scored = filtered
    .map((entry) => ({ entry, score: scoreEntry(entry, terms) }))
    .filter(({ score }) => terms.length === 0 || score > 0)
    .sort((a, b) => b.score - a.score || a.entry.skillName.localeCompare(b.entry.skillName))
  const limited = options.limit === undefined ? scored : scored.slice(0, options.limit)
  return limited.map(({ entry }) => entry)
}

function scoreEntry(entry: CatalogEntry, terms: readonly string[]): number {
  const name = entry.skillName.toLowerCase()
  const category = (entry.category ?? '').toLowerCase()
  const description = entry.description.toLowerCase()
  return terms.reduce((total, term) => {
    const nameHit = name.includes(term) ? 10 : 0
    const categoryHit = category.includes(term) ? 5 : 0
    const descriptionHit = description.includes(term) ? 1 : 0
    return total + nameHit + categoryHit + descriptionHit
  }, 0)
}

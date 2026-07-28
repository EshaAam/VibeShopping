/**
 * Product Link Guard
 *
 * WHY: the model is told to copy product links verbatim, but it also likes to
 * tidy up what looks like a typo. The catalog has a product named "Lenovo
 * Legion" whose slug is the mis-spelled 'lenevo-legion' (kept that way because
 * existing orders reference it), and the model helpfully "corrected" the link
 * to /product/lenovo-legion - a 404 shown to a real customer.
 *
 * Rather than trusting the prompt, every link in the reply is checked against
 * the slugs we actually retrieved. Near-misses are repaired, anything
 * unrecognisable is stripped. A link that reaches the customer is therefore
 * always a link that resolves.
 */

import type { RetrievedProduct } from './retrieval';

/** Slugs are lowercase alphanumerics and hyphens; stop at any other character. */
const PRODUCT_LINK = /\/product\/([a-zA-Z0-9-]+)/g;

/**
 * How far a hallucinated slug may stray and still be treated as a typo of a
 * real one. 3 covers letter swaps like lenevo/lenovo without letting genuinely
 * different products get confused - the real slugs are much further apart.
 */
const MAX_REPAIR_DISTANCE = 3;

/** Levenshtein distance, iterative single-row version. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1, // deletion
        current[j - 1] + 1, // insertion
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1) // substitution
      );
    }
    previous = current;
  }

  return previous[b.length];
}

/** Closest known slug within the repair threshold, or null if none is close. */
function findRepair(slug: string, knownSlugs: string[]): string | null {
  let best: string | null = null;
  let bestDistance = MAX_REPAIR_DISTANCE + 1;

  for (const known of knownSlugs) {
    const distance = editDistance(slug.toLowerCase(), known.toLowerCase());
    if (distance < bestDistance) {
      best = known;
      bestDistance = distance;
    }
  }

  return bestDistance <= MAX_REPAIR_DISTANCE ? best : null;
}

/**
 * Repair or remove every product link in an AI reply.
 *
 * @param text - the model's response
 * @param products - the rows that were actually put in the prompt; any link
 *                   outside this set is by definition invented
 */
export function sanitizeProductLinks(
  text: string,
  products: RetrievedProduct[]
): string {
  // When nothing was retrieved this set is empty, so no link can be verified
  // and all of them are dropped - exactly the desired outcome, since the model
  // had no product data to link to in the first place.
  const knownSlugs = products.map((product) => product.slug);
  const known = new Set(knownSlugs);

  // Processed line by line so the cleanup below only ever touches a line we
  // actually removed something from. Applied globally it would strip trailing
  // colons from untouched prose like "we have these in stock:".
  const lines = text.split('\n').map((line) => {
    let dropped = false;

    const next = line.replace(PRODUCT_LINK, (match, slug: string) => {
      if (known.has(slug)) return match;

      const repair = findRepair(slug, knownSlugs);
      if (repair) {
        console.warn(`[chat] repaired product link: ${slug} -> ${repair}`);
        return `/product/${repair}`;
      }

      console.warn(`[chat] dropped unverifiable product link: ${slug}`);
      dropped = true;
      return '';
    });

    return dropped ? tidyLine(next) : next;
  });

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Clean up the debris a dropped link leaves behind, so a line reads as
 * "Acer Nitro V 16S AI for $1420.00" rather than "...for $1420.00: ".
 *
 * Only ever called on a line a link was removed from, so a trailing separator
 * here is genuinely orphaned rather than part of the author's phrasing.
 */
function tidyLine(line: string): string {
  return line
    // Parentheses left empty by the removal.
    .replace(/\(\s*\)/g, '')
    // Runs of spaces created by the gap.
    .replace(/[ \t]{2,}/g, ' ')
    // A space that drifted in front of punctuation.
    .replace(/[ \t]+([,.!?:])/g, '$1')
    // The separator that was introducing the now-absent link.
    .replace(/\s*[:\-]\s*$/, '')
    .trimEnd();
}

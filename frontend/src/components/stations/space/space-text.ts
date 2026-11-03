/** « 1 station », « 3 stations » (pluriel français simple, en « s »). */
export function plural(count: number, word: string): string {
  return `${count} ${word}${count > 1 ? "s" : ""}`;
}

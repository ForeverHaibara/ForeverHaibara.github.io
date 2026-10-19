/** Every unordered triple exactly once, spreading each span across vertices
 * before increasing it. A truncated search no longer exhausts the first point. */
export function* balancedTriples(order: readonly number[]): Generator<[number, number, number]> {
  for (let span = 2; span < order.length; span += 1) for (let offset = 1; offset < span; offset += 1)
    for (let start = 0; start + span < order.length; start += 1) yield [order[start], order[start + offset], order[start + span]];
}

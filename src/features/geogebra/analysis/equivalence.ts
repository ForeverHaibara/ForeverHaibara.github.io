export class DisjointSet {
  private readonly parent: number[];
  private readonly rank: number[];

  public constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, index) => index);
    this.rank = new Array(size).fill(0);
  }

  public find(value: number): number {
    let root = value;
    while (this.parent[root] !== root) root = this.parent[root];
    while (this.parent[value] !== value) {
      const next = this.parent[value];
      this.parent[value] = root;
      value = next;
    }
    return root;
  }

  public union(left: number, right: number): void {
    let leftRoot = this.find(left);
    let rightRoot = this.find(right);
    if (leftRoot === rightRoot) return;
    if (this.rank[leftRoot] < this.rank[rightRoot]) [leftRoot, rightRoot] = [rightRoot, leftRoot];
    this.parent[rightRoot] = leftRoot;
    if (this.rank[leftRoot] === this.rank[rightRoot]) this.rank[leftRoot] += 1;
  }

  public groups(): Map<number, number[]> {
    const groups = new Map<number, number[]>();
    for (let index = 0; index < this.parent.length; index += 1) {
      const root = this.find(index);
      groups.set(root, [...(groups.get(root) ?? []), index]);
    }
    return groups;
  }
}

export const circularDistance = (left: number, right: number, period: number): number => {
  const difference = Math.abs(left - right) % period;
  return Math.min(difference, period - difference);
};

export const clusterByBuckets = (
  values: readonly number[],
  tolerance: number,
  period: number,
  equivalent: (left: number, right: number) => boolean,
): DisjointSet => {
  const set = new DisjointSet(values.length);
  if (values.length === 0) return set;
  const bucketCount = Math.max(1, Math.ceil(period / tolerance));
  const buckets = new Map<number, number[]>();
  values.forEach((value, index) => {
    const bucket = Math.floor((((value % period) + period) % period) / period * bucketCount) % bucketCount;
    for (let offset = -1; offset <= 1; offset += 1) {
      const candidateBucket = (bucket + offset + bucketCount) % bucketCount;
      (buckets.get(candidateBucket) ?? []).forEach((candidate) => {
        if (equivalent(values[index], values[candidate])) set.union(index, candidate);
      });
    }
    buckets.set(bucket, [...(buckets.get(bucket) ?? []), index]);
  });
  return set;
};

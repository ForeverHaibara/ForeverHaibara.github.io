export class CommandHistory {
  private entries: string[] = [];
  private cursor = 0;

  push(command: string): void {
    const normalized = command.trim();
    if (!normalized || this.entries.at(-1) === normalized) return;
    this.entries = [...this.entries, normalized].slice(-100);
    this.cursor = this.entries.length;
  }

  previous(): string {
    this.cursor = Math.max(0, this.cursor - 1);
    return this.entries[this.cursor] ?? '';
  }

  next(): string {
    this.cursor = Math.min(this.entries.length, this.cursor + 1);
    return this.entries[this.cursor] ?? '';
  }
}

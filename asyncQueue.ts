export class AsyncQueue<T> {
    private items: T[] = [];
    private waiters: Array<(value: T | undefined) => void> = [];
    private closed = false;

    enqueue(item: T): void {
        if (this.closed) return;

        const waiter = this.waiters.shift();
        if (waiter) {
            waiter(item);
        } else {
            this.items.push(item);
        }
    }

    dequeue(): Promise<T | undefined> {
        if (this.items.length > 0) {
            return Promise.resolve(this.items.shift());
        }

        if (this.closed) {
            return Promise.resolve(undefined);
        }

        return new Promise(resolve => {
            this.waiters.push(resolve);
        });
    }

    close(): void {
        this.closed = true;
        while (this.waiters.length > 0) {
            const waiter = this.waiters.shift();
            waiter?.(undefined);
        }
    }

    size(): number {
        return this.items.length;
    }
}
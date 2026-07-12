"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AsyncQueue = void 0;
class AsyncQueue {
    constructor() {
        this.items = [];
        this.waiters = [];
        this.closed = false;
    }
    enqueue(item) {
        if (this.closed)
            return;
        const waiter = this.waiters.shift();
        if (waiter) {
            waiter(item);
        }
        else {
            this.items.push(item);
        }
    }
    dequeue() {
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
    close() {
        this.closed = true;
        while (this.waiters.length > 0) {
            const waiter = this.waiters.shift();
            waiter?.(undefined);
        }
    }
    size() {
        return this.items.length;
    }
}
exports.AsyncQueue = AsyncQueue;
//# sourceMappingURL=asyncQueue.js.map
/**
 * @license
 * Copyright 2025 KNOWLEDGECODE
 * SPDX-License-Identifier: MIT
 */

interface Locking {
  promise?: Promise<boolean>;
  resolve?: (value: boolean | PromiseLike<boolean>) => void;
}

const map = new WeakMap<object, Locking>();

const isLocking = (obj: Locking | undefined): obj is Required<Locking> => {
  return typeof obj === 'object' && 'promise' in obj && 'resolve' in obj;
};

export class CriticalSection {
  private _lock (obj: object) {
    const value: Locking = {};

    value.promise = new Promise(resolve => (value.resolve = resolve));
    map.set(obj, value);
  }

  private _wait (cache: Required<Locking>, timeout: number) {
    const values = [cache.promise];

    if (timeout > 0) {
      values.push(new Promise<boolean>(resolve => setTimeout(resolve, timeout, false)));
    }
    return Promise.race(values);
  }

  /**
   * Enters a critical section for the given object with a timeout.
   * @param obj - The object to enter the critical section for.
   * @param timeout - The timeout in milliseconds. If the timeout is reached, it will return `false`.
   * @returns A promise that resolves to `true` if the critical section was entered, or `false` if the timeout was reached.
   */
  enter (obj: object, timeout = 0): Promise<boolean> {
    const cache = map.get(obj);

    if (isLocking(cache)) {
      return this._wait(cache, timeout).then(result => result ? this.enter(obj, timeout) : result);
    }
    this._lock(obj);
    return Promise.resolve(true);
  }

  /**
   * Waits for the critical section to be released (left) without locking it.
   * @param obj - The object to wait for
   * @param timeout - Optional timeout in milliseconds (default: 0)
   * @returns A Promise that resolves to true when released, false if timeout occurs
   */
  waitLeave (obj: object, timeout = 0): Promise<boolean> {
    const cache = map.get(obj);
    return isLocking(cache) ? this._wait(cache, timeout) : Promise.resolve(true);
  }

  /**
   * Tries to enter a critical section for the given object.
   * @param obj - The object to try entering the critical section for.
   * @returns `true` if the critical section was entered, `false` otherwise.
   */
  tryEnter (obj: object) {
    if (map.has(obj)) {
      return false;
    }
    this._lock(obj);
    return true;
  }

  /**
   * Checks if the critical section for the specified object is currently locked.
   * @param obj - The object to check
   * @returns true if the critical section is locked; otherwise, false.
   */
  isLocked (obj: object) {
    return map.has(obj);
  }

  /**
   * Leaves the critical section for the given object.
   * @param obj - The object to leave the critical section for.
   */
  leave (obj: object) {
    const value = map.get(obj);

    if (value) {
      map.delete(obj);
      value.resolve?.(true);
    }
  }
}

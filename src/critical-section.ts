/**
 * @license
 * Copyright 2025 KNOWLEDGECODE
 * SPDX-License-Identifier: MIT
 */

interface Occupation {
  promise?: Promise<boolean>;
  resolve?: (value: boolean | PromiseLike<boolean>) => void;
}

const map = new WeakMap<object, Occupation>();

const isOccupation = (obj: Occupation | undefined): obj is Required<Occupation> => {
  return typeof obj === 'object' && 'promise' in obj && 'resolve' in obj;
};

export class CriticalSection {
  private _occupy (obj: object) {
    const value: Occupation = {};

    value.promise = new Promise(resolve => (value.resolve = resolve));
    map.set(obj, value);
  }

  /**
   * Enters a critical section for the given object with a timeout.
   * @param obj - The object to enter the critical section for.
   * @param timeout - The timeout in milliseconds. If the timeout is reached, it will return `false`.
   * @returns A promise that resolves to `true` if the critical section was entered, or `false` if the timeout was reached.
   */
  enter (obj: object, timeout = 0): Promise<boolean> {
    const cache = map.get(obj);

    if (isOccupation(cache)) {
      if (timeout > 0) {
        return Promise.race([
          cache.promise,
          new Promise<boolean>(resolve => setTimeout(resolve, timeout, false))
        ])
          .then(result => result ? this.enter(obj, timeout) : result);
      }
      return cache.promise.then(() => this.enter(obj, timeout));
    }
    this._occupy(obj);
    return Promise.resolve(true);
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
    this._occupy(obj);
    return true;
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

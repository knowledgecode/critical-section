import { describe, it, expect, beforeEach } from 'vitest';
import { CriticalSection } from '../src/critical-section.ts';

describe('CriticalSection', () => {
  let criticalSection: CriticalSection;
  let testObj1: object;
  let testObj2: object;

  beforeEach(() => {
    criticalSection = new CriticalSection();
    testObj1 = {};
    testObj2 = {};
  });

  // Helper functions
  const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

  const expectSuccessfulEntry = async (cs: CriticalSection, obj: object, timeout?: number): Promise<boolean> => {
    const result = await cs.enter(obj, timeout);
    expect(result).toBe(true);
    return result;
  };

  const createOperation = (cs: CriticalSection, obj: object, index: number, results: string[]): Promise<void> => cs.enter(obj).then((result) => {
    expect(result).toBe(true);
    results.push(`enter-${index}`);
    return delay(10).then(() => {
      results.push(`leave-${index}`);
      cs.leave(obj);
    });
  });

  const createSimpleOperation = (cs: CriticalSection, obj: object, index: number, results: number[]): Promise<void> => cs.enter(obj).then((result) => {
    expect(result).toBe(true);
    results.push(index);
    cs.leave(obj);
  });

  const scheduleRelease = (cs: CriticalSection, obj: object, delayMs: number): Promise<void> => delay(delayMs).then(() => cs.leave(obj));

  describe('enter()', () => {
    it('should allow entering critical section for new object', async () => {
      const result = await criticalSection.enter(testObj1);
      expect(result).toBe(true);
    });

    it('should handle multiple different objects independently', async () => {
      const promise1 = criticalSection.enter(testObj1);
      const promise2 = criticalSection.enter(testObj2);

      const results = await Promise.all([promise1, promise2]);
      expect(results).toEqual([true, true]);
    });

    it('should queue entries for same object', async () => {
      await expectSuccessfulEntry(criticalSection, testObj1);

      // Second entry should wait until first is released
      const secondEntryPromise = criticalSection.enter(testObj1);

      // Release first entry
      criticalSection.leave(testObj1);

      const secondResult = await secondEntryPromise;
      expect(secondResult).toBe(true);
    });

    describe('with timeout', () => {
      it('should return true immediately for unoccupied object with timeout', async () => {
        const result = await criticalSection.enter(testObj1, 100);
        expect(result).toBe(true);
      });

      it('should timeout and return false when object is occupied', async () => {
        // Occupy the object
        await expectSuccessfulEntry(criticalSection, testObj1);

        // Try to enter with timeout
        const result = await criticalSection.enter(testObj1, 50);
        expect(result).toBe(false);

        // Clean up
        criticalSection.leave(testObj1);
      });

      it('should succeed if object is released before timeout', async () => {
        // Occupy the object
        await expectSuccessfulEntry(criticalSection, testObj1);

        // Schedule release after short delay
        scheduleRelease(criticalSection, testObj1, 30);

        // Try to enter with longer timeout
        const result = await criticalSection.enter(testObj1, 100);
        expect(result).toBe(true);

        // Clean up
        criticalSection.leave(testObj1);
      });

      it('should work without timeout (default behavior)', async () => {
        // Occupy the object
        await expectSuccessfulEntry(criticalSection, testObj1);

        // Queue second entry without timeout
        const secondEntryPromise = criticalSection.enter(testObj1);

        // Schedule release
        scheduleRelease(criticalSection, testObj1, 50);

        // Second entry should succeed
        const secondResult = await secondEntryPromise;
        expect(secondResult).toBe(true);

        // Clean up
        criticalSection.leave(testObj1);
      });
    });
  });

  describe('tryEnter()', () => {
    it('should return true for unoccupied object', () => {
      const result = criticalSection.tryEnter(testObj1);
      expect(result).toBe(true);
    });

    it('should return false for occupied object', async () => {
      await expectSuccessfulEntry(criticalSection, testObj1);

      const result = criticalSection.tryEnter(testObj1);
      expect(result).toBe(false);
    });

    it('should return true for different objects even if one is occupied', async () => {
      await expectSuccessfulEntry(criticalSection, testObj1);

      const result = criticalSection.tryEnter(testObj2);
      expect(result).toBe(true);

      // Clean up
      criticalSection.leave(testObj1);
      criticalSection.leave(testObj2);
    });
  });

  describe('leave()', () => {
    it('should release critical section', async () => {
      await expectSuccessfulEntry(criticalSection, testObj1);

      criticalSection.leave(testObj1);

      // Should be able to enter again immediately
      const result = criticalSection.tryEnter(testObj1);
      expect(result).toBe(true);

      // Clean up
      criticalSection.leave(testObj1);
    });

    it('should not throw error when leaving unoccupied object', () => {
      expect(() => criticalSection.leave(testObj1)).not.toThrow();
    });

    it('should allow queued entries to proceed', async () => {
      // First entry
      await expectSuccessfulEntry(criticalSection, testObj1);

      // Queue second entry
      const secondEntryPromise = criticalSection.enter(testObj1);
      let secondEntryResolved = false;
      secondEntryPromise.then((result) => {
        expect(result).toBe(true);
        secondEntryResolved = true;
      });

      // Second entry should not resolve immediately
      await delay(10);
      expect(secondEntryResolved).toBe(false);

      // Release first entry
      criticalSection.leave(testObj1);

      // Second entry should now resolve
      await secondEntryPromise;
      expect(secondEntryResolved).toBe(true);
    });
  });

  describe('Complex scenarios', () => {
    it('should handle multiple concurrent operations correctly', async () => {
      const results: string[] = [];
      const operations = Array.from({ length: 5 }, (_, i) => createOperation(criticalSection, testObj1, i, results)
      );

      await Promise.all(operations);

      // All operations should complete
      expect(results).toHaveLength(10);

      // Each enter should be paired with corresponding leave
      for (let i = 0; i < 5; i++) {
        expect(results).toContain(`enter-${i}`);
        expect(results).toContain(`leave-${i}`);
      }
    });

    it('should maintain independence between different objects', async () => {
      const obj1Results: number[] = [];
      const obj2Results: number[] = [];

      // Create operations for two different objects
      const obj1Operations = Array.from({ length: 3 }, (_, i) => createSimpleOperation(criticalSection, testObj1, i, obj1Results)
      );

      const obj2Operations = Array.from({ length: 3 }, (_, i) => createSimpleOperation(criticalSection, testObj2, i, obj2Results)
      );

      await Promise.all([...obj1Operations, ...obj2Operations]);

      expect(obj1Results).toHaveLength(3);
      expect(obj2Results).toHaveLength(3);
      expect(obj1Results).toEqual([0, 1, 2]);
      expect(obj2Results).toEqual([0, 1, 2]);
    });
  });
});

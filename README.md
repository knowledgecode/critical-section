# Critical Section

[![CI](https://github.com/knowledgecode/critical-section/actions/workflows/ci.yml/badge.svg)](https://github.com/knowledgecode/critical-section/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/critical-section)](https://www.npmjs.com/package/critical-section)

A lightweight TypeScript/JavaScript library for **object-based mutual exclusion** that treats your domain objects as natural lock identifiers.

## Why Critical Section?

Turn any object into a critical section lock - no string keys, no separate mutex instances to manage:

```typescript
// Use your existing objects directly as locks
const user = { id: 123, name: 'John' };
await criticalSection.enter(user);

// Global objects work perfectly too
await criticalSection.enter(document);
await criticalSection.enter(window);
```

## Key Features

- **🎯 Object-centric design**: Your domain objects become the locks themselves
- **🧠 Intuitive mental model**: One object = one critical section, naturally aligned with OOP
- **♻️ Automatic cleanup**: WeakMap prevents memory leaks through garbage collection
- **⚡ Lightweight**: Just 3 methods - `enter()`, `tryEnter()`, `leave()`
- **🌐 Universal**: Works in Node.js, browsers, and all modern JavaScript environments
- **🔒 Type-safe**: Full TypeScript support with strict type checking
- **📦 Zero dependencies**: No external runtime dependencies

## Installation

```bash
npm install critical-section
```

## Quick Start

```typescript
import { criticalSection } from 'critical-section';

// Any object becomes a critical section lock
const database = { host: 'localhost', db: 'users' };
const userRecord = { id: 123, email: 'user@example.com' };

async function updateUser() {
  // Lock the specific user record to prevent race conditions
  const entered = await criticalSection.enter(userRecord);

  if (entered) {
    try {
      console.log('Updating user record...');
      await validateUserData(userRecord);
      await performDatabaseUpdate(userRecord);
      await updateSearchIndex(userRecord);
      // All 3 operations complete atomically - no partial updates
    } finally {
      // Always release the lock
      criticalSection.leave(userRecord);
    }
  }
}

// Try immediate access without waiting
async function quickUserCheck() {
  if (criticalSection.tryEnter(userRecord)) {
    try {
      console.log('Quick read operation');
      const userData = await readUserData(userRecord);
      return userData;
    } finally {
      criticalSection.leave(userRecord);
    }
  } else {
    console.log('User record is busy, using cache...');
    return await getCachedUserData(userRecord.id);
  }
}

// Multiple objects = independent locks
await Promise.all([
  updateUser(),           // Uses userRecord lock
  cleanupDatabase(),      // Uses database lock - runs concurrently!
]);
```

## API

### `criticalSection.enter(obj: object, timeout?: number): Promise<boolean>`

Enters a critical section for the given object. If the critical section is already occupied, the promise will wait until it becomes available or times out.

**Parameters:**

- `obj` - Any object to use as the critical section identifier
- `timeout` (optional) - Maximum time to wait in milliseconds. If not provided, waits indefinitely

**Returns:**

- `Promise<boolean>` - Resolves to `true` when successfully entered, `false` if timeout occurs

**Examples:**

```typescript
// Wait indefinitely
const success = await criticalSection.enter(myResource);
if (success) {
  // Critical section is now entered
}

// Wait with timeout
const entered = await criticalSection.enter(myResource, 5000);
if (entered) {
  // Got access within 5 seconds
} else {
  // Timeout occurred
}
```

### `criticalSection.tryEnter(obj: object): boolean`

Attempts to enter a critical section immediately without waiting.

**Parameters:**

- `obj` - Any object to use as the critical section identifier

**Returns:**

- `boolean` - `true` if successfully entered, `false` if already occupied

**Example:**

```typescript
if (criticalSection.tryEnter(myResource)) {
  // Got immediate access
  console.log('Entered critical section');
} else {
  // Resource is busy
  console.log('Resource unavailable');
}
```

### `criticalSection.leave(obj: object): void`

Leaves the critical section for the given object, allowing queued entries to proceed.

**Parameters:**

- `obj` - The object to leave the critical section for

**Example:**

```typescript
criticalSection.leave(myResource);
// Critical section is now available for others
```

## Usage Patterns

### Protecting Async Operations

```typescript
const database = { connection: 'db-pool' };

async function updateUser(userId: string, data: object) {
  const entered = await criticalSection.enter(database);

  if (entered) {
    try {
      const user = await db.findUser(userId);
      user.update(data);
      await user.save();
    } finally {
      criticalSection.leave(database);
    }
  }
}
```

### Browser: Preventing Double-Click Issues

```typescript
// Problem: Double-clicks can cause duplicate form submissions,
// leading to duplicate orders, payments, or data corruption
const submitButton = document.getElementById('submit-btn');

submitButton.addEventListener('click', async (event) => {
  if (criticalSection.tryEnter(submitButton)) {
    try {
      // These operations must complete as a unit
      await submitForm();
      showSuccessMessage();
    } finally {
      criticalSection.leave(submitButton);
    }
  } else {
    // Already processing - prevents duplicate submission
    console.log('Form submission already in progress');
  }
});
```

### Browser: Global Object Synchronization

```typescript
// Use document/window as locks for global operations
async function updateGlobalTheme(newTheme: string) {
  const entered = await criticalSection.enter(document, 1000);
  if (entered) {
    try {
      document.documentElement.setAttribute('data-theme', newTheme);
      await saveThemeToStorage(newTheme);
    } finally {
      criticalSection.leave(document);
    }
  }
}

// Prevent overlapping resize operations
// Without protection: rapid resize events could cause inconsistent UI state
// (e.g., canvas size updated but layout calculation still pending)
async function handleWindowResize() {
  if (criticalSection.tryEnter(window)) {
    try {
      // These 3 operations must complete atomically
      await recalculateLayout();
      await updateCanvasSize();
      await triggerRedraw();
    } finally {
      criticalSection.leave(window);
    }
  }
  // Skip if already processing - prevents UI corruption
}
```

### Server: Rate Limiting with tryEnter

```typescript
const rateLimiter = { endpoint: '/api/heavy-operation' };

async function handleRequest(req, res) {
  if (criticalSection.tryEnter(rateLimiter)) {
    try {
      // Process the request
      await processHeavyOperation(req, res);
    } finally {
      criticalSection.leave(rateLimiter);
    }
  } else {
    // Too many requests
    res.status(429).send('Rate limit exceeded');
  }
}
```

### Timeout-based Operations

```typescript
const slowResource = { name: 'slow-service' };

async function processWithTimeout() {
  const entered = await criticalSection.enter(slowResource, 3000);

  if (entered) {
    try {
      await performSlowOperation();
    } finally {
      criticalSection.leave(slowResource);
    }
  } else {
    // Handle timeout
    await fallbackOperation();
  }
}
```

### Queue Management

```typescript
const printQueue = { printer: 'office-printer' };

async function printDocument(document: string) {
  console.log(`Queuing document: ${document}`);

  // This will wait in line if printer is busy
  const entered = await criticalSection.enter(printQueue);

  if (entered) {
    try {
      console.log(`Printing: ${document}`);
      await simulatePrinting(document);
      console.log(`Finished: ${document}`);
    } finally {
      criticalSection.leave(printQueue);
    }
  }
}

// Multiple documents will print in order
printDocument('Report A');
printDocument('Report B');
printDocument('Report C');
```

## How It Works

Uses a `WeakMap` to associate objects with their critical section state. Different objects = independent locks. When objects are garbage collected, their critical section state is automatically cleaned up.

```typescript
const fileA = { path: '/tmp/fileA.txt' };
const fileB = { path: '/tmp/fileB.txt' };

await criticalSection.enter(fileA);  // ✅ Acquired
await criticalSection.enter(fileB);  // ✅ Also acquired (different object)
```

## Compatibility

- **TypeScript**: Full type definitions included
- **Browsers**: Chrome 36+, Firefox 6+, Safari 7.1+, Edge 12+
- **Node.js**: 12.0+
- **Modules**: ES modules, CommonJS, all modern bundlers

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

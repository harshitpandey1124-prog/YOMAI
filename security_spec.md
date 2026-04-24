# Security Specification for AI Tool App

## Data Invariants
1. A **User** profile must match the `request.auth.uid`.
2. **History** items must belong to the user who created them (`userId == request.auth.uid`).
3. **Payments** and **Upgrades** must be tied to the `userId` in the document path and data.
4. Timestamps (`createdAt`, `upgradedAt`) must be set using `request.time`.
5. Document IDs must be valid strings (size <= 128, alphanumeric).

## The "Dirty Dozen" Payloads (Red Team Test Cases)

1. **Identity Spoofing (Create User)**: Attempt to create a user profile for a different UID.
2. **Identity Spoofing (Create History)**: Attempt to create a history item with another user's `userId`.
3. **Identity Spoofing (Read User)**: Attempt to read another user's profile.
4. **Identity Spoofing (Read History)**: Attempt to read another user's history collection.
5. **PII Leak**: Attempt to list all users to scrape emails.
6. **State Shortcutting**: Attempt to update a pending payment to 'completed' as a normal user.
7. **Resource Poisoning**: Attempt to use a 1MB string as a document ID.
8. **Shadow Field Injection**: Attempt to create a user profile with an unauthorized `isAdmin: true` field.
9. **Timestamp Malice**: Attempt to set `createdAt` to a past date instead of `request.time`.
10. **Immutable Violation**: Attempt to change the `email` of an existing user profile during update.
11. **Query Scrape**: Attempt to fetch history items with a query that doesn't filter by `userId`.
12. **Foreign Reference**: Attempt to create a history item for a user that doesn't exist in the `/users` collection.

## Test Runner (firestore.rules_test.ts)
```typescript
// To be implemented in the testing phase
```

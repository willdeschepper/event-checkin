# Check-in API contract

This contract keeps the mobile queue and the server consistent during retries,
timeouts and concurrent check-ins.

## List events

`GET /events`

```json
[
  {
    "id": "event-health-2026",
    "name": "Health Innovation Summit",
    "venue": "Main auditorium",
    "startsAt": "2026-09-15T12:00:00.000Z",
    "expectedAttendees": 1200
  }
]
```

## Register a check-in

`POST /events/:eventId/check-ins`

Headers:

```text
Authorization: Bearer <access-token>
Idempotency-Key: <uuid-v4>
Content-Type: application/json
```

Body:

```json
{
  "attendeeCode": "EVT-8F31A2",
  "method": "qr",
  "occurredAt": "2026-09-03T12:00:00.000Z"
}
```

Successful response:

```json
{
  "status": "confirmed",
  "receiptId": "receipt-01K4..."
}
```

### Idempotency rules

1. Persist the key, authenticated operator, event, request fingerprint and response
   in the same transaction as the check-in.
2. Repeating the same key and payload returns the original status and body.
3. Reusing a key with a different payload returns `409 Conflict`.
4. Enforce a database uniqueness constraint for `(event_id, attendee_code)`.
5. A concurrent duplicate returns the existing receipt instead of creating a
   second attendance record.

## Reconcile an uncertain request

`GET /check-ins/operations/:idempotencyKey`

Confirmed:

```json
{
  "status": "confirmed",
  "receiptId": "receipt-01K4..."
}
```

Still processing:

```json
{
  "status": "processing"
}
```

The endpoint returns `404` when the operation key was not persisted. The mobile
client can then submit the same command again with the same key.

## Operational recommendations

- Keep the transaction short and index `idempotency_key`, `event_id` and
  `(event_id, attendee_code)`.
- Publish side effects such as analytics or notifications through an outbox.
- Apply rate limiting by operator/device without blocking legitimate entrance
  peaks.
- Track request latency, duplicate-key reuse, rejected check-ins and queue age.
- Scale API instances horizontally while the database remains the source of truth
  for uniqueness.

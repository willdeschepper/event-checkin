import { check, sleep } from 'k6';
import http from 'k6/http';

const baseUrl = __ENV.BASE_URL || 'http://localhost:3000';
const eventId = __ENV.EVENT_ID || 'event-health-2026';
const token = __ENV.TOKEN || '';
const rate = Number(__ENV.RATE || 40);
const duration = __ENV.DURATION || '30s';

export const options = {
  scenarios: {
    entrancePeak: {
      executor: 'constant-arrival-rate',
      rate,
      timeUnit: '1s',
      duration,
      preAllocatedVUs: 80,
      maxVUs: 300,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

export default function () {
  const identity = `${__VU}-${__ITER}-${Date.now()}`;
  const suffix = `${Date.now().toString(16)}${__VU.toString(16)}${__ITER.toString(16)}`
    .slice(-12)
    .padStart(12, '0');
  const idempotencyKey = `00000000-0000-4000-8000-${suffix}`;
  const headers = {
    'Content-Type': 'application/json',
    'Idempotency-Key': idempotencyKey,
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = http.post(
    `${baseUrl}/events/${eventId}/check-ins`,
    JSON.stringify({
      attendeeCode: `LOAD-${identity}`,
      method: 'qr',
      occurredAt: new Date().toISOString(),
    }),
    {
      headers,
    },
  );

  check(response, {
    'check-in accepted': value => value.status === 200 || value.status === 201,
  });
  sleep(0.05);
}

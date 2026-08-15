/** Every error response is application/problem+json (RFC 9457). */

export function problem(res, { status, type, title, detail }) {
  res.status(status)
    .type('application/problem+json')
    .send({ type, title, status, detail });
}

export function notFound(res, what) {
  problem(res, {
    status: 404,
    type: 'https://bookstore.example/problems/not-found',
    title: 'Not found',
    detail: `No ${what} with that id.`,
  });
}

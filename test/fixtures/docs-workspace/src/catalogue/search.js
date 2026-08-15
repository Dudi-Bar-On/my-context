import { searchKey } from '../cache/keys.js';

const SEARCH_SQL = `
  SELECT isbn, title, author, price_cents
    FROM books, plainto_tsquery('english', $2) AS q
   WHERE tenant_id = $1 AND search_vector @@ q
   ORDER BY ts_rank(search_vector, q) DESC
   LIMIT 20
`;

export async function searchBooks(db, cache, tenantId, query) {
  const key = searchKey(tenantId, query);
  const cached = await cache.get(key);
  if (cached) return cached;

  const { rows } = await db.query(SEARCH_SQL, [tenantId, query]);
  await cache.set(key, rows, { ttlSeconds: 60 });
  return rows;
}

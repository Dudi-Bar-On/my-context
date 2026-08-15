/**
 * Two storefronts share one Redis cluster, so every key carries the tenant
 * that owns it.
 */
export function bookKey(tenantId, isbn) {
  return `t:${tenantId}:book:${isbn}`;
}

export function searchKey(tenantId, query) {
  return `t:${tenantId}:search:${query.trim().toLowerCase()}`;
}

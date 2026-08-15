/** Prices are integer cents everywhere inside the API. */

export function lineTotal(unitCents, quantity) {
  return unitCents * quantity;
}

export function orderTotal(lines) {
  return lines.reduce((sum, line) => sum + lineTotal(line.unitCents, line.quantity), 0);
}

/** Cents to a display string. The only place a price becomes a decimal. */
export function formatPrice(cents, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency })
    .format(cents / 100);
}

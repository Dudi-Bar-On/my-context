import { orderTotal } from '../billing/prices.js';
import { notFound, problem } from './errors.js';

/** Step two of checkout: payment to confirmation. */
export async function confirmOrder(req, res, db, log) {
  const order = await db.findOrder(req.params.id);
  if (!order) return notFound(res, 'order');

  if (order.paymentIntent === null) {
    return problem(res, {
      status: 409,
      type: 'https://bookstore.example/problems/unpaid',
      title: 'Order has no payment',
      detail: 'Complete the payment step before confirming.',
    });
  }

  const totalCents = orderTotal(order.lines);
  await db.confirmOrder(order.id, totalCents);
  // The customer id, never the customer's email address.
  log.info({ orderId: order.id, customerId: order.customerId, totalCents }, 'order confirmed');
  res.send({ id: order.id, totalCents });
}

/**
 * WhatsApp Bill Sender — Meta Cloud API
 * Non-blocking: silently skips if env vars are missing.
 */

const WA_TOKEN    = process.env.WHATSAPP_ACCESS_TOKEN;
const WA_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

function fmt(n: number) {
  return 'Rs.' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export interface WhatsAppOrderItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface WhatsAppOrder {
  invoiceNumber: string;
  items: WhatsAppOrderItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
}

export async function sendWhatsAppBill(
  phone: string,
  order: WhatsAppOrder,
  shopName: string,
  pointsEarned?: number,
  totalPoints?: number
): Promise<boolean> {
  if (!WA_TOKEN || !WA_PHONE_ID) {
    console.warn('[WhatsApp] Skipping — WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID not set.');
    return false;
  }

  // Normalize phone: strip non-digits, ensure country code
  let to = phone.replace(/\D/g, '');
  if (to.startsWith('0')) to = '91' + to.slice(1);   // 0xxx → 91xxx (India)
  if (to.length === 10)   to = '91' + to;             // 10-digit → add 91

  // Build message text
  const lines: string[] = [];
  lines.push(`🧾 *Bill from ${shopName}*`);
  lines.push(`Invoice: #${order.invoiceNumber}`);
  lines.push('─────────────────────');

  for (const item of order.items) {
    const line = `${item.name} × ${item.quantity}  ${fmt(item.total)}`;
    lines.push(line);
  }

  lines.push('─────────────────────');
  if (order.subtotal !== order.totalAmount) {
    lines.push(`Subtotal: ${fmt(order.subtotal)}`);
  }
  if (order.taxAmount > 0) {
    lines.push(`Tax: ${fmt(order.taxAmount)}`);
  }
  if (order.discountAmount > 0) {
    lines.push(`Discount: -${fmt(order.discountAmount)}`);
  }
  lines.push(`*Total: ${fmt(order.totalAmount)}*`);
  lines.push(`Payment: ${order.paymentMethod}`);

  if (pointsEarned !== undefined && pointsEarned > 0) {
    lines.push('─────────────────────');
    lines.push(`⭐ Points earned: *+${pointsEarned} pts*`);
    if (totalPoints !== undefined) {
      lines.push(`Total balance: *${totalPoints} pts*`);
    }
  }

  lines.push('─────────────────────');
  lines.push('Thank you! Visit again 😊');

  const text = lines.join('\n');

  try {
    const response = await fetch(
      `https://graph.facebook.com/v19.0/${WA_PHONE_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WA_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: text },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error(`[WhatsApp] API error ${response.status}:`, err);
      return false;
    }

    console.log(`[WhatsApp] Bill sent to ${to} for order ${order.invoiceNumber}`);
    return true;
  } catch (e) {
    console.error('[WhatsApp] Network error:', e);
    return false;
  }
}

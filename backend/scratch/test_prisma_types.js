const { PaymentMethod } = require('@prisma/client');
console.log('PaymentMethod:', PaymentMethod);
if (PaymentMethod) {
  console.log('Keys:', Object.keys(PaymentMethod));
} else {
  console.error('PaymentMethod is UNDEFINED');
}

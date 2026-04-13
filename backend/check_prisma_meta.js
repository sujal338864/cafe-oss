const { Prisma } = require('@prisma/client');
const product = Prisma.dmmf.datamodel.models.find(m => m.name === 'Product');
const field = product.fields.find(f => f.name === 'isAvailable');
console.log('Product Model Fields:', product.fields.map(f => f.name).join(', '));
console.log('isAvailable field:', JSON.stringify(field, null, 2));

import PDFDocument from 'pdfkit';

export function generateInvoicePDF(order: any, shop: any) {
  const doc = new PDFDocument({ margin: 40, size: 'A5' }); // A5 is standard receipt size

  // Header
  doc
    .fillColor('#111827')
    .fontSize(16)
    .font('Helvetica-Bold')
    .text(shop.name || 'Our Shop', { align: 'center' });
  
  if (shop.address) {
    doc.fontSize(10).font('Helvetica').text(shop.address, { align: 'center' });
  }
  if (shop.phone) {
    doc.text(`Phone: ${shop.phone}`, { align: 'center' });
  }

  doc.moveDown(1);
  doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
  doc.moveDown(0.5);

  // Order Details
  doc
    .fontSize(10)
    .fillColor('#4b5563')
    .font('Helvetica-Bold')
    .text(`Invoice: `, { continued: true })
    .font('Helvetica')
    .text(`${order.invoiceNumber}`)
    .font('Helvetica-Bold')
    .text(`Date: `, { continued: true })
    .font('Helvetica')
    .text(new Date(order.createdAt).toLocaleString('en-IN'))
    .font('Helvetica-Bold')
    .text(`Payment: `, { continued: true })
    .font('Helvetica')
    .text(`${order.paymentMethod} (${order.paymentStatus})`);

  if (order.customer) {
    doc
      .font('Helvetica-Bold')
      .text(`Customer: `, { continued: true })
      .font('Helvetica')
      .text(`${order.customer.name || ''} (${order.customer.phone})`);
  }

  doc.moveDown(1);
  doc.strokeColor('#e5e7eb').moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
  doc.moveDown(0.5);

  // Table Header
  const tableTop = doc.y;
  doc
    .font('Helvetica-Bold')
    .fillColor('#111827')
    .fontSize(10)
    .text('Item', 40, tableTop)
    .text('Qty', 180, tableTop, { width: 30, align: 'right' })
    .text('Price', 220, tableTop, { width: 50, align: 'right' })
    .text('Total', 280, tableTop, { width: 60, align: 'right' });

  doc.moveDown(0.3);
  doc.strokeColor('#f3f4f6').moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
  doc.moveDown(0.5);

  // Items
  doc.font('Helvetica').fillColor('#4b5563');
  order.items.forEach((item: any) => {
    const itemTotal = Number(item.unitPrice) * item.quantity;
    const currentY = doc.y;

    doc
      .text(item.name, 40, currentY, { width: 130 })
      .text(String(item.quantity), 180, currentY, { width: 30, align: 'right' })
      .text(Number(item.unitPrice).toFixed(2), 220, currentY, { width: 50, align: 'right' })
      .text(itemTotal.toFixed(2), 280, currentY, { width: 60, align: 'right' });
    
    doc.moveDown(0.5);
  });

  doc.moveDown(1);
  doc.strokeColor('#e5e7eb').moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
  doc.moveDown(0.5);

  // Totals Footer
  const footerY = doc.y;
  doc
    .fontSize(10)
    .font('Helvetica')
    .fillColor('#4b5563')
    .text('Subtotal:', 200, footerY, { width: 70, align: 'right' })
    .font('Helvetica-Bold')
    .text(Number(order.subtotal).toFixed(2), 270, footerY, { width: 70, align: 'right' });

  if (Number(order.taxAmount) > 0) {
    doc.moveDown(0.3);
    doc
      .font('Helvetica')
      .text('Tax:', 200, doc.y, { width: 70, align: 'right' })
      .text(Number(order.taxAmount).toFixed(2), 270, doc.y, { width: 70, align: 'right' });
  }

  if (Number(order.discountAmount) > 0) {
    doc.moveDown(0.3);
    doc
      .font('Helvetica')
      .fillColor('#dc2626')
      .text('Discount:', 200, doc.y, { width: 70, align: 'right' })
      .text(`-${Number(order.discountAmount).toFixed(2)}`, 270, doc.y, { width: 70, align: 'right' });
  }

  doc.moveDown(0.5);
  doc
    .fontSize(12)
    .font('Helvetica-Bold')
    .fillColor('#111827')
    .text('Grand Total:', 180, doc.y, { width: 90, align: 'right' })
    .text(`Rs.${Number(order.totalAmount).toFixed(2)}`, 270, doc.y, { width: 70, align: 'right' });

  doc.moveDown(2);
  doc
    .fontSize(10)
    .font('Helvetica-Oblique')
    .fillColor('#9ca3af')
    .text('Thank you for ordering with us!', { align: 'center' });

  doc.end();
  return doc;
}

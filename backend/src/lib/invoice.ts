import PDFDocument from 'pdfkit';

export function generateInvoicePDF(order: any, shop: any) {
  // Parse invoice settings
  let settings: any = {};
  if (shop.invoiceSettings) {
    try { settings = JSON.parse(shop.invoiceSettings); } catch (e) {}
  }

  const isThermal = settings.template === 'thermal';
  
  // Sizing configuration
  const pageSize = isThermal ? [168, 600] : 'A5'; 
  const margin = isThermal ? 10 : 40;

  const doc = new PDFDocument({ margin, size: pageSize });

  // 🧪 Set styles based on isThermal trigger
  const fNormal = isThermal ? 'Courier' : 'Helvetica';
  const fBold = isThermal ? 'Courier-Bold' : 'Helvetica-Bold';

  const sizeTitle = isThermal ? 11 : 16;
  const sizeText = isThermal ? 8 : 10;
  const sizeSmall = isThermal ? 7 : 8;

  // Header 
  if (isThermal) {
    // ☕ POS Style Thermal Layout
    const shopNameUpper = (shop.name || 'CAFE OSS').toUpperCase();
    doc
      .fillColor('#111827')
      .fontSize(sizeTitle)
      .font(fBold)
      .text(shopNameUpper, { align: 'center' });

    const dateStr = new Date(order.createdAt).toLocaleString('en-IN', { 
      day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true 
    });
    doc
      .font(fNormal)
      .fontSize(sizeSmall)
      .text(dateStr.replace(',', ''), { align: 'center' });

    doc.moveDown(0.3);
    // Dotted separator
    doc.strokeColor('#4b5563').dash(2, { space: 1 }).lineWidth(0.5)
       .moveTo(margin, doc.y).lineTo(doc.page.width - margin, doc.y).stroke().undash();
    doc.moveDown(0.3);

  } else {
    // 📄 Standard A5 Layout
    doc
      .fillColor('#111827')
      .fontSize(sizeTitle)
      .font(fBold)
      .text(shop.name || 'CAFE OSS', { align: 'center' });
    
    if (shop.address) doc.fontSize(sizeText).font(fNormal).text(shop.address, { align: 'center' });
    if (shop.phone) doc.fontSize(sizeText).text(`Phone: ${shop.phone}`, { align: 'center' });
    if (shop.gstNumber && settings.showGst !== false) doc.fontSize(sizeText).text(`GST: ${shop.gstNumber}`, { align: 'center' });

    doc.moveDown(0.5);
    doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(margin, doc.y).lineTo(doc.page.width - margin, doc.y).stroke();
    doc.moveDown(0.5);
  }

  // Order Detail Layouts
  if (!isThermal) {
    doc
      .fontSize(sizeSmall)
      .fillColor('#4b5563')
      .font(fBold).text(`Invoice: `, { continued: true }).font(fNormal).text(`${order.invoiceNumber}`)
      .font(fBold).text(`Date: `, { continued: true }).font(fNormal).text(new Date(order.createdAt).toLocaleDateString('en-IN'))
      .font(fBold).text(`Payment: `, { continued: true }).font(fNormal).text(`${order.paymentMethod} (${order.paymentStatus})`);

    if (order.customer) {
      doc.font(fBold).text(`Cust: `, { continued: true }).font(fNormal).text(`${order.customer.name || 'Guest'} (${order.customer.phone})`);
    }

    doc.moveDown(0.5);
    doc.strokeColor('#e5e7eb').moveTo(margin, doc.y).lineTo(doc.page.width - margin, doc.y).stroke();
    doc.moveDown(0.5);
  }

  // Table Header Setup
  const tableTop = doc.y;
  const colA = margin;                             
  const colB = isThermal ? 90 : 180;               
  const colC = isThermal ? 110 : 220;              
  const colD = doc.page.width - margin - (isThermal ? 18 : 35); 

  const labelItem = isThermal ? 'ITEM' : 'Item';
  const labelQty = isThermal ? 'QTY' : 'Qty';
  const labelAmt = isThermal ? 'AMT' : 'Price';

  doc
    .font(fBold)
    .fillColor('#111827')
    .fontSize(sizeSmall)
    .text(labelItem, colA, tableTop)
    .text(labelQty, colB, tableTop, { width: 18, align: 'right' })
    .text(labelAmt, isThermal ? colD - 35 : colC, tableTop, { width: 35, align: 'right' });

  if (isThermal) {
    // Solid Header for items list in POS screenshot 
    doc.moveDown(0.2);
    doc.strokeColor('#4b5563').dash(2, { space: 1 }).lineWidth(0.5)
       .moveTo(margin, doc.y).lineTo(doc.page.width - margin, doc.y).stroke().undash();
    doc.moveDown(0.3);
  } else {
    doc.moveDown(0.3);
    doc.strokeColor('#f3f4f6').moveTo(margin, doc.y).lineTo(doc.page.width - margin, doc.y).stroke();
    doc.moveDown(0.4);
  }

  // Items List
  doc.font(fNormal).fillColor('#4b5563').fontSize(sizeSmall);
  order.items.forEach((item: any) => {
    const itemTotal = Number(item.unitPrice) * item.quantity;
    const currentY = doc.y;

    doc
      .text(item.name, colA, currentY, { width: isThermal ? 75 : 130 })
      .text(String(item.quantity), colB, currentY, { width: 18, align: 'right' })
      // Print item Total on right column
      .text(itemTotal.toFixed(0), colD, currentY, { width: 35, align: 'right' });
    
    doc.moveDown(0.3);
  });

  doc.moveDown(0.4);
  if (isThermal) {
    doc.strokeColor('#4b5563').dash(2, { space: 1 }).lineWidth(0.5)
       .moveTo(margin, doc.y).lineTo(doc.page.width - margin, doc.y).stroke().undash();
  } else {
    doc.strokeColor('#e5e7eb').moveTo(margin, doc.y).lineTo(doc.page.width - margin, doc.y).stroke();
  }
  doc.moveDown(0.4);

  // Totals Section
  const footerX = isThermal ? 70 : 180;
  const valX = isThermal ? 105 : 255;
  const valW = isThermal ? 45 : 70;

  let rowY = doc.y;

  const labelSubtotal = isThermal ? 'Subtotal' : 'Subtotal:';
  const labelTax = isThermal ? 'Tax' : 'Tax:';
  const labelTotal = isThermal ? 'TOTAL' : 'Grand Total:';

  doc
    .fontSize(sizeSmall)
    .font(fNormal)
    .text(labelSubtotal, footerX, rowY, { width: 45, align: 'left' })
    .text('Rs.' + Number(order.subtotal).toFixed(0), valX, rowY, { width: valW, align: 'right' });

  if (Number(order.taxAmount) > 0) {
    doc.moveDown(0.2);
    rowY = doc.y;
    doc
      .text(labelTax, footerX, rowY, { width: 45, align: 'left' })
      .text('Rs.' + Number(order.taxAmount).toFixed(0), valX, rowY, { width: valW, align: 'right' });
  }

  if (Number(order.discountAmount) > 0) {
    doc.moveDown(0.2);
    rowY = doc.y;
    doc
      .fillColor('#dc2626')
      .text('Disc:', footerX, rowY, { width: 45, align: 'left' })
      .text('-Rs.' + Number(order.discountAmount).toFixed(0), valX, rowY, { width: valW, align: 'right' });
  }

  doc.moveDown(0.3);
  if (isThermal) {
    doc.strokeColor('#4b5563').dash(2, { space: 1 }).lineWidth(0.5)
       .moveTo(margin, doc.y).lineTo(doc.page.width - margin, doc.y).stroke().undash();
    doc.moveDown(0.3);
  }

  rowY = doc.y;
  doc
    .fontSize(isThermal ? sizeSmall : 12)
    .font(fBold)
    .fillColor('#111827')
    .text(labelTotal, footerX, rowY, { width: 45, align: 'left' })
    .text('Rs.' + Number(order.totalAmount).toFixed(0), valX, rowY, { width: valW, align: 'right' });

  doc.moveDown(0.4);
  if (isThermal) {
     doc
       .font(fNormal).fontSize(sizeSmall).fillColor('#4b5563')
       .text(`Payment: ${order.paymentMethod}`, margin, doc.y);
     doc.moveDown(0.3);
     doc.strokeColor('#4b5563').dash(2, { space: 1 }).lineWidth(0.5)
        .moveTo(margin, doc.y).lineTo(doc.page.width - margin, doc.y).stroke().undash();
  }

  doc.moveDown(1.2);
  
  // Custom or Default Footer
  const footerText = settings.footer || 'Thank you! Please visit again.';
  doc
    .fontSize(sizeSmall)
    .font(isThermal ? fNormal : 'Helvetica-Oblique')
    .fillColor('#4b5563')
    .text(footerText, { align: 'center', width: doc.page.width - margin * 2 });

  doc.end();
  return doc;
}

fetch("https://cafe-oss.onrender.com/api/menu/order", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ customerName: "Test", paymentMethod: "CASH", items: [] })
}).then(res => res.json()).then(data => {
  console.log("RESPONSE:", JSON.stringify(data, null, 2));
}).catch(console.error);

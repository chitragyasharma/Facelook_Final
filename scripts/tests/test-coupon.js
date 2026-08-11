fetch("https://facelook-backend.onrender.com/api/admin/coupons", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ code: "TEST100", type: "flat", value: 100, minOrder: 500, isActive: true })
}).then(r => console.log(r.status)).catch(console.error);

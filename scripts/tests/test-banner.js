fetch("https://facelook-backend.onrender.com/api/settings").then(r => r.json()).then(data => {
  console.log(data);
}).catch(console.error);

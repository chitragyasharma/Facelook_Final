const https = require('https');
https.get('https://facelook-backend.onrender.com/api/products', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      const prod = json.products[json.products.length - 1];
      console.log(JSON.stringify(prod.palette, null, 2));
    } catch(e) {
      console.log("Error parsing JSON:", e);
    }
  });
}).on('error', err => console.log(err));

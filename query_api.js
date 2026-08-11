const https = require('https');
https.get('https://facelook-backend.onrender.com/api/products', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      if (json.products) {
        console.log("Last product ID:", json.products[json.products.length - 1].id);
        console.log("Last product name:", json.products[json.products.length - 1].name);
        console.log("Last product palette:", JSON.stringify(json.products[json.products.length - 1].palette, null, 2));
      } else {
        console.log(data);
      }
    } catch(e) {
      console.log("Error parsing JSON:", e);
    }
  });
}).on('error', err => console.log(err));

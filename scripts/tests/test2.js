fetch("https://facelook-backend.onrender.com/api/products").then(r => r.json()).then(data => {
  const cats = data.map(d => d.cat);
  const counts = {};
  cats.forEach(c => { counts[c] = (counts[c] || 0) + 1; });
  console.log(counts);
});

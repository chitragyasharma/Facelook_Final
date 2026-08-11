const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/facelook').then(async () => {
  const db = mongoose.connection.db;
  const p = await db.collection('products').findOne({ name: { $regex: 'miniature', $options: 'i' } });
  if (!p) { console.log('Product not found'); return; }
  
  let mainSrc = p.image;
  if (p.images && p.images.length > 0) mainSrc = p.images[0];
  console.log('mainSrc length:', typeof mainSrc === 'string' ? mainSrc.length : typeof mainSrc);
  console.log('isCompactProduct:', p.name && (p.name.toLowerCase().includes('cover me') || p.name.toLowerCase().includes('compact')));
  
  console.log('palette length:', p.palette ? p.palette.length : 'none');
  if (p.palette && p.palette.length > 0) {
    console.log('first palette item:', { name: p.palette[0].name, hex: p.palette[0].hex, hasImage: !!p.palette[0].image });
  }
  
  let html = mainSrc ? `<img src="${mainSrc.substring(0, 50)}..." id="main-detail-img" style="width:100%;object-fit:contain;">` : (p.emoji || '💄');
  console.log('detail-emoji innerHTML:', html);
  
  process.exit();
});

require('dotenv').config({ path: '.env.test' });
const mongoose = require('mongoose');
const { Product } = require('./server/models');

async function test() {
    await mongoose.connect(process.env.MONGODB_URI);
    const products = await Product.find({}, '-_id -__v').sort({ id: 1 });
    console.log(`Found ${products.length} products in DB.`);
    if (products.length > 0) {
        console.log('Sample product:', JSON.stringify(products[0], null, 2));
    }
    process.exit(0);
}
test();

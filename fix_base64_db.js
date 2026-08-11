require('dotenv').config({ path: './server/.env' }) || require('dotenv').config();
const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    image: String,
    palette: [{ image: String }]
}, { strict: false });

const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);

async function fix() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to DB.");

        const products = await Product.find({});
        let updatedCount = 0;

        for (let p of products) {
            let changed = false;

            if (p.image && p.image.startsWith('assets/images/data:image')) {
                p.image = p.image.replace('assets/images/', '');
                changed = true;
            }

            if (p.palette && p.palette.length > 0) {
                for (let pal of p.palette) {
                    if (pal.image && pal.image.startsWith('assets/images/data:image')) {
                        pal.image = pal.image.replace('assets/images/', '');
                        changed = true;
                    }
                }
            }

            if (changed) {
                await p.save();
                updatedCount++;
                console.log(`Fixed base64 for product: ${p.name || p._id}`);
            }
        }

        console.log(`Finished fixing ${updatedCount} products.`);
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

fix();

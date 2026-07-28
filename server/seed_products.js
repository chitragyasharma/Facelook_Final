require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { Product } = require('../server/models');

const connectDB = async () => {
    console.log('Generating products.json for static fallback...');
    await seedImagesAsProducts();
};

const seedImagesAsProducts = async () => {
    try {
        const clientDir = path.join(__dirname, '../client');
        const files = fs.readdirSync(clientDir);
        
        // Filter out non-product images
        const exclude = ['admin.html', 'index.html.html', 'logo.png', 'logo.svg', 'newsletter_img.png', 'rzp-key.csv'];
        const productFiles = files.filter(f => {
            return (f.endsWith('.webp') || f.endsWith('.png') || f.endsWith('.jpg')) 
                && !exclude.includes(f)
                && !f.startsWith('category_');
        });

        console.log(`Found ${productFiles.length} product images.`);

        const products = productFiles.map((file, idx) => {
            let cat = 'Face';
            let name = file.split('.')[0].trim();
            // Capitalize
            name = name.charAt(0).toUpperCase() + name.slice(1);
            
            let nameLower = name.toLowerCase();
            if (nameLower.includes('lip') || nameLower.includes('velvet') || nameLower.includes('dream')) cat = 'Lips';
            if (nameLower.includes('compact') || nameLower.includes('foundation') || nameLower.includes('sindoor')) cat = 'Face';
            if (nameLower.includes('diamond') || nameLower.includes('posh')) cat = 'Eyes';

            // Extract shade if present
            let shade = 'Standard';
            const shadeMatch = name.match(/(shade|tint)\s*([0-9a-zA-Z\s\-]+)?/i);
            if (shadeMatch) {
                shade = shadeMatch[2] ? shadeMatch[2].trim() : shadeMatch[1];
            } else if (nameLower.includes('-')) {
                shade = name.split('-')[1].trim();
            }
            
            // Emoji mapping
            let emoji = '✨';
            if (cat === 'Lips') emoji = '💋';
            if (cat === 'Face') emoji = '💆';
            if (cat === 'Eyes') emoji = '👁️';

            // Base ID start after the hardcoded 12
            const pid = 100 + idx;

            // Price simulation
            const price = 199 + (idx % 5) * 100;
            const orig = price + 100 + (idx % 3) * 50;

            return {
                id: pid,
                name: name.replace(/ \- .*/, '').replace(/ shade.*/i, ''),
                cat: cat,
                price: price,
                orig: orig,
                rating: (4.0 + (idx % 10) / 10).toFixed(1),
                reviews: 50 + (idx * 7) % 300,
                shade: shade,
                emoji: emoji,
                tag: idx % 10 === 0 ? 'New' : (idx % 7 === 0 ? 'Bestseller' : null),
                desc: 'Premium quality ' + cat.toLowerCase() + ' product for your daily glow.',
                image: file // Not in the schema currently, but we can assume it loads by name or we can just rely on the frontend structure
            };
        });

        fs.writeFileSync(path.join(__dirname, 'products.json'), JSON.stringify(products, null, 2));
        console.log(`Successfully generated products.json with ${products.length} products!`);
    } catch (e) {
        console.error('Error seeding products:', e);
    }
};

connectDB();

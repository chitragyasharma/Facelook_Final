const mongoose = require('mongoose');
require('dotenv').config();

const CouponSchema = new mongoose.Schema({
    id: Number,
    code: String,
    isActive: Boolean,
    validFrom: Date,
    validTo: Date,
    usageLimit: Number,
    usedCount: Number,
    minOrder: Number
});

const Coupon = mongoose.model('Coupon', CouponSchema, 'coupons'); // Use exact collection name if necessary

async function test() {
    await mongoose.connect('mongodb://127.0.0.1:27017/facelook');
    const coupons = await Coupon.find();
    console.log("Coupons in DB:", coupons);
    process.exit();
}

test();

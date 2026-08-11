const mongoose = require('mongoose');
const { Coupon } = require('./server/models');
require('dotenv').config();

async function test() {
    await mongoose.connect('mongodb://127.0.0.1:27017/facelook');
    try {
        const lastCoupon = await Coupon.findOne().sort({ id: -1 });
        const id = lastCoupon ? lastCoupon.id + 1 : 1;
        const coupon = new Coupon({
            id,
            code: 'TEST1234',
            type: 'flat',
            value: 100,
            minOrder: 0,
            isActive: true
        });
        await coupon.save();
        console.log("Success:", coupon);
    } catch(e) {
        console.error("Error:", e);
    }
    await mongoose.disconnect();
}
test();

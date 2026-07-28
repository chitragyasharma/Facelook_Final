const Razorpay = require('razorpay');

const razorpay = new Razorpay({
    key_id: 'rzp_live_TIcgUZKzBnTB2z',
    key_secret: 'dDvKKcOmSELiayJUqlGGQw1C'
});

async function testRazorpay() {
    try {
        const options = {
            amount: 100 * 100, // 100 INR
            currency: "INR",
            receipt: "test_receipt_1"
        };
        const order = await razorpay.orders.create(options);
        console.log("Success! Order created:", order.id);
    } catch (error) {
        console.error("Razorpay Error:");
        console.error(error);
    }
}

testRazorpay();

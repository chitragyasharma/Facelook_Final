const Razorpay = require('razorpay');

const razorpay = new Razorpay({
    key_id: 'rzp_live_T9WW8IlTytpI0n',
    key_secret: 'wmVhLabHwm4IQkRWzjO5o1Gg'
});

async function test() {
    try {
        const options = {
            amount: 5050,
            currency: "INR",
            receipt: `receipt_${Date.now()}`
        };
        await razorpay.orders.create(options);
    } catch (error) {
        console.log("type of error:", typeof error);
        console.log("error constructor:", error.constructor.name);
        console.log("error keys:", Object.keys(error));
        console.log("has error.error:", !!error.error);
        if (error.error) {
            console.log("type of error.error:", typeof error.error);
            console.log("error.error keys:", Object.keys(error.error));
            console.log("error.error.description:", error.error.description);
        }
        
        let errDesc = 'Unknown error';
        if (error && error.error && error.error.description) {
            errDesc = error.error.description;
        } else if (error && error.message) {
            errDesc = error.message;
        } else {
            try {
                errDesc = typeof error === 'object' ? JSON.stringify(error) : String(error);
            } catch(e) {}
        }
        console.log("errDesc would be:", errDesc);
    }
}
test();

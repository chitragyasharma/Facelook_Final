const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    email: { type: String, unique: true, sparse: true },
    phone: { type: String, unique: true, sparse: true },
});
const User = mongoose.model('TestUser', UserSchema);

async function run() {
    await mongoose.connect('mongodb://127.0.0.1:27017/test_facelook');
    await User.deleteMany({});
    
    try {
        await new User({ phone: '123' }).save();
        await new User({ phone: '456' }).save();
        console.log("Success! Sparse works with undefined");
    } catch(e) {
        console.log("Error 1:", e.message);
    }
    
    try {
        await new User({ phone: '789', email: null }).save();
        await new User({ phone: '012', email: null }).save();
        console.log("Success! Sparse works with null");
    } catch(e) {
        console.log("Error 2:", e.message);
    }
    
    process.exit(0);
}
run();

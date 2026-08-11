require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const connectDB = require('./db');
const { User, Product, Cart, Wishlist, Order, Review, Coupon, Notification, Setting } = require('./models');
const fs = require('fs');
const adminRoutes = require('./admin-routes');
const Razorpay = require('razorpay');
const nodemailer = require('nodemailer');

const app = express();
app.set('trust proxy', 1); // Required for rate limiting behind proxies like Render
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || "facelook_super_secret_key";

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'secret_placeholder'
});

// Connect to MongoDB
connectDB();

app.use(helmet({ contentSecurityPolicy: false })); // Keep scripts/styles working for monolithic SPA
app.use(compression());
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));

// Admin routes
app.use('/api/admin', adminRoutes);

// --- Middleware ---
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: "Access denied" });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: "Invalid token" });
        req.user = user;
        next();
    });
}

// --- EMAIL & NOTIFICATIONS UTILITY ---
const sendCustomerEmail = async (to, subject, text) => {
    if (!to || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
        });
        transporter.sendMail({
            from: '"Facelook Cosmetics" <' + process.env.EMAIL_USER + '>',
            to,
            subject,
            text
        }).catch(err => console.error('Background email error:', err.message));
    } catch (err) {
        console.error('Error sending customer email:', err.message);
    }
};

app.get('/api/notifications', authenticateToken, async (req, res) => {
    try {
        const notifications = await Notification.find({ user_id: req.user.id }).sort({ createdAt: -1 }).limit(50);
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching notifications' });
    }
});

app.put('/api/notifications/:id/read', authenticateToken, async (req, res) => {
    try {
        const queryId = req.params.id;
        const query = { user_id: req.user.id };
        if (queryId.length === 24) {
            query.$or = [{ id: parseInt(queryId) || 0 }, { _id: queryId }];
        } else {
            query.id = parseInt(queryId);
        }
        await Notification.findOneAndUpdate(query, { isRead: true });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error marking notification read' });
    }
});

// --- AUTH ROUTES ---
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });

        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ error: 'Email already exists' });

        const hash = bcrypt.hashSync(password, 10);

        // Auto-increment logic
        const lastUser = await User.findOne().sort({ id: -1 });
        const id = lastUser ? lastUser.id + 1 : 1;

        const newUser = new User({ id, name, email, password: hash });
        await newUser.save();

        const token = jwt.sign({ id, name, email }, SECRET_KEY, { expiresIn: '7d' });
        res.json({ token, user: { name, email } });
    } catch (error) {
        res.status(500).json({ error: 'Server error during registration' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user || !user.password || !bcrypt.compareSync(password, user.password)) {
            return res.status(400).json({ error: "Invalid credentials (did you sign up with Google?)" });
        }

        const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, SECRET_KEY, { expiresIn: '7d' });
        res.json({ token, user: { name: user.name, email: user.email } });
    } catch (error) {
        res.status(500).json({ error: 'Server error during login' });
    }
});

// --- MSG91 OTP Integration ---
const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY;
const MSG91_TEMPLATE_ID = process.env.MSG91_TEMPLATE_ID;
const OTP_STORE = {}; // Fallback for when MSG91 is not configured

const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per window
    message: { error: 'Too many OTP requests from this IP, please try again after 15 minutes' }
});

app.post('/api/auth/send-otp', otpLimiter, async (req, res) => {
    try {
        let { phone } = req.body;
        if (!phone) return res.status(400).json({ error: 'Phone number required' });
        phone = phone.replace(/\D/g, ''); // Remove spaces and non-digits

        if (MSG91_AUTH_KEY && MSG91_TEMPLATE_ID) {
            console.log(`[MSG91] Attempting to send OTP to ${phone}`);
            const mobile = phone.startsWith('91') ? phone : '91' + phone.replace(/^\+91/, '');
            const url = `https://control.msg91.com/api/v5/otp?template_id=${MSG91_TEMPLATE_ID}&mobile=${mobile}&authkey=${MSG91_AUTH_KEY}`;
            console.log(`[MSG91] Request URL: ${url.replace(MSG91_AUTH_KEY, 'HIDDEN_KEY')}`);
            const response = await fetch(url, { method: 'GET' });
            const data = await response.json();
            console.log(`[MSG91] Response:`, data);
            if (data.type === 'error') throw new Error(data.message);
            return res.json({ success: true, message: 'OTP sent successfully via MSG91' });
        } else {
            const otp = Math.floor(1000 + Math.random() * 9000).toString();
            OTP_STORE[phone] = { otp, expiresAt: Date.now() + 5 * 60 * 1000 };
            console.log(`\n========================================`);
            console.log(`📱 MOCK SMS TO ${phone}`);
            console.log(`Your FACÉLOOK OTP is: ${otp}`);
            console.log(`========================================\n`);
            return res.json({ success: true, message: 'Mock OTP sent successfully' });
        }
    } catch (error) {
        console.error('Send OTP Error:', error);
        res.status(500).json({ error: 'Server error sending OTP' });
    }
});

app.post('/api/auth/verify-otp', async (req, res) => {
    try {
        let { phone, otp } = req.body;
        if (!phone || !otp) return res.status(400).json({ error: 'Phone and OTP required' });
        phone = phone.replace(/\D/g, ''); // Remove spaces and non-digits

        if (MSG91_AUTH_KEY) {
            const mobile = phone.startsWith('91') ? phone : '91' + phone.replace(/^\+91/, '');
            const url = `https://control.msg91.com/api/v5/otp/verify?otp=${otp}&mobile=${mobile}&authkey=${MSG91_AUTH_KEY}`;
            const response = await fetch(url, { method: 'GET' });
            const data = await response.json();
            if (data.type === 'error') {
                return res.status(400).json({ error: 'Invalid or expired OTP' });
            }
        } else {
            const record = OTP_STORE[phone];
            if (!record || record.otp !== otp || record.expiresAt < Date.now()) {
                return res.status(400).json({ error: 'Invalid or expired OTP' });
            }
            delete OTP_STORE[phone];
        }

        let user = await User.findOne({ phone });
        if (!user) {
            const lastUser = await User.findOne().sort({ id: -1 });
            const id = lastUser ? lastUser.id + 1 : 1;
            user = new User({ id, name: phone, phone });
            await user.save();
        }

        const token = jwt.sign({ id: user.id, name: user.name, phone: user.phone }, SECRET_KEY, { expiresIn: '7d' });
        res.json({ token, user: { name: user.name, phone: user.phone } });
    } catch (error) {
        console.error('Verify OTP Error:', error);
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

app.post('/api/auth/google', async (req, res) => {
    try {
        const { credential } = req.body;
        if (!credential) return res.status(400).json({ error: 'Google credential missing' });

        const payloadBase64 = credential.split('.')[1];
        const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('ascii'));
        const { email, name, sub: googleId } = payload;

        let user = await User.findOne({ email });
        if (!user) user = await User.findOne({ googleId });

        if (!user) {
            const lastUser = await User.findOne().sort({ id: -1 });
            const id = lastUser ? lastUser.id + 1 : 1;
            user = new User({ id, name, email, googleId });
            await user.save();
        } else if (!user.googleId) {
            user.googleId = googleId;
            await user.save();
        }

        const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, SECRET_KEY, { expiresIn: '7d' });
        res.json({ token, user: { name: user.name, email: user.email } });
    } catch (error) {
        res.status(500).json({ error: 'Server error decoding Google credential' });
    }
});

// --- PRODUCTS ---
app.get('/api/admin/force-sync-products', async (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const data = fs.readFileSync(path.join(__dirname, 'products.json'), 'utf-8');
        const products = JSON.parse(data);
        await Product.deleteMany({});
        await Product.insertMany(products);
        res.json({ success: true, count: products.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.get('/api/products', async (req, res) => {
    try {
        const mongoose = require('mongoose');
        const products = await Product.find({ isActive: { $ne: false } }, '-_id -__v').sort({ id: 1 });
        res.json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        try {
            const fs = require('fs');
            const data = fs.readFileSync(path.join(__dirname, 'products.json'), 'utf-8');
            return res.json(JSON.parse(data));
        } catch (e) {
            res.status(500).json({ error: 'Error fetching products' });
        }
    }
});

// --- CART ---
app.get('/api/cart', authenticateToken, async (req, res) => {
    try {
        const cartItems = await Cart.find({ user_id: req.user.id });
        const products = await Product.find({ id: { $in: cartItems.map(c => c.product_id) } });

        const result = cartItems.map(c => {
            const product = products.find(p => p.id === c.product_id);
            if (!product) return null;
            return {
                ...product._doc,
                qty: c.qty
            };
        }).filter(item => item !== null);

        // Remove MongoDB specific fields before sending
        result.forEach(r => { delete r._id; delete r.__v; });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching cart' });
    }
});

app.post('/api/cart', authenticateToken, async (req, res) => {
    try {
        const { product_id, qty = 1 } = req.body;
        const exItem = await Cart.findOne({ user_id: req.user.id, product_id });

        if (exItem) {
            exItem.qty += qty;
            await exItem.save();
        } else {
            const newItem = new Cart({ user_id: req.user.id, product_id, qty });
            await newItem.save();
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error updating cart' });
    }
});

app.put('/api/cart/:product_id', authenticateToken, async (req, res) => {
    try {
        const product_id = parseInt(req.params.product_id);
        const { qty } = req.body;

        await Cart.findOneAndUpdate(
            { user_id: req.user.id, product_id },
            { qty }
        );

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error updating cart item' });
    }
});

app.delete('/api/cart/:product_id', authenticateToken, async (req, res) => {
    try {
        const product_id = parseInt(req.params.product_id);
        await Cart.deleteOne({ user_id: req.user.id, product_id });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error removing from cart' });
    }
});

// --- WISHLIST ---
app.get('/api/wishlist', authenticateToken, async (req, res) => {
    try {
        const userWish = await Wishlist.find({ user_id: req.user.id });
        const wishItems = await Product.find({ id: { $in: userWish.map(w => w.product_id) } }, '-_id -__v');
        res.json(wishItems);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching wishlist' });
    }
});

app.post('/api/wishlist/toggle', authenticateToken, async (req, res) => {
    try {
        const { product_id } = req.body;
        const exItem = await Wishlist.findOne({ user_id: req.user.id, product_id });

        if (exItem) {
            await Wishlist.deleteOne({ _id: exItem._id });
            res.json({ status: 'removed' });
        } else {
            const newItem = new Wishlist({ user_id: req.user.id, product_id });
            await newItem.save();
            res.json({ status: 'added' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Error toggling wishlist' });
    }
});

// --- CHECKOUT ---
app.post('/api/checkout', authenticateToken, async (req, res) => {
    try {
        const { total, details } = req.body;

        const lastOrder = await Order.findOne().sort({ id: -1 });
        const order_id = lastOrder ? lastOrder.id + 1 : 1;

        const newOrder = new Order({ id: order_id, user_id: req.user.id, total, details });
        await newOrder.save();

        // Clear cart
        await Cart.deleteMany({ user_id: req.user.id });

        // Notifications
        const notifId = Date.now();
        await Notification.create({ id: notifId, user_id: req.user.id, title: 'Order Placed Successfully', message: `Your order #${order_id} has been confirmed!`, type: 'order' });
        sendCustomerEmail(req.user.email, `Facelook Order Confirmed #${order_id}`, `Hi ${req.user.name || 'Customer'},\n\nYour order #${order_id} for ₹${total} has been placed successfully!\n\nTrack your order here: https://facelookcosmetics.in/track\n\nThank you for shopping with Facelook!`);

        console.log(`\n========================================`);
        console.log(`📱 MOCK SMS TO ${req.user.phone || 'Customer'}`);
        console.log(`Hi ${req.user.name}, your FACÉLOOK order #${order_id} is confirmed! Track here: https://facelookcosmetics.in/track`);
        console.log(`========================================\n`);

        res.json({ success: true, order_id, message: "Order placed successfully" });
    } catch (error) {
        res.status(500).json({ error: 'Error during checkout' });
    }
});

app.post('/api/checkout/upi', authenticateToken, async (req, res) => {
    try {
        const { order_id, utr } = req.body;

        const order = await Order.findOne({ id: order_id });
        if (order) {
            order.status = 'pending';
            order.paymentMethod = 'upi';
            order.paymentStatus = 'pending';
            if (!order.details) order.details = {};
            order.details.utr_number = utr;
            order.markModified('details');
            await order.save();

            const notifId = Date.now();
            await Notification.create({ id: notifId, user_id: req.user.id, title: 'UPI Payment Pending', message: `Your UPI payment for order #${order_id} is pending verification.`, type: 'order' });
            sendCustomerEmail(req.user.email, `Facelook Order Pending Verification #${order_id}`, `Hi ${req.user.name || 'Customer'},\n\nYour order #${order_id} has been placed and is pending UPI verification with UTR ${utr}.\n\nThank you for shopping with Facelook!`);

            res.json({ success: true, message: "UPI Payment pending verification" });
        } else {
            res.status(400).json({ error: 'Order not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Error processing UPI details' });
    }
});

app.post('/api/payment/create-order', authenticateToken, async (req, res) => {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        console.error("Razorpay Keys are missing in .env");
        return res.status(400).json({ error: "Razorpay credentials not configured in backend .env" });
    }
    const { amount } = req.body;
    try {
        const options = {
            amount: Math.round(amount * 100),
            currency: "INR",
            receipt: `receipt_${Date.now()}`
        };
        const order = await razorpay.orders.create(options);
        res.json(order);
    } catch (error) {
        console.error('Razorpay Error:', error);

        // Extract stringified error to send to client for debugging
        let errDesc = 'Unknown error';
        if (error && error.error && error.error.description) {
            errDesc = error.error.description;
        } else if (error && error.message) {
            errDesc = error.message;
        } else {
            try {
                errDesc = typeof error === 'object' ? JSON.stringify(error) : String(error);
            } catch (e) { }
        }

        res.status(500).json({ error: "Could not create Razorpay order: " + errDesc });
    }
});

app.post('/api/payment/verify', authenticateToken, async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } = req.body;
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'secret_placeholder');
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generated_signature = hmac.digest('hex');

    if (generated_signature === razorpay_signature) {
        const order = await Order.findOne({ id: order_id });
        if (order) {
            order.status = 'confirmed';
            order.paymentStatus = 'paid';
            order.razorpay_payment_id = razorpay_payment_id;
            order.razorpay_order_id = razorpay_order_id;
            await order.save();

            const notifId = Date.now();
            await Notification.create({ id: notifId, user_id: req.user.id, title: 'Payment Successful', message: `Payment for order #${order_id} was successful!`, type: 'order' });
            sendCustomerEmail(req.user.email, `Facelook Payment Received #${order_id}`, `Hi ${req.user.name || 'Customer'},\n\nWe have received your payment for order #${order_id}!\n\nTrack your order here: https://facelookcosmetics.in/track\n\nThank you for shopping with Facelook!`);
        }
        await Cart.deleteMany({ user_id: req.user.id });
        res.json({ success: true });
    } else {
        res.status(400).json({ success: false, error: "Invalid signature" });
    }
});

app.get('/api/payment/key', (req, res) => {
    res.json({ key: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder' });
});

app.get('/api/settings', async (req, res) => {
    try {
        const settings = await Setting.find();
        const obj = {};
        settings.forEach(s => obj[s.key] = s.value);
        res.json(obj);
    } catch (e) { res.status(500).json({ error: 'Server Error' }); }
});

app.get('/api/settings/hero_slides', async (req, res) => {
    try {
        const setting = await Setting.findOne({ key: 'hero_slides' });
        res.json(setting ? setting.value : null);
    } catch (e) { res.status(500).json({ error: 'Server Error' }); }
});

app.get('/api/orders', authenticateToken, async (req, res) => {
    try {
        const orders = await Order.find({ user_id: req.user.id }).sort({ id: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching orders' });
    }
});

app.get('/api/track/:orderId', async (req, res) => {
    try {
        const order_id = parseInt(req.params.orderId.replace(/\D/g, ''));
        const order = await Order.findOne({ id: order_id });
        if (!order) return res.status(404).json({ error: 'Order not found' });

        let tracking = [];
        const date = new Date(order._id.getTimestamp());
        const placedStr = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;

        let hasRealTracking = false;
        if (order.trackingId && process.env.SHIPROCKET_EMAIL && process.env.SHIPROCKET_PASSWORD && order.deliveryPartner === 'Shiprocket') {
            try {
                // Auth to Shiprocket
                const authRes = await fetch('https://apiv2.shiprocket.in/v1/external/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: process.env.SHIPROCKET_EMAIL, password: process.env.SHIPROCKET_PASSWORD })
                });
                const authData = await authRes.json();

                if (authRes.ok && authData.token) {
                    // Fetch Tracking
                    const trackRes = await fetch(`https://apiv2.shiprocket.in/v1/external/courier/track/awb/${order.trackingId}`, {
                        headers: { 'Authorization': 'Bearer ' + authData.token }
                    });
                    const trackData = await trackRes.json();

                    if (trackRes.ok && trackData && trackData.tracking_data && trackData.tracking_data.track_status) {
                        hasRealTracking = true;
                        const td = trackData.tracking_data;

                        tracking.push({ title: 'Order Placed', date: placedStr, status: 'completed' });

                        // Parse Shiprocket status
                        let sStatus = td.track_status === 1 ? 'completed' : 'active';
                        tracking.push({ title: 'Shipped', date: td.shipment_track?.[0]?.date || 'Recent', status: sStatus });

                        if (td.track_status === 7) {
                            tracking.push({ title: 'Delivered', date: td.shipment_track?.[0]?.date || 'Today', status: 'completed' });
                        } else {
                            tracking.push({ title: 'In Transit', date: td.shipment_track?.[0]?.current_status || 'Moving', status: 'active' });
                        }
                    }
                }
            } catch (err) {
                console.error('Shiprocket Tracking Error:', err.message);
            }
        }

        if (!hasRealTracking) {
            // Mock tracking response fallback
            tracking.push({ title: 'Order Placed', date: placedStr, status: 'completed' });

            const statusLower = (order.status || '').toLowerCase();
            if (statusLower === 'paid' || statusLower === 'pending') {
                tracking.push({ title: 'Processing', date: 'In Progress', status: 'active' });
                tracking.push({ title: 'Shipped', date: 'Pending', status: 'pending' });
                tracking.push({ title: 'Delivered', date: 'Pending', status: 'pending' });
            } else if (statusLower === 'shipped') {
                tracking.push({ title: 'Processing', date: 'Completed', status: 'completed' });
                tracking.push({ title: 'Shipped', date: 'Today', status: 'active' });
                tracking.push({ title: 'Delivered', date: 'Pending', status: 'pending' });
            } else if (statusLower === 'delivered') {
                tracking.push({ title: 'Processing', date: 'Completed', status: 'completed' });
                tracking.push({ title: 'Shipped', date: 'Completed', status: 'completed' });
                tracking.push({ title: 'Delivered', date: 'Completed', status: 'completed' });
            } else {
                tracking.push({ title: order.status || 'Processing', date: 'Current', status: 'active' });
            }
        }

        res.json({ order_id: order.id, total: order.total, tracking });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching tracking' });
    }
});

// --- REVIEWS API ---
app.post('/api/reviews', async (req, res) => {
    try {
        const { productId, name, rating, title, body } = req.body;
        if (!productId || !name || !rating || !title || !body) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const nextId = await Review.countDocuments() + 1;
        const review = new Review({
            id: nextId,
            productId: parseInt(productId),
            name,
            rating: parseInt(rating),
            title,
            body
        });

        await review.save();
        res.json({ success: true, message: 'Review submitted successfully', review });
    } catch (error) {
        console.error("Error submitting review:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/reviews/:productId', async (req, res) => {
    try {
        const productId = parseInt(req.params.productId);
        const reviews = await Review.find({ productId }).sort({ createdAt: -1 });
        res.json({ success: true, reviews });
    } catch (error) {
        console.error("Error fetching reviews:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- CONTACT FORM ---
app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;
        if (!name || !email || !message) return res.status(400).json({ error: 'Name, email, and message are required' });
        // Store in a simple JSON log file (replace with DB or email service in production)
        const entry = { name, email, subject: subject || '', message, timestamp: new Date().toISOString() };
        const logPath = path.join(__dirname, 'contact-messages.json');
        let messages = [];
        try { messages = JSON.parse(fs.readFileSync(logPath, 'utf-8')); } catch (e) { }
        messages.push(entry);
        fs.writeFileSync(logPath, JSON.stringify(messages, null, 2));
        console.log(`\n========================================`);
        console.log(`📩 NEW CONTACT MESSAGE from ${name} (${email})`);
        console.log(`Subject: ${subject || 'N/A'}`);
        console.log(`Message: ${message}`);
        console.log(`========================================\n`);
        res.json({ success: true, message: 'Message received! We will get back to you within 24 hours.' });
    } catch (error) {
        res.status(500).json({ error: 'Error saving message' });
    }
});

// --- NEWSLETTER ---
app.post('/api/newsletter', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });
        const logPath = path.join(__dirname, 'newsletter-subscribers.json');
        let subs = [];
        try { subs = JSON.parse(fs.readFileSync(logPath, 'utf-8')); } catch (e) { }
        if (subs.find(s => s.email === email)) return res.json({ success: true, message: 'You are already subscribed!' });
        subs.push({ email, subscribedAt: new Date().toISOString() });
        fs.writeFileSync(logPath, JSON.stringify(subs, null, 2));
        console.log(`📧 New newsletter subscriber: ${email}`);
        res.json({ success: true, message: 'Subscribed successfully!' });
    } catch (error) {
        res.status(500).json({ error: 'Error subscribing' });
    }
});

// --- COUPONS ---
app.get('/api/coupons/active', async (req, res) => {
    try {
        const activeCoupons = await Coupon.find({ isActive: true });
        res.json(activeCoupons);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching active coupons' });
    }
});

// --- COUPON VALIDATION (for customers at checkout) ---
app.post('/api/coupons/validate', authenticateToken, async (req, res) => {
    try {
        const { code, cartTotal } = req.body;
        if (!code) return res.status(400).json({ error: 'Coupon code is required' });
        const cleanCode = code.trim().toUpperCase();
        const coupon = await Coupon.findOne({ code: cleanCode, isActive: true });
        if (!coupon) return res.status(400).json({ error: 'Invalid or expired coupon code' });
        const now = new Date();
        if (coupon.validTo && now > coupon.validTo) return res.status(400).json({ error: 'This coupon has expired' });
        if (coupon.validFrom && now < coupon.validFrom) return res.status(400).json({ error: 'This coupon is not yet active' });
        if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) return res.status(400).json({ error: 'This coupon has reached its usage limit' });
        if (coupon.minOrder > 0 && cartTotal < coupon.minOrder) return res.status(400).json({ error: `Minimum order of ₹${coupon.minOrder} required for this coupon` });

        let discount = 0;
        if (coupon.type === 'flat') {
            discount = coupon.value;
        } else {
            discount = Math.round((cartTotal * coupon.value) / 100);
            if (coupon.maxDiscount > 0) discount = Math.min(discount, coupon.maxDiscount);
        }

        res.json({ success: true, discount, coupon: { code: coupon.code, type: coupon.type, value: coupon.value } });
    } catch (error) {
        res.status(500).json({ error: 'Error validating coupon' });
    }
});

// --- SITEMAP (must be BEFORE catch-all) ---
function slugify(text) {
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

app.get('/sitemap.xml', async (req, res) => {
    try {
        const products = await Product.find({ isActive: { $ne: false } }, 'name updatedAt');
        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.facelookcosmetics.in/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://www.facelookcosmetics.in/shop</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
`;
        products.forEach(p => {
            const slug = slugify(p.name);
            xml += `  <url>
    <loc>https://www.facelookcosmetics.in/product/${slug}</loc>
    <lastmod>${new Date(p.updatedAt || Date.now()).toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
`;
        });
        xml += `</urlset>`;
        res.header('Content-Type', 'application/xml');
        res.send(xml);
    } catch (err) {
        res.status(500).send('Error generating sitemap');
    }
});

// --- HEALTH CHECK ---
app.get('/', (req, res) => {
    res.json({ status: 'Facelook API is running' });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

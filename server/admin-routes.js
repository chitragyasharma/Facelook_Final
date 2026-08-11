const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const router = express.Router();
const { AdminUser, User, Product, Order, Cart, Wishlist, ActivityLog, Coupon, Return, Influencer, Setting, Notification } = require('./models');
const { authenticateAdmin, requireRole, logActivity, getClientIP, ADMIN_SECRET } = require('./admin-middleware');

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

// ═══════════════════════════════════════
//  OTP STORE (In-memory for admin 2FA)
// ═══════════════════════════════════════
const ADMIN_OTP_STORE = {};

// ═══════════════════════════════════════
//  AUTH ROUTES
// ═══════════════════════════════════════

// Admin Login — Step 1: email + password

router.get('/force-create', async (req, res) => {
    try {
        const existingAdmin = await AdminUser.findOne({ email: 'facelook.cs51@gmail.com' });
        if (!existingAdmin) {
            await AdminUser.create({
                id: Date.now(),
                name: 'Super Admin',
                email: 'facelook.cs51@gmail.com',
                password: bcrypt.hashSync('Facelook@4411', 10),
                role: 'super_admin',
                twoFactorEnabled: true
            });
            return res.json({ success: true, message: 'Admin facelook.cs51@gmail.com created successfully!' });
        } else {
            // Force reset the password just in case it got corrupted
            existingAdmin.password = bcrypt.hashSync('Facelook@4411', 10);
            existingAdmin.isActive = true;
            await existingAdmin.save();
            return res.json({ success: true, message: 'Admin already existed, but password has been forcefully reset to Facelook@4411!' });
        }
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

        const admin = await AdminUser.findOne({ email, isActive: true });
        if (!admin || !bcrypt.compareSync(password, admin.password)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (admin.twoFactorEnabled) {
            // Generate OTP
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            ADMIN_OTP_STORE[email] = { otp, expiresAt: Date.now() + 5 * 60 * 1000, adminId: admin.id };
            
            // ALWAYS log the OTP to the server logs as a fallback
            console.log(`\n========================================`);
            console.log(`🔐 ADMIN 2FA OTP for ${email}: ${otp}`);
            console.log(`========================================\n`);
            
            // Send email
            if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
                try {
                    if (process.env.RESEND_API_KEY) {
                        console.log('Sending Admin OTP email via Resend...');
                        fetch('https://api.resend.com/emails', {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                from: 'onboarding@resend.dev',
                                to: email,
                                subject: 'Your Admin Login OTP',
                                text: `Your Facelook Admin login OTP is: ${otp}. It expires in 5 minutes.`
                            })
                        }).then(async (response) => {
                            if (response.ok) console.log('Admin OTP email sent successfully via Resend.');
                            else console.error('Resend error:', await response.text());
                        }).catch(err => console.error('Background OTP email error (Resend):', err.message));
                    } else {
                        const transporter = nodemailer.createTransport({
                            service: 'gmail',
                            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
                        });
                        console.log('Sending Admin OTP email via Nodemailer...');
                        transporter.sendMail({
                            from: '"Facelook Admin" <' + process.env.EMAIL_USER + '>',
                            to: email,
                            subject: 'Your Admin Login OTP',
                            text: `Your Facelook Admin login OTP is: ${otp}. It expires in 5 minutes.`
                        }).then(() => {
                            console.log('Admin OTP email sent successfully.');
                        }).catch(err => {
                            console.error('Background OTP email error (Render likely blocking SMTP):', err.message);
                        });
                    }
                } catch (err) {
                    console.error('Error sending OTP email:', err.message);
                }
            } else {
                console.log('EMAIL_USER and EMAIL_PASS missing in env, skipping email dispatch.');
            }
            
            return res.json({ requires2FA: true, message: 'OTP sent to your email' });
        }

        // No 2FA — issue token directly
        const token = jwt.sign({ id: admin.id, name: admin.name, email: admin.email, role: admin.role }, ADMIN_SECRET, { expiresIn: '8h' });
        admin.lastLogin = new Date();
        admin.lastLoginIP = getClientIP(req);
        await admin.save();
        await logActivity(admin.id, admin.name, 'Login', 'auth', 'Admin logged in', req);
        res.json({ token, admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } });
    } catch (error) {
        res.status(500).json({ error: 'Server error during login' });
    }
});

// Admin Resend OTP
router.post('/resend-otp', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email required' });

        const admin = await AdminUser.findOne({ email, isActive: true });
        if (!admin || !admin.twoFactorEnabled) {
            return res.status(400).json({ error: 'Cannot resend OTP for this user' });
        }

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        ADMIN_OTP_STORE[email] = { otp, expiresAt: Date.now() + 5 * 60 * 1000, adminId: admin.id };
        
        // ALWAYS log the OTP to the server logs as a fallback
        console.log(`\n========================================`);
        console.log(`🔐 ADMIN 2FA OTP for ${email}: ${otp}`);
        console.log(`========================================\n`);
        
        // Send email
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            try {
                if (process.env.RESEND_API_KEY) {
                    console.log('Sending Admin OTP email via Resend...');
                    fetch('https://api.resend.com/emails', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            from: 'onboarding@resend.dev',
                            to: email,
                            subject: 'Your Admin Login OTP',
                            text: `Your Facelook Admin login OTP is: ${otp}. It expires in 5 minutes.`
                        })
                    }).then(async (response) => {
                        if (response.ok) console.log('Admin OTP email sent successfully via Resend.');
                        else console.error('Resend error:', await response.text());
                    }).catch(err => console.error('Background OTP email error (Resend):', err.message));
                } else {
                    const transporter = nodemailer.createTransport({
                        service: 'gmail',
                        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
                    });
                    console.log('Sending Admin OTP email via Nodemailer...');
                    transporter.sendMail({
                        from: '"Facelook Admin" <' + process.env.EMAIL_USER + '>',
                        to: email,
                        subject: 'Your Admin Login OTP',
                        text: `Your Facelook Admin login OTP is: ${otp}. It expires in 5 minutes.`
                    }).then(() => {
                        console.log('Admin OTP email sent successfully.');
                    }).catch(err => {
                        console.error('Background OTP email error (Render likely blocking SMTP):', err.message);
                    });
                }
            } catch (err) {
                console.error('Error sending OTP email:', err.message);
            }
        } else {
            console.log('EMAIL_USER and EMAIL_PASS missing in env, skipping email dispatch.');
        }
        
        return res.json({ message: 'OTP resent to your email' });
    } catch (error) {
        res.status(500).json({ error: 'Server error during resend' });
    }
});

// Admin Login — Step 2: verify OTP
router.post('/verify-2fa', async (req, res) => {
    try {
        const { email, otp } = req.body;
        const record = ADMIN_OTP_STORE[email];
        if (!record || record.otp !== otp || record.expiresAt < Date.now()) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }
        delete ADMIN_OTP_STORE[email];

        const admin = await AdminUser.findOne({ id: record.adminId });
        if (!admin) return res.status(404).json({ error: 'Admin not found' });

        const token = jwt.sign({ id: admin.id, name: admin.name, email: admin.email, role: admin.role }, ADMIN_SECRET, { expiresIn: '8h' });
        admin.lastLogin = new Date();
        admin.lastLoginIP = getClientIP(req);
        await admin.save();
        await logActivity(admin.id, admin.name, 'Login (2FA verified)', 'auth', 'Admin logged in with 2FA', req);
        res.json({ token, admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } });
    } catch (error) {
        res.status(500).json({ error: 'Server error verifying OTP' });
    }
});

// Get current admin profile
router.get('/me', authenticateAdmin, async (req, res) => {
    try {
        const admin = await AdminUser.findOne({ id: req.admin.id }, '-password -__v -_id');
        res.json(admin);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching profile' });
    }
});

// Change password
router.post('/change-password', authenticateAdmin, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const admin = await AdminUser.findOne({ id: req.admin.id });
        if (!bcrypt.compareSync(currentPassword, admin.password)) {
            return res.status(400).json({ error: 'Current password incorrect' });
        }
        admin.password = bcrypt.hashSync(newPassword, 10);
        await admin.save();
        await logActivity(req.admin.id, req.admin.name, 'Password Changed', 'auth', '', req);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error changing password' });
    }
});

// ═══════════════════════════════════════
//  DASHBOARD STATS
// ═══════════════════════════════════════

router.get('/dashboard/stats', authenticateAdmin, async (req, res) => {
    try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - 7);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const yearStart = new Date(now.getFullYear(), 0, 1);

        const [totalOrders, todayOrders, weekOrders, monthOrders] = await Promise.all([
            Order.countDocuments(),
            Order.countDocuments({ created_at: { $gte: todayStart } }),
            Order.countDocuments({ created_at: { $gte: weekStart } }),
            Order.countDocuments({ created_at: { $gte: monthStart } })
        ]);

        const [totalRevenue] = await Order.aggregate([{ $group: { _id: null, total: { $sum: '$total' } } }]);
        const [monthRevenue] = await Order.aggregate([{ $match: { created_at: { $gte: monthStart } } }, { $group: { _id: null, total: { $sum: '$total' } } }]);
        const [yearRevenue] = await Order.aggregate([{ $match: { created_at: { $gte: yearStart } } }, { $group: { _id: null, total: { $sum: '$total' } } }]);

        const totalCustomers = await User.countDocuments();
        const totalProducts = await Product.countDocuments();
        const lowStockProducts = await Product.countDocuments({ stock: { $lte: 10 } });
        const pendingOrders = await Order.countDocuments({ status: 'pending' });
        const pendingReturns = await Return.countDocuments({ status: 'requested' });

        // Expiring products (within 90 days)
        const expiryThreshold = new Date(); expiryThreshold.setDate(expiryThreshold.getDate() + 90);
        const expiringProducts = await Product.countDocuments({ expiryDate: { $lte: expiryThreshold, $gte: now } });

        res.json({
            orders: { total: totalOrders, today: todayOrders, week: weekOrders, month: monthOrders },
            revenue: { total: totalRevenue?.total || 0, month: monthRevenue?.total || 0, year: yearRevenue?.total || 0 },
            customers: totalCustomers,
            products: totalProducts,
            lowStock: lowStockProducts,
            pendingOrders,
            pendingReturns,
            expiringProducts,
            conversionRate: totalCustomers > 0 ? ((totalOrders / totalCustomers) * 100).toFixed(1) : 0
        });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching dashboard stats' });
    }
});

// Revenue chart data (last 30 days)
router.get('/dashboard/revenue-chart', authenticateAdmin, async (req, res) => {
    try {
        const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const data = await Order.aggregate([
            { $match: { created_at: { $gte: thirtyDaysAgo } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } }, revenue: { $sum: '$total' }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching chart data' });
    }
});

// Top selling products
router.get('/dashboard/top-products', authenticateAdmin, async (req, res) => {
    try {
        const products = await Product.find({}, '-_id -__v').sort({ reviews: -1 }).limit(5);
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching top products' });
    }
});

// ═══════════════════════════════════════
//  ORDER MANAGEMENT
// ═══════════════════════════════════════

router.get('/orders', authenticateAdmin, async (req, res) => {
    try {
        const { status, page = 1, limit = 20, search, from, to } = req.query;
        const filter = {};
        if (status && status !== 'all') filter.status = status;
        if (from || to) {
            filter.created_at = {};
            if (from) filter.created_at.$gte = new Date(from);
            if (to) filter.created_at.$lte = new Date(to);
        }
        const total = await Order.countDocuments(filter);
        const orders = await Order.find(filter).sort({ created_at: -1 }).skip((page - 1) * limit).limit(parseInt(limit));
        res.json({ orders, total, page: parseInt(page), pages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching orders' });
    }
});

router.get('/orders/:id', authenticateAdmin, async (req, res) => {
    try {
        const order = await Order.findOne({ id: parseInt(req.params.id) });
        if (!order) return res.status(404).json({ error: 'Order not found' });
        const customer = await User.findOne({ id: order.user_id }, '-password -__v -_id');
        res.json({ order, customer });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching order' });
    }
});

router.put('/orders/:id/status', authenticateAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        const order = await Order.findOneAndUpdate({ id: parseInt(req.params.id) }, { status }, { new: true });
        
        // Notify customer
        if (order) {
            const customer = await User.findOne({ id: order.user_id });
            if (customer) {
                const notifId = Date.now();
                await Notification.create({ id: notifId, user_id: customer.id, title: 'Order Status Updated', message: `Your order #${order.id} is now ${status}.`, type: 'order' });
                sendCustomerEmail(customer.email, `Facelook Order Update #${order.id}`, `Hi ${customer.name || 'Customer'},\n\nYour order #${order.id} has been updated to: ${status.toUpperCase()}.\n\nTrack your order here: https://facelookcosmetics.in/track\n\nThank you for shopping with Facelook!`);
            }
        }
        
        await logActivity(req.admin.id, req.admin.name, `Order #${req.params.id} status → ${status}`, 'orders', '', req);
        res.json(order);
    } catch (error) {
        res.status(500).json({ error: 'Error updating order' });
    }
});

router.post('/orders/bulk-action', authenticateAdmin, async (req, res) => {
    try {
        const { orderIds, action } = req.body;
        await Order.updateMany({ id: { $in: orderIds } }, { status: action });
        await logActivity(req.admin.id, req.admin.name, `Bulk: ${orderIds.length} orders → ${action}`, 'orders', '', req);
        res.json({ success: true, updated: orderIds.length });
    } catch (error) {
        res.status(500).json({ error: 'Error performing bulk action' });
    }
});

router.post('/shiprocket/create-order', authenticateAdmin, async (req, res) => {
    try {
        const { orderId } = req.body;
        const order = await Order.findOne({ id: parseInt(orderId) });
        if (!order) return res.status(404).json({ error: 'Order not found' });
        
        let awbCode = '';
        let isMock = false;

        if (process.env.SHIPROCKET_EMAIL && process.env.SHIPROCKET_PASSWORD) {
            // Real Shiprocket API
            const authRes = await fetch('https://apiv2.shiprocket.in/v1/external/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: process.env.SHIPROCKET_EMAIL,
                    password: process.env.SHIPROCKET_PASSWORD
                })
            });
            const authData = await authRes.json();
            if (!authRes.ok || !authData.token) {
                console.error("Shiprocket Auth Failed:", authData);
                return res.status(500).json({ error: 'Shiprocket authentication failed. Check credentials.' });
            }

            const token = authData.token;

            // Prepare Order items
            const orderItems = order.details.cart.map(item => ({
                name: item.name,
                sku: item.sku || 'SKU-' + item.id,
                units: item.qty,
                selling_price: item.price,
                discount: 0,
                tax: 0,
                hsn: 3304
            }));

            // Create Order in Shiprocket
            const createOrderRes = await fetch('https://apiv2.shiprocket.in/v1/external/orders/create/adhoc', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({
                    order_id: `FL-${order.id}-${Date.now().toString().slice(-4)}`, // Ensure uniqueness
                    order_date: new Date(order.created_at || Date.now()).toISOString().substring(0, 19).replace('T', ' '),
                    pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION || "Primary",
                    billing_customer_name: (order.details.name || 'Customer').split(' ')[0],
                    billing_last_name: (order.details.name || '').split(' ').slice(1).join(' ') || '.',
                    billing_address: order.details.address || 'N/A',
                    billing_city: order.details.city || 'Delhi',
                    billing_pincode: order.details.pincode || '110001',
                    billing_state: "Delhi",
                    billing_country: "India",
                    billing_email: order.details.email || "customer@example.com",
                    billing_phone: order.details.phone || "9999999999",
                    shipping_is_billing: true,
                    order_items: orderItems,
                    payment_method: (order.details.pay === 'cod') ? "COD" : "Prepaid",
                    sub_total: order.total,
                    length: 10,
                    breadth: 10,
                    height: 10,
                    weight: 1
                })
            });

            const createOrderData = await createOrderRes.json();
            if (!createOrderRes.ok || !createOrderData.order_id) {
                console.error("Shiprocket Create Failed:", createOrderData);
                const errMsg = createOrderData.message || (createOrderData.errors && Object.values(createOrderData.errors).join(', ')) || JSON.stringify(createOrderData);
                return res.status(500).json({ error: 'Shiprocket order creation failed: ' + errMsg });
            }

            let finalAwb = createOrderData.awb_code;
            
            // If Shiprocket didn't auto-assign an AWB, manually assign one (Step 5 from PDF)
            if (!finalAwb && createOrderData.shipment_id) {
                try {
                    const assignRes = await fetch('https://apiv2.shiprocket.in/v1/external/courier/assign/awb', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                        body: JSON.stringify({ shipment_id: createOrderData.shipment_id })
                    });
                    const assignData = await assignRes.json();
                    
                    if (assignRes.ok && assignData.response && assignData.response.data && assignData.response.data.awb_code) {
                        finalAwb = assignData.response.data.awb_code;
                    }
                } catch(e) {
                    console.error("AWB Assign Error:", e);
                }
            }

            awbCode = finalAwb || createOrderData.shipment_id || `SR-${createOrderData.order_id}`;
        } else {
            // Fallback to Mock if no keys provided yet
            awbCode = 'AWB' + Math.floor(100000000 + Math.random() * 900000000);
            isMock = true;
        }
        
        order.status = 'shipped';
        order.trackingId = awbCode;
        order.deliveryPartner = isMock ? 'Shiprocket (Mock)' : 'Shiprocket';
        await order.save();
        
        const customer = await User.findOne({ id: order.user_id });
        if (customer) {
            const notifId = Date.now();
            await Notification.create({ id: notifId, user_id: customer.id, title: 'Order Shipped', message: `Your order #${order.id} has been shipped! Tracking: ${awbCode}`, type: 'order' });
            sendCustomerEmail(customer.email, `Facelook Order Shipped #${order.id}`, `Hi ${customer.name || 'Customer'},\n\nYour order #${order.id} has been shipped via ${order.deliveryPartner}!\nTracking ID: ${awbCode}\n\nTrack your order here: https://facelookcosmetics.in/track\n\nThank you for shopping with Facelook!`);
        }
        
        await logActivity(req.admin.id, req.admin.name, `Generated ${isMock ? 'mock ' : ''}Shiprocket AWB for Order #${orderId}`, 'orders', '', req);
        res.json({ success: true, trackingId: awbCode, message: isMock ? 'Mock AWB generated (No API Keys)' : 'Shiprocket AWB generated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error syncing with Shiprocket' });
    }
});

// ═══════════════════════════════════════
//  PRODUCT MANAGEMENT
// ═══════════════════════════════════════

router.get('/products', authenticateAdmin, async (req, res) => {
    try {
        const { cat, search, page = 1, limit = 50 } = req.query;
        const filter = {};
        if (cat && cat !== 'all') filter.cat = cat;
        if (search) filter.name = { $regex: search, $options: 'i' };
        const total = await Product.countDocuments(filter);
        const products = await Product.find(filter, '-_id -__v').sort({ id: 1 }).skip((page - 1) * limit).limit(parseInt(limit));
        res.json({ products, total });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching products' });
    }
});

router.post('/products', authenticateAdmin, requireRole('super_admin', 'manager'), async (req, res) => {
    try {
        const lastProduct = await Product.findOne().sort({ id: -1 });
        const id = lastProduct ? lastProduct.id + 1 : 1;
        const product = new Product({ id, ...req.body });
        if (!product.sku) product.sku = `FL-${product.cat?.substring(0, 3).toUpperCase() || 'GEN'}-${String(id).padStart(4, '0')}`;
        await product.save();
        await logActivity(req.admin.id, req.admin.name, `Product created: ${product.name}`, 'products', '', req);
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: 'Error creating product' });
    }
});

router.put('/products/:id', authenticateAdmin, requireRole('super_admin', 'manager'), async (req, res) => {
    try {
        const product = await Product.findOneAndUpdate({ id: parseInt(req.params.id) }, req.body, { new: true });
        await logActivity(req.admin.id, req.admin.name, `Product updated: ${product.name}`, 'products', '', req);
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: 'Error updating product' });
    }
});

router.delete('/products/:id', authenticateAdmin, requireRole('super_admin'), async (req, res) => {
    try {
        await Product.findOneAndUpdate({ id: parseInt(req.params.id) }, { isActive: false });
        await logActivity(req.admin.id, req.admin.name, `Product deleted: #${req.params.id}`, 'products', '', req);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting product' });
    }
});

// ═══════════════════════════════════════
//  CUSTOMER MANAGEMENT
// ═══════════════════════════════════════

router.get('/customers', authenticateAdmin, async (req, res) => {
    try {
        const { segment, search, page = 1, limit = 20 } = req.query;
        const filter = {};
        if (segment && segment !== 'all') filter.segment = segment;
        if (search) filter.$or = [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }];
        const total = await User.countDocuments(filter);
        const customers = await User.find(filter, '-password -__v -_id').sort({ id: -1 }).skip((page - 1) * limit).limit(parseInt(limit));
        
        // Enrich with order counts
        const enriched = await Promise.all(customers.map(async (c) => {
            const orderCount = await Order.countDocuments({ user_id: c.id });
            const totalSpent = await Order.aggregate([{ $match: { user_id: c.id } }, { $group: { _id: null, total: { $sum: '$total' } } }]);
            return { ...c.toObject(), orderCount, totalSpent: totalSpent[0]?.total || 0 };
        }));
        
        res.json({ customers: enriched, total });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching customers' });
    }
});

router.put('/customers/:id/block', authenticateAdmin, requireRole('super_admin', 'manager'), async (req, res) => {
    try {
        const user = await User.findOne({ id: parseInt(req.params.id) });
        user.isBlocked = !user.isBlocked;
        await user.save();
        await logActivity(req.admin.id, req.admin.name, `Customer ${user.isBlocked ? 'blocked' : 'unblocked'}: ${user.name}`, 'customers', '', req);
        res.json({ success: true, isBlocked: user.isBlocked });
    } catch (error) {
        res.status(500).json({ error: 'Error updating customer' });
    }
});

router.get('/customers/:id/orders', authenticateAdmin, async (req, res) => {
    try {
        const orders = await Order.find({ user_id: parseInt(req.params.id) }).sort({ created_at: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching customer orders' });
    }
});

// ═══════════════════════════════════════
//  COUPONS & DISCOUNTS
// ═══════════════════════════════════════

router.get('/coupons', authenticateAdmin, async (req, res) => {
    try {
        const coupons = await Coupon.find().sort({ createdAt: -1 });
        res.json(coupons);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching coupons' });
    }
});

router.post('/coupons', authenticateAdmin, requireRole('super_admin', 'manager', 'admin'), async (req, res) => {
    try {
        const lastCoupon = await Coupon.findOne().sort({ id: -1 });
        const id = lastCoupon ? lastCoupon.id + 1 : 1;
        const coupon = new Coupon({ id, ...req.body });
        await coupon.save();
        await logActivity(req.admin.id, req.admin.name, `Coupon created: ${coupon.code}`, 'coupons', '', req);
        res.json(coupon);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ error: 'A coupon with this code already exists' });
        }
        res.status(500).json({ error: error.message || 'Error creating coupon' });
    }
});

router.put('/coupons/:id', authenticateAdmin, requireRole('super_admin', 'manager', 'admin'), async (req, res) => {
    try {
        const coupon = await Coupon.findOneAndUpdate({ id: parseInt(req.params.id) }, req.body, { new: true });
        await logActivity(req.admin.id, req.admin.name, `Coupon updated: ${coupon.code}`, 'coupons', '', req);
        res.json(coupon);
    } catch (error) {
        res.status(500).json({ error: 'Error updating coupon' });
    }
});

router.delete('/coupons/:id', authenticateAdmin, requireRole('super_admin', 'manager', 'admin'), async (req, res) => {
    try {
        await Coupon.deleteOne({ id: parseInt(req.params.id) });
        await logActivity(req.admin.id, req.admin.name, `Coupon deleted: #${req.params.id}`, 'coupons', '', req);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting coupon' });
    }
});

// ═══════════════════════════════════════
//  RETURNS & REFUNDS
// ═══════════════════════════════════════

router.get('/returns', authenticateAdmin, async (req, res) => {
    try {
        const { status } = req.query;
        const filter = {};
        if (status && status !== 'all') filter.status = status;
        const returns = await Return.find(filter).sort({ createdAt: -1 });
        res.json(returns);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching returns' });
    }
});

router.put('/returns/:id', authenticateAdmin, requireRole('super_admin', 'manager'), async (req, res) => {
    try {
        const { status, adminNote, refundAmount, refundMethod } = req.body;
        const update = { status };
        if (adminNote) update.adminNote = adminNote;
        if (refundAmount) update.refundAmount = refundAmount;
        if (refundMethod) update.refundMethod = refundMethod;
        if (status === 'approved' || status === 'rejected' || status === 'refunded') update.resolvedAt = new Date();
        const ret = await Return.findOneAndUpdate({ id: parseInt(req.params.id) }, update, { new: true });
        await logActivity(req.admin.id, req.admin.name, `Return #${req.params.id} → ${status}`, 'returns', '', req);
        res.json(ret);
    } catch (error) {
        res.status(500).json({ error: 'Error updating return' });
    }
});

// ═══════════════════════════════════════
//  INFLUENCER MANAGEMENT
// ═══════════════════════════════════════

router.get('/influencers', authenticateAdmin, async (req, res) => {
    try {
        const influencers = await Influencer.find().sort({ createdAt: -1 });
        res.json(influencers);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching influencers' });
    }
});

router.post('/influencers', authenticateAdmin, requireRole('super_admin', 'manager'), async (req, res) => {
    try {
        const lastInf = await Influencer.findOne().sort({ id: -1 });
        const id = lastInf ? lastInf.id + 1 : 1;
        const influencer = new Influencer({ id, ...req.body });
        if (!influencer.referralCode) influencer.referralCode = `FL-${influencer.name.replace(/\s/g, '').substring(0, 6).toUpperCase()}-${id}`;
        await influencer.save();
        await logActivity(req.admin.id, req.admin.name, `Influencer added: ${influencer.name}`, 'influencers', '', req);
        res.json(influencer);
    } catch (error) {
        res.status(500).json({ error: 'Error creating influencer' });
    }
});

router.put('/influencers/:id', authenticateAdmin, requireRole('super_admin', 'manager'), async (req, res) => {
    try {
        const influencer = await Influencer.findOneAndUpdate({ id: parseInt(req.params.id) }, req.body, { new: true });
        await logActivity(req.admin.id, req.admin.name, `Influencer updated: ${influencer.name}`, 'influencers', '', req);
        res.json(influencer);
    } catch (error) {
        res.status(500).json({ error: 'Error updating influencer' });
    }
});

// ═══════════════════════════════════════
//  ACTIVITY LOGS
// ═══════════════════════════════════════

router.get('/activity-logs', authenticateAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 50, category } = req.query;
        const filter = {};
        if (category && category !== 'all') filter.category = category;
        const total = await ActivityLog.countDocuments(filter);
        const logs = await ActivityLog.find(filter).sort({ timestamp: -1 }).skip((page - 1) * limit).limit(parseInt(limit));
        res.json({ logs, total, page: parseInt(page), pages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching activity logs' });
    }
});

// ═══════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════

router.get('/settings', authenticateAdmin, async (req, res) => {
    try {
        const settings = await Setting.find();
        const obj = {};
        settings.forEach(s => obj[s.key] = s.value);
        res.json(obj);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching settings' });
    }
});

router.post('/settings', authenticateAdmin, requireRole('super_admin'), async (req, res) => {
    try {
        const entries = Object.entries(req.body);
        for (const [key, value] of entries) {
            await Setting.findOneAndUpdate({ key }, { key, value, updatedAt: new Date() }, { upsert: true });
        }
        await logActivity(req.admin.id, req.admin.name, `Settings updated`, 'settings', entries.map(e => e[0]).join(', '), req);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error saving settings' });
    }
});

// ═══════════════════════════════════════
//  ANALYTICS
// ═══════════════════════════════════════

router.get('/analytics/sales', authenticateAdmin, async (req, res) => {
    try {
        const { from, to } = req.query;
        const filter = {};
        if (from || to) {
            filter.created_at = {};
            if (from) filter.created_at.$gte = new Date(from);
            if (to) filter.created_at.$lte = new Date(to);
        }
        
        const salesByDay = await Order.aggregate([
            { $match: filter },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } }, revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);
        
        const salesByCategory = await Order.aggregate([
            { $match: filter },
            { $unwind: { path: '$details.items', preserveNullAndEmptyArrays: true } },
            { $group: { _id: '$status', count: { $sum: 1 }, revenue: { $sum: '$total' } } }
        ]);
        
        res.json({ salesByDay, salesByCategory });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching analytics' });
    }
});

router.get('/analytics/products', authenticateAdmin, async (req, res) => {
    try {
        const products = await Product.find({}, '-_id -__v').sort({ reviews: -1 }).limit(20);
        const lowStock = await Product.find({ stock: { $lte: 10 } }, '-_id -__v');
        const now = new Date();
        const expiryThreshold = new Date(); expiryThreshold.setDate(expiryThreshold.getDate() + 90);
        const expiring = await Product.find({ expiryDate: { $lte: expiryThreshold, $gte: now } }, '-_id -__v');
        res.json({ topProducts: products, lowStock, expiring });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching product analytics' });
    }
});

module.exports = router;


// ============================================================================
// Admin Panel Logic
// ============================================================================

let token = localStorage.getItem('admin_token');
let adminProfile = null;
let currentView = 'dashboard';

let revenueChartInstance = null;

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  if (token) {
    document.getElementById('login-container').style.display = 'none';
    document.getElementById('app-container').style.display = 'flex';
    fetchProfile();
    initNavigation();
    loadView('dashboard');
  } else {
    document.getElementById('login-container').style.display = 'flex';
    document.getElementById('app-container').style.display = 'none';
  }
});

// ----------------------------------------------------------------------------
// Authentication
// ----------------------------------------------------------------------------
async function login() {
  const email = document.getElementById('admin-email').value.trim();
  const password = document.getElementById('admin-pwd').value;
  const errEl = document.getElementById('login-error');
  errEl.innerText = '';
  
  if(!email || !password) {
      errEl.innerText = 'Please enter email and password';
      return;
  }
  
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email, password})
    });
    const data = await res.json();
    
    if (res.ok && data.requires2FA) {
       document.getElementById('login-step-1').style.display = 'none';
       document.getElementById('login-step-2').style.display = 'block';
    } else if (res.ok && data.token) {
      localStorage.setItem('admin_token', data.token);
      window.location.reload();
    } else {
      errEl.innerText = data.error || 'Login failed';
    }
  } catch(e) {
    errEl.innerText = 'Network error. Is server running?';
  }
}

async function verifyOtp() {
  const email = document.getElementById('admin-email').value.trim();
  const otp = document.getElementById('admin-otp').value.trim();
  const errEl = document.getElementById('login-error');
  errEl.innerText = '';

  try {
     const res = await fetch('/api/admin/verify-2fa', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email, otp})
     });
     const data = await res.json();
     if(res.ok && data.token) {
        localStorage.setItem('admin_token', data.token);
        window.location.reload();
     } else {
        errEl.innerText = data.error || 'OTP Verification Failed';
     }
  } catch(e) {
     errEl.innerText = 'Network error';
  }
}

function logout() {
  localStorage.removeItem('admin_token');
  window.location.reload();
}

async function fetchProfile() {
    try {
        const res = await fetch('/api/admin/me', {
            headers: {'Authorization': 'Bearer ' + token}
        });
        if(res.status === 401 || res.status === 403) return logout();
        const data = await res.json();
        adminProfile = data;
        document.getElementById('admin-name').innerText = data.name;
        document.getElementById('admin-role').innerText = data.role.replace('_', ' ').toUpperCase();
        document.querySelector('.avatar').innerText = data.name.charAt(0).toUpperCase();
    } catch(e) {
        console.error("Failed to load profile", e);
    }
}

// ----------------------------------------------------------------------------
// Navigation & Routing
// ----------------------------------------------------------------------------
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const view = item.getAttribute('data-view');
            
            // Update active states
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            loadView(view);
        });
    });
}

function loadView(view) {
    currentView = view;
    // Hide all views
    document.querySelectorAll('.view-section').forEach(el => el.style.display = 'none');
    // Show target view
    document.getElementById(`${view}-view`).style.display = 'block';
    // Update title
    document.getElementById('page-title').innerText = view.charAt(0).toUpperCase() + view.slice(1);

    // Fetch data based on view
    if (view === 'dashboard') fetchDashboardData();
    if (view === 'orders') fetchOrders();
    if (view === 'products') fetchProducts();
    if (view === 'customers') fetchCustomers();
    if (view === 'coupons') fetchCoupons();
    if (view === 'settings') fetchSettings();
}

// ----------------------------------------------------------------------------
// API Fetch Helpers (with generic auth handling)
// ----------------------------------------------------------------------------
async function apiGet(url) {
    const urlWithCacheBuster = url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();
    const res = await fetch(urlWithCacheBuster, { headers: {'Authorization': 'Bearer ' + token} });
    if (res.status === 401 || res.status === 403) { logout(); throw new Error("Unauthorized"); }
    return res.json();
}
async function apiPost(url, body, method = 'POST') {
    const res = await fetch(url, {
        method: method,
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token},
        body: JSON.stringify(body)
    });
    if (res.status === 401 || res.status === 403) { logout(); throw new Error("Unauthorized"); }
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || 'API Error');
    return data;
}


// ----------------------------------------------------------------------------
// Dashboard View
// ----------------------------------------------------------------------------
async function fetchDashboardData() {
    try {
        const stats = await apiGet('/api/admin/dashboard/stats');
        document.getElementById('stat-revenue').innerText = `₹${stats.revenue.year.toLocaleString()}`;
        document.getElementById('stat-orders').innerText = stats.orders.month.toLocaleString();
        document.getElementById('stat-customers').innerText = stats.customers.toLocaleString();
        document.getElementById('stat-low-stock').innerText = stats.lowStock.toLocaleString();

        const topProducts = await apiGet('/api/admin/dashboard/top-products');
        const tpBody = document.getElementById('top-products-body');
        if(topProducts.length === 0) {
            tpBody.innerHTML = '<tr><td colspan="3">No products</td></tr>';
        } else {
            tpBody.innerHTML = topProducts.map(p => `
                <tr>
                    <td style="display:flex; align-items:center; gap:10px;">
                        <img src="${p.image}" alt="">
                        <span>${p.name.substring(0,25)}...</span>
                    </td>
                    <td>₹${p.price}</td>
                    <td>${p.reviews || 0} sold</td>
                </tr>
            `).join('');
        }

        // Render Chart
        const chartData = await apiGet('/api/admin/dashboard/revenue-chart');
        renderChart(chartData);

    } catch (e) { console.error(e); }
}

function renderChart(data) {
    const ctx = document.getElementById('revenueChart').getContext('2d');
    if (revenueChartInstance) revenueChartInstance.destroy();

    const labels = data.map(d => d._id); // YYYY-MM-DD
    const values = data.map(d => d.revenue);

    revenueChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Revenue (₹)',
                data: values,
                borderColor: '#B76E79',
                backgroundColor: 'rgba(183, 110, 121, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: '#eaedf2' } },
                x: { grid: { display: false } }
            }
        }
    });
}

// ----------------------------------------------------------------------------
// Orders View
// ----------------------------------------------------------------------------
let currentOrderPage = 1;
async function fetchOrders(page = 1) {
    currentOrderPage = page;
    const status = document.getElementById('order-status-filter').value;
    try {
        const data = await apiGet(`/api/admin/orders?page=${page}&limit=10&status=${status}`);
        const tbody = document.getElementById('orders-tbody');
        
        if (data.orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No orders found</td></tr>';
        } else {
            tbody.innerHTML = data.orders.map(o => `
                <tr>
                    <td><strong>#${o.id}</strong></td>
                    <td>${new Date(o.created_at).toLocaleDateString()}</td>
                    <td>User #${o.user_id}</td>
                    <td>₹${o.total}</td>
                    <td><span class="badge ${o.status}">${o.status}</span></td>
                    <td>
                        ${o.status === 'pending' 
                            ? `<button class="btn-info" onclick="syncShiprocket(${o.id})">Ship</button>` 
                            : `<a href="${o.trackingUrl || '#'}" target="_blank" class="btn-primary" style="text-decoration:none; display:inline-block; padding: 6px 12px; font-size:12px;">Track</a>`}
                    </td>
                </tr>
            `).join('');
        }
        renderPagination('orders-pagination', data.page, data.pages, 'fetchOrders');
    } catch (e) { console.error(e); }
}

async function syncShiprocket(orderId) {
    if(!confirm("Generate Shiprocket AWB for Order #" + orderId + "?")) return;
    try {
        const data = await apiPost('/api/admin/shiprocket/create-order', { orderId });
        alert("AWB Generated: " + data.trackingId);
        fetchOrders(currentOrderPage);
    } catch(e) {
        alert("Sync failed: " + e.message);
    }
}

// ----------------------------------------------------------------------------
// Products View
// ----------------------------------------------------------------------------
let currentProductPage = 1;
let productSearchTimer = null;

function debounceSearchProducts() {
    clearTimeout(productSearchTimer);
    productSearchTimer = setTimeout(() => fetchProducts(1), 500);
}

async function fetchProducts(page = 1) {
    currentProductPage = page;
    const search = document.getElementById('product-search').value;
    try {
        const data = await apiGet(`/api/admin/products?page=${page}&limit=10&search=${search}`);
        const tbody = document.getElementById('products-tbody');
        
        if (data.products.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">No products found</td></tr>';
        } else {
            tbody.innerHTML = data.products.map(p => `
                <tr>
                    <td>${p.id}</td>
                    <td><img src="${p.image}" alt="${p.name}"></td>
                    <td><strong>${p.name}</strong><br><small class="text-muted">SKU: ${p.sku}</small></td>
                    <td style="text-transform: capitalize;">${p.cat}</td>
                    <td>₹${p.price}</td>
                    <td>${p.stock}</td>
                    <td><span class="badge ${p.isActive !== false ? 'active' : 'inactive'}">${p.isActive !== false ? 'Active' : 'Archived'}</span></td>
                    <td>
                        <button class="btn-info" onclick='openProductModal(${JSON.stringify(p).replace(/'/g, "\\'")})'>Edit</button>
                        <button class="btn-danger" style="margin-left:5px; background: #dc3545; color: white;" onclick='deleteProduct(${p.id})'>Delete</button>
                    </td>
                </tr>
            `).join('');
        }
        renderPagination('products-pagination', page, Math.ceil(data.total/10), 'fetchProducts');
    } catch (e) { console.error(e); }
}

function openProductModal(product = null) {
    const modal = document.getElementById('product-modal');
    document.getElementById('modal-title').innerText = product ? 'Edit Product' : 'Add New Product';
    
    if (product) {
        document.getElementById('prod-id').value = product.id;
        document.getElementById('prod-name').value = product.name;
        document.getElementById('prod-cat').value = product.cat;
        document.getElementById('prod-price').value = product.price;
        document.getElementById('prod-discountPrice').value = product.discountPrice || '';
        document.getElementById('prod-stock').value = product.stock;
        document.getElementById('prod-tag').value = product.tag || '';
        
        let allImages = [];
        if (product.images && product.images.length > 0) {
            allImages = [...product.images];
        } else {
            if (product.image) allImages.push(product.image);
            if (product.palette && product.palette.length > 0) {
                product.palette.forEach(sh => {
                    if (sh.image && !allImages.includes(sh.image)) {
                        allImages.push(sh.image);
                    }
                });
            }
        }
        uploadedImages = allImages;
        
        renderImagePreviews();
        document.getElementById('prod-desc').value = product.desc || '';
        document.getElementById('prod-countryOfOrigin').value = product.countryOfOrigin || '';
        document.getElementById('prod-deliveryInfo').value = product.deliveryInfo || '';
        document.getElementById('prod-howToUse').value = product.howToUse || '';
        document.getElementById('prod-ingredients').value = product.ingredients || '';
        
        paletteShades = [];
        if(product.palette && product.palette.length > 0) {
            paletteShades = JSON.parse(JSON.stringify(product.palette));
        }
        renderPaletteShades();

        document.getElementById('prod-otherInfo').value = product.otherInfo || '';
    } else {
        document.getElementById('product-form').reset();
        document.getElementById('prod-id').value = '';
        uploadedImages = [];
        paletteShades = [];
        renderImagePreviews();
        renderPaletteShades();
    }
    
    modal.style.display = 'flex';
}

// Drag and Drop Logic
let uploadedImages = [];
const dropZone = document.getElementById('image-drop-zone');
const fileInput = document.getElementById('prod-img-file');
const previewGrid = document.getElementById('image-preview-grid');
const dropZoneText = document.getElementById('drop-zone-text');

dropZone.addEventListener('click', (e) => {
    if(!e.target.classList.contains('remove-img-btn')) fileInput.click();
});
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) Array.from(e.dataTransfer.files).forEach(processImageFile);
});
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) Array.from(e.target.files).forEach(processImageFile);
});

function processImageFile(file) {
    if (!file.type.startsWith('image/')) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const MAX_WIDTH = 800;
            if (width > MAX_WIDTH) {
                height = Math.round((height * MAX_WIDTH) / width);
                width = MAX_WIDTH;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            uploadedImages.push(dataUrl);
            renderImagePreviews();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

let paletteShades = [];

function addPaletteShade(shade = {name: '', hex: '', image: ''}) {
    paletteShades.push(shade);
    renderPaletteShades();
}

function renderPaletteShades() {
    const container = document.getElementById('palette-shades-container');
    container.innerHTML = paletteShades.map((sh, idx) => `
        <div class="shade-row" style="display:flex; gap:10px; margin-bottom:10px; align-items:center;">
            <input type="text" placeholder="Shade Name" value="${sh.name.replace(/"/g, '&quot;')}" onchange="paletteShades[${idx}].name = this.value" style="flex:2; margin:0;">
            <input type="text" placeholder="#HEX" value="${sh.hex.replace(/"/g, '&quot;')}" onchange="paletteShades[${idx}].hex = this.value" style="flex:1; margin:0;">
            <div style="flex:1; display:flex; align-items:center;">
                ${sh.image ? `<img src="${sh.image}" style="width:30px;height:30px;border-radius:4px;margin-right:5px;object-fit:cover;">` : ''}
                <button type="button" class="btn-secondary" onclick="document.getElementById('shade-img-${idx}').click()" style="font-size:11px;padding:4px; margin:0;">Img</button>
                <input type="file" id="shade-img-${idx}" accept="image/*" style="display:none;" onchange="uploadShadeImage(event, ${idx})">
            </div>
            <button type="button" class="btn-danger" style="padding:4px 8px; margin:0;" onclick="removePaletteShade(${idx})">X</button>
        </div>
    `).join('');
}

function removePaletteShade(idx) {
    paletteShades.splice(idx, 1);
    renderPaletteShades();
}

function uploadShadeImage(e, idx) {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        paletteShades[idx].image = ev.target.result;
        renderPaletteShades();
    };
    reader.readAsDataURL(file);
}

function renderImagePreviews() {
    previewGrid.innerHTML = '';
    if (uploadedImages.length === 0) {
        dropZoneText.style.display = 'block';
    } else {
        dropZoneText.style.display = 'none';
        uploadedImages.forEach((src, index) => {
            const item = document.createElement('div');
            item.className = 'preview-item';
            item.innerHTML = `<img src="${src}"><button type="button" class="remove-img-btn" onclick="removeImage(event, ${index})">✕</button>`;
            previewGrid.appendChild(item);
        });
    }
}

function removeImage(e, index) {
    e.stopPropagation();
    uploadedImages.splice(index, 1);
    renderImagePreviews();
}

function closeProductModal() {
    document.getElementById('product-modal').style.display = 'none';
}

async function saveProduct() {
    const id = document.getElementById('prod-id').value;
    const palette = paletteShades.map(sh => ({
        name: sh.name.trim(),
        hex: sh.hex.trim(),
        image: sh.image || ''
    })).filter(sh => sh.name);

    const body = {
        name: document.getElementById('prod-name').value,
        cat: document.getElementById('prod-cat').value,
        price: parseFloat(document.getElementById('prod-price').value),
        discountPrice: document.getElementById('prod-discountPrice').value ? parseFloat(document.getElementById('prod-discountPrice').value) : null,
        stock: parseInt(document.getElementById('prod-stock').value),
        tag: document.getElementById('prod-tag').value,
        image: uploadedImages.length > 0 ? uploadedImages[0] : '',
        images: uploadedImages,
        palette: palette,
        desc: document.getElementById('prod-desc').value,
        countryOfOrigin: document.getElementById('prod-countryOfOrigin').value,
        deliveryInfo: document.getElementById('prod-deliveryInfo').value,
        howToUse: document.getElementById('prod-howToUse').value,
        ingredients: document.getElementById('prod-ingredients').value,
        otherInfo: document.getElementById('prod-otherInfo').value
    };

    try {
        if (id) {
            await apiPost(`/api/admin/products/${id}`, body, 'PUT');
            alert("Product updated");
        } else {
            await apiPost(`/api/admin/products`, body, 'POST');
            alert("Product added");
        }
        closeProductModal();
        fetchProducts(currentProductPage);
    } catch (e) {
        alert("Error saving product: " + e.message);
    }
}

async function deleteProduct(id) {
    if (confirm("Are you sure you want to delete this product?")) {
        try {
            await apiPost(`/api/admin/products/${id}`, {}, 'DELETE');
            alert("Product deleted");
            fetchProducts(currentProductPage);
        } catch (e) {
            alert("Error deleting product: " + e.message);
        }
    }
}

// ----------------------------------------------------------------------------
// Customers View
// ----------------------------------------------------------------------------
let currentCustomerPage = 1;
let customerSearchTimer = null;

function debounceSearchCustomers() {
    clearTimeout(customerSearchTimer);
    customerSearchTimer = setTimeout(() => fetchCustomers(1), 500);
}

async function fetchCustomers(page = 1) {
    currentCustomerPage = page;
    const search = document.getElementById('customer-search').value;
    try {
        const data = await apiGet(`/api/admin/customers?page=${page}&limit=10&search=${search}`);
        const tbody = document.getElementById('customers-tbody');
        
        if (data.customers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">No customers found</td></tr>';
        } else {
            tbody.innerHTML = data.customers.map(c => `
                <tr>
                    <td>${c.id}</td>
                    <td><strong>${c.name}</strong></td>
                    <td>${c.email}</td>
                    <td><span class="badge" style="background:#e0e0e0; color:#333;">${c.segment || 'None'}</span></td>
                    <td>${c.orderCount || 0}</td>
                    <td>₹${c.totalSpent || 0}</td>
                    <td><span class="badge ${c.isBlocked ? 'inactive' : 'active'}">${c.isBlocked ? 'Blocked' : 'Active'}</span></td>
                    <td>
                        <button class="btn-${c.isBlocked ? 'success' : 'danger'}" onclick="toggleCustomerBlock(${c.id})">${c.isBlocked ? 'Unblock' : 'Block'}</button>
                    </td>
                </tr>
            `).join('');
        }
        renderPagination('customers-pagination', page, Math.ceil(data.total/10), 'fetchCustomers');
    } catch (e) { console.error(e); }
}

async function toggleCustomerBlock(id) {
    if(!confirm("Are you sure you want to toggle block status for this customer?")) return;
    try {
        await apiPost(`/api/admin/customers/${id}/block`, {}, 'PUT');
        fetchCustomers(currentCustomerPage);
    } catch(e) {
        alert("Failed to update status: " + e.message);
    }
}

// -----------------------------------------------------------------------------
// Coupons View
// -----------------------------------------------------------------------------
async function fetchCoupons() {
    try {
        const coupons = await apiGet('/api/admin/coupons');
        const tbody = document.getElementById('coupons-tbody');
        
        if (coupons.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No coupons found</td></tr>';
            return;
        }
        
        tbody.innerHTML = coupons.map(c => `
            <tr>
                <td><strong>${c.code}</strong></td>
                <td>${c.type.toUpperCase()}</td>
                <td>${c.type === 'flat' ? '₹' + c.value : c.value + '%'}</td>
                <td>₹${c.minOrder}</td>
                <td>${c.validTo ? new Date(c.validTo).toLocaleDateString() : 'Never'}</td>
                <td><span class="badge ${c.isActive ? 'badge-success' : 'badge-danger'}">${c.isActive ? 'Active' : 'Inactive'}</span></td>
                <td>
                    <button class="btn-info" onclick='toggleCouponStatus(${c.id}, ${!c.isActive})'>${c.isActive ? 'Disable' : 'Enable'}</button>
                    <button class="btn-danger" onclick="deleteCoupon(${c.id})">Delete</button>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        showToast('Error loading coupons', 'error');
    }
}

function openCouponModal() {
    try {
        const form = document.getElementById('coupon-form');
        if (form && typeof form.reset === 'function') {
            form.reset();
        }
        const idField = document.getElementById('coupon-id');
        if (idField) idField.value = '';
        
        const titleField = document.getElementById('coupon-modal-title');
        if (titleField) titleField.innerText = 'Create Coupon';
        
        const modal = document.getElementById('coupon-modal');
        if (modal) {
            modal.style.display = 'flex';
            modal.style.opacity = '1';
            modal.style.visibility = 'visible';
            modal.style.zIndex = '999999';
        } else {
            alert('Modal element not found in DOM!');
        }
    } catch (e) {
        alert('Error opening modal: ' + e.message);
        console.error(e);
    }
}

function closeCouponModal() {
    document.getElementById('coupon-modal').style.display = 'none';
}

async function saveCoupon() {
    const id = document.getElementById('coupon-id').value;
    const code = document.getElementById('coupon-code').value.trim().toUpperCase();
    const type = document.getElementById('coupon-type').value;
    const value = document.getElementById('coupon-value').value;
    const minOrder = document.getElementById('coupon-minOrder').value;
    const validTo = document.getElementById('coupon-validTo').value;
    
    if (!code || !value) {
        showToast('Please fill required fields', 'error');
        return;
    }
    
    const data = {
        code, type, value: Number(value), minOrder: Number(minOrder || 0), isActive: true
    };
    if (validTo) {
        const endDate = new Date(validTo);
        endDate.setHours(23, 59, 59, 999);
        data.validTo = endDate.toISOString();
    }
    
    try {
        if (id) {
            await apiPost(`/api/admin/coupons/${id}`, data, 'PUT');
            showToast('Coupon updated successfully!', 'success');
        } else {
            await apiPost('/api/admin/coupons', data);
            showToast('Coupon created successfully!', 'success');
        }
        closeCouponModal();
        fetchCoupons();
    } catch (e) {
        showToast(e.message || 'Error generating coupon', 'error');
    }
}

async function toggleCouponStatus(id, isActive) {
    if (!confirm(`Are you sure you want to ${isActive ? 'enable' : 'disable'} this coupon?`)) return;
    try {
        await apiPost(`/api/admin/coupons/${id}`, { isActive }, 'PUT');
        showToast('Coupon status updated', 'success');
        fetchCoupons();
    } catch (e) {
        showToast('Error updating status', 'error');
    }
}

async function deleteCoupon(id) {
    if (!confirm('Are you sure you want to completely delete this coupon? This action cannot be undone.')) return;
    try {
        await apiPost(`/api/admin/coupons/${id}`, {}, 'DELETE');
        showToast('Coupon deleted', 'success');
        fetchCoupons();
    } catch (e) {
        showToast('Error deleting coupon', 'error');
    }
}

// ----------------------------------------------------------------------------
// Utilities
// ----------------------------------------------------------------------------
function renderPagination(containerId, currentPage, totalPages, functionName) {
    const container = document.getElementById(containerId);
    if(totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let html = '';
    // Prev
    if (currentPage > 1) {
        html += `<button class="page-btn" onclick="${functionName}(${currentPage - 1})">&laquo;</button>`;
    }
    
    // Pages (Simplified, just showing current/total or a few numbers)
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, currentPage + 2);
    
    for (let i = start; i <= end; i++) {
        html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="${functionName}(${i})">${i}</button>`;
    }
    
    // Next
    if (currentPage < totalPages) {
        html += `<button class="page-btn" onclick="${functionName}(${currentPage + 1})">&raquo;</button>`;
    }
    
    container.innerHTML = html;
}
// Settings Logic
async function fetchSettings() {
    try {
        const data = await apiGet('/api/admin/settings');
        if (data.hero_slides) {
            const slides = data.hero_slides;
            for(let i = 1; i <= 3; i++) {
                const s = slides[i-1] || {};
                document.getElementById(`hero-tag-${i}`).value = s.tag || '';
                document.getElementById(`hero-eyebrow-${i}`).value = s.eyebrow || '';
                document.getElementById(`hero-title-${i}`).value = s.title || '';
                document.getElementById(`hero-sub-${i}`).value = s.sub || '';
                document.getElementById(`hero-media-${i}`).value = s.media || '';
                document.getElementById(`hero-type-${i}`).value = s.type || '';
                if(s.media) {
                    renderHeroPreview(i, s.media, s.type);
                } else {
                    document.getElementById(`hero-text-${i}`).style.display = 'block';
                    document.getElementById(`hero-preview-${i}`).innerHTML = '';
                }
            }
        }
        
        if (data.announcement_banner) document.getElementById('announcement-banner').value = data.announcement_banner;
        
        if (data.policy_about) document.getElementById('policy-about').value = data.policy_about;
        if (data.policy_refund) document.getElementById('policy-refund').value = data.policy_refund;
        if (data.policy_shipping) document.getElementById('policy-shipping').value = data.policy_shipping;
        if (data.policy_return) document.getElementById('policy-return').value = data.policy_return;
        
    } catch (e) {
        console.error("Failed to fetch settings", e);
    }
}

async function savePolicies() {
    const payload = {
        policy_about: document.getElementById('policy-about').value,
        policy_refund: document.getElementById('policy-refund').value,
        policy_shipping: document.getElementById('policy-shipping').value,
        policy_return: document.getElementById('policy-return').value
    };
    try {
        const btns = document.querySelectorAll('#settings-view .btn-primary');
        const btn = btns[1]; // second primary button in settings view is savePolicies
        const oldTxt = btn.innerText;
        btn.innerText = 'Saving...';
        await apiPost('/api/admin/settings', payload, 'POST');
        btn.innerText = 'Saved!';
        setTimeout(() => btn.innerText = oldTxt, 2000);
    } catch (e) {
        alert('Failed to save policies');
    }
}

async function saveAnnouncement() {
    const payload = {
        announcement_banner: document.getElementById('announcement-banner').value
    };
    try {
        // Find the specific save button
        const btn = document.querySelector('button[onclick="saveAnnouncement()"]');
        const oldTxt = btn.innerText;
        btn.innerText = 'Saving...';
        await apiPost('/api/admin/settings', payload, 'POST');
        btn.innerText = 'Saved!';
        setTimeout(() => btn.innerText = oldTxt, 2000);
    } catch (e) {
        alert('Failed to save announcement banner');
    }
}

function processHeroFile(input, index) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    
    if (file.type.startsWith('video/')) {
        if (file.size > 5 * 1024 * 1024) {
            alert('Video must be under 5MB.');
            input.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById(`hero-media-${index}`).value = e.target.result;
            document.getElementById(`hero-type-${index}`).value = 'video';
            renderHeroPreview(index, e.target.result, 'video');
        };
        reader.readAsDataURL(file);
    } else if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width, height = img.height;
                const MAX = 1200;
                if (width > MAX) { height = Math.round(height * MAX / width); width = MAX; }
                canvas.width = width; canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                document.getElementById(`hero-media-${index}`).value = dataUrl;
                document.getElementById(`hero-type-${index}`).value = 'image';
                renderHeroPreview(index, dataUrl, 'image');
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

function renderHeroPreview(index, src, type) {
    const preview = document.getElementById(`hero-preview-${index}`);
    document.getElementById(`hero-text-${index}`).style.display = 'none';
    if (type === 'video') {
        preview.innerHTML = `<video src="${src}" controls style="max-height: 150px; max-width: 100%; border-radius: 8px;"></video><button type="button" class="remove-img-btn" onclick="removeHeroMedia(event, ${index})">✕</button>`;
    } else {
        preview.innerHTML = `<img src="${src}" style="max-height: 150px; max-width: 100%; border-radius: 8px; object-fit: contain;"><button type="button" class="remove-img-btn" onclick="removeHeroMedia(event, ${index})">✕</button>`;
    }
    preview.style.position = 'relative';
    preview.style.display = 'inline-block';
}

function removeHeroMedia(e, index) {
    e.stopPropagation();
    document.getElementById(`hero-media-${index}`).value = '';
    document.getElementById(`hero-type-${index}`).value = '';
    document.getElementById(`hero-preview-${index}`).innerHTML = '';
    document.getElementById(`hero-text-${index}`).style.display = 'block';
    document.getElementById(`hero-file-${index}`).value = '';
}

async function saveSettings() {
    const slides = [];
    for(let i=1; i<=3; i++) {
        slides.push({
            tag: document.getElementById(`hero-tag-${i}`).value,
            eyebrow: document.getElementById(`hero-eyebrow-${i}`).value,
            title: document.getElementById(`hero-title-${i}`).value,
            sub: document.getElementById(`hero-sub-${i}`).value,
            media: document.getElementById(`hero-media-${i}`).value,
            type: document.getElementById(`hero-type-${i}`).value
        });
    }
    try {
        const btn = document.querySelector('#settings-view .btn-primary');
        const oldTxt = btn.innerText;
        btn.innerText = 'Saving...';
        await apiPost('/api/admin/settings', { hero_slides: slides }, 'POST');
        btn.innerText = 'Saved!';
        setTimeout(() => btn.innerText = oldTxt, 2000);
    } catch (e) {
        alert('Failed to save settings');
    }
}

// Drag and drop for hero slides
[1,2,3].forEach(i => {
    const dz = document.getElementById(`hero-drop-${i}`);
    const fi = document.getElementById(`hero-file-${i}`);
    if(!dz || !fi) return;
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
    dz.addEventListener('drop', e => {
        e.preventDefault(); dz.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            fi.files = e.dataTransfer.files; 
            processHeroFile(fi, i);
        }
    });
});

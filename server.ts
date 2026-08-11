import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role: 'admin' | 'user';
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

interface AuditLog {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  action: string;
  sheetUrl: string;
  timestamp: string;
}

interface Settings {
  activeSheetUrl: string;
  updatePasscode: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const LOGS_FILE = path.join(DATA_DIR, 'logs.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

const DEFAULT_SHEETS_LINK = "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0";
const DEFAULT_PASS = "123456@";

// Safely ensure data storage exists WITHOUT overwriting user changes or resetting passwords on server reboot
function ensureDataStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Initialize users if file does not exist
  if (!fs.existsSync(USERS_FILE)) {
    const initialUsers: User[] = [
      {
        id: 'user_admin_khvanson',
        email: 'khvanson@gmail.com',
        fullName: 'Khuất Văn Sơn (Quản trị viên)',
        phone: '0906234585',
        password: DEFAULT_PASS,
        role: 'admin',
        status: 'approved',
        createdAt: new Date().toISOString()
      }
    ];
    fs.writeFileSync(USERS_FILE, JSON.stringify(initialUsers, null, 2), 'utf-8');
  } else {
    // If file exists, ensure admin user exists without wiping other accounts
    try {
      const data = fs.readFileSync(USERS_FILE, 'utf-8');
      const users: User[] = JSON.parse(data);
      const hasAdmin = users.some(u => u.email.toLowerCase() === 'khvanson@gmail.com' || u.role === 'admin');
      if (!hasAdmin) {
        users.unshift({
          id: 'user_admin_khvanson',
          email: 'khvanson@gmail.com',
          fullName: 'Khuất Văn Sơn (Quản trị viên)',
          phone: '0906234585',
          password: DEFAULT_PASS,
          role: 'admin',
          status: 'approved',
          createdAt: new Date().toISOString()
        });
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
      }
    } catch (e) {
      console.error('Error validating users file:', e);
    }
  }

  // Initialize logs if file does not exist
  if (!fs.existsSync(LOGS_FILE)) {
    fs.writeFileSync(LOGS_FILE, JSON.stringify([], null, 2), 'utf-8');
  }

  // Initialize settings if file does not exist
  if (!fs.existsSync(SETTINGS_FILE)) {
    const settings: Settings = {
      activeSheetUrl: DEFAULT_SHEETS_LINK,
      updatePasscode: DEFAULT_PASS
    };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  }
}

// Reset admin password & update passcode back to 123456@ as explicitly requested by user
function resetAdminToDefault() {
  ensureDataStorage();
  try {
    let users: User[] = [];
    if (fs.existsSync(USERS_FILE)) {
      users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    }
    let admin = users.find(u => u.email.toLowerCase() === 'khvanson@gmail.com' || u.role === 'admin');
    if (admin) {
      admin.password = DEFAULT_PASS;
      admin.role = 'admin';
      admin.status = 'approved';
    } else {
      users.unshift({
        id: 'user_admin_khvanson',
        email: 'khvanson@gmail.com',
        fullName: 'Khuất Văn Sơn (Quản trị viên)',
        phone: '0906234585',
        password: DEFAULT_PASS,
        role: 'admin',
        status: 'approved',
        createdAt: new Date().toISOString()
      });
    }
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');

    let settings: Settings = {
      activeSheetUrl: DEFAULT_SHEETS_LINK,
      updatePasscode: DEFAULT_PASS
    };
    if (fs.existsSync(SETTINGS_FILE)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
        settings = { ...settings, ...parsed };
      } catch (e) {}
    }
    settings.updatePasscode = DEFAULT_PASS;
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error resetting admin credentials:', err);
  }
}

function getUsers(): User[] {
  ensureDataStorage();
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

function saveUsers(users: User[]) {
  ensureDataStorage();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

function getLogs(): AuditLog[] {
  ensureDataStorage();
  try {
    const data = fs.readFileSync(LOGS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

function saveLogs(logs: AuditLog[]) {
  ensureDataStorage();
  fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2), 'utf-8');
}

function getSettings(): Settings {
  ensureDataStorage();
  try {
    const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return {
      activeSheetUrl: DEFAULT_SHEETS_LINK,
      updatePasscode: DEFAULT_PASS
    };
  }
}

function saveSettings(settings: Settings) {
  ensureDataStorage();
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Ensure storage is initialized safely without wiping user data or resetting passwords
  ensureDataStorage();

  // ==================== SYSTEM SETTINGS & GOOGLE SHEETS PROXY ====================

  // Fetch Google Sheets CSV server-side to bypass browser CORS / redirect blocks
  app.get('/api/fetch-sheet-csv', async (req, res) => {
    try {
      const rawUrl = req.query.url as string;
      const settings = getSettings();
      const targetUrl = (rawUrl && rawUrl.trim()) ? rawUrl.trim() : settings.activeSheetUrl;

      if (!targetUrl) {
        return res.status(400).json({ success: false, message: 'Thiếu liên kết Google Sheets.' });
      }

      const idMatch = targetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (!idMatch || !idMatch[1]) {
        return res.status(400).json({ success: false, message: 'Đường link Google Sheets không đúng định dạng.' });
      }
      const sheetId = idMatch[1];
      let gid = "0";
      const gidMatch = targetUrl.match(/[?&]gid=([0-9]+)/) || targetUrl.match(/#gid=([0-9]+)/);
      if (gidMatch && gidMatch[1]) {
        gid = gidMatch[1];
      }

      // Try primary Google Sheets export CSV endpoint
      const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
      let fetchRes = await fetch(exportUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });

      if (!fetchRes.ok) {
        // Fallback to gviz tq endpoint
        const gvizUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`;
        fetchRes = await fetch(gvizUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
      }

      if (!fetchRes.ok) {
        return res.status(400).json({
          success: false,
          message: `Không thể đọc dữ liệu từ Google Sheets (HTTP ${fetchRes.status}). Vui lòng đảm bảo file đã được bật chế độ "Bất kỳ ai có liên kết đều có thể xem".`
        });
      }

      const csvText = await fetchRes.text();
      return res.json({ success: true, csvText, sheetUrl: targetUrl });
    } catch (err: any) {
      console.error('Error fetching Google Sheets CSV:', err);
      return res.status(500).json({
        success: false,
        message: 'Lỗi khi kết nối tới Google Sheets: ' + (err.message || 'Lỗi mạng')
      });
    }
  });

  // Get current active settings
  app.get('/api/settings', (_req, res) => {
    const settings = getSettings();
    res.json({
      success: true,
      activeSheetUrl: settings.activeSheetUrl,
      isPasscodeCustomized: (settings.updatePasscode !== DEFAULT_PASS)
    });
  });

  // Verify update passcode
  app.post('/api/settings/verify-passcode', (req, res) => {
    const { passcode } = req.body;
    const settings = getSettings();
    if (!passcode || passcode.trim() !== settings.updatePasscode) {
      return res.status(400).json({ success: false, valid: false, message: 'Mật mã xác thực không chính xác!' });
    }
    return res.json({ success: true, valid: true });
  });

  // Update central Google Sheets URL across all devices
  app.post('/api/settings/sheet-url', (req, res) => {
    const { sheetUrl, passcode } = req.body;
    if (!sheetUrl || typeof sheetUrl !== 'string') {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp liên kết Google Sheets hợp lệ.' });
    }

    const settings = getSettings();
    if (passcode !== undefined && passcode !== null && passcode.trim() !== settings.updatePasscode) {
      return res.status(401).json({ success: false, message: 'Mật mã xác thực không chính xác! Vui lòng kiểm tra lại.' });
    }

    settings.activeSheetUrl = sheetUrl.trim();
    saveSettings(settings);

    return res.json({
      success: true,
      activeSheetUrl: settings.activeSheetUrl,
      message: 'Đã lưu và đồng bộ liên kết Google Sheets mới tới tất cả người dùng và mọi thiết bị!'
    });
  });

  // Change update passcode centrally
  app.post('/api/settings/change-passcode', (req, res) => {
    const { oldPasscode, newPasscode } = req.body;
    const settings = getSettings();

    if (!oldPasscode || oldPasscode.trim() !== settings.updatePasscode) {
      return res.status(400).json({ success: false, message: 'Mật mã hiện tại không chính xác!' });
    }

    if (!newPasscode || newPasscode.trim().length < 4) {
      return res.status(400).json({ success: false, message: 'Mật mã mới phải có độ dài tối thiểu 4 ký tự.' });
    }

    settings.updatePasscode = newPasscode.trim();
    saveSettings(settings);

    return res.json({ success: true, message: 'Đã lưu Mật mã Báo cáo mới thành công trên toàn hệ thống!' });
  });

  // Reset Admin password and Passcode back to default 123456@
  app.post('/api/settings/reset-all', (_req, res) => {
    resetAdminToDefault();
    return res.json({
      success: true,
      message: `Đã đặt lại Mật khẩu Quản trị và Mật mã Báo cáo về mặc định (${DEFAULT_PASS}) thành công!`
    });
  });

  // ==================== USER MANAGEMENT APIs ====================

  app.get('/api/users', (_req, res) => {
    const users = getUsers();
    res.json({ success: true, users });
  });

  app.post('/api/users/register', (req, res) => {
    const { fullName, email, phone, password } = req.body;
    if (!fullName || !email || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ các thông tin bắt buộc (*).' });
    }

    const users = getUsers();
    const existing = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
    if (existing) {
      return res.status(400).json({ success: false, message: 'Địa chỉ Email này đã được đăng ký trước đó!' });
    }

    const newUser: User = {
      id: 'user_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      fullName: fullName.trim(),
      email: email.trim(),
      phone: (phone || 'N/A').trim(),
      password: password.trim(),
      role: 'user',
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    saveUsers(users);

    return res.json({ success: true, user: newUser, message: 'Đăng ký tài khoản thành công! Đã gửi thông tin đến Quản trị viên để phê duyệt.' });
  });

  app.post('/api/users/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập Email và Mật khẩu.' });
    }

    const users = getUsers();
    const found = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());

    if (!found || found.password !== password.trim()) {
      return res.status(401).json({ success: false, message: 'Email hoặc Mật khẩu không chính xác!' });
    }

    if (found.status === 'pending') {
      return res.status(403).json({ success: false, status: 'pending', message: 'Tài khoản của bạn đang chờ Quản trị viên (Khuất Văn Sơn) phê duyệt cấp quyền.' });
    }

    if (found.status === 'rejected') {
      return res.status(403).json({ success: false, status: 'rejected', message: 'Tài khoản của bạn đã bị từ chối cấp quyền truy cập.' });
    }

    return res.json({ success: true, user: found });
  });

  app.post('/api/users/approve', (req, res) => {
    const { userId } = req.body;
    const users = getUsers();
    const target = users.find(u => u.id === userId);

    if (!target) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản!' });
    }

    target.status = 'approved';
    saveUsers(users);

    return res.json({ success: true, message: `Đã phê duyệt tài khoản ${target.email}` });
  });

  app.post('/api/users/reject', (req, res) => {
    const { userId } = req.body;
    const users = getUsers();
    const target = users.find(u => u.id === userId);

    if (!target) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản!' });
    }

    target.status = 'rejected';
    saveUsers(users);

    return res.json({ success: true, message: `Đã từ chối tài khoản ${target.email}` });
  });

  app.post('/api/users/reset-password', (req, res) => {
    const { userId, email } = req.body;
    const users = getUsers();
    let target: User | undefined;

    if (userId) {
      target = users.find(u => u.id === userId);
    } else if (email) {
      target = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
    }

    if (!target) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản!' });
    }

    target.password = DEFAULT_PASS;
    saveUsers(users);

    return res.json({ success: true, message: `Đã reset mật khẩu tài khoản ${target.email} về 123456@` });
  });

  app.delete('/api/users/:id', (req, res) => {
    const userId = req.params.id;
    let users = getUsers();
    const target = users.find(u => u.id === userId);

    if (!target) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản!' });
    }

    if (target.role === 'admin' || target.email.toLowerCase() === 'khvanson@gmail.com') {
      return res.status(400).json({ success: false, message: 'Không thể xóa tài khoản Quản trị viên tối cao!' });
    }

    users = users.filter(u => u.id !== userId);
    saveUsers(users);

    return res.json({ success: true, message: 'Đã xóa tài khoản thành công.' });
  });

  app.post('/api/users/change-admin-password', (req, res) => {
    const { currentPass, newPass } = req.body;
    const users = getUsers();
    const adminIndex = users.findIndex(u => u.email.toLowerCase() === 'khvanson@gmail.com' || u.role === 'admin');

    if (adminIndex === -1) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản Quản trị!' });
    }

    if (users[adminIndex].password !== currentPass) {
      return res.status(400).json({ success: false, message: 'Mật khẩu Quản trị hiện tại không chính xác!' });
    }

    if (!newPass || newPass.length < 4) {
      return res.status(400).json({ success: false, message: 'Mật khẩu mới phải có độ dài từ 4 ký tự trở lên!' });
    }

    users[adminIndex].password = newPass;
    saveUsers(users);

    return res.json({ success: true, message: 'Đã thay đổi Mật khẩu Quản trị thành công!' });
  });

  // Export full user database for backup
  app.get('/api/users/export', (_req, res) => {
    const users = getUsers();
    const backupData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      type: 'users_backup',
      count: users.length,
      users
    };
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="danh_sach_nguoi_dung_backup_${Date.now()}.json"`);
    return res.send(JSON.stringify(backupData, null, 2));
  });

  // Restore / import user database from backup file
  app.post('/api/users/restore', (req, res) => {
    try {
      const { users: incomingUsers, mode } = req.body;
      if (!Array.isArray(incomingUsers)) {
        return res.status(400).json({ success: false, message: 'Dữ liệu khôi phục không đúng cấu trúc (phải là danh sách người dùng).' });
      }

      let currentUsers = getUsers();
      let addedCount = 0;
      let updatedCount = 0;

      if (mode === 'replace') {
        // Completely replace with backup array, but preserve master admin if omitted
        currentUsers = incomingUsers;
        const hasAdmin = currentUsers.some(u => u.email.toLowerCase() === 'khvanson@gmail.com' || u.role === 'admin');
        if (!hasAdmin) {
          currentUsers.unshift({
            id: 'user_admin_khvanson',
            email: 'khvanson@gmail.com',
            fullName: 'Khuất Văn Sơn (Quản trị viên)',
            phone: '0906234585',
            password: DEFAULT_PASS,
            role: 'admin',
            status: 'approved',
            createdAt: new Date().toISOString()
          });
        }
      } else {
        // Default 'merge' mode: update existing emails, insert missing emails
        for (const inc of incomingUsers) {
          if (!inc || !inc.email) continue;
          const idx = currentUsers.findIndex(u => u.email.toLowerCase() === inc.email.trim().toLowerCase());
          if (idx !== -1) {
            // Update fields while preserving ID if existing
            currentUsers[idx] = {
              ...currentUsers[idx],
              fullName: inc.fullName || currentUsers[idx].fullName,
              phone: inc.phone || currentUsers[idx].phone,
              password: inc.password || currentUsers[idx].password,
              role: inc.role || currentUsers[idx].role,
              status: inc.status || currentUsers[idx].status,
              createdAt: inc.createdAt || currentUsers[idx].createdAt
            };
            updatedCount++;
          } else {
            // Insert new record
            currentUsers.push({
              id: inc.id || ('user_' + Date.now() + '_' + Math.floor(Math.random() * 1000)),
              fullName: (inc.fullName || '').trim(),
              email: (inc.email || '').trim(),
              phone: (inc.phone || 'N/A').trim(),
              password: (inc.password || DEFAULT_PASS).trim(),
              role: inc.role || 'user',
              status: inc.status || 'approved',
              createdAt: inc.createdAt || new Date().toISOString()
            });
            addedCount++;
          }
        }
      }

      saveUsers(currentUsers);
      return res.json({
        success: true,
        totalUsers: currentUsers.length,
        addedCount,
        updatedCount,
        message: `Phục hồi dữ liệu người dùng thành công! Tổng cộng: ${currentUsers.length} tài khoản (Thêm mới: ${addedCount}, Cập nhật: ${updatedCount}).`
      });
    } catch (err: any) {
      console.error('Error restoring users:', err);
      return res.status(500).json({ success: false, message: 'Lỗi khi nạp file sao lưu: ' + err.message });
    }
  });

  // ==================== AUDIT LOGS APIs ====================
  app.get('/api/audit-logs', (_req, res) => {
    const logs = getLogs();
    res.json({ success: true, logs });
  });

  // Export full audit logs database for backup
  app.get('/api/audit-logs/export', (_req, res) => {
    const logs = getLogs();
    const backupData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      type: 'audit_logs_backup',
      count: logs.length,
      logs
    };
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="lich_su_truy_vet_backup_${Date.now()}.json"`);
    return res.send(JSON.stringify(backupData, null, 2));
  });

  // Restore / import audit logs from backup file
  app.post('/api/audit-logs/restore', (req, res) => {
    try {
      const { logs: incomingLogs, mode } = req.body;
      if (!Array.isArray(incomingLogs)) {
        return res.status(400).json({ success: false, message: 'Dữ liệu lịch sử không đúng cấu trúc.' });
      }

      let currentLogs = getLogs();
      let addedCount = 0;

      if (mode === 'replace') {
        currentLogs = incomingLogs;
        addedCount = incomingLogs.length;
      } else {
        // Merge mode: append incoming logs that don't match existing log IDs
        const existingIds = new Set(currentLogs.map(l => l.id));
        for (const inc of incomingLogs) {
          if (!inc || !inc.id) continue;
          if (!existingIds.has(inc.id)) {
            currentLogs.push(inc);
            existingIds.add(inc.id);
            addedCount++;
          }
        }
        // Sort descending by timestamp
        currentLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      }

      saveLogs(currentLogs);
      return res.json({
        success: true,
        totalLogs: currentLogs.length,
        addedCount,
        message: `Phục hồi nhật ký truy vết thành công! Tổng số bản ghi: ${currentLogs.length} (Thêm mới: ${addedCount}).`
      });
    } catch (err: any) {
      console.error('Error restoring audit logs:', err);
      return res.status(500).json({ success: false, message: 'Lỗi khi nạp file sao lưu nhật ký: ' + err.message });
    }
  });

  app.post('/api/audit-logs', (req, res) => {
    const { email, fullName, phone, action, sheetUrl } = req.body;
    const logs = getLogs();
    const newLog: AuditLog = {
      id: 'log_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      email: email || 'N/A',
      fullName: fullName || email || 'Khách',
      phone: phone || 'N/A',
      action: action || 'Mở Google Sheets',
      sheetUrl: sheetUrl || '',
      timestamp: new Date().toISOString()
    };

    logs.unshift(newLog);
    saveLogs(logs);

    res.json({ success: true, log: newLog });
  });

  app.delete('/api/audit-logs', (_req, res) => {
    saveLogs([]);
    res.json({ success: true, message: 'Đã xóa sạch lịch sử nhật ký.' });
  });

  // Vite middleware in development or static serving in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

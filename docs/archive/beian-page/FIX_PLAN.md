# SSL 证书问题修复方案

## 问题诊断

### 当前问题
1. **HSTS 强制 HTTPS**：浏览器缓存了一年的强制 HTTPS 设置
2. **证书域名不匹配**：
   - SSL 证书只包含：`blackevil.cn`
   - 但配置使用了：`www.blackevil.cn`
   - 导致访问 https://www.blackevil.cn 时证书错误

### 证书状态
- 证书域名：blackevil.cn
- 有效期：2026-04-20 到 2026-07-19
- **还有 10 天即将过期！**

---

## 紧急修复方案

### 方案 A：重新申请包含 www 的证书（推荐）

在服务器上执行：

```bash
# 1. 停止 Nginx
systemctl stop nginx || service nginx stop

# 2. 重新申请证书（包含 www）
certbot certonly --standalone -d blackevil.cn -d www.blackevil.cn

# 3. 更新配置中的证书路径
# 证书会生成在新目录：/etc/letsencrypt/live/blackevil.cn/

# 4. 修改配置文件
nano /www/server/panel/vhost/nginx/blackevil.cn.conf
# 和 www.blackevil.cn.conf
# 将证书路径改为：
# ssl_certificate /etc/letsencrypt/live/blackevil.cn/fullchain.pem;
# ssl_certificate_key /etc/letsencrypt/live/blackevil.cn/privkey.pem;

# 5. 重启 Nginx
nginx -t && systemctl start nginx
```

### 方案 B：移除 www.blackevil.cn（临时方案）

如果不想重新申请证书，可以：

```bash
# 修改配置，移除 www.blackevil.cn
nano /www/server/panel/vhost/nginx/blackevil.cn.conf
# 将 server_name 改为：
# server_name blackevil.cn;

# 重启
nginx -t && systemctl reload nginx
```

---

## 正确的备案部署方案

### 重要原则
**备案页面必须保留 HTTPS 配置！** 因为：
- HSTS 已在浏览器缓存，强制 HTTPS
- 备案审核人员也可能访问 HTTPS
- 删除 HTTPS 会导致证书错误

### 正确部署步骤

#### 1. 创建备案页面（保留 HTTPS）

修改 Nginx 配置，**同时保留 HTTP 和 HTTPS**：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name blackevil.cn;

    # 备案页面（HTTP）
    root /var/www/blackevil.cn-beian;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    # 不强制跳转 HTTPS（备案期间）
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name blackevil.cn;

    # SSL 配置
    ssl_certificate /etc/letsencrypt/live/blackevil.cn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/blackevil.cn/privkey.pem;

    # 备案页面（HTTPS）
    root /var/www/blackevil.cn-beian;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    # 不添加 HSTS（避免强制 HTTPS）
    # add_header Strict-Transport-Security ... （注释掉）
}
```

#### 2. 关键注意事项

- ✅ **保留 HTTPS 配置**：避免证书错误
- ✅ **不强制 HTTPS 跳转**：让审核人员可以访问 HTTP
- ✅ **注释掉 HSTS**：避免浏览器强制 HTTPS
- ✅ **修复证书域名**：重新申请包含 www 的证书

---

## 清除浏览器 HSTS 的方法

### Chrome / Edge
1. 地址栏输入：`chrome://net-internals/#hsts` 或 `edge://net-internals/#hsts`
2. 在 "Delete domain security policies" 输入域名
3. 分别删除：
   - `blackevil.cn`
   - `www.blackevil.cn`
4. 点击 Delete 按钮

### Firefox
- 清除浏览器历史记录
- 或使用隐私模式访问

### Safari
- 清除历史记录和网站数据

---

## 当前恢复状态

### ✅ 已恢复
- 原配置已恢复：SISM 系统 + n8n 服务
- 备份完整：~/nginx-backup/ 目录
- HTTP 访问正常：http://blackevil.cn

### ⚠️ 需要修复
- HTTPS 证书域名不匹配（www.blackevil.cn）
- SSL 证书即将过期（10天后）
- HSTS 导致浏览器强制 HTTPS

---

## 建议操作顺序

1. **立即清除浏览器 HSTS**（按上面方法）
2. **访问 http://blackevil.cn**（不要用 HTTPS）
3. **修复证书问题**（重新申请包含 www 的证书）
4. **等证书修复后**，再部署备案页面（保留 HTTPS）

---

## 如果需要立即部署备案页面

在证书修复后，我可以帮你：
1. 创建保留 HTTPS 的备案页面配置
2. 注释掉 HSTS header
3. 不强制 HTTPS 跳转
4. 让备案审核人员可以正常访问

请先清除浏览器 HSTS，然后访问 http://blackevil.cn 确认原服务已恢复。
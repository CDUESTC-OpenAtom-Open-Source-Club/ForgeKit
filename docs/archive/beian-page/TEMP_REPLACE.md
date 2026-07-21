# Nginx 临时替换备案页面操作指南

## 操作流程

### 步骤 1：登录服务器

```bash
ssh root@175.24.139.148
```

### 步骤 2：检查当前 Nginx 配置

```bash
# 查看 Nginx 配置文件位置
nginx -t

# 查看当前域名配置（找到 blackevil.cn 的配置）
ls -la /etc/nginx/sites-available/
ls -la /etc/nginx/sites-enabled/
ls -la /etc/nginx/conf.d/

# 查看当前配置内容（假设在 sites-available）
cat /etc/nginx/sites-available/blackevil.cn
# 或
cat /etc/nginx/conf.d/blackevil.cn.conf
```

### 步骤 3：备份当前配置（重要！恢复时需要）

```bash
# 创建备份目录
mkdir -p ~/nginx-backup

# 备份当前配置（根据实际位置调整）
cp /etc/nginx/sites-available/blackevil.cn ~/nginx-backup/blackevil.cn.original
# 或
cp /etc/nginx/conf.d/blackevil.cn.conf ~/nginx-backup/blackevil.cn.conf.original

# 记录备份时间
echo "备份时间: $(date)" > ~/nginx-backup/backup-info.txt
```

### 步骤 4：上传备案页面文件

在本地执行（不需要在服务器上）：

```bash
# 在 ForgeKit 项目目录执行
cd /Users/blackevil/Projects/ForgeKit

# 创建服务器目录并上传文件
ssh root@175.24.139.148 "mkdir -p /var/www/blackevil.cn-beian"
scp docs/beian-page/index.html root@175.24.139.148:/var/www/blackevil.cn-beian/
```

### 步骤 5：修改 Nginx 配置（临时切换到备案页面）

回到服务器上执行：

```bash
# 编辑配置文件（根据实际位置）
sudo nano /etc/nginx/sites-available/blackevil.cn
# 或
sudo nano /etc/nginx/conf.d/blackevil.cn.conf

# 替换为以下内容：
```

**临时备案页面配置：**

```nginx
server {
    listen 80;
    server_name blackevil.cn www.blackevil.cn;

    # 备案页面目录
    root /var/www/blackevil.cn-beian;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    # 可选：记录访问日志
    access_log /var/log/nginx/blackevil.cn-beian.access.log;
    error_log /var/log/nginx/blackevil.cn-beian.error.log;
}
```

保存并退出（nano: Ctrl+X, Y, Enter）

### 步骤 6：测试并重启 Nginx

```bash
# 测试配置语法
sudo nginx -t

# 如果测试通过，重新加载配置
sudo systemctl reload nginx

# 或使用重启
sudo systemctl restart nginx
```

### 步骤 7：验证页面部署成功

```bash
# 在服务器上测试
curl -I http://localhost
curl http://localhost | head -20

# 检查页面是否正确返回
curl http://blackevil.cn
```

在本地浏览器访问：`http://blackevil.cn`

应该看到备案页面内容。

---

## 备案通过后恢复原服务

### 步骤 1：恢复原配置

```bash
ssh root@175.24.139.148

# 查看备份信息
cat ~/nginx-backup/backup-info.txt

# 恢复原配置（根据之前备份的位置）
cp ~/nginx-backup/blackevil.cn.original /etc/nginx/sites-available/blackevil.cn
# 或
cp ~/nginx-backup/blackevil.cn.conf.original /etc/nginx/conf.d/blackevil.cn.conf

# 测试配置
sudo nginx -t

# 重新加载
sudo systemctl reload nginx
```

### 步骤 2：清理备案页面（可选）

```bash
# 删除备案页面目录
rm -rf /var/www/blackevil.cn-beian

# 删除备份（建议保留一段时间以防需要）
# rm -rf ~/nginx-backup
```

### 步骤 3：验证原服务恢复

访问原网站确认服务恢复正常。

---

## 完整命令汇总（一键执行版）

### 一键切换到备案页面

在服务器上执行：

```bash
# 创建备份
mkdir -p ~/nginx-backup
CONFIG_FILE=$(find /etc/nginx -name "*blackevil*" -type f | head -1)
cp "$CONFIG_FILE" ~/nginx-backup/original.conf

# 创建备案页面目录
mkdir -p /var/www/blackevil.cn-beian

# 写入临时配置（需要手动上传 index.html）
cat > "$CONFIG_FILE" << 'EOF'
server {
    listen 80;
    server_name blackevil.cn www.blackevil.cn;
    root /var/www/blackevil.cn-beian;
    index index.html;
    location / {
        try_files $uri $uri/ =404;
    }
}
EOF

# 测试并重启
nginx -t && systemctl reload nginx
```

### 一键恢复原服务

```bash
CONFIG_FILE=$(find /etc/nginx -name "*blackevil*" -type f | head -1)
cp ~/nginx-backup/original.conf "$CONFIG_FILE"
nginx -t && systemctl reload nginx
```

---

## 注意事项

1. **务必备份原配置** - 恢复时必须用到
2. **备案期间保持页面稳定** - 不要频繁修改
3. **备案页面内容真实** - 展示了实际存在的开源项目
4. **备案通过后及时恢复** - 避影响原服务

## 如果遇到问题

### Nginx 配置找不到？

```bash
# 查找所有 Nginx 配置
find /etc/nginx -name "*.conf" -type f
grep -r "blackevil" /etc/nginx/
```

### 80 端口被占用？

```bash
# 查看端口占用
netstat -tulnp | grep :80
# 或
ss -tulnp | grep :80

# 如果有其他进程占用，需要先停止
```

### Nginx 重启失败？

```bash
# 查看错误日志
tail -20 /var/log/nginx/error.log

# 检查配置语法
nginx -t
```
# 备案页面部署说明

## 背景

备案被驳回原因："网站内容与备案主体性质不符"。
需要部署一个符合"个人应用型"备案性质的简单静态网页。

## 页面说明

创建的页面 `index.html` 内容包括：
- 个人开发工具介绍
- 开源项目展示（ForgeKit）
- 个人学习笔记
- 符合"个人应用型"备案主体性质

## 快速部署方案

### 方案一：使用 Nginx（推荐）

如果你的服务器上已经有 Nginx：

1. **将 index.html 上传到服务器**

```bash
# 在服务器上创建目录
sudo mkdir -p /var/www/blackevil.cn

# 上传文件（在本地执行）
scp docs/beian-page/index.html root@175.24.139.148:/var/www/blackevil.cn/
```

2. **修改 Nginx 配置**

在服务器上修改 Nginx 配置文件（通常在 `/etc/nginx/sites-available/` 或 `/etc/nginx/conf.d/`）：

```nginx
server {
    listen 80;
    server_name blackevil.cn www.blackevil.cn;

    root /var/www/blackevil.cn;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    # 可选：将原来的服务代理到其他端口（不影响备案页面）
    # location /app {
    #     proxy_pass http://localhost:8080;
    # }
}
```

3. **重启 Nginx**

```bash
sudo nginx -t  # 测试配置
sudo systemctl reload nginx
```

### 方案二：使用 Python 快速静态服务

如果没有 Nginx，可以使用 Python 快速启动静态服务器：

1. **上传 index.html 到服务器**

```bash
scp docs/beian-page/index.html root@175.24.139.148:/root/beian-page/
```

2. **在服务器上启动 Python HTTP 服务**

```bash
# 在服务器上执行
cd /root/beian-page
python3 -m http.server 80 --bind 0.0.0.0
```

或者使用 nohup 保持后台运行：

```bash
nohup python3 -m http.server 80 --bind 0.0.0.0 > /dev/null 2>&1 &
```

### 方案三：使用 Node.js serve 工具

如果服务器有 Node.js：

```bash
# 安装 serve
npm install -g serve

# 上传文件后启动
scp docs/beian-page/index.html root@175.24.139.148:/root/beian-page/
cd /root/beian-page
serve -p 80
```

## 保持原有服务的方法

如果原来的服务需要继续运行，可以：

1. **修改原服务端口**：将原服务改为监听其他端口（如 8080）
2. **使用 Nginx 反向代理**：
   - 主域名（blackevil.cn）指向备案静态页面
   - 子路径（如 `/app`）或子域名指向原服务

示例 Nginx 配置：

```nginx
server {
    listen 80;
    server_name blackevil.cn;

    # 备案静态页面
    root /var/www/blackevil.cn;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    # 原服务代理（可选）
    location /app {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# 或使用子域名
server {
    listen 80;
    server_name app.blackevil.cn;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 验证部署

部署完成后，访问 `http://blackevil.cn` 应该看到：
- 简洁的个人开发工具展示页面
- 包含 ForgeKit 开源项目介绍
- 符合个人应用型备案性质

可以使用 curl 测试：

```bash
curl -I http://blackevil.cn
curl http://blackevil.cn
```

## 备案通过后的处理

备案审核通过后，可以：
1. 恢复原服务
2. 或继续保留备案页面作为主页，原服务通过子路径/子域名访问

## 文件位置

- 页面文件：`docs/beian-page/index.html`
- 部署说明：`docs/beian-page/DEPLOY.md`

## 注意事项

- 备案审核期间，保持页面稳定可访问
- 页面底部包含备案号占位符，审核通过后填入真实备案号
- 确保页面响应速度正常（静态页面加载快）
- 页面内容真实（展示了实际存在的开源项目 ForgeKit）
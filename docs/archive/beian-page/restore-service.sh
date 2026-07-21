#!/bin/bash
# 备案通过后恢复原服务的脚本
# 在服务器上执行：bash restore-service.sh

echo "===================================="
echo "开始恢复原服务配置..."
echo "===================================="

# 1. 恢复主域名配置
echo "恢复 blackevil.cn 配置..."
cp ~/nginx-backup/baota-original.conf /www/server/panel/vhost/nginx/blackevil.cn.conf

# 2. 恢复 www 子域名配置
echo "恢复 www.blackevil.cn 配置..."
cp ~/nginx-backup/www-original.conf /www/server/panel/vhost/nginx/www.blackevil.cn.conf

# 3. 测试配置
echo "测试 Nginx 配置..."
nginx -t

if [ $? -eq 0 ]; then
    echo "配置测试通过，重启 Nginx..."
    systemctl reload nginx || service nginx reload

    echo "===================================="
    echo "原服务已成功恢复！"
    echo "===================================="
    echo ""
    echo "已恢复的服务："
    echo "- blackevil.cn → SISM 系统 (端口 18080/18081)"
    echo "- www.blackevil.cn → n8n 服务 (端口 5678)"
    echo "- new.blackevil.cn → 保持不变"
    echo ""
    echo "请访问域名确认服务恢复正常。"
else
    echo "配置测试失败，请检查错误信息！"
    exit 1
fi

# 4. 可选：删除备案页面文件（用户选择）
echo ""
read -p "是否删除备案页面文件？(y/N): " choice
if [ "$choice" = "y" ] || [ "$choice" = "Y" ]; then
    rm -rf /var/www/blackevil.cn-beian
    echo "备案页面文件已删除"
else
    echo "保留备案页面文件在: /var/www/blackevil.cn-beian"
fi

echo ""
echo "恢复完成！原配置备份仍保存在 ~/nginx-backup/"
echo "备份文件列表："
ls -lh ~/nginx-backup/
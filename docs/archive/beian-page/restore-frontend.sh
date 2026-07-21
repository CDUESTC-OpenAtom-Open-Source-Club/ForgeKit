#!/bin/bash
# 备案通过后恢复原前端页面
# 执行：bash ~/nginx-backup/restore-frontend.sh

echo "===================================="
echo "恢复原前端页面..."
echo "===================================="

# 1. 恢复原配置
echo "恢复原 Nginx 配置..."
cp ~/nginx-backup/baota-original.conf /www/server/panel/vhost/nginx/blackevil.cn.conf

# 2. 测试配置
echo "测试 Nginx 配置..."
nginx -t

if [ $? -eq 0 ]; then
    echo "配置测试通过，重启 Nginx..."
    systemctl reload nginx || service nginx reload

    echo "===================================="
    echo "原前端页面已恢复！"
    echo "===================================="
    echo ""
    echo "现在访问网站会看到："
    echo "- SISM 系统（战略指标管理系统）"
    echo ""
    echo "请访问域名确认页面已恢复。"

    # 3. 可选：删除备案页面文件
    echo ""
    read -p "是否删除备案页面文件？(y/N): " choice
    if [ "$choice" = "y" ] || [ "$choice" = "Y" ]; then
        rm -rf /var/www/sism-beian
        echo "备案页面文件已删除"
    else
        echo "保留备案页面文件在: /var/www/sism-beian/"
    fi

else
    echo "配置测试失败！"
    exit 1
fi

echo ""
echo "恢复完成！备份文件仍保存在 ~/nginx-backup/"
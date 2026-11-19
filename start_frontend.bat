@echo off
chcp 65001 >nul
echo ========================================
echo 正在启动前端服务 (Vite)...
echo 后端 API 代理地址: http://127.0.0.1:8011
echo ========================================

cd /d %~dp0frontend

:: 检查是否存在 package.json
if not exist "package.json" (
    echo 错误：package.json 不存在，请检查项目文件。
    pause
    exit /b 1
)

:: 启动服务
npm run dev

echo ========================================
echo 前端服务已启动！
echo 请查看上方输出获取实际访问地址（通常是 http://localhost:5173）
echo ========================================
pause

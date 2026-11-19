@echo off
chcp 65001 >nul
echo ========================================
echo 正在启动后端服务 (FastAPI)...
echo ========================================

:: 激活虚拟环境
cd /d %~dp0backend

if not exist ".venv\Scripts\activate.bat" (
    echo 错误：虚拟环境不存在，请先安装依赖。
    pause
    exit /b 1
)

call .venv\Scripts\activate.bat

:: 启动服务
uvicorn app.main:app --reload --host 127.0.0.1 --port 8011

echo ========================================
echo 后端服务已启动！访问地址: http://127.0.0.1:8011
echo 接口文档地址: http://127.0.0.1:8011/docs
echo ========================================
pause

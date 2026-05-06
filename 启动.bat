@echo off
chcp 65001 > nul
cd /d "%~dp0dist"
echo 正在启动 Bughouse 比赛编排系统...
echo 如果首次运行，可能需要几秒钟下载依赖...
start http://localhost:8080
npx serve -l 8080 --no-clipboard

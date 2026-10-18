@echo off
pushd "%~dp0"
echo Serving CreditFlow at http://127.0.0.1:3000
python -m http.server 3000
popd

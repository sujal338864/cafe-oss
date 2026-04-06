@echo off
echo Pushing Backend...
git add .
git commit -m "perf: optimization"
git push origin main
echo Pushing Frontend...
cd ../frontend
git add .
git commit -m "perf: optimization"
git push origin main
echo DONE.

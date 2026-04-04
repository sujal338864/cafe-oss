@echo off
echo Starting Prisma Repair Bat...
node prisma_repair.js > repair_bat_out.txt 2>&1
echo Done.

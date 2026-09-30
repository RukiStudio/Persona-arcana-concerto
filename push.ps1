# ============================================================
# 一键推送脚本：add -> commit -> push 当前分支到 GitHub
# 用法（在项目根目录）：
#   .\push.ps1                        # 自动生成提交信息
#   .\push.ps1 -Message "修复教程发牌"
#   .\push.ps1 -DryRun                # 只预览，不实际提交/推送
# 双击 push.bat 也可直接运行
# ============================================================
param(
  [string]$Message = "",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

function Info($t) { Write-Host "[push] $t" -ForegroundColor Cyan }
function Ok($t)   { Write-Host "[ OK ] $t" -ForegroundColor Green }
function Warn($t) { Write-Host "[WARN] $t" -ForegroundColor Yellow }

# ---------- 0. 环境检查 ----------
git rev-parse --is-inside-work-tree *> $null
if ($LASTEXITCODE -ne 0) { throw "当前目录不是 git 仓库：$PSScriptRoot" }

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
$remote = "origin"
if ($branch -eq "HEAD") { throw "处于游离 HEAD 状态，请先切换分支" }

Info "分支: $branch   远端: $remote"

# ---------- 1. 暂存全部改动 ----------
git add -A
$staged = git diff --cached --name-only
if (-not $staged) {
  Warn "没有需要提交的改动"
  $ahead = git rev-list --count "$remote/$branch..$branch" 2>$null
  if ($ahead -and [int]$ahead -gt 0) {
    Info "但本地领先远端 $ahead 个提交，继续推送"
  } else {
    Ok "远端已是最新，无需操作"
    exit 0
  }
} else {
  Info "待提交文件："
  $staged | ForEach-Object { Write-Host "       $_" }
}

if ($DryRun) { Warn "DryRun：已暂存但未提交、未推送"; exit 0 }

# ---------- 2. 提交 ----------
if ($staged) {
  if (-not $Message) {
    $Message = "chore: 更新 $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
  }
  git commit -m $Message
  if ($LASTEXITCODE -ne 0) { throw "提交失败" }
  Ok "已提交：$Message"
}

# ---------- 3. 推送 ----------
git push -u $remote $branch
if ($LASTEXITCODE -ne 0) {
  Warn "推送失败。若为网络问题，可尝试以下方式后重跑本脚本："
  Warn "  A) 走代理:  git config --local http.proxy http://127.0.0.1:7890"
  Warn "  B) 换 SSH:  git remote set-url origin git@github.com:RukiStudio/Persona-arcana-concerto.git"
  Warn "  C) 用镜像:  git remote set-url origin https://ghproxy.net/https://github.com/RukiStudio/Persona-arcana-concerto.git"
  throw "推送失败"
}

Ok "推送完成 -> $remote/$branch"
git log -1 --oneline
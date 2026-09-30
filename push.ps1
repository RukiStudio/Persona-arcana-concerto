# ============================================================
# 一键推送脚本：add -> commit -> push 当前分支到 GitHub
# 传输方式自动探测：直连HTTPS -> SSH -> 镜像代理，按序回退
#
# 用法（在项目根目录的外部 PowerShell 终端运行）：
#   .\push.ps1                              # 自动选传输方式
#   .\push.ps1 -Message "修复教程发牌"
#   .\push.ps1 -ToMaster                    # 推送到远端 master（快进，更新 Pages）
#   .\push.ps1 -Transport https             # 强制直连 HTTPS
#   .\push.ps1 -Transport ssh               # 强制 SSH
#   .\push.ps1 -Transport mirror            # 强制镜像代理
#   .\push.ps1 -DryRun                      # 只预览，不提交不推送
# 双击 push.bat 也可运行
# ============================================================
param(
  [string]$Message = "",
  [ValidateSet("auto", "https", "ssh", "mirror")]
  [string]$Transport = "auto",
  [switch]$ToMaster,
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

$origUrl = (git remote get-url $remote).Trim()
Info "分支: $branch   远端: $remote ($origUrl)"

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

# ---------- 3. 探测可用传输方式 ----------
function Test-Tcp($host, $port, $timeoutMs = 3000) {
  $t = New-Object System.Net.Sockets.TcpClient
  try {
    $ar = $t.BeginConnect($host, $port, $null, $null)
    $ok = $ar.AsyncWaitHandle.WaitOne($timeoutMs)
    return $ok
  } catch {
    return $false
  } finally {
    $t.Close()
  }
}

$MIRRORS = @(
  "https://ghproxy.net/https://github.com/RukiStudio/Persona-arcana-concerto.git",
  "https://ghproxy.com/https://github.com/RukiStudio/Persona-arcana-concerto.git",
  "https://gh.api.99988866.xyz/https://github.com/RukiStudio/Persona-arcana-concerto.git",
  "https://gitclone.com/github.com/RukiStudio/Persona-arcana-concerto.git"
)

$httpsOk = Test-Tcp "github.com" 443
$sshOk   = Test-Tcp "github.com" 22
$hasSshKey = Test-Path (Join-Path ([Environment]::GetFolderPath("UserProfile")) ".ssh\id_*")

Info "网络探测：HTTPS(443)=$httpsOk  SSH(22)=$sshOk  本地SSH密钥=$hasSshKey"

$chosen = $null
if ($Transport -ne "auto") {
  $chosen = $Transport
} else {
  if ($httpsOk) { $chosen = "https" }
  elseif ($sshOk -and $hasSshKey) { $chosen = "ssh" }
  else { $chosen = "mirror" }
}
Info "使用传输方式: $chosen"

# ---------- 4. 推送 ----------
$target = if ($ToMaster) { "master" } else { $branch }
$pushed = $false
$tried = @()

# 按顺序尝试的 (mode, url) 列表
$attempts = New-Object System.Collections.Generic.List[object]
switch ($chosen) {
  "https"  { $attempts.Add(@("https", $origUrl)) }
  "ssh"    { $attempts.Add(@("ssh", "git@github.com:RukiStudio/Persona-arcana-concerto.git")) }
  "mirror" { foreach ($m in $MIRRORS) { $attempts.Add(@("mirror", $m)) } }
}

# 自动模式下额外兜底：直连失败再试镜像
if ($Transport -eq "auto" -and $chosen -ne "mirror") {
  foreach ($m in $MIRRORS) { $attempts.Add(@("mirror", $m)) }
}

foreach ($attempt in $attempts) {
  $mode = $attempt[0]; $url = $attempt[1]
  $tried += "$mode($url)"

  Info "尝试 [$mode] -> $url"
  git remote set-url $remote $url
  git push -u $remote "HEAD:$target" 2>&1 | ForEach-Object { Write-Host "       $_" }
  if ($LASTEXITCODE -eq 0) {
    $pushed = $true
    break
  }
  Warn "[$mode] 推送失败，尝试下一个"
}

# 还原原始远端 URL（避免永久改动）
git remote set-url $remote $origUrl

if (-not $pushed) {
  Warn "所有传输方式均失败。已尝试："
  $tried | ForEach-Object { Write-Host "       $_" }
  Warn ""
  Warn "手动排查建议："
  Warn "  1) 检查本机是否有 VPN/代理，若有则开启后重跑"
  Warn "  2) 配置本地代理:  git config --local http.proxy http://127.0.0.1:7890"
  Warn "  3) 生成 SSH 密钥并添加到 GitHub（需能访问 github.com 网页）："
  Warn "       ssh-keygen -t ed25519 -C '你的邮箱'"
  Warn "       把 ~/.ssh/id_ed25519.pub 内容粘贴到 GitHub -> Settings -> SSH keys"
  Warn "       git remote set-url origin git@github.com:RukiStudio/Persona-arcana-concerto.git"
  Warn "  4) 换用 ghproxy 镜像直推:  git push https://ghproxy.net/https://github.com/RukiStudio/Persona-arcana-concerto.git HEAD:master"
  throw "推送失败"
}

Ok "推送完成 -> $remote/$target  (via $chosen)"
git log -1 --oneline

#!/bin/sh
# 提交前的私人信息闸门。
# 用法：./scripts/check-private-info.sh [workspace|staged]
#
# 两档：
#   硬拦截 —— .git/private-patterns.local 里的个人词（用户名、自有域名主干、
#             私有网段等），命中直接 exit 1。该文件不进版本库。
#   仅警告 —— 通用私网段（项目自带测试数据本来就用 192.168.1.x），不阻断。
set -u

MODE="${1:-workspace}"

GIT_DIR="$(git rev-parse --git-dir 2>/dev/null)"
LOCAL_PAT="$GIT_DIR/private-patterns.local"

if [ ! -f "$LOCAL_PAT" ]; then
  echo "⚠ 缺少 $LOCAL_PAT，跳过硬拦截（只做通用扫描）"
  BLOCK=""
else
  BLOCK=$(grep -v '^[[:space:]]*#' "$LOCAL_PAT" | grep -v '^[[:space:]]*$' | paste -sd'|' -)
fi

WARN='192\.168\.[0-9]{1,3}\.[0-9]{1,3}|10\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}|100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\.[0-9]{1,3}\.[0-9]{1,3}|[a-z0-9-]+\.ts\.net'

if [ "$MODE" = "staged" ]; then
  FILES=$(git diff --cached --name-only --diff-filter=ACM)
else
  FILES=$(git ls-files)
fi

BLOCK_HITS=""
WARN_COUNT=0

for f in $FILES; do
  case "$f" in
    *.png|*.jpg|*.jpeg|*.ico|*.woff|*.woff2|*.ttf|*.otf|*.zip|*.gz|*.tgz|*.AppImage|*.deb|*.exe|*.apk|*.so|*.node)
      continue ;;
    node_modules/*|.git/*|dist/*|dist-electron/*|frontend/dist/*|backend/dist/*)
      continue ;;
  esac
  [ -f "$f" ] || continue

  if [ -n "$BLOCK" ]; then
    OUT=$(grep -nE "$BLOCK" "$f" 2>/dev/null | head -3)
    if [ -n "$OUT" ]; then
      BLOCK_HITS="${BLOCK_HITS}
--- $f
$OUT"
    fi
  fi

  if grep -qE "$WARN" "$f" 2>/dev/null; then
    WARN_COUNT=$((WARN_COUNT + 1))
  fi
done

if [ -n "$BLOCK_HITS" ]; then
  echo "❌ 检测到你的私人信息，已阻止提交："
  echo "$BLOCK_HITS"
  echo
  echo "改写成占位符（如 https://your-server.example.ts.net:3001）后重试。"
  exit 1
fi

if [ "$WARN_COUNT" -gt 0 ]; then
  echo "ℹ $WARN_COUNT 个文件含通用私网地址（多为项目自带测试数据），未阻断。"
fi

echo "✓ 未发现私人信息"
exit 0

#!/bin/bash

# Maestro 本地重新安装脚本
# 用于在开发过程中清理并重新安装 maestro CLI

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 显示帮助信息
show_help() {
    echo "Maestro 本地重新安装脚本"
    echo ""
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  -h, --help        显示帮助信息"
    echo "  -c, --clean       仅清理（不重新安装）"
    echo "  -f, --full        完全重新安装（包括删除 node_modules）"
    echo "  -s, --skip-deps   跳过依赖安装（仅重新构建）"
    echo "  -l, --link        安装后执行 npm link"
    echo "  -g, --global      全局安装（npm install -g .）"
    echo ""
    echo "示例:"
    echo "  $0              # 标准重新安装（清理 dist，重新构建）"
    echo "  $0 -f           # 完全重新安装（包括 node_modules）"
    echo "  $0 -l           # 重新安装并链接到全局"
    echo "  $0 -s           # 仅重新构建"
}

# 清理函数
clean_dist() {
    log_info "清理 dist 目录..."
    if [ -d "$PROJECT_ROOT/dist" ]; then
        rm -rf "$PROJECT_ROOT/dist"
        log_success "dist 目录已清理"
    else
        log_info "dist 目录不存在，跳过"
    fi
}

clean_node_modules() {
    log_info "清理 node_modules 目录..."
    if [ -d "$PROJECT_ROOT/node_modules" ]; then
        rm -rf "$PROJECT_ROOT/node_modules"
        log_success "node_modules 目录已清理"
    else
        log_info "node_modules 目录不存在，跳过"
    fi
}

# 卸载全局链接
unlink_global() {
    log_info "尝试卸载全局链接..."
    cd "$PROJECT_ROOT"
    if npm unlink maestro-cli 2>/dev/null || npm unlink -g maestro-cli 2>/dev/null; then
        log_success "全局链接已卸载"
    else
        log_info "没有找到全局链接，跳过"
    fi
}

# 安装依赖
install_deps() {
    log_info "安装依赖..."
    cd "$PROJECT_ROOT"
    npm install
    log_success "依赖安装完成"
}

# 构建项目
build_project() {
    log_info "构建项目..."
    cd "$PROJECT_ROOT"
    npm run build
    log_success "项目构建完成"
}

# 链接到全局
link_global() {
    log_info "链接到全局..."
    cd "$PROJECT_ROOT"
    npm link
    log_success "已链接到全局，可以使用 'maestro' 命令"
}

# 全局安装
install_global() {
    log_info "全局安装..."
    cd "$PROJECT_ROOT"
    npm install -g .
    log_success "全局安装完成，可以使用 'maestro' 命令"
}

# 验证安装
verify_install() {
    log_info "验证安装..."
    if command -v maestro &> /dev/null; then
        local version=$(maestro --version 2>/dev/null || echo "未知")
        log_success "maestro 命令可用，版本: $version"
    else
        log_warning "maestro 命令不在 PATH 中"
        log_info "你可以通过以下方式运行: node $PROJECT_ROOT/dist/cli/index.js"
    fi
}

# 主函数
main() {
    local clean_only=false
    local full_clean=false
    local skip_deps=false
    local do_link=false
    local do_global=false

    # 解析参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -c|--clean)
                clean_only=true
                shift
                ;;
            -f|--full)
                full_clean=true
                shift
                ;;
            -s|--skip-deps)
                skip_deps=true
                shift
                ;;
            -l|--link)
                do_link=true
                shift
                ;;
            -g|--global)
                do_global=true
                shift
                ;;
            *)
                log_error "未知选项: $1"
                show_help
                exit 1
                ;;
        esac
    done

    echo ""
    echo "========================================"
    echo "  Maestro 本地重新安装"
    echo "========================================"
    echo ""

    # 步骤 1: 清理
    clean_dist

    if [ "$full_clean" = true ]; then
        unlink_global
        clean_node_modules
    fi

    # 如果仅清理，则退出
    if [ "$clean_only" = true ]; then
        log_success "清理完成"
        exit 0
    fi

    # 步骤 2: 安装依赖
    if [ "$skip_deps" = false ] && [ "$full_clean" = true ]; then
        install_deps
    elif [ "$skip_deps" = false ] && [ ! -d "$PROJECT_ROOT/node_modules" ]; then
        install_deps
    fi

    # 步骤 3: 构建
    build_project

    # 步骤 4: 链接或安装到全局
    if [ "$do_global" = true ]; then
        install_global
    elif [ "$do_link" = true ]; then
        link_global
    fi

    # 步骤 5: 验证
    verify_install

    echo ""
    log_success "重新安装完成！"
    echo ""
}

# 运行主函数
main "$@"

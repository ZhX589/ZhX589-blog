---
title: Arch NTQQ Fcitx5
published: 2026-07-10 11:14:28
updated: 2026-07-10 11:29:07
description: Arch Linux 上 NTQQ 在 Wayland 下使用 Fcitx5 输入法的一些建议
tags:
  - QQ
  - Linux
  - Arch
category: 笔记
draft: false
---
一开始在和一些大佬讨论了环境变量方案，发现环境变量可能会导致很多其他问题，因而转向 Wiki 上推荐的参数方案。腾讯QQ 是 Electron 程序，因而可以是用
```bash 
--enable-features=UseOzonePlatform --ozone-platform=wayland --enable-wayland-ime
```
参数启动（即强制`wayland`运行而非`xwayland`）。

实践下来成功。

由于我使用的是Arch Linux，并且我认为直接修改 `.desktop`文件而“不通知”我的软件包管理器很容易出问题，因而我尝试自己打包。首先先 clone [原 linuxqq AUR 包][1]，然后在 `linuxqq.sh` 里惊奇地发现这么一段代码：
```bash
if [[ -f "${XDG_CONFIG_HOME}/qq-flags.conf" ]]; then
	mapfile -t QQ_USER_FLAGS <<<"$(grep -v '^#' "${XDG_CONFIG_HOME}/qq-flags.conf")"
	echo "User flags:" ${QQ_USER_FLAGS[@]}
fi
```
也就是说这个`linuqq`软件包是支持自定义启动参数的，写入`${XDG_CONFIG_HOME}/qq-flags.conf`即可。一般情况下 `XDG_CONFIG_HOME` 环境变量都是用户目录下的 `.config` 目录。

因而在 `~/.config/qq-flags.conf 写入
```text
--enable-features=UseOzonePlatform
--ozone-platform=wayland
--enable-wayland-ime
```
即可。

[1]:aur.archlinux.org/packages/linuxqq
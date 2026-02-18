---
title: "尝试解决Edge和Firefox滚动条样式不统一"
published: 2025-08-16 14:46:00
description: 如题，尝试解决Edge和Firefox滚动条样式不统一
category: 建站
tags: [HTML, 网页, CSS]
---

# 尝试解决Edge和Firefox滚动条样式不统一

> 作者为蒟蒻高中牲，若有不妥之处请多多包含，并望于评论区指正，不胜感激！

之前在MDN学习CSS时，看到了一些关于滚动条样式的属性`scrollbar-width`，想着去观察一下我的网站的滚动条。发现是最初很细，鼠标悬停时变粗，既好看又方便。直到我一不小心在Edge上打开了我的网站，一看这个滚动条：
![2025-08-16T06:21:12.png](https://49.232.0.197/usr/uploads/2025/08/1544601003.png)
太不好看了！
于是便琢磨把Edge上的调整一下。
网上查到Chromium浏览器都不支持`scrollbar-width`，但是查到可以使用非标准的伪元素`::-webkit-scrollbar`来自定义滚动条，于是便尝试通过这种方式模拟类似的效果。

目的：

1. 默认情况下，将滚动条设置为较细。
2. 当鼠标悬停在滚动条上时，将滚动条变粗。

首先设置一下滚动条的大小。

```css
::-webkit-scrollbar {
  width: 8px; /* 默认细宽度 */
  height: 8px; /* 水平滚动条高度 */
}
```

接下来设置滑动条块的样式，`background`用灰色填充，`border-radius`设置圆角，用`border`创建一个一定大小的透明边框实现变细效果。在鼠标悬停时移除就实现了“变粗”。

```css
::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
  border: 2px solid transparent; /* 创建透明边框 */
  background-clip: padding-box; /* 确保背景不渗透到边框 */
}

::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
  border: 0; /* 悬停时移除透明边框实现"变粗"效果 */
}
```

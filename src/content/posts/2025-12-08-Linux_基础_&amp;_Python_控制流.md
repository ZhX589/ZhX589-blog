---
title: "Linux 基础 & Python 控制流"
published: 2025-12-08 11:24:00
descreptions: Linux基础与Python控制流的简明教程，AIGC辅助
category: 编程社
tags: [技术, Linux, 教程, AIGC辅助]
---

# Linux 基础使用 & Python 控制流

## Linux 基础使用

> 注意：
> 机房开启了保存电脑记录，所以请记住你的座位。

本节课开始我们初步开始使用Linux。Linux在全世界有广泛的使用，例如我们的安卓手机都基于Linux内核（Android/Linux），以及80%的线上服务都在Linux服务器上运行（GNU/Linux）。

本次我们使用NOI Linux 2.0（基于Ubuntu）进行学习活动。

1. 如何打开编辑器。
   点击左下角九个点的菜单标识可以打开应用菜单。选择VS Code，在插件栏下载中文及Python插件，重启VS Code即可开始编辑。

Linux 是当今计算领域中至关重要的操作系统。它不仅广泛应用于服务器领域（约80%的线上服务运行在基于GNU/Linux的服务器上），也是移动设备（Android基于Linux内核）、嵌入式系统、超级计算机等领域的核心技术基础。

本次课程我们将使用 NOI Linux 2.0（基于 Ubuntu 20.04 LTS）作为学习环境。这是一个专门为编程竞赛和学习设计的Linux发行版，预装了丰富的开发工具。

---

### 1. 开发环境配置指南

#### 1.1 编辑器安装与配置

点击屏幕左下角的应用程序菜单图标（九宫格图标）即可打开应用程序菜单。

联网后，在终端（使用Alt+Ctrl+T打开）中输入

```bash
sudo apt update && sudo apt install vlc firefox -y
```

如果有时间可以使用

```bash
sudo apt upgrade -y
```

进行全局更新。
在搜索框中输入 "VS Code" 或浏览找到 Visual Studio Code: 首次启动 VS Code 后，需要进行以下基础配置：

    -   **语言包安装**：点击左侧活动栏的扩展图标（四个方块形状），搜索 "Chinese"，安装 Microsoft 提供的中文语言包

    -   **Python 支持**：同样在扩展商店中搜索 "Python"，安装 Microsoft 官方的 Python 扩展

    -   **重启生效**：安装完成后需要重启 VS Code 使配置生效

接下来重启浏览器，就可以~~enjoy BiliBili~~写代码了。

**常用命令详解：**

```bash

# 1. 更新软件包索引
sudo apt update
# - sudo: 以管理员权限执行命令
# - apt: Ubuntu/Debian系统的包管理工具
# - update: 从软件源服务器获取最新的软件包列表信息

# 2. 安装常用软件
sudo apt install vlc firefox -y
# - install: 安装指定软件包
#   - vlc: 强大的多媒体播放器
#   - firefox: 网页浏览器
# - -y: 自动确认安装，无需手动输入"y"

# 3. 升级已安装的软件（可选，时间充足时执行）
sudo apt upgrade -y
# - upgrade: 将所有已安装的软件升级到最新版本
# - 注意：此过程可能需要较长时间和网络带宽
```

#### 1.3 基础命令扩展学习

除了上述命令，以下基础命令也值得掌握：

```bash

# 查看当前目录
pwd

# 列出目录内容
ls
ls -la  # 显示详细信息，包括隐藏文件

# 切换目录
cd Documents  # 进入Documents目录
cd ..         # 返回上一级目录
cd ~          # 返回用户主目录

# 创建目录和文件
mkdir python_projects  # 创建新目录
touch hello.py         # 创建空文件

# 查看文件内容
cat hello.py           # 显示整个文件内容
less hello.py          # 分页查看（按q退出）
```

## Python 控制流

我们之前写的程序，都是按顺序执行的。有些时候，我们需要重复执行一些相似的操作，或者在不同情况下执行不同的工作，这个时候就需要用到循环/分支结构控制程序流程了。

**请以
_写出一个输出`1`到`n`中的所有质数的程序。其中`n`由输入给出。_
为目标学习下方文档并上网查找资料。**

### 分支结构

例如我在天晴的时候会去骑自行车，下雨的时候我在家里看罗小黑，那么该写一个什么程序来猜测我的行程呢？

我们可以使用if语句

```python
status = input("今天是晴天吗？请输入Yes或No: ")

if status == "Yes":
	print("今天副社长石头要去骑车")
elif status == "No":
	print("今天副社长石头回去看罗小黑哦!喵~")
else:
	print("你输入的不是Yes或No吧？检查一下哦")
```

其中`else`意为否则，`elif`是`else if`的缩写。
在第一个`if`语句为否的情况下，就会执行下面的否则语句。`else`和`elif`的区别在于，`elif`还需要满足另一个条件。由此可知，`else`需放在最后，因为任何不满足第一条`if`语句的情况都满足`else`。

### 循环结构

有的时候我们需要重复进行某些事情，例如一年三百六十五天，我就要吃`1095`次饭。要是每一次都重新写一遍代码，那么将会无比麻烦。

于是就有了循环结构。循环结构有`while`和`for`两种。

---

#### while 循环

`while` 循环会在条件为真时重复执行一段代码。

```python
count = 0
while count < 5:
    print("这是第", count+1, "次循环")
    count += 1
```

#### for 循环

`for` 循环常用于遍历序列（如列表、元组、字符串）或范围。

```python
for i in range(5):
    print("这是第", i+1, "次循环")
```

---

## Python 学习任务：输出 1 到 n 中的所有质数

### 任务分析

质数（素数）是指大于1且只能被1和自身整除的自然数。我们需要：

1. 获取用户输入的整数 `n`
2. 从 2 到 n 依次判断每个数是否为质数
3. 输出所有质数

### 实现步骤

1. 使用 `input` 获取用户输入的 `n`，并转换为整数
2. 使用外层循环遍历从 2 到 n 的每个数
3. 对内层循环判断当前数是否为质数：
   - 质数判断：从 2 到该数的平方根，判断是否能整除
4. 如果是质数，则输出

### 示例代码

```python
n = int(input("请输入一个整数 n："))

print(f"1 到 {n} 中的所有质数为：")

for num in range(2, n + 1):
    is_prime = True
    for i in range(2, int(num ** 0.5) + 1):
        if num % i == 0:
            is_prime = False
            break
    if is_prime:
        print(num, end=" ")
```

---

### 代码解释

- `int(input(...))`：获取用户输入并转换为整数
- `range(2, n + 1)`：生成从 2 到 n 的整数序列
- `num ** 0.5`：计算 num 的平方根，用于优化质数判断
- `break`：一旦发现能被整除，立即跳出内层循环
- `end=" "`：使输出在同一行以空格分隔

---

### 优化建议

1. 可以只判断奇数（除了2以外）
2. 使用埃拉托斯特尼筛法（Sieve of Eratosthenes）能更高效地找出质数

---

### 扩展练习

1. 尝试使用 `while` 循环实现质数判断
2. 尝试使用函数封装质数判断逻辑
3. 尝试输出 n 以内的所有合数（非质数）

### AI 生成的详解

# Python 控制流详解

## 一、分支结构深入

### 1.1 条件表达式

Python 使用布尔值（True/False）作为判断条件：

```python
# 比较运算符
a = 10
b = 5
print(a > b)   # True
print(a == b)  # False
print(a != b)  # True
```

### 1.2 if 语句的完整结构

```python
# 完整的 if-elif-else 结构
score = int(input("请输入你的分数："))

if score >= 90:
    grade = "A"
    print("优秀！")
elif score >= 80:
    grade = "B"
    print("良好！")
elif score >= 70:
    grade = "C"
    print("中等！")
elif score >= 60:
    grade = "D"
    print("及格！")
else:
    grade = "F"
    print("不及格，需要努力！")

print(f"你的等级是：{grade}")
```

### 1.3 嵌套 if 语句

```python
age = int(input("请输入你的年龄："))
has_license = input("你有驾照吗？(yes/no): ").lower()

if age >= 18:
    if has_license == "yes":
        print("你可以开车上路！")
    else:
        print("你需要先考取驾照！")
else:
    print("你还未成年，不能开车！")
```

### 1.4 逻辑运算符

```python
# and（与）、or（或）、not（非）
age = 20
is_student = True
has_ticket = False

if age >= 18 and is_student:
    print("可以享受学生优惠！")

if has_ticket or age < 12:
    print("可以进入！")

if not has_ticket:
    print("需要购票！")
```

## 二、循环结构深入

### 2.1 while 循环详解

```python
# 基本 while 循环
count = 1
while count <= 5:
    print(f"这是第 {count} 次循环")
    count += 1  # 重要：不要忘记改变条件变量！

# 无限循环与 break
total = 0
while True:  # 无限循环
    num = input("请输入数字（输入'q'退出）：")
    if num == 'q':
        break  # 跳出循环
    total += int(num)
print(f"总和为：{total}")

# continue 的使用
num = 0
while num < 10:
    num += 1
    if num % 2 == 0:
        continue  # 跳过偶数
    print(num)
```

### 2.2 for 循环详解

```python
# 遍历列表
fruits = ["苹果", "香蕉", "橙子", "葡萄"]
for fruit in fruits:
    print(f"我喜欢吃{fruit}")

# 遍历字符串
message = "Hello Python"
for char in message:
    print(char)

# range() 函数详解
print("range(5):", list(range(5)))      # [0, 1, 2, 3, 4]
print("range(2, 7):", list(range(2, 7))) # [2, 3, 4, 5, 6]
print("range(1, 10, 2):", list(range(1, 10, 2))) # [1, 3, 5, 7, 9]

# 反向遍历
for i in range(10, 0, -1):
    print(i, end=" ")  # 10 9 8 7 6 5 4 3 2 1
```

### 2.3 循环的 else 子句

```python
# for-else：当循环正常完成（未被break中断）时执行else
for i in range(5):
    if i == 10:  # 这个条件永远不会满足
        break
    print(i)
else:
    print("循环正常完成！")

# while-else 类似
count = 0
while count < 5:
    print(count)
    count += 1
else:
    print("while循环正常结束")
```

### 2.4 嵌套循环

```python
# 打印乘法表
print("九九乘法表：")
for i in range(1, 10):
    for j in range(1, i + 1):
        print(f"{j}×{i}={i*j:2d}", end="  ")
    print()  # 换行
```

## 三、质数判断程序的优化与扩展

### 3.1 优化版本 - 使用函数封装

```python
def is_prime(num):
    """判断一个数是否为质数"""
    if num <= 1:
        return False
    if num == 2:
        return True
    if num % 2 == 0:
        return False

    # 只检查奇数因子
    for i in range(3, int(num ** 0.5) + 1, 2):
        if num % i == 0:
            return False
    return True

def find_primes(n):
    """找出1到n中的所有质数"""
    primes = []
    if n >= 2:
        primes.append(2)

    # 只检查奇数
    for num in range(3, n + 1, 2):
        if is_prime(num):
            primes.append(num)

    return primes

# 主程序
n = int(input("请输入一个整数 n："))
primes = find_primes(n)
print(f"1 到 {n} 中的所有质数：{primes}")
print(f"共有 {len(primes)} 个质数")
```

### 3.2 高级版本 - 埃拉托斯特尼筛法

```python
def sieve_of_eratosthenes(n):
    """使用筛法找出所有质数"""
    if n < 2:
        return []

    # 创建标记数组，初始假设所有数都是质数
    is_prime = [True] * (n + 1)
    is_prime[0] = is_prime[1] = False

    for i in range(2, int(n ** 0.5) + 1):
        if is_prime[i]:
            # 将i的倍数标记为非质数
            for j in range(i * i, n + 1, i):
                is_prime[j] = False

    # 收集所有质数
    primes = [i for i in range(2, n + 1) if is_prime[i]]
    return primes

# 测试筛法
n = int(input("请输入一个整数 n："))
primes = sieve_of_eratosthenes(n)
print(f"1 到 {n} 中的所有质数：")
for i, prime in enumerate(primes, 1):
    print(f"{prime:4d}", end=" ")
    if i % 10 == 0:  # 每行显示10个
        print()
```

### 3.3 扩展练习 - 质数分解

```python
def prime_factors(num):
    """分解质因数"""
    factors = []
    divisor = 2

    while divisor * divisor <= num:
        if num % divisor == 0:
            factors.append(divisor)
            num //= divisor
        else:
            divisor += 1 if divisor == 2 else 2  # 跳过偶数

    if num > 1:
        factors.append(num)

    return factors

# 测试质因数分解
number = int(input("请输入一个正整数："))
factors = prime_factors(number)
print(f"{number} = ", end="")
print(" × ".join(map(str, factors)))
```

## 四、综合练习

### 4.1 猜数字游戏

```python
import random

def guess_number():
    """猜数字游戏"""
    secret = random.randint(1, 100)
    attempts = 0
    max_attempts = 10

    print("猜数字游戏开始！我有一个1-100之间的秘密数字。")

    while attempts < max_attempts:
        try:
            guess = int(input(f"第{attempts+1}次尝试，请输入你的猜测："))
        except ValueError:
            print("请输入有效的数字！")
            continue

        attempts += 1

        if guess < secret:
            print("太小了！")
        elif guess > secret:
            print("太大了！")
        else:
            print(f"恭喜！你在{attempts}次内猜对了！")
            break

    if attempts >= max_attempts:
        print(f"游戏结束！正确答案是：{secret}")

# 运行游戏
guess_number()
```

### 4.2 计算器程序

```python
def calculator():
    """简单的计算器"""
    print("简单计算器")
    print("支持的操作：+ - * / % **")
    print("输入 'quit' 退出")

    while True:
        expression = input("\n请输入表达式：").strip()

        if expression.lower() == 'quit':
            print("再见！")
            break

        try:
            result = eval(expression)  # 注意：eval有安全风险，这里仅用于示例
            print(f"结果：{result}")
        except ZeroDivisionError:
            print("错误：不能除以零！")
        except:
            print("错误：无效的表达式！")

# 更安全的版本
def safe_calculator():
    """更安全的计算器版本"""
    while True:
        print("\n1. 加法")
        print("2. 减法")
        print("3. 乘法")
        print("4. 除法")
        print("5. 退出")

        choice = input("请选择操作：")

        if choice == '5':
            break

        if choice not in ['1', '2', '3', '4']:
            print("无效的选择！")
            continue

        try:
            num1 = float(input("请输入第一个数："))
            num2 = float(input("请输入第二个数："))

            if choice == '1':
                result = num1 + num2
                operator = "+"
            elif choice == '2':
                result = num1 - num2
                operator = "-"
            elif choice == '3':
                result = num1 * num2
                operator = "*"
            elif choice == '4':
                if num2 == 0:
                    print("错误：除数不能为零！")
                    continue
                result = num1 / num2
                operator = "/"

            print(f"{num1} {operator} {num2} = {result}")

        except ValueError:
            print("请输入有效的数字！")
```

## 五、学习建议

### 5.1 调试技巧

1. **使用 print 调试**：在关键位置打印变量值
2. **使用断点**：在 VS Code 中设置断点
3. **异常处理**：使用 try-except 捕获错误

### 5.2 编程习惯

1. **变量命名**：使用有意义的变量名
2. **注释**：为复杂逻辑添加注释
3. **函数封装**：将重复代码封装成函数
4. **测试**：为代码编写测试用例

### 5.3 进阶学习

1. **列表推导式**：简化循环创建列表
2. **生成器**：处理大数据时节省内存
3. **装饰器**：扩展函数功能
4. **面向对象编程**：类和对象的概念

---

## 六、实践任务

完成以下编程任务来巩固学习：

### 任务1：斐波那契数列

编写程序输出前 n 个斐波那契数列

### 任务2：闰年判断

输入年份，判断是否为闰年

### 任务3：最大公约数和最小公倍数

输入两个数，计算它们的最大公约数和最小公倍数

### 任务4：回文数判断

判断一个数是否为回文数

# 控制系统路线

## 进入条件

已掌握标签（mastered tags）：`tim.timebase`、`adc.sampling`、`tim.pwm`、`tim.capture`、`debug.observation`。能说明采样周期、执行器边界和测量噪声。

## 为什么适合继续学习

现有 ADC、定时器和 PWM 能组成最小闭环，让“读数—误差—控制量—执行器”变成可测系统。先建模和限幅，再调参数。

## 起步项目

做一个低风险 LED 亮度闭环：固定采样周期，记录 setpoint、measurement、error 和 output，先 P 控制，再加入积分 anti-windup；不直接从电机高功率项目开始。

## 尚未掌握

尚未掌握稳定性证明、离散化、频域、系统辨识、噪声滤波、饱和与多变量控制。一次参数“看起来能用”不能等同控制理论掌握。

## 权威资料

- [Arm CMSIS-DSP PID controller documentation](https://arm-software.github.io/CMSIS-DSP/latest/group__PID.html)
- 访问日期：2026-07-20

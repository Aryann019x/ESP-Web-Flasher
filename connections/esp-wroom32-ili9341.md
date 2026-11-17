# ESP-WROOM32 with ILI9341 Display Wiring Guide

This board pairs an ESP32-WROOM-32 with a 2.4" ILI9341 display and a 5-way button pad. It has no touchscreen.

## Flash the right image first

Use the **ESP-WROOM-32 + ILI9341 2.4" joystick** card. This build is for the button board with an ILI9341 panel.

If your board has a touchscreen, use the ESP-WROOM-32 + ST7789 card instead. The ST7789 build has a different panel driver and adds XPT2046 touch support; the ILI9341 build will not drive that touch controller.

The image is built for a 4MB module and uses the 4MB partition layout. Do not flash it on a 2MB or 8MB module with a different layout unless you erase first.

## Components

- **MCU**: ESP32-WROOM-32
- **Display**: ILI9341 2.4" SPI TFT LCD, 240x320
- **Input**: 5-way tactile button pad (up/down/left/right/select)
- **LED / IR**: onboard LED and IR emitter/receiver on GPIO2
- **Radio Options**: CC1101 or NRF24 on the shared SPI bus (separate CS lines)
- **Storage**: microSD on the shared SPI bus (optional)
- **I2C**: Grove/standard sensors on GPIO21/22
- **USB**: micro-USB or USB-C breakout through a USB-serial chip (CP210x or CH340 on most dev boards)

## Display Pinout (ILI9341)

| Display Pin | ESP32 Pin | Purpose |
|---|---|---|
| VCC | 3.3V | Power |
| GND | GND | Ground |
| CS | 17 | Chip Select |
| RESET | 5 | Reset (active-LOW) |
| DC | 16 | Data/Command |
| MOSI | 23 | Serial Data In |
| MISO | 19 | Serial Data Out |
| SCK | 18 | Clock |
| BL/LED | 32 | Backlight (PWM) |

## Button Pinout (5-Way Tactile)

| Button | ESP32 Pin | Function |
|---|---|---|
| Select/OK | 35 | Center button |
| Up | 34 | Navigation up |
| Down | 26 | Navigation down |
| Right | 27 | Navigation right |
| Left | 33 | Navigation left |

All buttons are **active-LOW** (GND when pressed). GPIO34 and GPIO35 are input-only pins with no internal pull-ups, so each of those two needs an external 10k resistor to 3.3V. GPIO26, GPIO27 and GPIO33 can use the firmware's internal pull-ups.

## Radio Modules (CC1101 / NRF24) - Shared SPI Bus

Both radios share MOSI/MISO/SCK with the display. Each module has its own chip select, so a CC1101 and an NRF24 can be connected at the same time.

### NRF24 (2.4GHz)
| NRF24 Pin | ESP32 Pin | Purpose |
|---|---|---|
| VCC | 3.3V | Power (add 10uF decoupling) |
| GND | GND | Ground |
| MOSI | 23 | Serial Data In (shared) |
| MISO | 19 | Serial Data Out (shared) |
| SCK | 18 | Clock (shared) |
| CS | 15 | Chip Select |
| CE | 4 | Chip Enable |

### CC1101 (sub-GHz)
| CC1101 Pin | ESP32 Pin | Purpose |
|---|---|---|
| VCC | 3.3V | Power |
| GND | GND | Ground |
| MOSI | 23 | Serial Data In (shared) |
| MISO | 19 | Serial Data Out (shared) |
| SCK | 18 | Clock (shared) |
| CS | 25 | Chip Select |
| GDO0 | 13 | Data Output / RX input |

**Note**: the firmware drives each CS separately. Do not tie either CS permanently low.

## SD Card (optional)

| SD Card Pin | ESP32 Pin | Purpose |
|---|---|---|
| VCC | 3.3V | Power |
| GND | GND | Ground |
| MOSI | 23 | Serial Data In (shared) |
| MISO | 19 | Serial Data Out (shared) |
| SCK | 18 | Clock (shared) |
| CS | 12 | Chip Select (SD only) |

## IR (Single-Pin)

| Function | ESP32 Pin | Purpose |
|---|---|---|
| IR TX | 2 | IR LED output |
| IR RX | 2 | IR receiver input (shared half-duplex pin) |

The IR receiver and emitter share GPIO2 on this board. This is intentional: the firmware only drives the LED while transmitting and releases the pin for receiving. GPIO2 is also the status LED.

## I2C Sensors (Grove/Standard)

| Sensor Pin | ESP32 Pin | Purpose |
|---|---|---|
| VCC | 3.3V | Power |
| GND | GND | Ground |
| SCL | 22 | I2C Clock |
| SDA | 21 | I2C Data |

## Status LED

| LED Pin | ESP32 Pin | Purpose |
|---|---|---|
| Anode | 2 | Active HIGH output |
| Cathode | GND | Ground |

GPIO2 is shared by the status LED, the IR emitter and the IR receiver. Do not add an external driver that holds the pin high.

## Serial Port

| Pin | ESP32 Pin | Type |
|---|---|---|
| RX | 3 | UART0 input (programming/debug) |
| TX | 1 | UART0 output (programming/debug) |

Most WROOM-32 dev boards expose this through a CP210x or CH340 USB-serial chip. If Windows does not show a COM port, install the driver for that chip and use a data-capable USB cable.

## Power Supply

- **ESP32-WROOM-32 module supply**: 3.0&ndash;3.6&nbsp;V, 3.3&nbsp;V typical. The module is not a 5&nbsp;V part.
- **Board input**: 5&nbsp;V USB or the 5&nbsp;V pin, regulated down to 3.3&nbsp;V on the board. The 3V3 pin takes a regulated 3.3&nbsp;V supply only.
- **Power options**: use one source only &mdash; USB, the 5&nbsp;V pin, or the 3V3 pin. Never feed 5&nbsp;V into 3V3.
- **Current budget for this build**: the ESP32-WROOM-32 datasheet specifies a 0.5&nbsp;A supply minimum. With the display and radio, budget for peaks around 800&nbsp;mA and use a 5&nbsp;V USB source rated for at least 1&nbsp;A.

Espressif references:

- [ESP32-DevKitC V4 user guide](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html)
- [ESP32-WROOM-32 datasheet](https://documentation.espressif.com/esp32-wroom-32_datasheet_en.pdf)

> **WiFi / AP brownout warning:** starting an access point, Evil Portal or a WiFi attack adds short current spikes. Weak USB ports, long or thin cables, and unpowered hubs can drop the 3.3V rail far enough to reset the board mid-boot. Use a 5&nbsp;V USB source rated for at least 1&nbsp;A, keep the USB cable short, and add a 470-1000 uF electrolytic capacitor plus a 100 nF ceramic capacitor across 3.3V/GND if it still resets. A 100 uF capacitor near the radio module also helps. This build caps WiFi TX power at 13 dBm, but the power path still has to be able to deliver the peak current.

## SPI Bus Architecture

```
ESP32 VSPI bus
├─ Display (CS=17) - ILI9341
├─ SD card (CS=12) - microSD
├─ NRF24 (CS=15, CE=4)
└─ CC1101 (CS=25, GDO0=13)

Shared lines: MOSI=23, MISO=19, SCK=18
```

Display, SD card and both radios share MOSI/MISO/SCK. Each device has its own chip select.

## Wiring Notes

1. **SPI Bus Sharing**: display, radio and SD card all share SCK/MOSI/MISO. Each device has its own CS line to prevent conflicts.
2. **Button pull-ups**: all five buttons pull to GND when pressed. GPIO34 (Up) and GPIO35 (Select) have no internal pull-ups, so fit a 10k resistor from each of those pins to 3.3V. The firmware enables internal pull-ups on GPIO26, GPIO27 and GPIO33.
3. **Backlight**: the BL pin (GPIO32) supports PWM for brightness control (0-255).
4. **Reset**: the display RESET (GPIO5) is active-LOW. It is normally held HIGH through a 10k resistor.
5. **Debouncing**: the firmware handles software debouncing for the buttons (typical bounce time around 20ms).
6. **GPIO2**: the onboard LED, IR emitter and IR receiver share this pin. It is not a spare GPIO.
7. **GPIO25 and GPIO13**: these are the CC1101 CS and GDO0 pins. If you use an NRF24 instead, GPIO15 and GPIO4 are its CS and CE pins.

## Features

- **ESP32 dual-core 240MHz** - enough headroom for the display, radio and WiFi stack
- **ILI9341 2.4" display** - 240x320, SPI, PWM backlight
- **5-way buttons** - no touchscreen, no calibration
- **IR and RF** - IR TX/RX and 433/868MHz RF on GPIO2
- **Radio options** - CC1101 and NRF24 can be connected together
- **4MB flash** - full Bruce build with a 3.75MB app partition

# ESP-WROOM32 with ST7789 Display & Touchscreen Wiring Guide

This board pairs an ESP32-WROOM-32 with a 2.8" ST7789 display and an XPT2046 resistive touch controller.

## Flash the right image first

Use the **ESP-WROOM-32 + ST7789 2.8"** card. This build is for the touch board with an ST7789 panel.

If your board has an ILI9341 panel and a 5-way button pad instead, use the ESP-WROOM-32 + ILI9341 card. The panel drivers and touch wiring are different, and the ILI9341 build has no touch support.

The image is built for a 4MB module and uses the 4MB partition layout. Do not flash it on a 2MB module.

## Components

- **MCU**: ESP32-WROOM-32
- **Display**: ST7789 2.8" SPI TFT LCD, 240x320, BGR colour order
- **Touchscreen**: XPT2046 resistive touch controller
- **SD Card**: microSD slot on the shared SPI bus
- **Input**: boot button on GPIO0 (active-LOW, used as OK)
- **LED / IR**: onboard LED and IR emitter/receiver on GPIO2
- **Radio Options**: CC1101 or NRF24 on the shared SPI bus (separate CS lines)
- **I2C**: Grove/standard sensors on GPIO21/22
- **USB**: micro-USB or USB-C breakout through a USB-serial chip (CP210x or CH340 on most dev boards)

## Display Pinout (ST7789)

| Display Pin | ESP32 Pin | Purpose |
|---|---|---|
| VCC | 3.3V | Power |
| GND | GND | Ground |
| CS | 17 | Chip Select |
| RESET | 5 | Reset (active-LOW) |
| DC | 16 | Data/Command |
| MOSI | 23 | Serial Data In |
| MISO | 19 | Serial Data Out (not used by the panel) |
| SCK | 18 | Clock |
| BL/LED | 32 | Backlight (PWM) |

## Touchscreen Pinout (XPT2046)

The touch controller shares MOSI/MISO/SCK with the display and has its own CS.

| Touch Pin | ESP32 Pin | Purpose |
|---|---|---|
| VCC | 3.3V | Power |
| GND | GND | Ground |
| MOSI | 23 | Serial Data In (shared) |
| MISO | 19 | Serial Data Out (shared) |
| SCK | 18 | Clock (shared) |
| CS | 21 | Chip Select (touch only) |
| IRQ | Not used | Interrupt is disabled (`-1`) |

**Important**: GPIO21 is both the touch CS and the default Grove SDA pin. Do not use an I2C sensor on GPIO21 while the touchscreen is enabled. Move SDA to another free pin in the firmware settings, or leave I2C disconnected.

## SD Card Slot Pinout

| SD Card Pin | ESP32 Pin | Purpose |
|---|---|---|
| VCC | 3.3V | Power |
| GND | GND | Ground |
| MOSI | 23 | Serial Data In (shared) |
| MISO | 19 | Serial Data Out (shared) |
| SCK | 18 | Clock (shared) |
| CS | 12 | Chip Select (SD only) |

## Radio Modules (CC1101 / NRF24) - Shared SPI Bus

Both radios share MOSI/MISO/SCK with the display, touch and SD card. Each module has its own chip select, so a CC1101 and an NRF24 can be connected at the same time.

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

**Note**: display, touchscreen, SD card and both radios share MOSI/MISO/SCK, but each device has its own CS line for isolation. Do not tie either radio CS permanently low.

## IR (Single-Pin)

| Function | ESP32 Pin | Purpose |
|---|---|---|
| IR TX | 2 | IR LED output |
| IR RX | 2 | IR receiver input (shared half-duplex pin) |

The IR receiver and emitter share GPIO2 on this board. This is intentional: the firmware only drives the LED while transmitting and releases the pin for receiving. GPIO2 is also the status LED.

## User Input

| Input | ESP32 Pin | Type |
|---|---|---|
| Boot Button | 0 | Tactile switch, active-LOW (used as OK) |

## I2C Sensors (Grove/Standard)

| Sensor Pin | ESP32 Pin | Purpose |
|---|---|---|
| VCC | 3.3V | Power |
| GND | GND | Ground |
| SCL | 22 | I2C Clock |
| SDA | 21 | I2C Data (shared with touch CS by default) |

See the touch section above before connecting an I2C sensor.

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
- **Current budget**: the ESP32-WROOM-32 datasheet specifies a 0.5&nbsp;A supply minimum. With the display, touch and radio, use a 5&nbsp;V USB source rated for at least 1&nbsp;A.

Espressif references:

- [ESP32-DevKitC V4 user guide](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html)
- [ESP32-WROOM-32 datasheet](https://documentation.espressif.com/esp32-wroom-32_datasheet_en.pdf)

> **WiFi / AP brownout warning:** starting an access point, Evil Portal or a WiFi attack adds short current spikes. Weak USB ports, long or thin cables, and unpowered hubs can drop the 3.3V rail far enough to reset the board mid-boot. Use a 5&nbsp;V USB source rated for at least 1&nbsp;A, keep the USB cable short, and add a 470-1000 uF electrolytic capacitor plus a 100 nF ceramic capacitor across 3.3V/GND if it still resets. A 100 uF capacitor near the radio module also helps.

## SPI Bus Architecture

```
ESP32 VSPI bus
├─ Display (CS=17) - ST7789
├─ Touchscreen (CS=21) - XPT2046
├─ SD card (CS=12) - microSD
├─ NRF24 (CS=15, CE=4)
└─ CC1101 (CS=25, GDO0=13)

Shared lines: MOSI=23, MISO=19, SCK=18
```

Display, touch, SD card and both radios share MOSI/MISO/SCK. Each device has its own chip select.

## Wiring Notes

1. **Multi-device SPI**: display, touch, SD card and both radios share the same MOSI/MISO/SCK lines. Each device gets its own CS line.
2. **Touch CS conflict**: GPIO21 is used for both touch CS and Grove SDA. If you need I2C, move SDA or leave the Grove connector unused.
3. **Backlight**: the BL pin (GPIO32) supports PWM for brightness control (0-255).
4. **Reset**: the display RESET (GPIO5) is active-LOW. It is normally held HIGH through a 10k resistor.
5. **SPI frequency**: 40MHz write, 20MHz read, 2.5MHz touch.
6. **Display rotation**: set to 90 degrees (landscape) by default.
7. **Colour order**: the ST7789 is configured for RGB to BGR conversion.
8. **GPIO2**: the onboard LED, IR emitter and IR receiver share this pin. It is not a spare GPIO.
9. **Radio pins**: CC1101 uses GPIO25 (CS) and GPIO13 (GDO0). NRF24 uses GPIO15 (CS) and GPIO4 (CE).

## Features

- **ESP32 dual-core 240MHz** - enough headroom for the display, touch, radio and WiFi stack
- **ST7789 2.8" display** - 240x320, SPI, PWM backlight
- **XPT2046 touchscreen** - resistive touch on the shared SPI bus
- **IR and RF** - IR TX/RX and 433/868MHz RF on GPIO2
- **Radio options** - CC1101 and NRF24 can be connected together
- **4MB flash** - full Bruce build with a 3.75MB app partition

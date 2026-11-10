# SOLEPOWER — Physical Prototype Assembly & Lab Testing Guide
## From Components to a Demonstrable Smart Footwear Prototype

---

**Project:** SOLEPOWER (Kinetic Footwear Energy Harvester)  
**Subject:** Mini Project (BCC 351) — B.Tech CSE 2nd Year  
**Authors:** Gargi Arora & Kartik | Dronacharya Group of Institutions (AKTU)

---

## 1. Safety & Component Precautions

1. **Piezoelectric Ceramic Fragility:** The white circular ceramic material on the brass discs is brittle. Do not bend or fold the discs. Always cushion them with foam/silicone.
2. **Supercapacitor Polarity:** A supercapacitor is polarized. Connecting it backwards will damage it permanently.
   * **Positive (+):** Longer lead.
   * **Negative (-):** Shorter lead, marked with a black/gold stripe with minus signs `- - -`.
3. **Schottky Diode Polarity (1N5819):**
   * The end with the **silver/white painted band** is the **Cathode (K)**.
   * The unmarked end is the **Anode (A)**.

---

## 2. Step 1: Assembling the Schottky Bridge Rectifier on a Breadboard

A full-wave bridge rectifier converts AC footstep pulses into unidirectional DC current with minimal voltage drop ($0.2\text{V} - 0.3\text{V}$).

### Schematic Wiring with 4x 1N5819 Diodes:

```
                  (+) DC Output (to Supercapacitor +)
                           ▲
                           │
                 ┌─────────┴─────────┐
                 │                   │
             [Cathode]           [Cathode]
             Diode D1            Diode D2
              [Anode]             [Anode]
                 │                   │
AC Input 1 ──────┼───────────────────┼────── (From Piezo Red Wire)
                 │                   │
             [Cathode]           [Cathode]
             Diode D3            Diode D4
              [Anode]             [Anode]
                 │                   │
                 └─────────┬─────────┘
                           │
                           ▼
                  (-) Ground (to Supercapacitor -)
```

### Exact Breadboard Column Connections:
* **D1:** Anode to Row 10 (AC 1) | Cathode to Row 15 (DC +)
* **D2:** Anode to Row 12 (AC 2) | Cathode to Row 15 (DC +)
* **D3:** Cathode to Row 10 (AC 1) | Anode to Row 20 (DC -)
* **D4:** Cathode to Row 12 (AC 2) | Anode to Row 20 (DC -)
* **Piezo Red Wire:** Connect to Row 10 (AC 1)
* **Piezo Black Wire:** Connect to Row 12 (AC 2)
* **Supercapacitor (+) Positive:** Connect to Row 15 (DC +)
* **Supercapacitor (-) Negative:** Connect to Row 20 (DC - / GND)

---

## 3. Step 2: Connecting the INA219 Sensor & ESP32

The **INA219** measures the harvested voltage and current flow into the circuit and sends it to the ESP32 via I2C:

| INA219 Pin | Connects To | Explanation |
| :--- | :--- | :--- |
| **VCC** | ESP32 `3V3` Pin | Power for sensor IC |
| **GND** | ESP32 `GND` Pin | Common ground |
| **SCL** | ESP32 `GPIO 22` | I2C Clock line |
| **SDA** | ESP32 `GPIO 21` | I2C Data line |
| **Vin+** | Supercapacitor (+) | Measures storage voltage |
| **Vin-** | Load (+) | Output to load/regulator |

---

## 4. Step 3: Shoe Insole Transducer Matrix Construction

The human foot exerts maximum mechanical force on two specific zones:
* **Heel (Calcaneus):** 60% of total kinetic impact force during heel-strike.
* **Forefoot / Ball (Metatarsals):** 40% of propulsion force during toe-off.

### Layout of 6 Piezoelectric Discs:
```
           ┌───────────────────────┐
           │        ( TOE )        │
           │                       │
           │     [P1]     [P2]     │ <--- Forefoot Zone (2 Discs)
           │                       │
           │        ( ARCH )       │ <--- Arch Zone (Wiring runs through here)
           │                       │
           │     [P3]     [P4]     │
           │                       │ <--- Heel Zone (4 Discs - Max Force)
           │     [P5]     [P6]     │
           │       ( HEEL )        │
           └───────────────────────┘
```

### Parallel Wiring Rule:
All 6 discs must be wired in **PARALLEL** (not series):
* All **Red wires** (center ceramic electrode) soldered together into one master `AC_Positive` wire.
* All **Black wires** (outer brass plate) soldered together into one master `AC_Negative` wire.
* *Why Parallel?* Parallel wiring sums the microscopic currents ($I_{\text{total}} = I_1 + I_2 + \dots + I_6$), boosting the charging current into the supercapacitor!

### Mechanical Layering (Sandwich Design):
To prevent ceramic cracking under body weight:
1. **Layer 1 (Bottom):** Shoe outer sole cavity or base insole.
2. **Layer 2 (Cushioning):** 2mm soft EVA foam or silicone sheet with circular cutouts for discs.
3. **Layer 3 (Transducers):** The 6 Piezo discs seated in the cutouts.
4. **Layer 4 (Distributor Plate):** Thin flexible plastic or card sheet (distributes foot pressure evenly across the discs rather than concentrating point stress).
5. **Layer 5 (Top):** Standard soft fabric shoe insole for walking comfort.

---

## 5. Step 4: Lab Multimeter Verification Protocol (For Evaluation)

Carry your digital multimeter into your project viva to demonstrate physical generation to the external examiner!

### Test 1: Open-Circuit Voltage ($V_{\text{oc}}$)
1. Turn multimeter dial to **DC Voltage ($20\text{V}$ range)**.
2. Connect red probe to Rectifier Output (+) and black probe to Rectifier Output (-).
3. Tap or step firmly on the insole.
4. **Expected Result:** Instantaneous voltage jump of **$3.5\text{V} - 6.0\text{V}$** per firm press!

### Test 2: Capacitor Charging Accumulation Test ($E = \frac{1}{2} C V^2$)
1. Connect multimeter across the **Supercapacitor leads**.
2. Note initial voltage (e.g. $0.50\text{V}$).
3. Press the insole repeatedly 30 to 50 times (simulating walking).
4. **Expected Result:** Voltage steadily creeps upward (e.g. from $0.50\text{V} \to 0.90\text{V} \to 1.45\text{V} \to 2.10\text{V}$).
5. *Show this to the professor to prove true capacitive energy storage!*

---

## 6. Step 5: Demonstrating "Useful Low-Power Output"

To demonstrate the full cycle:
$$\text{Walking} \longrightarrow \text{Harvesting} \longrightarrow \text{Storage} \longrightarrow \text{Usable Output}$$

Connect a **Low-Power High-Efficiency 3mm Green/Blue LED** in series with a $220\Omega$ resistor and a small push button across the supercapacitor buffer:
* While walking, energy charges the supercapacitor.
* Pressing the button discharges the supercapacitor to light up the LED brightly!
* This proves the system acts as a self-powered **Night-Time Pedestrian Safety Light** or emergency beacon!

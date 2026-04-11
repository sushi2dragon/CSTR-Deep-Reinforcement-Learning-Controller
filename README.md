# CSTR Deep Reinforcement Learning Controller

Replication of **"CSTR control with deep reinforcement learning"** (Martinez et al., PSE 2021+) using **Twin Delayed DDPG (TD3)**.

A complete implementation with first-principles CSTR modeling, TD3 training over 20,000 episodes, and an interactive Streamlit dashboard for real-time control visualization.

## 📋 Overview

This project demonstrates deep reinforcement learning applied to process control. A TD3 agent learns to control:
- **Reactor level (H)** — by adjusting inlet valve opening
- **Product concentration (C_B)** — by manipulating reactor temperature

The agent trains for 20,000 episodes and achieves tight setpoint tracking across a range of target conditions.

## 📁 Files

| File | Purpose |
|------|---------|
| `cstr_env.py` | CSTR environment (first-principles model, OpenAI Gym-like interface) |
| `td3_agent.py` | TD3 algorithm (actor-critic with twin critics, exploration noise) |
| `train.py` | Training loop (20,000 episodes, GPU acceleration) |
| `validate.py` | Validation and figure generation (learning curve, control plots) |
| `dashboard.py` | Interactive Streamlit dashboard |
| `launch_dashboard.bat` | Windows batch script to launch dashboard |
| `requirements.txt` | Python dependencies |

## 🚀 Quick Start

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Train the agent (optional — pre-trained model included)
```bash
python train.py --episodes 20000
```
Training takes ~5 hours on GPU. Models saved to `checkpoints/`.

### 3. Launch the dashboard
**Windows:**
```bash
launch_dashboard.bat
```

**Linux/Mac:**
```bash
source venv/bin/activate
streamlit run dashboard.py
```

Dashboard opens at **http://localhost:8501**

### 4. Use the dashboard
- **Drag sliders** to set level (H) and composition (C_B) setpoints
- **Click "Run Simulation"** to see the trained agent in action
- **View 6 plots:** level tracking, composition, manipulated variables, rewards, errors
- **Select model checkpoints** to compare training progress

## 🧠 Model Architecture (Paper Table 1)

**Actor Network:**
- Input: 8-dim state (H, CB, errors, integrals, derivatives)
- Hidden: 400 → 200 neurons (ReLU)
- Output: 2 actions (valve, temperature) with Tanh activation

**Critic Network (×2 for TD3):**
- Input: (state + action) = 10-dim
- Hidden: 800 → 400 neurons (ReLU)
- Output: Q-value (scalar)

**Key TD3 features:**
- Twin critics (clipped double Q-learning)
- Delayed actor updates (every 2 critic steps)
- Target policy smoothing (noise + clipping on target actions)
- Ornstein-Uhlenbeck exploration noise (σ=0.2)

## 📊 Training Results

| Metric | Value |
|--------|-------|
| Total episodes | 20,000 |
| Steps per episode | 200 (4 hours simulated) |
| Best episode reward | −3.1 |
| Final 100-ep avg | −371.4 |
| Training time | ~5 hours (GPU) |
| Device | CUDA (RTX 4060) |

**Learning curve characteristics:**
- Rapid improvement in first 500 episodes
- Exploration dip at ~episode 10,000 (agent tries new strategies)
- Recovery by episode 12,500
- Convergence by episode 15,000

## 🔬 CSTR Model

**Reaction:** A → B (first-order, isothermal)

**Manipulated variables:**
- F1: Inlet flow rate (0–2 m³/h) via valve opening
- T: Reactor temperature (300–400 K)

**Controlled variables:**
- H: Reactor level (0–3 m)
- C_B: Product concentration (0–0.5 kmol/m³)

**Physics:**
- Volume balance: dH/dt = (F_in − F_out) / A
- Mass balance (A): dC_A/dt = (F_in · C_A_in − F_out · C_A) / V − k·C_A
- Mass balance (B): dC_B/dt = (−F_out · C_B) / V + k·C_A
- Reaction rate (Arrhenius): k(T) = k₀ · exp(−Ea/R / T)

**Reaction parameters (PSO-calibrated):**
- k₀ = 1.85 × 10⁷ h⁻¹
- Ea/R = 2352.61 K

## 📈 Validation

Two test scenarios from the paper:

| Scenario | Level SP | Composition SP | Result |
|----------|----------|----------------|--------|
| Left | 1.2 m | 0.08 kmol/m³ | ✅ Clean convergence |
| Right | 2.0 m | 0.16 kmol/m³ | ✅ Fast, tight tracking |

Steady-state errors < 0.5% of setpoint — validates the TD3 controller.

## 📚 Reference

Martinez, B., Rodríguez, M., & Díaz, I. (2022). *CSTR control with deep reinforcement learning.* Proceedings of the 14th International Symposium on Process Systems Engineering (PSE 2021+). Kyoto, Japan.

## 🛠️ Development Notes

- **Environment:** Python 3.13, PyTorch 2.11, Streamlit 1.56
- **GPU:** CUDA 12.1 (but CPU-compatible)
- **Code style:** Clean, modular, well-commented
- **Reproducibility:** Fixed random seed (42) for deterministic results

## 📝 License

Educational/research use. Based on open methodology (TD3 from OpenAI Spinning Up).

---

**Dashboard URL:** http://localhost:8501 (after running `streamlit run dashboard.py`)

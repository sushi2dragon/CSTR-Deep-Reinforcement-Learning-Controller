"""
Validation and plotting for the extended CSTR TD3 controller.

Generates:
  - learning_curve.png        - Reward vs episode (smoothed)
  - scenario_{i}_{name}.png   - One plot per MV pairing (7 total)
      * Top:    Reactor temperature T tracking the stepped setpoint
      * Bottom: The two active manipulated variables over time
  - all_scenarios.png         - 7-panel summary grid (temperature tracking only)

Matches the professor's reference figure style:
  "Reactor Temperature Control using <MV1> & <MV2> as manipulated variables"
"""

import numpy as np
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
import os
import argparse

from cstr_env import CSTREnv, SCENARIOS, MV_LABELS
from td3_agent import TD3Agent


# ── Style ──────────────────────────────────────────────────────────────────────
plt.rcParams.update({
    'font.family': 'DejaVu Sans',
    'axes.facecolor': '#f5f6fa',
    'axes.grid': True,
    'grid.color': 'white',
    'grid.linewidth': 1.0,
    'axes.spines.top': False,
    'axes.spines.right': False,
})

# Professor-requested validation setpoint profile (°C), different from his example
VALIDATION_SP_PROFILE_C = [
    (0.0, 0.8, 32.0),
    (0.8, 1.6, 40.0),
    (1.6, 2.4, 45.0),
    (2.4, 3.2, 36.0),
    (3.2, 4.0, 42.0),
]

# Colour scheme for each MV (matches professor's example: green/orange for MVs)
MV_COLOURS = {
    "T_A_in": "#e67e22",   # orange
    "T_B_in": "#f1c40f",   # yellow
    "F_A":    "#27ae60",   # green
    "F_B":    "#16a085",   # teal
    "T_oil":  "#8e44ad",   # purple
}


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _build_sp_profile_K(env):
    """Build a piecewise-constant setpoint array (in Kelvin) of length max_steps+1."""
    n = env.max_steps + 1
    # Initialise to the LAST segment value so every index is always valid
    last_sp_K = VALIDATION_SP_PROFILE_C[-1][2] + 273.15
    profile = np.full(n, last_sp_K, dtype=np.float32)
    for (t_lo, t_hi, sp_C) in VALIDATION_SP_PROFILE_C:
        idx_lo = int(np.floor(t_lo / env.dt))
        idx_hi = int(np.ceil(t_hi / env.dt))
        idx_lo = max(0, min(n, idx_lo))
        idx_hi = max(0, min(n, idx_hi))
        profile[idx_lo:idx_hi] = sp_C + 273.15
    return profile


def _K_to_C(K):
    return np.asarray(K) - 273.15


# ──────────────────────────────────────────────────────────────────────────────
# Learning curve
# ──────────────────────────────────────────────────────────────────────────────

def plot_learning_curve(rewards_path, output_path='figures'):
    """Reward vs episode (raw faint + 200-episode moving average)."""
    rewards = np.load(rewards_path)
    n = len(rewards)
    episodes = np.arange(1, n + 1)

    # Clip raw rewards into a sensible display window for visualization
    Y_MIN, Y_MAX = -20000, 0
    rewards_disp = np.clip(rewards, Y_MIN, Y_MAX)

    window = min(200, max(1, n // 25))
    smoothed = np.convolve(rewards_disp, np.ones(window) / window, mode='valid')
    sm_eps = episodes[window - 1:]

    fig, ax = plt.subplots(figsize=(10, 6))
    fig.patch.set_facecolor('white')

    ax.plot(episodes, rewards_disp, alpha=0.12, color='#3949ab', linewidth=0.5)
    ax.plot(sm_eps, smoothed, color='#1a237e', linewidth=2.5, label=f'{window}-ep moving avg')

    tick_step = max(1, n // 8)
    ax.set_xticks(np.arange(0, n + 1, tick_step))

    ax.set_xlabel('Episode', fontsize=13)
    ax.set_ylabel('Reward', fontsize=13)
    ax.set_title('CSTR-TD3 Learning Curve — Reactor Temperature Tracking', fontsize=13)
    ax.set_xlim(0, n)
    ax.set_ylim(Y_MIN, Y_MAX)
    ax.legend(loc='lower right', fontsize=11)

    os.makedirs(output_path, exist_ok=True)
    out = os.path.join(output_path, 'learning_curve.png')
    fig.savefig(out, dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f"Saved: {out}")


# ──────────────────────────────────────────────────────────────────────────────
# Single-scenario validation
# ──────────────────────────────────────────────────────────────────────────────

def run_scenario(agent, env, scenario_id):
    """Run one scenario with the scripted stepped setpoint profile."""
    sp_profile = _build_sp_profile_K(env)
    state = env.reset(scenario_id=scenario_id,
                      sp_T_profile=sp_profile,
                      init_T=303.15)

    done = False
    total_reward = 0.0
    while not done:
        action = agent.select_action(state, explore=False)
        state, reward, done, _ = env.step(action)
        total_reward += reward

    return env.history, env.scenario, total_reward


def plot_scenario(hist, scenario, output_path='figures'):
    """
    Produce the 2-row figure for a scenario (matches professor's reference):
        Top:    Reactor Temperature + setpoint (blue line + red dashed)
        Bottom: the two ACTIVE manipulated variables over time
    """
    time_h = np.array(hist["time"])
    T_C    = _K_to_C(hist["T"])
    sp_C   = _K_to_C(hist["sp_T"])

    # Identify the two active MVs for this scenario
    mask = scenario["mask"]
    active_indices = [i for i, m in enumerate(mask) if m == 1]
    active_names   = [MV_LABELS[i] for i in active_indices]

    # Actions were recorded at every step -> length max_steps; prepend initial value
    # for plotting so both series share `time_h`
    step_time = np.array(hist["time"][1:])   # length max_steps
    mv_names = MV_LABELS
    mv_series = {
        "T_A_in": _K_to_C(np.array(hist["T_A_in"])),
        "T_B_in": _K_to_C(np.array(hist["T_B_in"])),
        "F_A":    np.array(hist["F_A"]),
        "F_B":    np.array(hist["F_B"]),
        "T_oil":  _K_to_C(np.array(hist["T_oil"])),
    }

    fig = plt.figure(figsize=(13, 8))
    fig.patch.set_facecolor('white')
    gs = gridspec.GridSpec(2, 1, figure=fig, height_ratios=[1.1, 1.0], hspace=0.30)

    # ── Top: Reactor Temperature + setpoint ──────────────────────────────────
    ax_t = fig.add_subplot(gs[0])
    ax_t.plot(time_h, T_C, color='#1f3bb3', linewidth=2.2, label='Reactor Temperature')
    ax_t.plot(time_h, sp_C, color='#d62728', linewidth=2.0,
              linestyle='--', label='Setpoint')

    # Annotate each step level
    for (t_lo, t_hi, sp_val) in VALIDATION_SP_PROFILE_C:
        x_mid = 0.5 * (t_lo + t_hi)
        ax_t.text(x_mid, sp_val + 0.6, f'{sp_val:.0f}°C',
                  ha='center', va='bottom', fontsize=9, color='#555555')

    ax_t.set_title(
        f"Reactor Temperature Control using "
        f"{active_names[0]} & {active_names[1]} as manipulated variables",
        fontsize=12, fontweight='bold')
    ax_t.set_ylabel("Temperature (°C)", fontsize=11)
    ax_t.set_xlim(0, time_h[-1])
    # Clamp y-axis to readable range regardless of any numerical outliers
    sp_lo = float(np.nanmin(sp_C)) - 5
    sp_hi = float(np.nanmax(sp_C)) + 5
    y_lo = max(sp_lo - 5, 15.0)   # never show below 15 °C
    y_hi = min(sp_hi + 10, 120.0) # never show above 120 °C
    ax_t.set_ylim(y_lo, y_hi)
    ax_t.legend(loc='upper right', fontsize=10)

    # ── Bottom: the two active MVs ────────────────────────────────────────────
    ax_m = fig.add_subplot(gs[1])
    for name in active_names:
        y = mv_series[name]
        col = MV_COLOURS[name]

        # Unit suffix for the legend
        if name.startswith("T_"):
            label = f"{name}  (°C)"
        else:
            label = f"{name}  (m³/h)"
        ax_m.plot(step_time, y, color=col, linewidth=1.6, label=label)

    ax_m.set_title("Manipulated Variables", fontsize=11, fontweight='bold')
    ax_m.set_xlabel("Time (h)", fontsize=11)
    ax_m.set_ylabel("Manipulated Variable", fontsize=11)
    ax_m.set_xlim(0, time_h[-1])
    ax_m.legend(loc='upper right', fontsize=10)

    # Save
    os.makedirs(output_path, exist_ok=True)
    safe_name = scenario["name"].replace(" ", "").replace("+", "_")
    out = os.path.join(output_path, f"scenario_{scenario['id']}_{safe_name}.png")
    fig.savefig(out, dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f"Saved: {out}")


def plot_all_scenarios_summary(histories, scenarios, output_path='figures'):
    """
    Compact 7-panel summary: reactor temperature tracking for every scenario.
    4 rows x 2 columns (last slot empty).
    """
    fig = plt.figure(figsize=(15, 16))
    fig.patch.set_facecolor('white')
    gs = gridspec.GridSpec(4, 2, figure=fig, hspace=0.55, wspace=0.18)

    for idx, (hist, sc) in enumerate(zip(histories, scenarios)):
        row = idx // 2
        col = idx % 2
        ax = fig.add_subplot(gs[row, col])

        time_h = np.array(hist["time"])
        T_C    = _K_to_C(hist["T"])
        sp_C   = _K_to_C(hist["sp_T"])

        ax.plot(time_h, T_C, color='#1f3bb3', linewidth=1.6, label='T')
        ax.plot(time_h, sp_C, color='#d62728', linewidth=1.5, linestyle='--', label='SP')

        ax.set_title(f"Scenario {sc['id']}: {sc['name']}", fontsize=11, fontweight='bold')
        ax.set_xlabel("Time (h)", fontsize=9)
        ax.set_ylabel("T (°C)", fontsize=9)
        ax.set_xlim(0, time_h[-1])
        y_lo = max(float(np.nanmin(sp_C)) - 7, 15.0)
        y_hi = min(float(np.nanmax(sp_C)) + 15, 120.0)
        ax.set_ylim(y_lo, y_hi)
        ax.legend(loc='upper right', fontsize=8)

    # Hide the empty 8th slot
    ax_empty = fig.add_subplot(gs[3, 1])
    ax_empty.axis('off')
    ax_empty.text(0.5, 0.5,
                  "7 MV-Pair Scenarios\nReactor Temperature Tracking",
                  ha='center', va='center', fontsize=14,
                  fontweight='bold', color='#333333',
                  transform=ax_empty.transAxes)

    out = os.path.join(output_path, "all_scenarios.png")
    fig.savefig(out, dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f"Saved: {out}")


# ──────────────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────────────

def main(model_path='checkpoints/best', output_path='figures'):
    env = CSTREnv(max_steps=200)
    agent = TD3Agent(state_dim=env.state_dim, action_dim=env.action_dim)
    agent.load(model_path)
    print(f"Loaded model from: {model_path}")

    # Learning curve (if rewards log exists)
    rewards_path = os.path.join(os.path.dirname(model_path), 'episode_rewards.npy')
    if os.path.exists(rewards_path):
        plot_learning_curve(rewards_path, output_path)
    else:
        print(f"Warning: {rewards_path} not found, skipping learning curve")

    # One plot per scenario + a summary grid
    histories, scenarios = [], []
    print("\nRunning 7 MV-pairing scenarios:")
    for sc in SCENARIOS:
        hist, scenario_rec, total_reward = run_scenario(agent, env, sc["id"])
        plot_scenario(hist, scenario_rec, output_path)
        histories.append(hist)
        scenarios.append(scenario_rec)
        print(f"  [scenario {sc['id']}] {sc['name']:<22s} -> reward = {total_reward:>10.1f}")

    plot_all_scenarios_summary(histories, scenarios, output_path)

    print(f"\nAll figures saved to: {output_path}/")


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', default='checkpoints/best')
    parser.add_argument('--output', default='figures')
    args = parser.parse_args()
    main(model_path=args.model, output_path=args.output)

"""
Validation and plotting script for trained TD3 CSTR controller.

Generates:
  - Fig 2: Learning curve (reward vs episode)  — matches paper Fig. 2
  - Fig 3: Validation plots (level, composition) — matches paper Fig. 3

Matches the figures from:
  "CSTR control with deep reinforcement learning" (Martinez et al., PSE 2021+)
"""

import numpy as np
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
import os
import argparse

from cstr_env import CSTREnv
from td3_agent import TD3Agent

# ── Style matching the paper ───────────────────────────────────────────────────
plt.rcParams.update({
    'font.family': 'DejaVu Sans',
    'axes.facecolor': '#eaeaf2',
    'axes.grid': True,
    'grid.color': 'white',
    'grid.linewidth': 1.0,
    'axes.spines.top': False,
    'axes.spines.right': False,
})


def plot_learning_curve(rewards_path, output_path='figures'):
    """
    Reproduce Fig. 2: Learning curve (reward vs episode).

    Fix vs previous version:
    - Y-axis clipped to meaningful range (matching paper scale)
    - Larger smoothing window (500 ep) for a smooth paper-like curve
    - Raw rewards shown only within clipped bounds (no extreme outlier distortion)
    """
    rewards = np.load(rewards_path)
    n = len(rewards)
    episodes = np.arange(1, n + 1)

    # Clip extreme outliers for display (keep within 5th percentile floor)
    y_floor = max(np.percentile(rewards, 3), -6000)
    rewards_clipped = np.clip(rewards, y_floor, 0)

    # Smoothed curve — 500-episode moving average (matches paper's smooth look)
    window = 500
    kernel = np.ones(window) / window
    smoothed = np.convolve(rewards_clipped, kernel, mode='valid')
    smoothed_eps = episodes[window - 1:]

    fig, ax = plt.subplots(figsize=(10, 6))
    fig.patch.set_facecolor('white')

    # Raw rewards (faint, clipped)
    ax.plot(episodes, rewards_clipped, alpha=0.12, color='#3949ab', linewidth=0.4)

    # Smoothed curve (bold, matching paper)
    ax.plot(smoothed_eps, smoothed, color='#1a237e', linewidth=2.2, label='Reward (smoothed)')

    ax.set_xlabel('Episode', fontsize=13)
    ax.set_ylabel('Reward', fontsize=13)
    ax.set_title('CSTR-TD3 : cstr_HCB_E_I_D', fontsize=13)
    ax.set_xlim(0, n)
    ax.set_ylim(y_floor * 1.05, 200)
    ax.legend(fontsize=11)

    os.makedirs(output_path, exist_ok=True)
    out = os.path.join(output_path, 'learning_curve.png')
    fig.savefig(out, dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f"Saved: {out}")


def run_validation(agent, env, sp_H, sp_CB, ic_H=None, ic_CA=None, ic_CB=None):
    """Run one validation episode with fixed setpoints and optional initial conditions."""
    state = env.reset(sp_H=sp_H, sp_CB=sp_CB)

    # Override initial conditions if provided
    if ic_H is not None:
        env.H = ic_H
        env.CA = ic_CA if ic_CA is not None else 0.5
        env.CB = ic_CB if ic_CB is not None else 0.02
        env.prev_error_H  = sp_H  - env.H
        env.prev_error_CB = sp_CB - env.CB
        state = env._get_state()

    done = False
    total_reward = 0.0
    while not done:
        action = agent.select_action(state, explore=False)
        state, reward, done, _ = env.step(action)
        total_reward += reward

    return env.history, total_reward


def plot_validation(histories, setpoints, output_path='figures'):
    """
    Reproduce Fig. 3: Validation of the TD3 algorithm.

    Fix vs previous version:
    - [A] plotted with secondary y-axis (right) so it's always visible regardless
      of whether it lives at a different scale to [B]
    - Level subplot clearly labelled and sized
    - Colours match the paper (blue=H or [A], red=[B], green dashed=setpoint)
    """
    fig = plt.figure(figsize=(16, 10))
    fig.patch.set_facecolor('white')
    gs_outer = gridspec.GridSpec(1, 2, figure=fig, wspace=0.35)

    for col, (hist, (sp_H, sp_CB)) in enumerate(zip(histories, setpoints)):
        time_h = np.array(hist['time'])
        H  = np.array(hist['H'])
        CA = np.array(hist['CA'])
        CB = np.array(hist['CB'])

        gs_inner = gridspec.GridSpecFromSubplotSpec(2, 1, subplot_spec=gs_outer[col],
                                                    hspace=0.38)

        # ── Level ──────────────────────────────────────────────────────────────
        ax_h = fig.add_subplot(gs_inner[0])
        ax_h.plot(time_h, H, color='#1565c0', linewidth=2.0, label='H')
        ax_h.axhline(sp_H, color='#c62828', linestyle='--', linewidth=1.5,
                     label=f'sp={sp_H}')
        ax_h.set_title(f'CSTR-TD3 test: cstr_HCB_E_I_D\nLevel (m)', fontsize=11)
        ax_h.set_ylabel('Level (m)', fontsize=11)
        ax_h.set_ylim(0, max(H.max() * 1.15, sp_H * 1.3, 0.5))
        ax_h.set_xlim(0, time_h[-1])
        ax_h.legend(fontsize=9, loc='lower right')

        # ── Composition ────────────────────────────────────────────────────────
        ax_c = fig.add_subplot(gs_inner[1])

        # [B] on primary axis (left)
        lB, = ax_c.plot(time_h, CB, color='#c62828', linewidth=2.0, label='[B] product')
        ax_c.axhline(sp_CB, color='#2e7d32', linestyle='--', linewidth=1.5,
                     label=f'sp={sp_CB}')
        ax_c.set_ylabel('[B] Composition (kmol/m³)', fontsize=10, color='#c62828')
        ax_c.tick_params(axis='y', labelcolor='#c62828')

        cb_max = max(CB.max() * 1.3, sp_CB * 1.6, 0.08)
        ax_c.set_ylim(0, cb_max)
        ax_c.set_xlim(0, time_h[-1])
        ax_c.set_xlabel('Time (h)', fontsize=11)
        ax_c.set_title('Composition (kmol/m³)', fontsize=11)

        # [A] on secondary axis (right) — always visible regardless of scale
        ax_c2 = ax_c.twinx()
        lA, = ax_c2.plot(time_h, CA, color='#1565c0', linewidth=2.0,
                         linestyle='-', label='[A] reactant')
        ax_c2.set_ylabel('[A] Reactant (kmol/m³)', fontsize=10, color='#1565c0')
        ax_c2.tick_params(axis='y', labelcolor='#1565c0')
        ca_max = max(CA.max() * 1.3, 0.05)
        ax_c2.set_ylim(0, ca_max)

        # Combined legend
        lines = [lB, ax_c.get_lines()[1], lA]
        labels = [l.get_label() for l in lines]
        ax_c.legend(lines, labels, fontsize=9, loc='upper right')

    os.makedirs(output_path, exist_ok=True)
    out = os.path.join(output_path, 'validation.png')
    fig.savefig(out, dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f"Saved: {out}")


def plot_manipulated_variables(histories, setpoints, output_path='figures'):
    """Plot control actions (inlet flow F1 and reactor temperature T)."""
    fig, axes = plt.subplots(2, 2, figsize=(16, 9))
    fig.patch.set_facecolor('white')
    fig.suptitle('Manipulated Variables — TD3 Control Actions', fontsize=13)

    for col, (hist, (sp_H, sp_CB)) in enumerate(zip(histories, setpoints)):
        time_h = np.array(hist['time'][1:])
        F1 = np.array(hist['F1'])
        T  = np.array(hist['T'])

        ax_f = axes[0, col]
        ax_f.plot(time_h, F1, color='#6a1b9a', linewidth=1.5, label='F1')
        ax_f.set_ylabel('Inlet Flow F1 (m³/h)', fontsize=11)
        ax_f.set_title(f'sp_H={sp_H} m  |  sp_CB={sp_CB} kmol/m³', fontsize=11)
        ax_f.set_ylim(0, 2.2)
        ax_f.set_xlim(0, time_h[-1])
        ax_f.legend(fontsize=9)

        ax_t = axes[1, col]
        ax_t.plot(time_h, T, color='#e65100', linewidth=1.5, label='T')
        ax_t.set_xlabel('Time (h)', fontsize=11)
        ax_t.set_ylabel('Temperature (K)', fontsize=11)
        ax_t.set_ylim(295, 405)
        ax_t.set_xlim(0, time_h[-1])
        ax_t.legend(fontsize=9)

    plt.tight_layout()
    out = os.path.join(output_path, 'manipulated_variables.png')
    fig.savefig(out, dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f"Saved: {out}")


def main(model_path='checkpoints/best', output_path='figures'):
    """Load trained model, run validation, and generate all plots."""
    env   = CSTREnv(max_steps=200)
    agent = TD3Agent(state_dim=env.state_dim, action_dim=env.action_dim)
    agent.load(model_path)
    print(f"Loaded model from: {model_path}")

    # ── Learning curve ─────────────────────────────────────────────────────────
    rewards_path = os.path.join(os.path.dirname(model_path), 'episode_rewards.npy')
    if os.path.exists(rewards_path):
        plot_learning_curve(rewards_path, output_path)
    else:
        print(f"Warning: {rewards_path} not found, skipping learning curve")

    # ── Validation runs ────────────────────────────────────────────────────────
    # Start from a low initial level so the rise-to-setpoint is clearly visible
    test_scenarios = [
        {'sp_H': 1.2, 'sp_CB': 0.08,  'ic_H': 0.3, 'ic_CA': 0.4, 'ic_CB': 0.02},
        {'sp_H': 2.0, 'sp_CB': 0.16,  'ic_H': 0.3, 'ic_CA': 0.4, 'ic_CB': 0.02},
    ]

    histories  = []
    setpoints  = []
    for sc in test_scenarios:
        hist, total_reward = run_validation(
            agent, env, sc['sp_H'], sc['sp_CB'],
            ic_H=sc['ic_H'], ic_CA=sc['ic_CA'], ic_CB=sc['ic_CB']
        )
        histories.append(hist)
        setpoints.append((sc['sp_H'], sc['sp_CB']))
        print(f"  sp_H={sc['sp_H']}, sp_CB={sc['sp_CB']}  ->  total reward = {total_reward:.1f}")

    plot_validation(histories, setpoints, output_path)
    plot_manipulated_variables(histories, setpoints, output_path)
    print(f"\nAll figures saved to: {output_path}/")


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--model',  default='checkpoints/best')
    parser.add_argument('--output', default='figures')
    args = parser.parse_args()
    main(model_path=args.model, output_path=args.output)

"""
Validation and plotting script for trained TD3 CSTR controller.

Generates:
  - Fig 2: Learning curve (reward vs episode)
  - Fig 3: Validation plots (level, composition, reactant vs time)

Matches the figures from:
  "CSTR control with deep reinforcement learning" (Martinez et al., PSE 2021+)
"""

import numpy as np
import matplotlib.pyplot as plt
import os
import argparse

from cstr_env import CSTREnv
from td3_agent import TD3Agent


def plot_learning_curve(rewards_path, output_path='figures'):
    """
    Reproduce Fig. 2: Learning curve (reward vs episode).
    Applies smoothing to show the trend as in the paper.
    """
    rewards = np.load(rewards_path)
    episodes = np.arange(1, len(rewards) + 1)

    # Smoothed curve (moving average)
    window = 200
    smoothed = np.convolve(rewards, np.ones(window) / window, mode='valid')
    smoothed_eps = episodes[window - 1:]

    fig, ax = plt.subplots(figsize=(10, 6))
    ax.plot(episodes, rewards, alpha=0.15, color='blue', linewidth=0.5)
    ax.plot(smoothed_eps, smoothed, color='blue', linewidth=2, label='Smoothed reward')
    ax.set_xlabel('Episode', fontsize=14)
    ax.set_ylabel('Reward', fontsize=14)
    ax.set_title('CSTR-TD3 : cstr_HCB_E_I_D', fontsize=14)
    ax.legend(fontsize=12)
    ax.grid(True, alpha=0.3)

    os.makedirs(output_path, exist_ok=True)
    fig.savefig(os.path.join(output_path, 'learning_curve.png'), dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f"Saved: {output_path}/learning_curve.png")


def run_validation(agent, env, sp_H, sp_CB):
    """Run a single validation episode with fixed setpoints."""
    state = env.reset(sp_H=sp_H, sp_CB=sp_CB)
    done = False
    total_reward = 0.0

    while not done:
        action = agent.select_action(state, explore=False)
        state, reward, done, info = env.step(action)
        total_reward += reward

    return env.history, total_reward


def plot_validation(histories, setpoints, output_path='figures'):
    """
    Reproduce Fig. 3: Validation of the TD3 algorithm.
    Two side-by-side panels, each with level and composition subplots.
    """
    fig, axes = plt.subplots(2, 2, figsize=(16, 10))

    for col, (hist, (sp_H, sp_CB)) in enumerate(zip(histories, setpoints)):
        time_h = np.array(hist['time'])
        H = np.array(hist['H'])
        CA = np.array(hist['CA'])
        CB = np.array(hist['CB'])

        # --- Level plot ---
        ax_level = axes[0, col]
        ax_level.plot(time_h, H, 'b-', linewidth=2, label='H')
        ax_level.axhline(y=sp_H, color='r', linestyle='--', linewidth=1.5, label=f'sp={sp_H}')
        ax_level.set_ylabel('Level (m)', fontsize=12)
        ax_level.set_title(f'CSTR-TD3 test: cstr_HCB_E_I_D\nLevel (m)', fontsize=12)
        ax_level.legend(fontsize=10)
        ax_level.set_ylim(0, 2.5)
        ax_level.grid(True, alpha=0.3)

        # --- Composition plot ---
        ax_comp = axes[1, col]
        ax_comp.plot(time_h, CA, 'b-', linewidth=2, label='[A]')
        ax_comp.plot(time_h, CB, 'r-', linewidth=2, label='[B]')
        ax_comp.axhline(y=sp_CB, color='g', linestyle='--', linewidth=1.5, label=f'sp={sp_CB}')
        ax_comp.set_xlabel('Time (h)', fontsize=12)
        ax_comp.set_ylabel('Composition (kmol/m³)', fontsize=12)
        ax_comp.set_title('Composition (kmol/m³)', fontsize=12)
        ax_comp.legend(fontsize=10)
        ax_comp.set_ylim(0, 0.5)
        ax_comp.grid(True, alpha=0.3)

    plt.tight_layout()
    os.makedirs(output_path, exist_ok=True)
    fig.savefig(os.path.join(output_path, 'validation.png'), dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f"Saved: {output_path}/validation.png")


def plot_manipulated_variables(histories, setpoints, output_path='figures'):
    """Plot the control actions (inlet flow and temperature) over time."""
    fig, axes = plt.subplots(2, 2, figsize=(16, 10))

    for col, (hist, (sp_H, sp_CB)) in enumerate(zip(histories, setpoints)):
        time_h = np.array(hist['time'][1:])  # actions start from step 1
        F1 = np.array(hist['F1'])
        T = np.array(hist['T'])

        ax_f = axes[0, col]
        ax_f.plot(time_h, F1, 'b-', linewidth=1.5)
        ax_f.set_ylabel('Inlet Flow F1 (m³/h)', fontsize=12)
        ax_f.set_title(f'Manipulated Variables (sp_H={sp_H}, sp_CB={sp_CB})', fontsize=12)
        ax_f.grid(True, alpha=0.3)

        ax_t = axes[1, col]
        ax_t.plot(time_h, T, 'r-', linewidth=1.5)
        ax_t.set_xlabel('Time (h)', fontsize=12)
        ax_t.set_ylabel('Temperature (K)', fontsize=12)
        ax_t.grid(True, alpha=0.3)

    plt.tight_layout()
    os.makedirs(output_path, exist_ok=True)
    fig.savefig(os.path.join(output_path, 'manipulated_variables.png'), dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f"Saved: {output_path}/manipulated_variables.png")


def main(model_path='checkpoints/best', output_path='figures'):
    """Load trained model, run validation, and generate all plots."""

    env = CSTREnv(max_steps=200)
    agent = TD3Agent(state_dim=env.state_dim, action_dim=env.action_dim)
    agent.load(model_path)
    print(f"Loaded model from: {model_path}")

    # --- Learning curve (Fig. 2) ---
    rewards_path = os.path.join(os.path.dirname(model_path), 'episode_rewards.npy')
    if os.path.exists(rewards_path):
        plot_learning_curve(rewards_path, output_path)
    else:
        print(f"Warning: {rewards_path} not found, skipping learning curve plot")

    # --- Validation (Fig. 3) ---
    # Two test scenarios matching the paper's Fig. 3
    test_setpoints = [
        (1.2, 0.08),   # Left panel: sp_H=1.2, sp_CB=0.08
        (2.0, 0.16),   # Right panel: sp_H=2.0, sp_CB=0.16
    ]

    histories = []
    for sp_H, sp_CB in test_setpoints:
        hist, total_reward = run_validation(agent, env, sp_H, sp_CB)
        histories.append(hist)
        print(f"Validation sp_H={sp_H}, sp_CB={sp_CB}: total reward = {total_reward:.1f}")

    plot_validation(histories, test_setpoints, output_path)
    plot_manipulated_variables(histories, test_setpoints, output_path)

    print(f"\nAll figures saved to: {output_path}/")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Validate TD3 CSTR controller')
    parser.add_argument('--model', type=str, default='checkpoints/best', help='Model path')
    parser.add_argument('--output', type=str, default='figures', help='Output directory')
    args = parser.parse_args()

    main(model_path=args.model, output_path=args.output)

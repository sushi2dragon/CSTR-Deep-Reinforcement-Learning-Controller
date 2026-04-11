"""
Interactive Dashboard for TD3 CSTR Controller.
Run with: streamlit run dashboard.py
"""

import streamlit as st
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
import os
import sys

# ── Page config ────────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="CSTR TD3 Controller Dashboard",
    page_icon="⚗️",
    layout="wide",
)

st.title("⚗️ CSTR Deep Reinforcement Learning Controller")
st.caption("TD3 Agent — Martinez et al., PSE 2021+ | Replication")

# ── Lazy imports (avoid re-importing torch on every widget interaction) ────────
@st.cache_resource
def load_agent(model_path):
    from cstr_env import CSTREnv
    from td3_agent import TD3Agent
    env = CSTREnv(max_steps=200)
    agent = TD3Agent(state_dim=env.state_dim, action_dim=env.action_dim)
    agent.load(model_path)
    return agent, env

# ── Sidebar controls ───────────────────────────────────────────────────────────
with st.sidebar:
    st.header("⚙️ Simulation Settings")

    model_choice = st.selectbox(
        "Model checkpoint",
        options=["checkpoints/best", "checkpoints/final"]
        + sorted([
            f"checkpoints/{d}" for d in os.listdir("checkpoints")
            if d.startswith("ep_")
        ] if os.path.exists("checkpoints") else []),
    )

    st.divider()
    st.subheader("Setpoints")

    col1, col2 = st.columns(2)
    with col1:
        sp_H = st.slider("Level H (m)", min_value=0.5, max_value=2.5,
                         value=1.2, step=0.05, format="%.2f")
    with col2:
        sp_CB = st.slider("Composition C_B (kmol/m³)", min_value=0.05,
                          max_value=0.25, value=0.08, step=0.005, format="%.3f")

    st.divider()
    st.subheader("Initial Conditions")
    use_random_ic = st.checkbox("Random initial conditions", value=False)
    if not use_random_ic:
        col3, col4 = st.columns(2)
        with col3:
            ic_H = st.slider("Initial H (m)", 0.3, 2.8, 1.0, 0.05)
            ic_CA = st.slider("Initial C_A (kmol/m³)", 0.1, 0.9, 0.5, 0.05)
        with col4:
            ic_CB = st.slider("Initial C_B (kmol/m³)", 0.01, 0.3, 0.05, 0.01)

    st.divider()
    run_btn = st.button("▶  Run Simulation", type="primary", use_container_width=True)  # noqa

    st.divider()
    st.subheader("Learning Curve")
    show_lc = st.checkbox("Show learning curve", value=True)

# ── Simulation logic ───────────────────────────────────────────────────────────
def run_simulation(agent, env_template, sp_H, sp_CB, ic=None):
    from cstr_env import CSTREnv
    env = CSTREnv(max_steps=200)

    # Manual reset to set custom initial conditions
    env.sp_H = sp_H
    env.sp_CB = sp_CB
    if ic:
        env.H, env.CA, env.CB = ic
    else:
        env.H = np.random.uniform(0.8, 1.5)
        env.CA = np.random.uniform(0.3, 0.7)
        env.CB = np.random.uniform(0.05, 0.15)

    env.integral_error_H = 0.0
    env.integral_error_CB = 0.0
    env.prev_error_H = sp_H - env.H
    env.prev_error_CB = sp_CB - env.CB
    env.step_count = 0
    env.history = {
        'time': [0.0], 'H': [env.H], 'CA': [env.CA], 'CB': [env.CB],
        'F1': [], 'T': [], 'sp_H': [sp_H], 'sp_CB': [sp_CB], 'reward': []
    }

    state = env._get_state()
    total_reward = 0.0
    done = False
    while not done:
        action = agent.select_action(state, explore=False)
        state, reward, done, _ = env.step(action)
        total_reward += reward

    return env.history, total_reward


def make_plots(hist, sp_H, sp_CB):
    time = np.array(hist['time'])
    H    = np.array(hist['H'])
    CA   = np.array(hist['CA'])
    CB   = np.array(hist['CB'])
    F1   = np.array(hist['F1'])
    T    = np.array(hist['T'])
    t_act = time[1:]  # actions start at step 1

    fig = plt.figure(figsize=(14, 9))
    fig.patch.set_facecolor('#0e1117')
    gs = gridspec.GridSpec(2, 3, figure=fig, hspace=0.45, wspace=0.35)

    SPINE_COLOR = '#444'
    GRID_COLOR  = '#2a2a2a'
    TEXT_COLOR  = '#dddddd'

    def style_ax(ax, title, ylabel, xlabel="Time (h)"):
        ax.set_facecolor('#1a1a2e')
        ax.set_title(title, color=TEXT_COLOR, fontsize=11, pad=8)
        ax.set_ylabel(ylabel, color=TEXT_COLOR, fontsize=9)
        ax.set_xlabel(xlabel, color=TEXT_COLOR, fontsize=9)
        ax.tick_params(colors=TEXT_COLOR, labelsize=8)
        for spine in ax.spines.values():
            spine.set_color(SPINE_COLOR)
        ax.grid(True, color=GRID_COLOR, linewidth=0.7)
        ax.legend(fontsize=8, facecolor='#1a1a2e', labelcolor=TEXT_COLOR,
                  edgecolor=SPINE_COLOR)

    # ── Level ──────────────────────────────────────────────────────────────────
    ax1 = fig.add_subplot(gs[0, 0])
    ax1.plot(time, H, color='#4fc3f7', lw=2, label='H (actual)')
    ax1.axhline(sp_H, color='#ff7043', ls='--', lw=1.5, label=f'Setpoint {sp_H:.2f} m')
    ax1.set_ylim(0, 2.8)
    style_ax(ax1, "Reactor Level", "Level (m)")

    # ── Composition ────────────────────────────────────────────────────────────
    ax2 = fig.add_subplot(gs[1, 0])
    ax2.plot(time, CA, color='#4fc3f7', lw=2, label='[A] reactant')
    ax2.plot(time, CB, color='#ef5350', lw=2, label='[B] product')
    ax2.axhline(sp_CB, color='#66bb6a', ls='--', lw=1.5, label=f'SP_B {sp_CB:.3f}')
    ax2.set_ylim(0, max(CA.max() * 1.15, sp_CB * 1.5, 0.1))
    style_ax(ax2, "Chemical Compositions", "Concentration (kmol/m³)")

    # ── Inlet flow F1 ──────────────────────────────────────────────────────────
    ax3 = fig.add_subplot(gs[0, 1])
    ax3.plot(t_act, F1, color='#ab47bc', lw=1.5, label='F1')
    ax3.set_ylim(0, 2.2)
    style_ax(ax3, "Inlet Flow (Manipulated)", "F1 (m³/h)")
    ax3.legend(fontsize=8, facecolor='#1a1a2e', labelcolor=TEXT_COLOR, edgecolor=SPINE_COLOR)

    # ── Temperature ────────────────────────────────────────────────────────────
    ax4 = fig.add_subplot(gs[1, 1])
    ax4.plot(t_act, T, color='#ffa726', lw=1.5, label='T')
    ax4.set_ylim(295, 405)
    style_ax(ax4, "Reactor Temperature (Manipulated)", "T (K)")
    ax4.legend(fontsize=8, facecolor='#1a1a2e', labelcolor=TEXT_COLOR, edgecolor=SPINE_COLOR)

    # ── Reward over time ───────────────────────────────────────────────────────
    ax5 = fig.add_subplot(gs[0, 2])
    rewards = np.array(hist['reward'])
    ax5.plot(t_act, rewards, color='#26c6da', lw=1, alpha=0.6)
    smoothed = np.convolve(rewards, np.ones(10)/10, mode='valid')
    ax5.plot(t_act[9:], smoothed, color='#26c6da', lw=2, label='Reward (smoothed)')
    ax5.axhline(0, color='#555', ls=':', lw=1)
    style_ax(ax5, "Step Reward", "Reward")

    # ── Error over time ────────────────────────────────────────────────────────
    ax6 = fig.add_subplot(gs[1, 2])
    err_H  = np.abs(np.array(hist['sp_H']) - np.array(hist['H']))
    err_CB = np.abs(np.array(hist['sp_CB']) - np.array(hist['CB']))
    ax6.plot(time, err_H,  color='#4fc3f7', lw=1.5, label='|Error H| (m)')
    ax6.plot(time, err_CB, color='#ef5350', lw=1.5, label='|Error C_B| (kmol/m³)')
    ax6.axhline(0, color='#555', ls=':', lw=1)
    style_ax(ax6, "Absolute Tracking Errors", "Error")

    return fig


def make_learning_curve(rewards_path):
    rewards = np.load(rewards_path)
    episodes = np.arange(1, len(rewards) + 1)

    window = 200
    smoothed = np.convolve(rewards, np.ones(window)/window, mode='valid')
    smoothed_eps = episodes[window - 1:]

    fig, ax = plt.subplots(figsize=(14, 3.5))
    fig.patch.set_facecolor('#0e1117')
    ax.set_facecolor('#1a1a2e')
    ax.plot(episodes, rewards, alpha=0.12, color='#4fc3f7', lw=0.5)
    ax.plot(smoothed_eps, smoothed, color='#4fc3f7', lw=2, label='Smoothed reward')
    ax.axvline(10000, color='#ff7043', ls='--', lw=1, alpha=0.6, label='Exploration dip (~ep 10k)')
    ax.set_xlabel('Episode', color='#ddd', fontsize=10)
    ax.set_ylabel('Reward', color='#ddd', fontsize=10)
    ax.set_title('Learning Curve — CSTR-TD3 : cstr_HCB_E_I_D', color='#ddd', fontsize=12)
    ax.tick_params(colors='#ddd')
    for sp in ax.spines.values():
        sp.set_color('#444')
    ax.grid(True, color='#2a2a2a', lw=0.7)
    ax.legend(fontsize=9, facecolor='#1a1a2e', labelcolor='#ddd', edgecolor='#444')
    fig.tight_layout()
    return fig


# ── Main area ──────────────────────────────────────────────────────────────────

# Load model (cached)
if not os.path.exists(model_choice):
    st.error(f"Model not found at `{model_choice}`. Train first with `python train.py`.")
    st.stop()

with st.spinner("Loading model..."):
    agent, env_ref = load_agent(model_choice)

# Metrics row (always visible)
col_m1, col_m2, col_m3, col_m4 = st.columns(4)
col_m1.metric("Model", model_choice.split("/")[-1])
col_m2.metric("Level Setpoint", f"{sp_H:.2f} m")
col_m3.metric("Composition Setpoint", f"{sp_CB:.3f} kmol/m³")
col_m4.metric("Device", str(agent.device).upper())

st.divider()

# ── Run on button press (or auto-run on first load) ────────────────────────────
if run_btn or "sim_hist" not in st.session_state:
    ic = None if use_random_ic else (ic_H, ic_CA, ic_CB)
    with st.spinner("Running simulation..."):
        hist, total_reward = run_simulation(agent, env_ref, sp_H, sp_CB, ic)
    st.session_state["sim_hist"] = hist
    st.session_state["total_reward"] = total_reward
    st.session_state["sim_sp"] = (sp_H, sp_CB)

hist = st.session_state["sim_hist"]
total_reward = st.session_state["total_reward"]
sim_sp_H, sim_sp_CB = st.session_state["sim_sp"]

# ── Summary metrics ────────────────────────────────────────────────────────────
H_arr  = np.array(hist['H'])
CB_arr = np.array(hist['CB'])
steady_slice = slice(len(H_arr)//2, None)  # second half of episode

ss_err_H  = np.abs(sim_sp_H  - H_arr[steady_slice]).mean()
ss_err_CB = np.abs(sim_sp_CB - CB_arr[steady_slice]).mean()

c1, c2, c3, c4 = st.columns(4)
c1.metric("Total Episode Reward", f"{total_reward:.1f}")
c2.metric("Steady-State Error H", f"{ss_err_H:.4f} m")
c3.metric("Steady-State Error C_B", f"{ss_err_CB:.5f} kmol/m³")
c4.metric("Steps", len(H_arr) - 1)

# ── Simulation plots ───────────────────────────────────────────────────────────
st.subheader("Simulation Results")
fig = make_plots(hist, sim_sp_H, sim_sp_CB)
st.pyplot(fig, width='stretch')
plt.close(fig)

# ── Learning curve ─────────────────────────────────────────────────────────────
if show_lc:
    rewards_path = "checkpoints/episode_rewards.npy"
    if os.path.exists(rewards_path):
        st.subheader("Training History — Learning Curve")
        lc_fig = make_learning_curve(rewards_path)
        st.pyplot(lc_fig, use_container_width=True)
        plt.close(lc_fig)
    else:
        st.info("Learning curve not available (run full training first).")

# ── Footer ─────────────────────────────────────────────────────────────────────
st.divider()
st.caption("Martinez et al. (2022) · TD3 Algorithm · CSTR First-Principles Model · RTX 4060 GPU")

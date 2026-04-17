"""
Interactive Dashboard for TD3 CSTR Controller (5-MV extended model).
Run with: streamlit run dashboard.py
"""

import streamlit as st
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
import os

from cstr_env import SCENARIOS, MV_LABELS

# ── Page config ────────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="CSTR TD3 Controller Dashboard",
    page_icon="⚗️",
    layout="wide",
)

st.title("⚗️ CSTR Deep Reinforcement Learning Controller")
st.caption("TD3 Agent — 5 Manipulated Variables, 7 MV-Pairing Scenarios")

# ── Lazy imports (avoid re-importing torch on every widget interaction) ────────
@st.cache_resource
def load_agent(model_path):
    from cstr_env import CSTREnv
    from td3_agent import TD3Agent
    env = CSTREnv(max_steps=200)
    agent = TD3Agent(state_dim=env.state_dim, action_dim=env.action_dim)
    agent.load(model_path)
    return agent, env


# ── Scenario labels for sidebar dropdown ───────────────────────────────────────
SCENARIO_OPTIONS = [
    f"{i+1}. {s['name']}  —  MVs: {s['active'][0]} + {s['active'][1]}"
    for i, s in enumerate(SCENARIOS)
]

# ── Default stepped setpoint profile (matches validate.py) ─────────────────────
DEFAULT_STEPPED_PROFILE_C = [
    (0.0, 0.8, 32.0),
    (0.8, 1.6, 40.0),
    (1.6, 2.4, 45.0),
    (2.4, 3.2, 36.0),
    (3.2, 4.0, 42.0),
]

MV_COLOURS = {
    "T_A_in": "#4fc3f7",
    "T_B_in": "#81c784",
    "F_A":    "#ffa726",
    "F_B":    "#ef5350",
    "T_oil":  "#ba68c8",
}

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
    st.subheader("Scenario")
    scenario_idx = st.selectbox(
        "MV-Pairing Scenario",
        options=list(range(len(SCENARIO_OPTIONS))),
        format_func=lambda i: SCENARIO_OPTIONS[i],
        index=0,
    )
    scenario = SCENARIOS[scenario_idx]
    st.caption(
        f"Active MVs: **{scenario['active'][0]}**, **{scenario['active'][1]}**  \n"
        f"Frozen at defaults: " + ", ".join(
            mv for mv, m in zip(MV_LABELS, scenario['mask']) if m == 0
        )
    )

    st.divider()
    st.subheader("Setpoint (Reactor Temperature)")
    use_stepped = st.checkbox("Use stepped 5-segment profile", value=True)

    if not use_stepped:
        sp_T_C = st.slider("Setpoint T (°C)", min_value=25.0, max_value=50.0,
                           value=40.0, step=0.5, format="%.1f")
    else:
        st.caption("Profile: 32 → 40 → 45 → 36 → 42 °C (every 0.8 h)")
        sp_T_C = None

    st.divider()
    st.subheader("Initial Condition")
    init_T_C = st.slider("Initial reactor T (°C)", 20.0, 50.0, 30.0, 0.5)

    st.divider()
    run_btn = st.button("▶  Run Simulation", type="primary", use_container_width=True)

    st.divider()
    st.subheader("Learning Curve")
    show_lc = st.checkbox("Show learning curve", value=True)


# ── Simulation logic ───────────────────────────────────────────────────────────
def build_sp_profile_K(max_steps, dt):
    """Build piecewise-constant stepped profile in Kelvin."""
    n = max_steps
    prof = np.zeros(n, dtype=np.float64)
    for (t0, t1, T_C) in DEFAULT_STEPPED_PROFILE_C:
        k0 = int(round(t0 / dt))
        k1 = min(n, int(round(t1 / dt)))
        prof[k0:k1] = T_C + 273.15
    # Fill any remainder
    if prof[-1] == 0:
        prof[prof == 0] = DEFAULT_STEPPED_PROFILE_C[-1][2] + 273.15
    return prof


def run_simulation(agent, scenario_id, use_stepped, sp_T_C, init_T_C):
    from cstr_env import CSTREnv
    env = CSTREnv(max_steps=200)
    dt = env.dt * env.sub_steps  # total step length in hours

    if use_stepped:
        sp_profile_K = build_sp_profile_K(env.max_steps, dt)
    else:
        sp_profile_K = np.full(env.max_steps, sp_T_C + 273.15, dtype=np.float64)

    state = env.reset(
        scenario_id=scenario_id,
        sp_T_profile=sp_profile_K,
        init_T=init_T_C + 273.15,
    )
    total_reward = 0.0
    done = False
    while not done:
        action = agent.select_action(state, explore=False)
        state, reward, done, _ = env.step(action)
        total_reward += reward

    return env.history, total_reward


def make_plots(hist, scenario):
    time = np.array(hist['time'])
    T_C = np.array(hist['T']) - 273.15        # reactor temperature history (K→°C)
    sp_T_C = np.array(hist['sp_T']) - 273.15
    H = np.array(hist['H'])
    CA = np.array(hist['CA'])
    CB = np.array(hist['CB'])

    # Per-MV history arrays (all shape (N,), one sample per step)
    mv_hist = {
        "T_A_in": np.array(hist['T_A_in']),
        "T_B_in": np.array(hist['T_B_in']),
        "F_A":    np.array(hist['F_A']),
        "F_B":    np.array(hist['F_B']),
        "T_oil":  np.array(hist['T_oil']),
    }
    t_act = time[1:len(mv_hist['T_A_in']) + 1]

    fig = plt.figure(figsize=(14, 9))
    fig.patch.set_facecolor('#0e1117')
    gs = gridspec.GridSpec(2, 2, figure=fig, hspace=0.4, wspace=0.3)

    SPINE_COLOR = '#444'
    GRID_COLOR = '#2a2a2a'
    TEXT_COLOR = '#dddddd'

    def style_ax(ax, title, ylabel, xlabel="Time (h)"):
        ax.set_facecolor('#1a1a2e')
        ax.set_title(title, color=TEXT_COLOR, fontsize=11, pad=8)
        ax.set_ylabel(ylabel, color=TEXT_COLOR, fontsize=9)
        ax.set_xlabel(xlabel, color=TEXT_COLOR, fontsize=9)
        ax.tick_params(colors=TEXT_COLOR, labelsize=8)
        for sp in ax.spines.values():
            sp.set_color(SPINE_COLOR)
        ax.grid(True, color=GRID_COLOR, linewidth=0.7)

    # ── Panel 1: Reactor temperature + setpoint ───────────────────────────────
    ax1 = fig.add_subplot(gs[0, 0])
    ax1.plot(time, T_C, color='#ffa726', lw=2, label='T reactor')
    ax1.plot(time[:len(sp_T_C)], sp_T_C, color='#ef5350', ls='--', lw=1.5, label='Setpoint')
    style_ax(ax1, f"Reactor Temperature  —  {scenario['name']}", "T (°C)")
    ax1.legend(fontsize=8, facecolor='#1a1a2e', labelcolor=TEXT_COLOR,
               edgecolor=SPINE_COLOR, loc='best')

    # ── Panel 2: Active MVs over time ─────────────────────────────────────────
    ax2 = fig.add_subplot(gs[0, 1])
    active_idx = [i for i, m in enumerate(scenario['mask']) if m == 1]
    for idx in active_idx:
        label = MV_LABELS[idx]
        series = mv_hist[label].copy()
        # Convert to display units (T in °C, F in m³/h)
        if idx in (0, 1, 4):     # temperatures
            series = series - 273.15
            unit = "°C"
        else:                    # flows
            unit = "m³/h"
        ax2.plot(t_act, series, color=MV_COLOURS[label], lw=1.8,
                 label=f"{label} ({unit})")
    style_ax(ax2, "Active Manipulated Variables", "MV value")
    ax2.legend(fontsize=8, facecolor='#1a1a2e', labelcolor=TEXT_COLOR,
               edgecolor=SPINE_COLOR, loc='best')

    # ── Panel 3: Level H ──────────────────────────────────────────────────────
    ax3 = fig.add_subplot(gs[1, 0])
    ax3.plot(time, H, color='#4fc3f7', lw=2, label='Level H')
    ax3.set_ylim(0, 3.0)
    ax3.axhline(0.5, color='#555', ls=':', lw=1)
    ax3.axhline(2.5, color='#555', ls=':', lw=1)
    style_ax(ax3, "Reactor Level (observable, safety-bounded)", "H (m)")
    ax3.legend(fontsize=8, facecolor='#1a1a2e', labelcolor=TEXT_COLOR,
               edgecolor=SPINE_COLOR, loc='best')

    # ── Panel 4: Concentrations ───────────────────────────────────────────────
    ax4 = fig.add_subplot(gs[1, 1])
    ax4.plot(time, CA, color='#4fc3f7', lw=2, label='[A] reactant')
    ax4.plot(time, CB, color='#ef5350', lw=2, label='[B] product')
    style_ax(ax4, "Chemical Compositions (observable)", "Conc. (kmol/m³)")
    ax4.legend(fontsize=8, facecolor='#1a1a2e', labelcolor=TEXT_COLOR,
               edgecolor=SPINE_COLOR, loc='best')

    return fig


def make_learning_curve(rewards_path):
    rewards = np.load(rewards_path)
    episodes = np.arange(1, len(rewards) + 1)

    window = min(200, max(1, len(rewards) // 20))
    smoothed = np.convolve(rewards, np.ones(window) / window, mode='valid')
    smoothed_eps = episodes[window - 1:]

    fig, ax = plt.subplots(figsize=(14, 3.5))
    fig.patch.set_facecolor('#0e1117')
    ax.set_facecolor('#1a1a2e')
    ax.plot(episodes, rewards, alpha=0.12, color='#4fc3f7', lw=0.5)
    ax.plot(smoothed_eps, smoothed, color='#4fc3f7', lw=2,
            label=f'Smoothed reward (window={window})')
    ax.set_xlabel('Episode', color='#ddd', fontsize=10)
    ax.set_ylabel('Reward', color='#ddd', fontsize=10)
    ax.set_title('Learning Curve — CSTR-TD3 (5-MV extended)', color='#ddd', fontsize=12)
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
col_m2.metric("Scenario", f"#{scenario_idx + 1} — {scenario['name']}")
col_m3.metric("Profile", "Stepped" if use_stepped else f"Constant {sp_T_C:.1f}°C")
col_m4.metric("Device", str(agent.device).upper())

st.divider()

# ── Run on button press (or auto-run on first load) ────────────────────────────
run_signature = (scenario_idx, use_stepped, sp_T_C, init_T_C, model_choice)

if run_btn or "sim_hist" not in st.session_state or \
   st.session_state.get("run_signature") != run_signature:
    with st.spinner("Running simulation..."):
        hist, total_reward = run_simulation(
            agent, scenario_idx, use_stepped, sp_T_C, init_T_C
        )
    st.session_state["sim_hist"] = hist
    st.session_state["total_reward"] = total_reward
    st.session_state["sim_scenario"] = scenario
    st.session_state["run_signature"] = run_signature

hist = st.session_state["sim_hist"]
total_reward = st.session_state["total_reward"]
sim_scenario = st.session_state["sim_scenario"]

# ── Summary metrics ────────────────────────────────────────────────────────────
T_arr = np.array(hist['T'])
sp_T_arr = np.array(hist['sp_T'])
# Use second half for steady-state-style metric
steady_slice = slice(len(T_arr) // 2, None)
err_T = np.abs(T_arr[steady_slice] - sp_T_arr[:len(T_arr)][steady_slice])
mae_T = err_T.mean()
rmse_T = np.sqrt((err_T ** 2).mean())

c1, c2, c3, c4 = st.columns(4)
c1.metric("Total Episode Reward", f"{total_reward:.1f}")
c2.metric("Mean |Error T|", f"{mae_T:.3f} K")
c3.metric("RMSE T", f"{rmse_T:.3f} K")
c4.metric("Steps", len(T_arr) - 1)

# ── Simulation plots ───────────────────────────────────────────────────────────
st.subheader("Simulation Results")
fig = make_plots(hist, sim_scenario)
st.pyplot(fig, use_container_width=True)
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
st.caption("CSTR First-Principles Model with Hot Oil Bath · TD3 Algorithm · 5 Manipulated Variables · 7 MV-Pairing Scenarios")

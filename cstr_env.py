"""
CSTR Environment for Deep Reinforcement Learning Control.

Extended model: includes a hot oil bath jacket and full energy balance.

Reaction: A -> B (first-order, exothermic)
Controlled variable: Reactor temperature (T)
Manipulated variables (5 total, selected per scenario via mask):
    0. T_A_in  — Feed A inlet temperature      (15–80 °C)
    1. T_B_in  — Feed B inlet temperature      (15–80 °C)
    2. F_A     — Feed A volumetric flow rate   (0–2.0 m^3/h)
    3. F_B     — Feed B volumetric flow rate   (0–2.0 m^3/h)
    4. T_oil   — Hot oil bath jacket temperature (30–120 °C)

Seven scenarios, each using a pair of MVs (the remaining 3 are held at
physical defaults):
    1: T_A_in + T_B_in
    2: T_oil  + F_A
    3: T_oil  + F_B
    4: T_A_in + F_B
    5: T_B_in + F_A
    6: T_oil  + T_A_in
    7: T_oil  + T_B_in

Reactant and product concentrations, reactor level, etc. are still simulated
but not rewarded. Level is kept safe by an internal override if it leaves
[0.5, 2.5] m.
"""

import numpy as np


# -----------------------------------------------------------------------------
# Scenario definitions (mask: 1 = active/agent-controlled, 0 = frozen at default)
# Order of mask matches action index: [T_A_in, T_B_in, F_A, F_B, T_oil]
# -----------------------------------------------------------------------------
SCENARIOS = [
    {"id": 1, "name": "T_A_in + T_B_in",  "mask": [1, 1, 0, 0, 0]},
    {"id": 2, "name": "T_oil  + F_A",     "mask": [0, 0, 1, 0, 1]},
    {"id": 3, "name": "T_oil  + F_B",     "mask": [0, 0, 0, 1, 1]},
    {"id": 4, "name": "T_A_in + F_B",     "mask": [1, 0, 0, 1, 0]},
    {"id": 5, "name": "T_B_in + F_A",     "mask": [0, 1, 1, 0, 0]},
    {"id": 6, "name": "T_oil  + T_A_in",  "mask": [1, 0, 0, 0, 1]},
    {"id": 7, "name": "T_oil  + T_B_in",  "mask": [0, 1, 0, 0, 1]},
]

MV_LABELS = ["T_A_in", "T_B_in", "F_A", "F_B", "T_oil"]


class CSTREnv:
    """
    Jacketed CSTR with full energy balance and 5 manipulated variables.
    """

    def __init__(self, max_steps=200, dt=0.02):
        # --- Tank geometry ---
        self.A_tank = 1.0                 # m^2
        self.H_max = 3.0                  # m
        self.H_min_safe = 0.5             # m, trigger for level safety override
        self.H_max_safe = 2.5             # m

        # --- Outlet (gravity-driven) ---
        self.cv = 0.8                     # m^2.5/h

        # --- Inlet stream concentrations ---
        self.CA_in_A = 1.0                # kmol/m^3  (feed A rich in reactant)
        self.CA_in_B = 0.5                # kmol/m^3  (feed B dilute)

        # --- Reaction kinetics (Arrhenius, PSO-calibrated) ---
        self.k0 = 3.0e8                   # h^-1
        self.Ea_R = 7500.0                # K

        # --- Thermodynamics (energy balance) ---
        self.rho = 1000.0                 # kg/m^3, liquid density (water-like)
        self.Cp = 4.18                    # kJ/(kg·K), heat capacity
        self.dH_rxn = -5.0e4              # kJ/kmol, heat of reaction (exothermic)
        self.UA = 2000.0                  # kJ/(h·K), jacket heat-transfer coefficient

        # --- Physical ranges for the 5 manipulated variables (SI: K and m^3/h) ---
        #   [T_A_in, T_B_in, F_A, F_B, T_oil]
        self.mv_min = np.array([288.15, 288.15, 0.0, 0.0, 303.15], dtype=np.float32)
        self.mv_max = np.array([353.15, 353.15, 2.0, 2.0, 393.15], dtype=np.float32)

        # --- Default (frozen) values for MVs when not agent-controlled ---
        # T_feed = 25 °C = 298.15 K; F = 0.5 m^3/h; T_oil = 60 °C = 333.15 K
        self.mv_default = np.array([298.15, 298.15, 0.5, 0.5, 333.15], dtype=np.float32)

        # --- Setpoint range for reactor temperature (controlled variable) ---
        self.sp_T_min = 298.15            # K (~25 °C)
        self.sp_T_max = 323.15            # K (~50 °C)

        # --- Normalization references ---
        self.T_ref = 320.0                # K, typical reactor temperature for normalization
        self.T_err_scale = 50.0           # K, error normalization scale

        # --- Simulation parameters ---
        self.dt = dt                      # h
        self.max_steps = max_steps

        # --- Dimensions ---
        # State layout (13-D):
        #   0: T_reactor / T_ref
        #   1: err_T / T_err_scale
        #   2: clipped integral err_T
        #   3: clipped derivative err_T
        #   4: sp_T / T_ref
        #   5: H / H_max
        #   6: C_A           (kept raw, typically ~0-1)
        #   7: C_B           (kept raw, typically ~0-0.5)
        #   8..12: scenario mask (one bit per MV)
        self.state_dim = 13
        self.action_dim = 5

        # --- Reward weight ---
        self.w_T = 100.0                  # applied to (err_T in K)^2

        self.reset()

    # ------------------------------------------------------------------ helpers

    def _reaction_rate(self, T):
        """Arrhenius rate constant k(T)."""
        return self.k0 * np.exp(-self.Ea_R / T)

    def _scale_actions(self, action):
        """Map [-1, 1]^5 to physical units."""
        a = np.clip(np.asarray(action, dtype=np.float32), -1.0, 1.0)
        frac = (a + 1.0) / 2.0
        return self.mv_min + frac * (self.mv_max - self.mv_min)

    def _apply_mask(self, mv_physical):
        """
        Replace inactive MVs (mask == 0) with their physical defaults.
        Returns the physical-unit MV vector that is actually applied to the ODE.
        """
        mask = self.scenario_mask.astype(np.float32)
        return mask * mv_physical + (1.0 - mask) * self.mv_default

    def _sample_setpoint_profile(self):
        """
        Generate a scripted stepped T setpoint profile for the full episode.

        Produces an array of length `max_steps+1` giving the setpoint at
        every time index. Step changes occur at uniform intervals, with
        values drawn from [sp_T_min, sp_T_max].
        """
        n_steps_total = self.max_steps + 1
        n_segments = 5
        seg_len = n_steps_total // n_segments
        profile = np.empty(n_steps_total, dtype=np.float32)
        for i in range(n_segments):
            lo, hi = (i * seg_len, (i + 1) * seg_len) if i < n_segments - 1 else (i * seg_len, n_steps_total)
            sp_K = np.random.uniform(self.sp_T_min, self.sp_T_max)
            profile[lo:hi] = sp_K
        return profile

    # ------------------------------------------------------------------ dynamics

    def _integrate_step(self, H, CA, CB, T, mv):
        """
        Euler integration with 4 sub-steps.

        mv: [T_A_in, T_B_in, F_A, F_B, T_oil] in SI units (K, m^3/h, K)
        """
        T_A_in, T_B_in, F_A, F_B, T_oil = mv
        sub_dt = self.dt / 4.0

        for _ in range(4):
            # --- Safety override on level (keeps the reactor physically sensible) ---
            # If level is too low, reduce outflow effect; if too high, reduce inflow.
            H_safe = max(H, 0.01)
            V = self.A_tank * H_safe
            F_out = self.cv * np.sqrt(H_safe)
            F_in = F_A + F_B

            # Override flows if level drifts out of safe band (transparent to agent)
            if H < self.H_min_safe and F_in < F_out:
                # agent's flows would drain the tank — pad them
                boost = (F_out - F_in) + 0.1
                F_A_eff = F_A + 0.5 * boost
                F_B_eff = F_B + 0.5 * boost
                F_in = F_A_eff + F_B_eff
            elif H > self.H_max_safe and F_in > F_out:
                cut = (F_in - F_out) + 0.1
                F_A_eff = max(F_A - 0.5 * cut, 0.0)
                F_B_eff = max(F_B - 0.5 * cut, 0.0)
                F_in = F_A_eff + F_B_eff
            else:
                F_A_eff = F_A
                F_B_eff = F_B

            # --- Reaction kinetics ---
            k = self._reaction_rate(T)

            # --- Mass balances ---
            dH = (F_in - F_out) / self.A_tank

            dCA = (
                F_A_eff * self.CA_in_A
                + F_B_eff * self.CA_in_B
                - F_out * CA
            ) / V - k * CA

            dCB = (-F_out * CB) / V + k * CA

            # --- Energy balance ---
            # Convective: feed streams at T_A_in, T_B_in enter at their temperatures,
            # outlet leaves at T (current reactor temperature).
            conv = (F_A_eff * (T_A_in - T) + F_B_eff * (T_B_in - T)) / V
            # Reaction heat (exothermic: dH_rxn < 0 -> heat generated)
            rxn = (-self.dH_rxn) * k * CA / (self.rho * self.Cp)
            # Jacket heat transfer
            jacket = self.UA * (T_oil - T) / (self.rho * V * self.Cp)

            dT = conv + rxn + jacket

            # --- Update states ---
            H = max(H + sub_dt * dH, 0.01)
            CA = max(CA + sub_dt * dCA, 0.0)
            CB = max(CB + sub_dt * dCB, 0.0)
            T = T + sub_dt * dT

            # Clip temperature to a sane range
            T = float(np.clip(T, 273.15, 500.0))

        return H, CA, CB, T

    # ------------------------------------------------------------------ reset

    def reset(self, scenario_id=None, sp_T_profile=None, init_T=None):
        """
        Reset the environment.

        Args:
            scenario_id: int 1-7; if None, sampled uniformly.
            sp_T_profile: optional pre-scripted setpoint array (length max_steps+1),
                          in Kelvin. If None, a random stepped profile is generated.
            init_T: optional initial reactor temperature in Kelvin.
        """
        # Pick scenario
        if scenario_id is None:
            scenario_idx = np.random.randint(0, len(SCENARIOS))
        else:
            scenario_idx = scenario_id - 1
        self.scenario = SCENARIOS[scenario_idx]
        self.scenario_mask = np.array(self.scenario["mask"], dtype=np.float32)

        # Initial physical state
        self.H = 1.5                                      # m
        self.CA = 0.5                                     # kmol/m^3
        self.CB = 0.02                                    # kmol/m^3
        self.T = float(init_T) if init_T is not None else 303.15   # K (~30 °C)

        # Setpoint profile (in Kelvin)
        if sp_T_profile is not None:
            self.sp_T_profile = np.asarray(sp_T_profile, dtype=np.float32)
        else:
            self.sp_T_profile = self._sample_setpoint_profile()
        self.sp_T = float(self.sp_T_profile[0])

        # Error tracking
        self.integral_error_T = 0.0
        self.prev_error_T = self.sp_T - self.T

        self.step_count = 0

        # History
        self.history = {
            "time": [0.0],
            "T": [self.T],
            "sp_T": [self.sp_T],
            "H": [self.H],
            "CA": [self.CA],
            "CB": [self.CB],
            "T_A_in": [],
            "T_B_in": [],
            "F_A": [],
            "F_B": [],
            "T_oil": [],
            "reward": [],
        }

        return self._get_state()

    # ------------------------------------------------------------------ state

    def _get_state(self):
        err_T = self.sp_T - self.T

        if self.step_count > 0:
            deriv_T = (err_T - self.prev_error_T) / self.dt
        else:
            deriv_T = 0.0

        state = np.array([
            self.T / self.T_ref,
            err_T / self.T_err_scale,
            float(np.clip(self.integral_error_T / 50.0, -1.0, 1.0)),
            float(np.clip(deriv_T * self.dt / self.T_err_scale, -1.0, 1.0)),
            self.sp_T / self.T_ref,
            self.H / self.H_max,
            float(np.clip(self.CA, 0.0, 2.0)),
            float(np.clip(self.CB, 0.0, 1.0)),
            *self.scenario_mask.tolist(),
        ], dtype=np.float32)

        return state

    # ------------------------------------------------------------------ step

    def step(self, action):
        """
        Execute one time step.

        Args:
            action: np.array of shape (5,), values in [-1, 1]
                Index -> MV:
                    0: T_A_in,  1: T_B_in,  2: F_A,  3: F_B,  4: T_oil
        Returns:
            state, reward, done, info
        """
        # Scale actions to physical units, then freeze inactive MVs
        mv_physical_raw = self._scale_actions(action)
        mv_applied = self._apply_mask(mv_physical_raw)

        # Integrate dynamics
        H_new, CA_new, CB_new, T_new = self._integrate_step(
            self.H, self.CA, self.CB, self.T, mv_applied
        )

        self.H = float(np.clip(H_new, 0.01, self.H_max))
        self.CA = max(CA_new, 0.0)
        self.CB = max(CB_new, 0.0)
        self.T = float(T_new)

        # Advance setpoint (may step-change)
        self.step_count += 1
        sp_idx = min(self.step_count, len(self.sp_T_profile) - 1)
        self.sp_T = float(np.clip(self.sp_T_profile[sp_idx], 273.15, 450.0))

        # Errors & reward
        err_T = self.sp_T - self.T
        self.integral_error_T += err_T * self.dt
        reward = -self.w_T * (err_T ** 2)

        self.prev_error_T = err_T

        done = self.step_count >= self.max_steps

        # History
        T_A_in, T_B_in, F_A, F_B, T_oil = mv_applied
        self.history["time"].append(self.step_count * self.dt)
        self.history["T"].append(self.T)
        self.history["sp_T"].append(self.sp_T)
        self.history["H"].append(self.H)
        self.history["CA"].append(self.CA)
        self.history["CB"].append(self.CB)
        self.history["T_A_in"].append(float(T_A_in))
        self.history["T_B_in"].append(float(T_B_in))
        self.history["F_A"].append(float(F_A))
        self.history["F_B"].append(float(F_B))
        self.history["T_oil"].append(float(T_oil))
        self.history["reward"].append(float(reward))

        info = {
            "T_A_in": float(T_A_in),
            "T_B_in": float(T_B_in),
            "F_A": float(F_A),
            "F_B": float(F_B),
            "T_oil": float(T_oil),
            "err_T": float(err_T),
            "scenario": self.scenario["id"],
            "scenario_name": self.scenario["name"],
        }

        return self._get_state(), reward, done, info

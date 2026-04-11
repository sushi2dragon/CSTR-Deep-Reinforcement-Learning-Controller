"""
CSTR Environment for Deep Reinforcement Learning Control.

Replicates the CSTR described in:
  "CSTR control with deep reinforcement learning" (Martinez et al., PSE 2021+)

Reaction: A -> B (first order, isothermal)
Controlled variables: Reactor level (H), Product concentration (C_B)
Manipulated variables: Inlet valve opening (controls F1), Reactor temperature (T)
"""

import numpy as np


class CSTREnv:
    """
    Continuous Stirred-Tank Reactor environment.

    Two inlet streams with different reactant concentrations feed the reactor.
    Product is extracted by gravity. The agent controls the valve opening on
    inlet stream 1 and the reactor temperature to maintain level and product
    concentration at their setpoints.
    """

    def __init__(self, max_steps=200, dt=0.02):
        # --- Tank geometry ---
        self.A_tank = 1.0       # m^2, cross-sectional area
        self.H_max = 3.0        # m, maximum level

        # --- Outlet (gravity-driven) ---
        self.cv = 0.8           # m^2.5/h, valve coefficient

        # --- Inlet streams ---
        self.F1_max = 2.0       # m^3/h, max flow rate of stream 1 (manipulated)
        self.F2 = 0.5           # m^3/h, constant flow rate of stream 2
        self.CA_in1 = 1.0       # kmol/m^3, reactant A concentration in stream 1
        self.CA_in2 = 0.5       # kmol/m^3, reactant A concentration in stream 2

        # --- Reaction kinetics (Arrhenius) ---
        # Based on PSO-calibrated parameters, scaled for simulation units
        self.k0 = 3.0e8         # h^-1, pre-exponential factor
        self.Ea_R = 7500.0      # K, activation energy / gas constant

        # --- Temperature range (manipulated) ---
        self.T_min = 300.0      # K
        self.T_max = 400.0      # K

        # --- Simulation parameters ---
        self.dt = dt            # h, time step (~1.2 min)
        self.max_steps = max_steps

        # --- Setpoint ranges ---
        self.H_sp_range = (0.5, 2.5)       # m
        self.CB_sp_range = (0.05, 0.25)     # kmol/m^3

        # --- Dimensions ---
        self.state_dim = 8      # [H, CB, err_H, err_CB, int_err_H, int_err_CB, derr_H, derr_CB]
        self.action_dim = 2     # [valve_opening, temperature]

        # --- Reward weights ---
        self.w_H = 25.0
        self.w_CB = 2500.0

        self.reset()

    def _reaction_rate(self, T):
        """Arrhenius reaction rate constant k(T)."""
        return self.k0 * np.exp(-self.Ea_R / T)

    def _integrate_step(self, H, CA, CB, F1, T):
        """
        Euler integration with sub-stepping for stability and speed.
        Uses 4 sub-steps per dt for accuracy without RK4 overhead.
        """
        k = self.k0 * np.exp(-self.Ea_R / T)
        sub_dt = self.dt / 4.0

        for _ in range(4):
            H = max(H, 0.01)
            V = self.A_tank * H
            F_out = self.cv * np.sqrt(H)

            dH = (F1 + self.F2 - F_out) / self.A_tank
            dCA = (F1 * self.CA_in1 + self.F2 * self.CA_in2 - F_out * CA) / V - k * CA
            dCB = (-F_out * CB) / V + k * CA

            H += sub_dt * dH
            CA += sub_dt * dCA
            CB += sub_dt * dCB

        return H, CA, CB

    def reset(self, sp_H=None, sp_CB=None):
        """
        Reset environment. Optionally specify setpoints for validation.
        Returns initial state.
        """
        # Random initial conditions near nominal operating point
        self.H = np.random.uniform(0.8, 1.5)
        self.CA = np.random.uniform(0.3, 0.7)
        self.CB = np.random.uniform(0.05, 0.15)

        # Setpoints (random during training, fixed during validation)
        if sp_H is not None:
            self.sp_H = sp_H
        else:
            self.sp_H = np.random.uniform(*self.H_sp_range)

        if sp_CB is not None:
            self.sp_CB = sp_CB
        else:
            self.sp_CB = np.random.uniform(*self.CB_sp_range)

        # Error tracking
        self.integral_error_H = 0.0
        self.integral_error_CB = 0.0
        self.prev_error_H = self.sp_H - self.H
        self.prev_error_CB = self.sp_CB - self.CB

        self.step_count = 0

        # History for plotting
        self.history = {
            'time': [0.0],
            'H': [self.H],
            'CA': [self.CA],
            'CB': [self.CB],
            'F1': [],
            'T': [],
            'sp_H': [self.sp_H],
            'sp_CB': [self.sp_CB],
            'reward': []
        }

        return self._get_state()

    def _get_state(self):
        """
        Build state vector as described in the paper:
        - Instantaneous measurements of controlled variables (H, C_B)
        - Absolute errors w.r.t. setpoints
        - Integral of errors
        - Derivative of errors
        """
        error_H = self.sp_H - self.H
        error_CB = self.sp_CB - self.CB

        if self.step_count > 0:
            deriv_H = (error_H - self.prev_error_H) / self.dt
            deriv_CB = (error_CB - self.prev_error_CB) / self.dt
        else:
            deriv_H = 0.0
            deriv_CB = 0.0

        # Normalize state components for neural network input
        state = np.array([
            self.H / self.H_max,                        # normalized level
            self.CB / 0.5,                               # normalized concentration
            error_H / self.H_max,                        # normalized error in H
            error_CB / 0.5,                              # normalized error in CB
            np.clip(self.integral_error_H / 5.0, -1, 1), # normalized integral error H
            np.clip(self.integral_error_CB / 1.0, -1, 1), # normalized integral error CB
            np.clip(deriv_H * self.dt, -1, 1),           # normalized derivative error H
            np.clip(deriv_CB * self.dt, -1, 1),          # normalized derivative error CB
        ], dtype=np.float32)

        return state

    def step(self, action):
        """
        Execute one time step.

        Args:
            action: np.array of shape (2,), values in [-1, 1]
                action[0]: valve opening (mapped to F1)
                action[1]: temperature (mapped to T)

        Returns:
            state, reward, done, info
        """
        # Map actions from [-1, 1] to physical ranges
        valve = np.clip((action[0] + 1.0) / 2.0, 0.0, 1.0)
        F1 = valve * self.F1_max

        temp_frac = np.clip((action[1] + 1.0) / 2.0, 0.0, 1.0)
        T = self.T_min + temp_frac * (self.T_max - self.T_min)

        # Integrate CSTR dynamics (Euler with sub-stepping)
        H_new, CA_new, CB_new = self._integrate_step(self.H, self.CA, self.CB, F1, T)

        self.H = np.clip(H_new, 0.01, self.H_max)
        self.CA = max(CA_new, 0.0)
        self.CB = max(CB_new, 0.0)

        # Compute errors
        error_H = self.sp_H - self.H
        error_CB = self.sp_CB - self.CB

        # Update integral errors
        self.integral_error_H += error_H * self.dt
        self.integral_error_CB += error_CB * self.dt

        # Reward: negative weighted squared error (to be maximized)
        reward = -(self.w_H * error_H ** 2 + self.w_CB * error_CB ** 2)

        # Update previous errors for derivative calculation
        self.prev_error_H = error_H
        self.prev_error_CB = error_CB

        self.step_count += 1
        done = self.step_count >= self.max_steps

        # Record history
        self.history['time'].append(self.step_count * self.dt)
        self.history['H'].append(self.H)
        self.history['CA'].append(self.CA)
        self.history['CB'].append(self.CB)
        self.history['F1'].append(F1)
        self.history['T'].append(T)
        self.history['sp_H'].append(self.sp_H)
        self.history['sp_CB'].append(self.sp_CB)
        self.history['reward'].append(reward)

        info = {'F1': F1, 'T': T, 'error_H': error_H, 'error_CB': error_CB}

        return self._get_state(), reward, done, info

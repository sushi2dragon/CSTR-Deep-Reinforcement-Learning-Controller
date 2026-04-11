"""
Twin Delayed DDPG (TD3) Agent.

Replicates the architecture and hyperparameters from:
  "CSTR control with deep reinforcement learning" (Martinez et al., PSE 2021+)

Table 1 hyperparameters:
  - Batch size: 64
  - Replay memory: 10^6
  - Learning rate: 3e-4 (Adam)
  - Policy network: 2 hidden layers (400, 200), ReLU, Tanh output
  - Critic network: 2 hidden layers (800, 400), ReLU
  - Loss: MSE
  - Target update rate (tau): 0.003
  - Discount factor (gamma): 0.99
  - Exploration noise: 0.2 (Ornstein-Uhlenbeck)
  - Warm-up: 1000 timesteps
"""

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
import os
import json


# ============================================================
# Neural Network Architectures
# ============================================================

class Actor(nn.Module):
    """
    Policy network: state -> action.
    Architecture: state_dim -> 400 -> 200 -> action_dim
    Hidden: ReLU, Output: Tanh
    """

    def __init__(self, state_dim, action_dim):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(state_dim, 400),
            nn.ReLU(),
            nn.Linear(400, 200),
            nn.ReLU(),
            nn.Linear(200, action_dim),
            nn.Tanh()
        )

    def forward(self, state):
        return self.net(state)


class Critic(nn.Module):
    """
    Q-value network: (state, action) -> Q-value.
    Architecture: (state_dim + action_dim) -> 800 -> 400 -> 1
    Hidden: ReLU
    """

    def __init__(self, state_dim, action_dim):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(state_dim + action_dim, 800),
            nn.ReLU(),
            nn.Linear(800, 400),
            nn.ReLU(),
            nn.Linear(400, 1)
        )

    def forward(self, state, action):
        return self.net(torch.cat([state, action], dim=-1))


# ============================================================
# Ornstein-Uhlenbeck Noise Process
# ============================================================

class OUNoise:
    """Ornstein-Uhlenbeck process for temporally correlated exploration."""

    def __init__(self, action_dim, mu=0.0, theta=0.15, sigma=0.2):
        self.action_dim = action_dim
        self.mu = mu
        self.theta = theta
        self.sigma = sigma
        self.reset()

    def reset(self):
        self.state = np.ones(self.action_dim) * self.mu

    def sample(self):
        dx = self.theta * (self.mu - self.state) + self.sigma * np.random.randn(self.action_dim)
        self.state += dx
        return self.state.copy()


# ============================================================
# Replay Buffer
# ============================================================

class ReplayBuffer:
    """Fixed-size circular replay buffer."""

    def __init__(self, state_dim, action_dim, max_size=1_000_000):
        self.max_size = max_size
        self.ptr = 0
        self.size = 0

        self.states = np.zeros((max_size, state_dim), dtype=np.float32)
        self.actions = np.zeros((max_size, action_dim), dtype=np.float32)
        self.rewards = np.zeros(max_size, dtype=np.float32)
        self.next_states = np.zeros((max_size, state_dim), dtype=np.float32)
        self.dones = np.zeros(max_size, dtype=np.float32)

    def add(self, state, action, reward, next_state, done):
        self.states[self.ptr] = state
        self.actions[self.ptr] = action
        self.rewards[self.ptr] = reward
        self.next_states[self.ptr] = next_state
        self.dones[self.ptr] = float(done)

        self.ptr = (self.ptr + 1) % self.max_size
        self.size = min(self.size + 1, self.max_size)

    def sample(self, batch_size):
        idx = np.random.randint(0, self.size, size=batch_size)
        return (
            self.states[idx],
            self.actions[idx],
            self.rewards[idx],
            self.next_states[idx],
            self.dones[idx]
        )


# ============================================================
# TD3 Agent
# ============================================================

class TD3Agent:
    """
    Twin Delayed DDPG agent as described in the paper.

    Key TD3 features:
      1. Twin critics (clipped double Q-learning)
      2. Delayed policy updates (every 2 critic updates)
      3. Target policy smoothing (noise added to target actions)
    """

    def __init__(
        self,
        state_dim,
        action_dim,
        lr=3e-4,
        gamma=0.99,
        tau=0.003,
        batch_size=64,
        replay_size=1_000_000,
        warmup_steps=1000,
        noise_sigma=0.2,
        policy_delay=2,
        target_noise=0.2,
        target_noise_clip=0.5,
        device=None
    ):
        self.state_dim = state_dim
        self.action_dim = action_dim
        self.gamma = gamma
        self.tau = tau
        self.batch_size = batch_size
        self.warmup_steps = warmup_steps
        self.policy_delay = policy_delay
        self.target_noise = target_noise
        self.target_noise_clip = target_noise_clip

        if device is None:
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        else:
            self.device = torch.device(device)

        # Actor (policy) networks
        self.actor = Actor(state_dim, action_dim).to(self.device)
        self.actor_target = Actor(state_dim, action_dim).to(self.device)
        self.actor_target.load_state_dict(self.actor.state_dict())
        self.actor_optimizer = optim.Adam(self.actor.parameters(), lr=lr)

        # Twin Critic networks
        self.critic1 = Critic(state_dim, action_dim).to(self.device)
        self.critic2 = Critic(state_dim, action_dim).to(self.device)
        self.critic1_target = Critic(state_dim, action_dim).to(self.device)
        self.critic2_target = Critic(state_dim, action_dim).to(self.device)
        self.critic1_target.load_state_dict(self.critic1.state_dict())
        self.critic2_target.load_state_dict(self.critic2.state_dict())
        self.critic_optimizer = optim.Adam(
            list(self.critic1.parameters()) + list(self.critic2.parameters()), lr=lr
        )

        # Replay buffer
        self.replay_buffer = ReplayBuffer(state_dim, action_dim, replay_size)

        # Exploration noise
        self.noise = OUNoise(action_dim, sigma=noise_sigma)

        # Counters
        self.total_steps = 0
        self.update_count = 0

    def select_action(self, state, explore=True):
        """Select action with optional exploration noise."""
        if self.total_steps < self.warmup_steps and explore:
            # Random actions during warmup
            return np.random.uniform(-1, 1, size=self.action_dim)

        state_t = torch.FloatTensor(state).unsqueeze(0).to(self.device)
        with torch.no_grad():
            action = self.actor(state_t).cpu().numpy()[0]

        if explore:
            action += self.noise.sample()
            action = np.clip(action, -1.0, 1.0)

        return action

    def store_transition(self, state, action, reward, next_state, done):
        """Store a transition in the replay buffer."""
        self.replay_buffer.add(state, action, reward, next_state, done)
        self.total_steps += 1

    def train_step(self):
        """Perform one training update (critic always, actor every policy_delay steps)."""
        if self.replay_buffer.size < self.batch_size or self.total_steps < self.warmup_steps:
            return None

        # Sample batch
        states, actions, rewards, next_states, dones = self.replay_buffer.sample(self.batch_size)

        states = torch.FloatTensor(states).to(self.device)
        actions = torch.FloatTensor(actions).to(self.device)
        rewards = torch.FloatTensor(rewards).unsqueeze(1).to(self.device)
        next_states = torch.FloatTensor(next_states).to(self.device)
        dones = torch.FloatTensor(dones).unsqueeze(1).to(self.device)

        # --- Critic update ---
        with torch.no_grad():
            # Target policy smoothing: add clipped noise to target actions
            noise = (torch.randn_like(actions) * self.target_noise).clamp(
                -self.target_noise_clip, self.target_noise_clip
            )
            next_actions = (self.actor_target(next_states) + noise).clamp(-1.0, 1.0)

            # Clipped double Q-learning: use minimum of twin target critics
            target_q1 = self.critic1_target(next_states, next_actions)
            target_q2 = self.critic2_target(next_states, next_actions)
            target_q = rewards + (1.0 - dones) * self.gamma * torch.min(target_q1, target_q2)

        current_q1 = self.critic1(states, actions)
        current_q2 = self.critic2(states, actions)

        critic_loss = nn.MSELoss()(current_q1, target_q) + nn.MSELoss()(current_q2, target_q)

        self.critic_optimizer.zero_grad()
        critic_loss.backward()
        self.critic_optimizer.step()

        self.update_count += 1

        # --- Delayed Actor update ---
        actor_loss_val = None
        if self.update_count % self.policy_delay == 0:
            actor_loss = -self.critic1(states, self.actor(states)).mean()

            self.actor_optimizer.zero_grad()
            actor_loss.backward()
            self.actor_optimizer.step()

            actor_loss_val = actor_loss.item()

            # Soft update target networks
            self._soft_update(self.actor, self.actor_target)
            self._soft_update(self.critic1, self.critic1_target)
            self._soft_update(self.critic2, self.critic2_target)

        return {
            'critic_loss': critic_loss.item(),
            'actor_loss': actor_loss_val
        }

    def _soft_update(self, source, target):
        """Polyak averaging: target = tau * source + (1 - tau) * target."""
        for src_param, tgt_param in zip(source.parameters(), target.parameters()):
            tgt_param.data.copy_(self.tau * src_param.data + (1.0 - self.tau) * tgt_param.data)

    def save(self, path):
        """Save model weights and training state."""
        os.makedirs(path, exist_ok=True)
        torch.save(self.actor.state_dict(), os.path.join(path, 'actor.pth'))
        torch.save(self.critic1.state_dict(), os.path.join(path, 'critic1.pth'))
        torch.save(self.critic2.state_dict(), os.path.join(path, 'critic2.pth'))
        torch.save(self.actor_target.state_dict(), os.path.join(path, 'actor_target.pth'))
        torch.save(self.critic1_target.state_dict(), os.path.join(path, 'critic1_target.pth'))
        torch.save(self.critic2_target.state_dict(), os.path.join(path, 'critic2_target.pth'))

        meta = {
            'total_steps': self.total_steps,
            'update_count': self.update_count,
            'state_dim': self.state_dim,
            'action_dim': self.action_dim
        }
        with open(os.path.join(path, 'meta.json'), 'w') as f:
            json.dump(meta, f)

    def load(self, path):
        """Load model weights."""
        self.actor.load_state_dict(
            torch.load(os.path.join(path, 'actor.pth'), map_location=self.device, weights_only=True)
        )
        self.critic1.load_state_dict(
            torch.load(os.path.join(path, 'critic1.pth'), map_location=self.device, weights_only=True)
        )
        self.critic2.load_state_dict(
            torch.load(os.path.join(path, 'critic2.pth'), map_location=self.device, weights_only=True)
        )
        self.actor_target.load_state_dict(
            torch.load(os.path.join(path, 'actor_target.pth'), map_location=self.device, weights_only=True)
        )
        self.critic1_target.load_state_dict(
            torch.load(os.path.join(path, 'critic1_target.pth'), map_location=self.device, weights_only=True)
        )
        self.critic2_target.load_state_dict(
            torch.load(os.path.join(path, 'critic2_target.pth'), map_location=self.device, weights_only=True)
        )

        meta_path = os.path.join(path, 'meta.json')
        if os.path.exists(meta_path):
            with open(meta_path, 'r') as f:
                meta = json.load(f)
            self.total_steps = meta.get('total_steps', 0)
            self.update_count = meta.get('update_count', 0)

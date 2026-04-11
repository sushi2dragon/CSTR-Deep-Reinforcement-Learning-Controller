"""
Training script for TD3 control of CSTR.

Replicates the training procedure from:
  "CSTR control with deep reinforcement learning" (Martinez et al., PSE 2021+)

Trains for 20,000 episodes (configurable), logs rewards, saves checkpoints.
"""

import numpy as np
import os
import time
import argparse

from cstr_env import CSTREnv
from td3_agent import TD3Agent


def train(
    num_episodes=20000,
    max_steps=200,
    save_interval=1000,
    log_interval=100,
    save_dir='checkpoints',
    seed=42
):
    """
    Train TD3 agent on CSTR environment.

    Args:
        num_episodes: Total training episodes (paper uses 20,000)
        max_steps: Steps per episode
        save_interval: Save checkpoint every N episodes
        log_interval: Print progress every N episodes
        save_dir: Directory for checkpoints
        seed: Random seed
    """
    np.random.seed(seed)

    # Create environment and agent
    env = CSTREnv(max_steps=max_steps)
    agent = TD3Agent(
        state_dim=env.state_dim,
        action_dim=env.action_dim,
        lr=3e-4,
        gamma=0.99,
        tau=0.003,
        batch_size=64,
        replay_size=1_000_000,
        warmup_steps=1000,
        noise_sigma=0.2,
        policy_delay=2,
        target_noise=0.2,
        target_noise_clip=0.5
    )

    os.makedirs(save_dir, exist_ok=True)

    # Training logs
    episode_rewards = []
    best_reward = -float('inf')
    start_time = time.time()

    print("=" * 70)
    print("TD3 Training for CSTR Control")
    print(f"  Episodes: {num_episodes}")
    print(f"  Steps/episode: {max_steps}")
    print(f"  Device: {agent.device}")
    print(f"  Warmup steps: {agent.warmup_steps}")
    print("=" * 70)

    for episode in range(1, num_episodes + 1):
        state = env.reset()
        agent.noise.reset()
        episode_reward = 0.0

        for step in range(max_steps):
            # Select action with exploration noise
            action = agent.select_action(state, explore=True)

            # Step environment
            next_state, reward, done, info = env.step(action)

            # Store transition and train
            agent.store_transition(state, action, reward, next_state, done)
            agent.train_step()

            episode_reward += reward
            state = next_state

            if done:
                break

        episode_rewards.append(episode_reward)

        # Track best model
        if episode_reward > best_reward:
            best_reward = episode_reward
            agent.save(os.path.join(save_dir, 'best'))

        # Periodic checkpoint
        if episode % save_interval == 0:
            agent.save(os.path.join(save_dir, f'ep_{episode}'))

        # Logging
        if episode % log_interval == 0:
            recent = episode_rewards[-log_interval:]
            avg_reward = np.mean(recent)
            elapsed = time.time() - start_time
            eps_per_sec = episode / elapsed

            print(
                f"Episode {episode:6d}/{num_episodes} | "
                f"Avg Reward: {avg_reward:8.1f} | "
                f"Best: {best_reward:8.1f} | "
                f"Steps: {agent.total_steps:8d} | "
                f"Speed: {eps_per_sec:.1f} ep/s"
            )

    # Save final model and rewards
    agent.save(os.path.join(save_dir, 'final'))
    np.save(os.path.join(save_dir, 'episode_rewards.npy'), np.array(episode_rewards))

    total_time = time.time() - start_time
    print("=" * 70)
    print(f"Training complete in {total_time:.0f}s ({total_time/60:.1f} min)")
    print(f"Final avg reward (last 100): {np.mean(episode_rewards[-100:]):.1f}")
    print(f"Best episode reward: {best_reward:.1f}")
    print(f"Models saved to: {save_dir}/")
    print("=" * 70)

    return episode_rewards


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Train TD3 on CSTR')
    parser.add_argument('--episodes', type=int, default=20000, help='Number of episodes')
    parser.add_argument('--steps', type=int, default=200, help='Steps per episode')
    parser.add_argument('--save-dir', type=str, default='checkpoints', help='Checkpoint dir')
    parser.add_argument('--seed', type=int, default=42, help='Random seed')
    parser.add_argument('--save-interval', type=int, default=1000, help='Checkpoint interval')
    parser.add_argument('--log-interval', type=int, default=100, help='Log interval')
    args = parser.parse_args()

    train(
        num_episodes=args.episodes,
        max_steps=args.steps,
        save_dir=args.save_dir,
        seed=args.seed,
        save_interval=args.save_interval,
        log_interval=args.log_interval
    )

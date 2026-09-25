"""Reinforcement Learning muhiti (Gymnasium).

Agent har bir shamchada maqsadli pozitsiyani tanlaydi: 0 = naqd (flat), 1 = long.
Mukofot = pozitsiya × keyingi shamcha log-daromadi − pozitsiya o'zgarganda komissiya.
Kuzatuv = oxirgi `window` shamchaning xususiyatlari + joriy pozitsiya.

O'qitish (ixtiyoriy, `pip install stable-baselines3`):
    env = CandleTradingEnv(features, close)
    model = train_ppo(env, timesteps=200_000)
"""
from __future__ import annotations

import gymnasium as gym
import numpy as np
import pandas as pd
from gymnasium import spaces


class CandleTradingEnv(gym.Env):
    metadata = {"render_modes": []}

    def __init__(self, features: pd.DataFrame, close: pd.Series, window: int = 16,
                 fee_rate: float = 0.001, episode_length: int | None = 1000):
        super().__init__()
        mask = features.notna().all(axis=1)
        self.X = features[mask].to_numpy(dtype=np.float32)
        self.close = close[mask].to_numpy(dtype=np.float64)
        if len(self.X) <= window + 2:
            raise ValueError("RL muhiti uchun ma'lumot yetarli emas")
        self.window, self.fee = window, fee_rate
        self.episode_length = episode_length
        n_feat = self.X.shape[1]
        self.action_space = spaces.Discrete(2)
        self.observation_space = spaces.Box(-np.inf, np.inf, shape=(window * n_feat + 1,), dtype=np.float32)

    def _obs(self) -> np.ndarray:
        win = self.X[self.t - self.window + 1:self.t + 1].ravel()
        return np.append(win, np.float32(self.position)).astype(np.float32)

    def reset(self, *, seed: int | None = None, options: dict | None = None):
        super().reset(seed=seed)
        last_start = len(self.X) - 2 - (self.episode_length or 0)
        lo = self.window - 1
        self.t = int(self.np_random.integers(lo, max(last_start, lo) + 1)) if self.episode_length else lo
        self.start_t = self.t
        self.position = 0
        self.equity = 1.0
        return self._obs(), {}

    def step(self, action: int):
        action = int(action)
        cost = self.fee if action != self.position else 0.0
        self.position = action
        log_ret = np.log(self.close[self.t + 1] / self.close[self.t])
        reward = self.position * log_ret + np.log(1 - cost)
        self.equity *= float(np.exp(reward))
        self.t += 1
        terminated = self.t >= len(self.X) - 1
        truncated = bool(self.episode_length and self.t - self.start_t >= self.episode_length)
        return self._obs(), float(reward), terminated, truncated, {"equity": self.equity}


def train_ppo(env: CandleTradingEnv, timesteps: int = 200_000, path: str = "models/ppo_candle"):
    from stable_baselines3 import PPO  # ixtiyoriy bog'liqlik

    model = PPO("MlpPolicy", env, verbose=1, n_steps=2048, batch_size=256, gamma=0.99)
    model.learn(total_timesteps=timesteps)
    model.save(path)
    return model

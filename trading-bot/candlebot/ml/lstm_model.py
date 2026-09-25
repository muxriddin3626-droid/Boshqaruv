"""PyTorch LSTM klassifikator (ixtiyoriy, `pip install torch`).

Shamchalar ketma-ketligidan (window × features) keyingi harakat ehtimolini baholaydi.
Gradient Boosting baseline'idan yaxshiroq natija bermasa — ishlatmang (murakkablik ≠ foyda).
"""
from __future__ import annotations

import numpy as np
import pandas as pd


def make_sequences(features: pd.DataFrame, labels: pd.Series, window: int = 32):
    data = features.join(labels.rename("y")).dropna()
    X, y = data.drop(columns="y").to_numpy(np.float32), data["y"].to_numpy(np.float32)
    idx = range(window, len(X) + 1)
    return np.stack([X[i - window:i] for i in idx]), y[window - 1:]


def train_lstm(features: pd.DataFrame, labels: pd.Series, window: int = 32, epochs: int = 10,
               hidden: int = 64, lr: float = 1e-3):
    import torch
    from torch import nn

    class LSTMClassifier(nn.Module):
        def __init__(self, n_features: int):
            super().__init__()
            self.lstm = nn.LSTM(n_features, hidden, num_layers=2, batch_first=True, dropout=0.2)
            self.head = nn.Linear(hidden, 1)

        def forward(self, x):
            out, _ = self.lstm(x)
            return self.head(out[:, -1]).squeeze(-1)  # logit

    X, y = make_sequences(features, labels, window)
    mu, sd = X.reshape(-1, X.shape[-1]).mean(0), X.reshape(-1, X.shape[-1]).std(0) + 1e-8
    X = (X - mu) / sd
    split = int(len(X) * 0.8)  # vaqt bo'yicha bo'lish, aralashtirmasdan
    Xtr, ytr = torch.tensor(X[:split]), torch.tensor(y[:split])
    Xte, yte = torch.tensor(X[split:]), torch.tensor(y[split:])

    model = LSTMClassifier(X.shape[-1])
    opt = torch.optim.Adam(model.parameters(), lr=lr)
    loss_fn = nn.BCEWithLogitsLoss()
    for epoch in range(epochs):
        model.train()
        for i in range(0, len(Xtr), 256):
            opt.zero_grad()
            loss = loss_fn(model(Xtr[i:i + 256]), ytr[i:i + 256])
            loss.backward()
            opt.step()
        model.eval()
        with torch.no_grad():
            acc = ((model(Xte) > 0).float() == yte).float().mean().item()
        print(f"epoch {epoch + 1}: loss={loss.item():.4f} val_acc={acc:.3f}")
    return model, (mu, sd)

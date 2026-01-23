module.exports = {
  apps: [
    {
      name: "backend",
      cwd: "./backend",
      script: "/Users/valarpirai.annadurai/.local/bin/uv",
      args: "run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload",
      env: {
        DATABASE_URL: "sqlite:///./app.db",
        UPLOAD_DIR: "./uploads",
        WORKER_POLL_INTERVAL: "5",
        WORKER_TIMEOUT: "300",
        MAX_FILE_SIZE: "52428800",
      },
    },
    {
      name: "worker",
      cwd: "./backend",
      script: "/Users/valarpirai.annadurai/.local/bin/uv",
      args: "run python worker.py",
      instances: 3,
      env: {
        DATABASE_URL: "sqlite:///./app.db",
        UPLOAD_DIR: "./uploads",
        WORKER_POLL_INTERVAL: "5",
        WORKER_TIMEOUT: "300",
      },
    },
    {
      name: "frontend",
      cwd: "./frontend",
      script: "./node_modules/.bin/vite",
      interpreter: "/Users/valarpirai.annadurai/.nvm/versions/node/v22.22.0/bin/node",
    },
  ],
};

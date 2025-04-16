#!/usr/bin/env python3
import os
import subprocess
import time

def run_ml_model():
    try:
        subprocess.run(["python", "INSERT NAME.py"], check=True)
    except subprocess.CalledProcessError:
        return False
    return True

def check_predictions_file():
    return os.path.exists("DUCK PREDICTIONS.csv")

def git_push():
    try:
        subprocess.run(["git", "add", "DUCK PREDICTION FILE.csv"], check=True)
        commit_message = f"Updated duck predictions {time.strftime('%Y-%m-%d %H:%M:%S')}"
        subprocess.run(["git", "commit", "-m", commit_message], check=True)
        subprocess.run(["git", "push", "origin", "main"], check=True)
    except subprocess.CalledProcessError:
        return False
    return True

def main():
    if not run_ml_model():
        return
    if not check_predictions_file():
        return
    if not git_push():
        return
    print("Deployment complete.")

if __name__ == "__main__":
    main()

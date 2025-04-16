#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status

# insert commands needed to get a suitable Python environment
python insert_name.py
git add "DUCK_PREDICTIONS.csv"
git commit -m "Updated duck predictions, $(date --rfc-3339=seconds)"
git push -u origin main
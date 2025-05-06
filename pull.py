#!/usr/bin/env python3

import os
import time
from datetime import datetime, timedelta
from pathlib import Path

import requests
import pandas as pd
from dateutil.relativedelta import relativedelta


def month_window_for_year(year_offset: int = 0,
                          months_back: int = 1,
                          months_forward: int = 1):
    now_utc = datetime.utcnow()
    monday = now_utc - timedelta(days=now_utc.weekday())
    monday = monday.replace(hour=0, minute=0, second=0, microsecond=0)
    sunday = monday + timedelta(days=6, hours=23, minutes=59, seconds=59)
    monday -= relativedelta(years=year_offset)
    sunday -= relativedelta(years=year_offset)
    start_dt = monday - relativedelta(months=months_back)
    end_dt = sunday + relativedelta(months=months_forward)
    fmt = "%Y%m%d%H%M%S000"
    return start_dt.strftime(fmt), end_dt.strftime(fmt), monday.year

def db_download(study_id: int,
                output_file: Path,
                attributes: str,
                start_ts: str,
                end_ts: str,
                max_retries: int = 3):

    USERNAME = os.getenv("MOVEBANK_USER")
    PASSWORD = os.getenv("MOVEBANK_PASS")

    url = "https://www.movebank.org/movebank/service/direct-read"
    params = {
        "entity_type": "event",
        "study_id": study_id,
        "attributes": attributes,
        "format": "csv",
        "timestamp_start": start_ts,
        "timestamp_end": end_ts,
        "individual_taxon_canonical_name": "Anas platyrhynchos"
    }

    headers = {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/115.0.0.0 Safari/537.36"
        ),
        "Connection": "keep-alive",
    }

    chunk_size = 8192

    for attempt in range(1, max_retries + 1):
        try:
            print(f"[{study_id}] Attempt {attempt}/{max_retries}")
            with requests.get(url,
                              auth=(USERNAME, PASSWORD),
                              params=params,
                              headers=headers,
                              stream=True,
                              timeout=30) as resp:

                if resp.status_code != 200:
                    print("  Error:", resp.status_code)
                    print(resp.text)
                    return None

                total_size = int(resp.headers.get("Content-Length", 0))
                downloaded = 0

                with open(output_file, "wb") as fh:
                    for chunk in resp.iter_content(chunk_size=chunk_size):
                        if chunk:
                            fh.write(chunk)
                            downloaded += len(chunk)
                            if total_size:
                                pct = 100 * downloaded / total_size
                                print(f"    {downloaded/1024:.1f} KB / "
                                      f"{total_size/1024:.1f} KB  ({pct:.1f} %)",
                                      end="\r", flush=True)
                            else:
                                print(f"    {downloaded/1024:.1f} KB",
                                      end="\r", flush=True)

                print(f"\n  Saved {output_file}")
                return output_file

        except requests.exceptions.ChunkedEncodingError:
            pass
        except requests.exceptions.RequestException:
            pass

        if attempt < max_retries:
            print("  Retrying in 5 s …")
            time.sleep(5)

    print("  Download failed after retries")
    return None


if __name__ == "__main__":
    YEARS_BACK = 1

    STUDIES = [
        (2279158388, "mallard_connectivity_data"),
    ]

    ATTRS = (
        "tag_local_identifier,timestamp,"
        "location_long,location_lat,individual_taxon_canonical_name"
    )

    combined_frames = {base: [] for _, base in STUDIES}

    for year_offset in range(YEARS_BACK + 1):
        start_ts, end_ts, anchor_year = month_window_for_year(year_offset)
        print(f"\nWindow {anchor_year}: {start_ts} → {end_ts}")

        for study_id, base_name in STUDIES:
            yearly_file = Path(f"{base_name}_{anchor_year}.csv")
            downloaded = db_download(
                study_id=study_id,
                output_file=yearly_file,
                attributes=ATTRS,
                start_ts=start_ts,
                end_ts=end_ts,
            )

            if downloaded and downloaded.exists():
                df = pd.read_csv(downloaded)
                combined_frames[base_name].append(df)

    for base_name, frames in combined_frames.items():
        if frames:
            combined_df = pd.concat(frames, ignore_index=True)
            combined_path = Path(f"{base_name}_combined.csv")
            combined_df.to_csv(combined_path, index=False)
            print(f"\nCombined file written → {combined_path} "
                  f"({len(combined_df):,} rows)")

            for file in Path().glob(f"{base_name}_*.csv"):
                if file.stem != combined_path.stem:
                    file.unlink()

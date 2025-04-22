import requests
import time
import os
import pandas as pd

def db_download(study_id, output_file, attributes, start_ts=None, end_ts=None):
    USERNAME = "Team7Waterfowl" #Input own user and password as needed
    PASSWORD = "WingWatch007"

    url = "https://www.movebank.org/movebank/service/direct-read"
    params = {
        "entity_type": "event",
        "study_id": study_id,
        "attributes": attributes,
        "format": "csv"
    }
    
    if start_ts: params["timestamp_start"] = start_ts
    if end_ts:   params["timestamp_end"]   = end_ts

    headers = {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/115.0.0.0 Safari/537.36"),
        "Connection": "keep-alive"
    }

    max_retries = 3
    chunk_size = 8192

    for attempt in range(max_retries):
        try:
            print(f"Attempt {attempt+1} of {max_retries}...")
            with requests.get(url, auth=(USERNAME, PASSWORD), params=params,
                            headers=headers, stream=True, timeout=30) as response:
                if response.status_code == 200:
                    total_size = response.headers.get('Content-Length')
                    if total_size is not None:
                        total_size = int(total_size)
                    downloaded_bytes = 0
                    
                    with open(output_file, "wb") as f:
                        for chunk in response.iter_content(chunk_size=chunk_size):
                            if chunk:
                                f.write(chunk)
                                downloaded_bytes += len(chunk)
                                if total_size:
                                    percent = (downloaded_bytes / total_size) * 100
                                    print(f"Downloaded {downloaded_bytes/1024:.1f} KB "
                                        f"of {total_size/1024:.1f} KB ({percent:.1f}%)", end="\r")
                                else:
                                    print(f"Downloaded {downloaded_bytes/1024:.1f} KB", end="\r")
                    print(f"\nCSV file saved as {output_file}")
                    break  
                else:
                    print("Error:", response.status_code)
                    print(response.text)
                    break 
        except requests.exceptions.ChunkedEncodingError as e:
            print("ChunkedEncodingError encountered:", e)
            if attempt < max_retries - 1:
                print("Retrying after a short delay...")
                time.sleep(5)  
            else:
                print("Exceeded maximum retries. Exiting.")
                
        max_retries = 3
        chunk_size = 8192
        
        for attempt in range(max_retries):
            try:
                print(f"Attempt {attempt+1} of {max_retries} for study {study_id}...")
                with requests.get(url, auth=(USERNAME, PASSWORD), params=params,
                                headers=headers, stream=True, timeout=30) as response:
                    if response.status_code == 200:
                        total_size = response.headers.get('Content-Length')
                        if total_size is not None:
                            total_size = int(total_size)
                        downloaded_bytes = 0

                        with open(output_file, "wb") as f:
                            for chunk in response.iter_content(chunk_size=chunk_size):
                                if chunk:
                                    f.write(chunk)
                                    downloaded_bytes += len(chunk)
                                    if total_size:
                                        percent = (downloaded_bytes / total_size) * 100
                                        print(f"Downloaded {downloaded_bytes/1024:.1f} KB "
                                            f"of {total_size/1024:.1f} KB ({percent:.1f}%)", end="\r")
                                    else:
                                        print(f"Downloaded {downloaded_bytes/1024:.1f} KB", end="\r")
                        print(f"\nCSV file saved as {output_file}")
                        break  
                    else:
                        print("Error:", response.status_code)
                        print(response.text)
                        break 
            except requests.exceptions.ChunkedEncodingError as e:
                print("ChunkedEncodingError encountered:", e)
                if attempt < max_retries - 1:
                    print("Retrying after a short delay...")
                    time.sleep(5)
                else:
                    print("Exceeded maximum retries. Exiting.")

# Mallard connectivity database download 
db_download(
    study_id=2279158388,
    output_file="mallard_connectivity_data.csv",
    attributes="tag_local_identifier,timestamp,location_long,location_lat,individual_taxon_canonical_name",
    start_ts = "20240201000000000",
    end_ts = "20240430235959000"

    )

# Mallard Wintering Ecology database download
#db_download(
#    study_id=975374057, 
#    output_file="wintering_ecology_data.csv",
#    attributes="tag_local_identifier,timestamp,location_long,location_lat,individual_taxon_canonical_name",
#)

import requests

URL = "https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson"
DEST = "static/data/world-countries.geojson"

if __name__ == "__main__":
    print(f"Downloading world countries GeoJSON from {URL}...")
    response = requests.get(URL)
    response.raise_for_status()
    with open(DEST, "wb") as f:
        f.write(response.content)
    print(f"Saved to {DEST}")

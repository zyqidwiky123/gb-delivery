import json
import requests
import urllib.parse

API_KEY = "AIzaSyB2urHuowq3a4qzjtRQL1yHlibCNGOX2LU"

def check_status(name, address):
    query = f"{name} {address}"
    url = f"https://maps.googleapis.com/maps/api/place/textsearch/json?query={urllib.parse.quote(query)}&key={API_KEY}"
    try:
        response = requests.get(url).json()
        if response.get('results'):
            result = response['results'][0]
            status = result.get('business_status', 'OPERATIONAL') # default to operational if field missing
            place_id = result.get('place_id')
            return status, place_id
        return 'NOT_FOUND', None
    except Exception as e:
        return f'ERROR: {str(e)}', None

# Check a few samples
samples = [
    {"name": "Warung Mak Ti", "address": "Jl. Mawar, RT.03/RW.03, Nglaos, Jatinom, Kec. Kanigoro, Kota Blitar"},
    {"name": "Lesehan Gandoz", "address": "Jalan Cakraningrat, Sentul, Kepanjenkidul, Sentul, Kec. Kepanjenkidul, Kota Blitar"},
    {"name": "Bromfiets Cafe", "address": "Jl. Raya Dandong No.121, Srengat II, Srengat, Kec. Srengat, Kabupaten Blitar"}
]

for s in samples:
    status, pid = check_status(s['name'], s['address'])
    print(f"Merchant: {s['name']} | Status: {status} | Place ID: {pid}")

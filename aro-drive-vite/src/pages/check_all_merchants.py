import json
import requests
import urllib.parse
import time

API_KEY = "AIzaSyB2urHuowq3a4qzjtRQL1yHlibCNGOX2LU"

def check_status(name, address):
    # Try with name and address
    query = f"{name} {address}"
    url = f"https://maps.googleapis.com/maps/api/place/textsearch/json?query={urllib.parse.quote(query)}&key={API_KEY}"
    try:
        response = requests.get(url).json()
        if response.get('results'):
            result = response['results'][0]
            status = result.get('business_status', 'OPERATIONAL')
            return status, result.get('name')
        return 'NOT_FOUND', None
    except Exception as e:
        return f'ERROR: {str(e)}', None

with open('merchants_list.json', 'r') as f:
    merchants = json.load(f)

results = []
for i, m in enumerate(merchants):
    name = m['name']
    address = m['address']
    doc_id = m['id']
    
    status, maps_name = check_status(name, address)
    results.append({
        'id': doc_id,
        'name': name,
        'status': status,
        'maps_name': maps_name,
        'address': address
    })
    
    if (i + 1) % 10 == 0:
        print(f"Checked {i+1}/{len(merchants)}...")
    
    # Avoid hitting quota too fast if there's a rate limit
    time.sleep(0.1)

with open('merchant_audit_results.json', 'w') as f:
    json.dump(results, f, indent=2)

print("\nAudit Complete. Saved to merchant_audit_results.json")

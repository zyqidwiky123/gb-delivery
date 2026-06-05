import json
with open('merchants_list_clean.json', 'r') as f:
    merchants = json.load(f)
print("\n".join([m['id'] for m in merchants]))

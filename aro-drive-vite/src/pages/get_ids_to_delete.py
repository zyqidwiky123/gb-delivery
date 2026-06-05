import json

with open('merchants_list.json', 'r') as f:
    merchants = json.load(f)

ids_to_delete = []

for m in merchants:
    name = m['name'].lower()
    address = m['address'].lower()
    
    is_outside = True
    if 'blitar' in address or 'malang' in address or 'kediri' in address:
        is_outside = False
        
    if name == 'unknown' or is_outside:
        ids_to_delete.append(m['id'])

print("\n".join(ids_to_delete))

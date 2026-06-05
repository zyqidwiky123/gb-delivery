import json

with open('merchants_list.json', 'r') as f:
    merchants = json.load(f)

unknown_names = []
outside_blitar = []
blitar_merchants = []

for m in merchants:
    address = m['address'].lower()
    name = m['name'].lower()
    
    is_outside = True
    if 'blitar' in address:
        is_outside = False
        
    if name == 'unknown':
        unknown_names.append(m)
    elif is_outside:
        outside_blitar.append(m)
    else:
        blitar_merchants.append(m)

print(f"Unknown Names: {len(unknown_names)}")
print(f"Outside Blitar: {len(outside_blitar)}")
print(f"Blitar Merchants: {len(blitar_merchants)}")

# Sample some unknown names to check
print("\nSample Unknown Names:")
for m in unknown_names[:5]:
    print(f"- {m['id']}: {m['address']}")

# Sample some outside blitar to check
print("\nSample Outside Blitar:")
for m in outside_blitar[:5]:
    print(f"- {m['name']} ({m['id']}): {m['address']}")

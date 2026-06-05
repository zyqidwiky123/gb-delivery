import json

with open('merchant_audit_results.json', 'r') as f:
    results = json.load(f)

stats = {}
closed_merchants = []
not_found_merchants = []

for r in results:
    status = r['status']
    stats[status] = stats.get(status, 0) + 1
    if status == 'CLOSED_PERMANENTLY':
        closed_merchants.append(r)
    elif status == 'NOT_FOUND':
        not_found_merchants.append(r)

print("Status Statistics:")
for status, count in stats.items():
    print(f"- {status}: {count}")

print("\nPermanently Closed Merchants:")
for m in closed_merchants:
    print(f"- {m['name']} ({m['id']}) @ {m['address']}")

# Also identify the 'Unknown' name merchants that were not found
unknown_not_found = [m for m in not_found_merchants if m['name'].lower() == 'unknown']
print(f"\nUnknown Names & Not Found: {len(unknown_not_found)}")

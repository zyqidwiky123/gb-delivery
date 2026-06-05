import json
import re
from collections import Counter

def analyze_merchants():
    # Load the clean list (300 entries)
    with open('aro-drive-vite/src/pages/merchants_list_clean.json', 'r') as f:
        merchants = json.load(f)

    print(f"Total Merchants: {len(merchants)}")

    # 1. Analyze Categories based on Names
    categories = [
        'Bakso', 'Mie', 'Nasi Goreng', 'Sate', 'Ayam', 'Seblak', 
        'Cafe', 'Angkringan', 'Lalapan', 'Pecel', 'Bebek', 'Soto',
        'Cilot', 'Cilok', 'Pentol'
    ]
    
    category_counts = Counter()
    for m in merchants:
        name = m['name'].lower()
        found = False
        for cat in categories:
            if cat.lower() in name:
                category_counts[cat] += 1
                found = True
        if not found:
            category_counts['Lainnya'] += 1

    print("\nTop Categories (by name):")
    for cat, count in category_counts.most_common(10):
        print(f"- {cat}: {count}")

    # 2. Analyze Location (Kecamatan)
    # Address format usually ends with "... Kec. [Kecamatan], Kota/Kabupaten Blitar ..."
    kec_pattern = r'Kec\.\s+([^,]+)'
    kec_counts = Counter()
    for m in merchants:
        match = re.search(kec_pattern, m['address'])
        if match:
            kec_counts[match.group(1).strip()] += 1
        else:
            kec_counts['Unknown'] += 1

    print("\nMerchant Distribution by Kecamatan:")
    for kec, count in kec_counts.most_common(10):
        print(f"- {kec}: {count}")

    # 3. Analyze Audit Status (from merchant_audit_results.json)
    try:
        with open('aro-drive-vite/src/pages/merchant_audit_results.json', 'r') as f:
            audit_results = json.load(f)
        
        status_counts = Counter(item.get('status', 'Unknown') for item in audit_results)
        print("\nAudit Status:")
        for status, count in status_counts.items():
            print(f"- {status}: {count}")
    except FileNotFoundError:
        print("\nAudit results file not found.")

if __name__ == "__main__":
    analyze_merchants()

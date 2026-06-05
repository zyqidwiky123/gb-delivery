import json

with open('merchants_list_clean.json', 'r') as f:
    merchants = json.load(f)

with open('merchant_review_list.md', 'w') as f:
    f.write("# Daftar Merchant ARO Food (300 Tersisa)\n\n")
    f.write("Silakan tinjau daftar di bawah ini. Jika ada yang sudah tutup permanen, beri tahu saya agar bisa saya hapus.\n\n")
    f.write("| No | Nama Merchant | Alamat | ID Firestore |\n")
    f.write("|---|---------------|--------|--------------|\n")
    for i, m in enumerate(merchants):
        f.write(f"| {i+1} | {m['name']} | {m['address']} | `{m['id']}` |\n")


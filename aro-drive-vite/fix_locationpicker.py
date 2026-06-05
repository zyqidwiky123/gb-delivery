import re

with open('/home/marco/ARO-DRIVE/aro-drive-vite/src/pages/LocationPicker.jsx', 'r') as f:
    content = f.read()

# Fix useMemo import
content = content.replace(
    "import React, { useState, useEffect, useRef, useCallback } from 'react';",
    "import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';"
)

# Fix white colors in the search overlay so it works in light mode
content = re.sub(r'bg-white/([0-9]+)', r'bg-surface-container', content)
content = re.sub(r'border-white/([0-9]+)', r'border-outline', content)
content = re.sub(r'text-white/([0-9]+)', r'text-on-surface-variant opacity-\1', content)
content = content.replace('text-white', 'text-on-surface')

# Fix placeholder
content = content.replace('placeholder:text-on-surface-variant opacity-20', 'placeholder:text-on-surface-variant placeholder:opacity-50')
content = content.replace('placeholder:text-white/20', 'placeholder:text-on-surface-variant placeholder:opacity-50')

with open('/home/marco/ARO-DRIVE/aro-drive-vite/src/pages/LocationPicker.jsx', 'w') as f:
    f.write(content)


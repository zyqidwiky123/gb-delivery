const sanitizeOrderData = (data) => {
  if (data === null) return null;
  if (data === undefined) return undefined; 
  if (data && typeof data === 'object' && data.constructor?.name === 'FieldValue') return data;
  if (Array.isArray(data)) return data.map(v => sanitizeOrderData(v)).filter(v => v !== undefined);
  if (typeof data === 'object') {
    const sanitized = {};
    Object.keys(data).forEach(key => {
      const value = sanitizeOrderData(data[key]);
      if (value !== undefined) {
        sanitized[key] = value;
      }
    });
    return sanitized;
  }
  if (typeof data === 'number' && isNaN(data)) return 0;
  return data;
};

const basePayload = { name: "test", loc: undefined, arr: [1, undefined, null, NaN, { a: undefined }] };
console.log(JSON.stringify(sanitizeOrderData(basePayload)));

const fs = require('fs');
const crypto = require('crypto');

// 1. Read the TS file content
const content = fs.readFileSync('src/data/services.ts', 'utf-8');

// 2. Extract the services array string
const arrayMatch = content.match(/export const services: LocalService\[\] = \[([\s\S]*?)\];/);
if (!arrayMatch) {
    console.error('Could not find array');
    process.exit(1);
}

const arrayStr = arrayMatch[1];
const rows = arrayStr.split('\n').map(l => l.trim()).filter(l => l.startsWith('{'));

// 3. Parse each row manually without eval or imports
const services = rows.map(r => {
    const idMatch = r.match(/id:\s*["']([^"']+)["']/);
    const nameMatch = r.match(/name:\s*["']([^"']+)["']/);
    const catMatch = r.match(/category:\s*["']([^"']+)["']/);
    const priceMatch = r.match(/base_price:\s*(\d+)/);
    const customMatch = r.match(/is_custom_price:\s*(true|false)/);
    const activeMatch = r.match(/is_active:\s*(true|false)/);

    if (!idMatch) return null;

    return {
        id: idMatch[1],
        name: nameMatch[1],
        category: catMatch[1],
        base_price: parseInt(priceMatch[1]),
        is_custom_price: customMatch[1] === 'true',
        is_active: activeMatch[1] === 'true',
        uuid: crypto.randomUUID()
    };
}).filter(Boolean);

// 4. Generate the SQL script
let sql = `-- Migration Script: Update Services Pricing

-- 1. Insert new services with UUIDs
INSERT INTO "public"."services" ("id", "name", "category", "base_price", "is_custom_price", "is_active")
VALUES
`;

const values = services.map((s, index) => {
    const isLast = index === services.length - 1;
    const nameEscaped = s.name.replace(/'/g, "''");
    return `('${s.uuid}', '${nameEscaped}', '${s.category}', ${s.base_price}, ${s.is_custom_price}, true)${isLast ? ';' : ','}`;
});

sql += values.join('\n');

sql += `

-- 2. Disable old services
UPDATE "public"."services"
SET is_active = false
WHERE id NOT IN (
  ${services.map(s => `'${s.uuid}'`).join(',\n  ')}
);
`;

fs.writeFileSync('update_services_uuid.sql', sql);

// 5. Update the TS frontend file
let servicesTsContent = content;
services.forEach(s => {
    servicesTsContent = servicesTsContent.replace(`id: "${s.id}"`, `id: "${s.uuid}"`);
});

fs.writeFileSync('src/data/services.ts', servicesTsContent);
console.log('Successfully generated update_services_uuid.sql and updated src/data/services.ts');

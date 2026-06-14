import crypto from 'crypto';
import fs from 'fs';
import { services } from './src/data/services.js';

// Generate UUIDs for each service
const updatedServices = services.map(s => {
    return {
        ...s,
        uuid: crypto.randomUUID()
    };
});

let sql = `-- Migration Script: Update Services Pricing

-- 1. Insert new services with UUIDs
INSERT INTO "public"."services" ("id", "name", "category", "base_price", "is_custom_price", "is_active")
VALUES
`;

const values = updatedServices.map((s, index) => {
    const isLast = index === updatedServices.length - 1;
    const name = s.name.replace(/'/g, "''"); // escape single quotes
    return `('${s.uuid}', '${name}', '${s.category}', ${s.base_price}, ${s.is_custom_price}, ${s.is_active})${isLast ? ';' : ','}`;
});

sql += values.join('\n');

sql += `

-- 2. Disable old services
-- Setting is_active = false for all services that are NOT in the list we just inserted.
UPDATE "public"."services"
SET is_active = false
WHERE id NOT IN (
  ${updatedServices.map(s => `'${s.uuid}'`).join(',\n  ')}
);
`;

fs.writeFileSync('update_services_uuid.sql', sql);
console.log('Created update_services_uuid.sql');

// Also update the local services.ts to use these new UUIDs so UI matches DB!
let servicesTsContent = fs.readFileSync('src/data/services.ts', 'utf-8');

updatedServices.forEach(s => {
    // Replace the old ID (like "ch-1") with the new UUID in the file
    servicesTsContent = servicesTsContent.replace(`id: "${s.id}"`, `id: "${s.uuid}"`);
});

fs.writeFileSync('src/data/services.ts', servicesTsContent);
console.log('Updated src/data/services.ts with new UUIDs');


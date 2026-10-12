import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

// Simple fallback .env loader in case --env-file was not provided
if (!process.env.DATABASE_URL) {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const idx = trimmed.indexOf('=');
          const key = trimmed.substring(0, idx).trim();
          let val = trimmed.substring(idx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      });
    }
  } catch (err) {
    // ignore
  }
}

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./dev.db';
}

const prisma = new PrismaClient();

async function main() {
  console.log('--- Seeding Database for Collections Exporter ---');

  const adminUsername = (process.env.ADMIN_USERNAME || 'admin').trim();
  const adminPassword = (process.env.ADMIN_PASSWORD || 'admin12345').trim();
  const adminDisplayName = (process.env.ADMIN_DISPLAY_NAME || 'System Administrator').trim();

  console.log(`Upserting admin account "${adminUsername}"...`);
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const adminUser = await prisma.user.upsert({
    where: { username: adminUsername },
    update: {
      displayName: adminDisplayName,
      passwordHash,
      role: 'admin',
      status: 'active',
      failedLoginAttempts: 0,
      lockedUntil: null
    },
    create: {
      username: adminUsername,
      displayName: adminDisplayName,
      passwordHash,
      role: 'admin',
      status: 'active'
    }
  });

  console.log(`Admin user "${adminUser.username}" ready (Role: ${adminUser.role}, Status: ${adminUser.status}).`);

  // Also upsert demo client user for client testing
  const demoUsername = (process.env.CLIENT_USERNAME || 'client_101').trim();
  const demoPassword = (process.env.CLIENT_PASSWORD || 'client12345').trim();
  const clientPassHash = await bcrypt.hash(demoPassword, 10);

  const clientUser = await prisma.user.upsert({
    where: { username: demoUsername },
    update: {
      role: 'user',
      status: 'active'
    },
    create: {
      username: demoUsername,
      displayName: 'Demo Store Client',
      passwordHash: clientPassHash,
      role: 'user',
      status: 'active'
    }
  });

  console.log(`Client user "${clientUser.username}" ready (Role: ${clientUser.role}, Status: ${clientUser.status}).`);
  console.log('Seeding finished successfully.');
}

main()
  .catch((e) => {
    console.error('Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

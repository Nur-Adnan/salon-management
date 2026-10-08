import { MongoClient, ObjectId } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/salon?replicaSet=rs0&directConnection=true';

async function seed() {
  console.log('Connecting to MongoDB at', MONGODB_URI);
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db();

  console.log('Clearing existing collections...');
  const collections = await db.listCollections().toArray();
  for (const c of collections) {
    if (!c.name.startsWith('system.')) {
      await db.collection(c.name).deleteMany({});
    }
  }

  console.log('Seeding Organization...');
  const tenantId = new ObjectId('660000000000000000000001');
  await db.collection('organizations').insertOne({
    _id: tenantId,
    name: 'Luxe Salon & Spa',
    slug: 'luxe-salon',
    timezone: 'Asia/Dhaka',
    settings: {
      locales: ['en', 'bn'],
      defaultLocale: 'en',
      currency: 'BDT',
    },
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.log('Seeding Branches...');
  const branch1Id = new ObjectId('660000000000000000000010');
  const branch2Id = new ObjectId('660000000000000000000011');
  const defaultWorkingHours = Array.from({ length: 7 }, () => ({
    closed: false,
    open: '09:00',
    close: '21:00',
  }));

  await db.collection('branches').insertMany([
    {
      _id: branch1Id,
      tenantId,
      name: 'Gulshan Avenue',
      timezone: 'Asia/Dhaka',
      address: 'Road 11, Block D, Gulshan 1, Dhaka',
      status: 'active',
      slotMinutes: 15,
      workingHours: defaultWorkingHours,
      vatRateBps: 1500,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: branch2Id,
      tenantId,
      name: 'Dhanmondi Branch',
      timezone: 'Asia/Dhaka',
      address: 'Satmasjid Road, Dhanmondi, Dhaka',
      status: 'active',
      slotMinutes: 15,
      workingHours: defaultWorkingHours,
      vatRateBps: 1500,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  console.log('Seeding Users & Memberships...');
  const ownerId = new ObjectId('660000000000000000000020');
  const stylist1Id = new ObjectId('660000000000000000000021');
  const stylist2Id = new ObjectId('660000000000000000000022');

  await db.collection('users').insertMany([
    {
      _id: ownerId,
      supabaseUserId: 'supa-owner-id',
      email: 'owner@luxe.com',
      status: 'active',
      profile: { name: 'Sophia Ahmed' },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: stylist1Id,
      supabaseUserId: 'supa-stylist-1',
      email: 'sarah@luxe.com',
      status: 'active',
      profile: { name: 'Sarah Khan' },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: stylist2Id,
      supabaseUserId: 'supa-stylist-2',
      email: 'rahim@luxe.com',
      status: 'active',
      profile: { name: 'Rahim Chowdhury' },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  await db.collection('memberships').insertMany([
    {
      tenantId,
      branchId: null,
      userId: ownerId,
      role: 'owner',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      tenantId,
      branchId: branch1Id,
      userId: stylist1Id,
      role: 'stylist',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      tenantId,
      branchId: branch1Id,
      userId: stylist2Id,
      role: 'stylist',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  console.log('Seeding Staff Working Hours...');
  const allWeekSchedule = Array.from({ length: 7 }, () => ({
    working: true,
    start: '09:00',
    end: '18:00',
    breaks: [{ start: '13:00', end: '14:00' }],
  }));

  await db.collection('staff_working_hours').insertMany([
    {
      tenantId,
      branchId: branch1Id,
      staffId: stylist1Id,
      weeklySchedule: allWeekSchedule,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      tenantId,
      branchId: branch1Id,
      staffId: stylist2Id,
      weeklySchedule: allWeekSchedule,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  console.log('Seeding Resources...');
  await db.collection('resources').insertMany([
    {
      _id: new ObjectId(),
      tenantId,
      branchId: branch1Id,
      name: 'Styling Chair 1',
      type: 'chair',
      capacity: 1,
      bookable: true,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: new ObjectId(),
      tenantId,
      branchId: branch1Id,
      name: 'Facial Suite 1',
      type: 'room',
      capacity: 1,
      bookable: true,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  console.log('Seeding Service Categories & Services...');
  const catHairId = new ObjectId('660000000000000000000030');
  const catSkinId = new ObjectId('660000000000000000000031');

  await db.collection('service_categories').insertMany([
    {
      _id: catHairId,
      tenantId,
      name: { en: 'Hair Care & Styling', bn: 'হেয়ার কেয়ার' },
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: catSkinId,
      tenantId,
      name: { en: 'Skin & Facial Therapy', bn: 'স্কিন কেয়ার' },
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  const svc1Id = new ObjectId('660000000000000000000040');
  const svc2Id = new ObjectId('660000000000000000000041');
  const svc3Id = new ObjectId('660000000000000000000042');

  await db.collection('services').insertMany([
    {
      _id: svc1Id,
      tenantId,
      categoryId: catHairId,
      name: { en: 'Executive Haircut & Styling', bn: 'এক্সিকিউটিভ হেয়ারকাট' },
      durationMin: 45,
      bufferBeforeMin: 0,
      bufferAfterMin: 15,
      price: { amount: 150000, currency: 'BDT' }, // 1,500 BDT
      taxable: true,
      eligibleResourceTypes: ['chair'],
      eligibleStaffIds: [stylist1Id, stylist2Id],
      active: true,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: svc2Id,
      tenantId,
      categoryId: catSkinId,
      name: { en: 'Hydra Glow Deep Facial', bn: 'হাইড্রা গ্লো ফেসিয়াল' },
      durationMin: 60,
      bufferBeforeMin: 0,
      bufferAfterMin: 15,
      price: { amount: 350000, currency: 'BDT' }, // 3,500 BDT
      taxable: true,
      eligibleResourceTypes: ['room'],
      eligibleStaffIds: [stylist1Id],
      active: true,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: svc3Id,
      tenantId,
      categoryId: catHairId,
      name: { en: 'Keratin Smoothing Treatment', bn: 'কেরাটিন ট্রিটমেন্ট' },
      durationMin: 90,
      bufferBeforeMin: 0,
      bufferAfterMin: 15,
      price: { amount: 800000, currency: 'BDT' }, // 8,000 BDT
      taxable: true,
      eligibleResourceTypes: ['chair'],
      eligibleStaffIds: [stylist2Id],
      active: true,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  console.log('Seeding Customers...');
  const cust1Id = new ObjectId('660000000000000000000050');
  const cust2Id = new ObjectId('660000000000000000000051');

  await db.collection('customers').insertMany([
    {
      _id: cust1Id,
      tenantId,
      name: 'Farhana Yasmin',
      phone: '+8801711122233',
      email: 'farhana@example.com',
      locale: 'en',
      marketingOptOut: false,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: cust2Id,
      tenantId,
      name: 'Tanvir Hossain',
      phone: '+8801811122233',
      email: 'tanvir@example.com',
      locale: 'en',
      marketingOptOut: false,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  console.log('Seeding Appointments...');
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86400000);
  tomorrow.setHours(14, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrow.getTime() + 45 * 60000);

  const pastApptDate = new Date(now.getTime() - 7 * 86400000);
  pastApptDate.setHours(11, 0, 0, 0);
  const pastApptEnd = new Date(pastApptDate.getTime() + 45 * 60000);

  await db.collection('appointments').insertMany([
    {
      _id: new ObjectId('660000000000000000000060'),
      tenantId,
      branchId: branch1Id,
      customerId: cust1Id,
      status: 'confirmed',
      source: 'online',
      depositAmount: { amount: 50000, currency: 'BDT' },
      lines: [
        {
          serviceId: svc1Id,
          staffId: stylist1Id,
          resourceId: null,
          start: tomorrow,
          end: tomorrowEnd,
        },
      ],
      notes: 'Customer requested gentle shampoo',
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: new ObjectId('660000000000000000000061'),
      tenantId,
      branchId: branch1Id,
      customerId: cust1Id,
      status: 'completed',
      source: 'online',
      depositAmount: { amount: 0, currency: 'BDT' },
      lines: [
        {
          serviceId: svc2Id,
          staffId: stylist1Id,
          resourceId: null,
          start: pastApptDate,
          end: pastApptEnd,
        },
      ],
      notes: 'First time facial',
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  console.log('Seeding Loyalty & Gift Cards...');
  await db.collection('loyalty_accounts').insertOne({
    tenantId,
    customerId: cust1Id,
    points: 450,
    tier: 'Gold',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.collection('loyalty_ledger_entries').insertOne({
    tenantId,
    customerId: cust1Id,
    delta: 450,
    balanceAfter: 450,
    reason: 'Welcome bonus & service purchase',
    createdAt: new Date(),
  });

  await db.collection('gift_cards').insertOne({
    _id: new ObjectId(),
    tenantId,
    customerId: cust1Id,
    code: 'LUXE-GIFT-5000',
    initialBalance: { amount: 500000, currency: 'BDT' },
    balance: { amount: 350000, currency: 'BDT' }, // 3,500 BDT remaining
    status: 'active',
    expiresAt: new Date(now.getTime() + 180 * 86400000),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.log('Seeding Subscriptions & Coupons...');
  const planId = new ObjectId('660000000000000000000070');
  await db.collection('subscription_plans').insertOne({
    _id: planId,
    tenantId,
    name: 'VIP Beauty Club (Monthly)',
    price: { amount: 499900, currency: 'BDT' },
    billingCycle: 'monthly',
    benefits: ['1 Free Haircut per month', '20% off all spa treatments', 'Priority booking'],
    active: true,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.collection('customer_subscriptions').insertOne({
    tenantId,
    customerId: cust1Id,
    planId,
    status: 'active',
    currentPeriodEnd: new Date(now.getTime() + 25 * 86400000),
    paymentToken: 'tok_bkash_sub_12345',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.collection('coupons').insertMany([
    {
      _id: new ObjectId(),
      tenantId,
      code: 'WELCOME20',
      discountType: 'percentage',
      discountValue: 20,
      active: true,
      minSpendMinor: 100000,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: new ObjectId(),
      tenantId,
      code: 'LUXESPA500',
      discountType: 'fixed',
      discountValue: 50000,
      active: true,
      minSpendMinor: 250000,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  console.log('Seeding Products & Inventory...');
  const prodId = new ObjectId('660000000000000000000080');
  await db.collection('products').insertOne({
    _id: prodId,
    tenantId,
    name: { en: "L'Oréal Keratin Shampoo 500ml", bn: 'কেরাটিন শ্যাম্পু' },
    sku: 'LOR-SHP-500',
    barcode: '8901234567890',
    price: { amount: 220000, currency: 'BDT' }, // 2,200 BDT
    costPrice: { amount: 140000, currency: 'BDT' },
    active: true,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.collection('stock_levels').insertOne({
    tenantId,
    branchId: branch1Id,
    productId: prodId,
    qtyOnHand: 45,
    minQty: 10,
    batches: [
      {
        batchNumber: 'LOT-2026A',
        qtyOnHand: 45,
        expiryDate: new Date('2027-12-31'),
        costPriceMinor: 140000,
      },
    ],
    updatedAt: new Date(),
  });

  console.log('Seeding Completed Sales for POS & Reports...');
  await db.collection('sales').insertOne({
    _id: new ObjectId('660000000000000000000090'),
    tenantId,
    branchId: branch1Id,
    invoiceNumber: 'INV-2026-0001',
    customerId: cust1Id,
    status: 'completed',
    lines: [
      {
        lineType: 'service',
        serviceId: svc1Id,
        staffId: stylist1Id,
        name: 'Executive Haircut & Styling',
        quantity: 1,
        unitPrice: { amount: 150000, currency: 'BDT' },
        lineTotal: { amount: 150000, currency: 'BDT' },
        tax: { amount: 22500, currency: 'BDT' },
      },
      {
        lineType: 'product',
        productId: prodId,
        name: "L'Oréal Keratin Shampoo 500ml",
        quantity: 1,
        unitPrice: { amount: 220000, currency: 'BDT' },
        lineTotal: { amount: 220000, currency: 'BDT' },
        tax: { amount: 33000, currency: 'BDT' },
      },
    ],
    subtotal: { amount: 370000, currency: 'BDT' },
    taxTotal: { amount: 55500, currency: 'BDT' },
    discountTotal: { amount: 0, currency: 'BDT' },
    tipTotal: { amount: 20000, currency: 'BDT' },
    total: { amount: 445500, currency: 'BDT' }, // 4,455 BDT
    payments: [
      {
        method: 'card',
        amount: { amount: 445500, currency: 'BDT' },
        reference: 'TXN-CARD-9912',
      },
    ],
    createdAt: new Date(now.getTime() - 2 * 3600000),
    updatedAt: new Date(now.getTime() - 2 * 3600000),
  });

  console.log('Seeding Daily Rollup for Analytics...');
  const todayKey = now.toISOString().slice(0, 10);
  await db.collection('daily_rollups').insertOne({
    tenantId,
    branchId: branch1Id,
    dateKey: todayKey,
    grossSalesMinor: 445500,
    netSalesMinor: 370000,
    taxMinor: 55500,
    discountMinor: 0,
    tipMinor: 20000,
    completedAppointments: 3,
    cancelledAppointments: 0,
    totalBookings: 4,
    updatedAt: new Date(),
  });

  console.log('✅ Seed completed successfully!');
  await client.close();
}

seed().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});

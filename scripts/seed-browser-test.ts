import mongoose, { Types } from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/salon?replicaSet=rs0&directConnection=true';

async function seed() {
  console.log('Connecting to MongoDB at:', MONGODB_URI);
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db!;

  console.log('Clearing existing test data...');
  const collections = await db.listCollections().toArray();
  for (const c of collections) {
    if (!c.name.startsWith('system.')) {
      await db.collection(c.name).deleteMany({});
    }
  }

  console.log('Seeding Organization & Branches...');
  const tenantId = new Types.ObjectId();
  const dhanmondiBranchId = new Types.ObjectId();
  const gulshanBranchId = new Types.ObjectId();

  await db.collection('organizations').insertOne({
    _id: tenantId,
    name: 'Bloom Salon & Spa',
    slug: 'bloom',
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

  const defaultHours = Array.from({ length: 7 }, () => ({
    closed: false,
    open: '09:00',
    close: '21:00',
  }));

  await db.collection('branches').insertMany([
    {
      _id: dhanmondiBranchId,
      tenantId,
      name: 'Dhanmondi Flagship',
      timezone: 'Asia/Dhaka',
      address: 'House 42, Road 9/A, Dhanmondi, Dhaka',
      status: 'active',
      slotMinutes: 15,
      workingHours: defaultHours,
      vatRateBps: 500, // 5%
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: gulshanBranchId,
      tenantId,
      name: 'Gulshan Branch',
      timezone: 'Asia/Dhaka',
      address: 'Plot 12, Road 113, Gulshan-2, Dhaka',
      status: 'active',
      slotMinutes: 15,
      workingHours: defaultHours,
      vatRateBps: 500,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  console.log('Seeding Users & Memberships...');
  const ownerUserId = new Types.ObjectId();
  const managerUserId = new Types.ObjectId();
  const stylist1UserId = new Types.ObjectId();
  const stylist2UserId = new Types.ObjectId();
  const receptionUserId = new Types.ObjectId();

  await db.collection('users').insertMany([
    {
      _id: ownerUserId,
      email: 'owner@bloom.test',
      supabaseUserId: 'user-owner-1',
      status: 'active',
      profile: { name: 'Farhana Ahmed' },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: managerUserId,
      email: 'manager@bloom.test',
      supabaseUserId: 'user-manager-1',
      status: 'active',
      profile: { name: 'Kazi Tanvir' },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: stylist1UserId,
      email: 'rahim@bloom.test',
      supabaseUserId: 'user-stylist-1',
      status: 'active',
      profile: { name: 'Rahim Stylist' },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: stylist2UserId,
      email: 'fatima@bloom.test',
      supabaseUserId: 'user-stylist-2',
      status: 'active',
      profile: { name: 'Fatima Begum' },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: receptionUserId,
      email: 'reception@bloom.test',
      supabaseUserId: 'user-reception-1',
      status: 'active',
      profile: { name: 'Sadia Reception' },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  await db.collection('memberships').insertMany([
    {
      tenantId,
      branchId: null, // Org-wide owner
      userId: ownerUserId,
      role: 'owner',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      tenantId,
      branchId: dhanmondiBranchId,
      userId: managerUserId,
      role: 'manager',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      tenantId,
      branchId: dhanmondiBranchId,
      userId: stylist1UserId,
      role: 'stylist',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      tenantId,
      branchId: dhanmondiBranchId,
      userId: stylist2UserId,
      role: 'stylist',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      tenantId,
      branchId: dhanmondiBranchId,
      userId: receptionUserId,
      role: 'receptionist',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  console.log('Seeding Staff Compensation...');
  await db.collection('staff_compensation').insertMany([
    {
      tenantId,
      userId: stylist1UserId,
      commissionRateBps: 1500, // 15%
      baseSalaryMinor: 2500000, // 25,000 BDT
      hourlyRateMinor: 15000, // 150 BDT
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      tenantId,
      userId: stylist2UserId,
      commissionRateBps: 1200, // 12%
      baseSalaryMinor: 2000000,
      hourlyRateMinor: 12000,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  console.log('Seeding Staff Shifts (Sunday to Saturday)...');
  const shiftDocs = [];
  for (let day = 0; day < 7; day++) {
    shiftDocs.push(
      {
        tenantId,
        branchId: dhanmondiBranchId,
        staffId: stylist1UserId,
        dayOfWeek: day,
        open: '10:00',
        close: '19:00',
        breaks: [{ start: '13:00', end: '14:00', description: 'Lunch' }],
        isOff: day === 5, // Friday off
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        tenantId,
        branchId: dhanmondiBranchId,
        staffId: stylist2UserId,
        dayOfWeek: day,
        open: '11:00',
        close: '20:00',
        breaks: [{ start: '14:00', end: '15:00', description: 'Lunch' }],
        isOff: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    );
  }
  await db.collection('staff_shifts').insertMany(shiftDocs);

  console.log('Seeding Resources...');
  const chair1Id = new Types.ObjectId();
  const chair2Id = new Types.ObjectId();
  const facialRoomId = new Types.ObjectId();

  await db.collection('resources').insertMany([
    {
      _id: chair1Id,
      tenantId,
      branchId: dhanmondiBranchId,
      name: 'Styling Chair 1',
      type: 'chair',
      capacity: 1,
      bookable: true,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: chair2Id,
      tenantId,
      branchId: dhanmondiBranchId,
      name: 'Styling Chair 2',
      type: 'chair',
      capacity: 1,
      bookable: true,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: facialRoomId,
      tenantId,
      branchId: dhanmondiBranchId,
      name: 'VIP Facial & Spa Room',
      type: 'room',
      capacity: 1,
      bookable: true,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  console.log('Seeding Services...');
  const svcHaircutId = new Types.ObjectId();
  const svcFacialId = new Types.ObjectId();
  const svcMassageId = new Types.ObjectId();
  const svcManiPediId = new Types.ObjectId();

  await db.collection('services').insertMany([
    {
      _id: svcHaircutId,
      tenantId,
      name: { en: 'Signature Haircut & Blowdry', bn: 'হেয়ারকাট ও ব্লোড্রাই' },
      description: { en: 'Consultation, wash, cut and professional styling', bn: null },
      category: 'hair',
      durationMin: 45,
      bufferBeforeMin: 0,
      bufferAfterMin: 15,
      price: { amount: 120000, currency: 'BDT' }, // 1,200 BDT
      pricingType: 'fixed',
      active: true,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: svcFacialId,
      tenantId,
      name: { en: 'Organic Deluxe Glow Facial', bn: 'ডিলাক্স গ্লো ফেসিয়াল' },
      description: { en: 'Deep pore cleansing, exfoliation, hydration mask', bn: null },
      category: 'skin',
      durationMin: 60,
      bufferBeforeMin: 0,
      bufferAfterMin: 15,
      price: { amount: 350000, currency: 'BDT' }, // 3,500 BDT
      pricingType: 'fixed',
      active: true,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: svcMassageId,
      tenantId,
      name: { en: 'Aromatherapy Swedish Massage', bn: 'সুইডিশ ম্যাসাজ' },
      description: { en: 'Full body relaxing essential oils massage', bn: null },
      category: 'spa',
      durationMin: 90,
      bufferBeforeMin: 10,
      bufferAfterMin: 20,
      price: { amount: 450000, currency: 'BDT' }, // 4,500 BDT
      pricingType: 'fixed',
      active: true,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: svcManiPediId,
      tenantId,
      name: { en: 'Spa Manicure & Pedicure Combo', bn: 'ম্যানিকিউর ও পেডিকিউর' },
      description: { en: 'Nail shaping, cuticle care, scrub, polish', bn: null },
      category: 'nails',
      durationMin: 60,
      bufferBeforeMin: 0,
      bufferAfterMin: 15,
      price: { amount: 200000, currency: 'BDT' }, // 2,000 BDT
      pricingType: 'fixed',
      active: true,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  console.log('Seeding Products...');
  const prodOilId = new Types.ObjectId();
  const prodShampooId = new Types.ObjectId();
  const prodCleanserId = new Types.ObjectId();

  await db.collection('products').insertMany([
    {
      _id: prodOilId,
      tenantId,
      name: { en: 'Moroccan Argan Hair Serum 100ml', bn: 'মরোক্কান আর্গান হেয়ার সিরাম' },
      sku: 'OIL-ARG-001',
      barcode: '8901234567890',
      category: 'haircare',
      retailPrice: { amount: 250000, currency: 'BDT' }, // 2,500 BDT
      costPrice: { amount: 140000, currency: 'BDT' }, // 1,400 BDT
      trackInventory: true,
      active: true,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: prodShampooId,
      tenantId,
      name: { en: 'Organic Keratin Shampoo 500ml', bn: 'অর্গানিক কেরাটিন শ্যাম্পু' },
      sku: 'SHP-KER-001',
      barcode: '8901234567891',
      category: 'haircare',
      retailPrice: { amount: 180000, currency: 'BDT' }, // 1,800 BDT
      costPrice: { amount: 95000, currency: 'BDT' }, // 950 BDT
      trackInventory: true,
      active: true,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: prodCleanserId,
      tenantId,
      name: { en: 'Gentle Foaming Cleanser 200ml', bn: 'ফোমিং ক্লিনজার' },
      sku: 'CLN-GNT-001',
      barcode: '8901234567892',
      category: 'skincare',
      retailPrice: { amount: 150000, currency: 'BDT' }, // 1,500 BDT
      costPrice: { amount: 80000, currency: 'BDT' }, // 800 BDT
      trackInventory: true,
      active: true,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  console.log('Seeding Stock Levels...');
  await db.collection('stock_levels').insertMany([
    {
      tenantId,
      branchId: dhanmondiBranchId,
      productId: prodOilId,
      onHand: 42,
      reserved: 0,
      available: 42,
      reorderPoint: 10,
      batchNumber: 'LOT-2026-01',
      expiryDate: new Date('2027-12-31'),
      costPriceMinor: 140000,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      tenantId,
      branchId: dhanmondiBranchId,
      productId: prodShampooId,
      onHand: 28,
      reserved: 0,
      available: 28,
      reorderPoint: 8,
      batchNumber: 'LOT-2026-02',
      expiryDate: new Date('2028-06-30'),
      costPriceMinor: 95000,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      tenantId,
      branchId: dhanmondiBranchId,
      productId: prodCleanserId,
      onHand: 15,
      reserved: 0,
      available: 15,
      reorderPoint: 5,
      batchNumber: 'LOT-2026-03',
      expiryDate: new Date('2027-08-31'),
      costPriceMinor: 80000,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  console.log('Seeding Packages...');
  await db.collection('packages').insertOne({
    tenantId,
    name: { en: 'Bridal Glow All-In-One Package', bn: 'ব্রাইডাল গ্লো প্যাকেজ' },
    description: { en: 'Haircut + Deluxe Facial + Mani/Pedi', bn: null },
    serviceIds: [svcHaircutId, svcFacialId, svcManiPediId],
    price: { amount: 550000, currency: 'BDT' }, // 5,500 BDT (discounted from 6,700)
    active: true,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.log('Seeding Suppliers & Purchase Orders...');
  const supplierId = new Types.ObjectId();
  await db.collection('suppliers').insertOne({
    _id: supplierId,
    tenantId,
    name: 'Apex Beauty Imports Ltd',
    contactName: 'Kamal Hossain',
    phone: '+8801715000111',
    email: 'orders@apexbeauty.test',
    address: 'Tejgaon I/A, Dhaka',
    active: true,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.collection('purchase_orders').insertOne({
    tenantId,
    branchId: dhanmondiBranchId,
    supplierId,
    orderNumber: 'PO-2026-001',
    status: 'received',
    items: [
      {
        productId: prodOilId,
        quantityOrdered: 50,
        quantityReceived: 50,
        unitCostMinor: 140000,
        batchNumber: 'LOT-2026-01',
      },
    ],
    totalMinor: 7000000,
    expectedDeliveryDate: new Date(),
    receivedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.log('Seeding Customers...');
  const custNusratId = new Types.ObjectId();
  const custTanvirId = new Types.ObjectId();
  const custAyeshaId = new Types.ObjectId();

  await db.collection('customers').insertMany([
    {
      _id: custNusratId,
      tenantId,
      firstName: 'Nusrat',
      lastName: 'Jahan',
      phone: '+8801711000001',
      email: 'nusrat@example.com',
      notes: 'VIP customer, prefers Rahim for haircuts.',
      tags: ['vip', 'frequent'],
      loyalty: {
        points: 450,
        tier: 'gold',
        totalEarned: 800,
        totalRedeemed: 350,
      },
      deletedAt: null,
      createdAt: new Date(Date.now() - 60 * 86400000),
      updatedAt: new Date(),
    },
    {
      _id: custTanvirId,
      tenantId,
      firstName: 'Tanvir',
      lastName: 'Hasan',
      phone: '+8801811000002',
      email: 'tanvir@example.com',
      notes: 'Likes afternoon appointments',
      tags: ['regular'],
      loyalty: {
        points: 120,
        tier: 'silver',
        totalEarned: 120,
        totalRedeemed: 0,
      },
      deletedAt: null,
      createdAt: new Date(Date.now() - 30 * 86400000),
      updatedAt: new Date(),
    },
    {
      _id: custAyeshaId,
      tenantId,
      firstName: 'Ayesha',
      lastName: 'Siddiqua',
      phone: '+8801911000003',
      email: 'ayesha@example.com',
      notes: '',
      tags: ['new'],
      loyalty: {
        points: 50,
        tier: 'bronze',
        totalEarned: 50,
        totalRedeemed: 0,
      },
      deletedAt: null,
      createdAt: new Date(Date.now() - 5 * 86400000),
      updatedAt: new Date(),
    },
  ]);

  console.log('Seeding Appointments...');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(11, 0, 0, 0);

  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setMinutes(tomorrowEnd.getMinutes() + 45);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(15, 0, 0, 0);
  const yesterdayEnd = new Date(yesterday);
  yesterdayEnd.setMinutes(yesterdayEnd.getMinutes() + 60);

  await db.collection('appointments').insertMany([
    {
      tenantId,
      branchId: dhanmondiBranchId,
      customerId: custNusratId,
      status: 'confirmed',
      source: 'online',
      depositAmount: { amount: 50000, currency: 'BDT' },
      lines: [
        {
          serviceId: svcHaircutId,
          staffId: stylist1UserId,
          resourceId: chair1Id,
          start: tomorrow,
          end: tomorrowEnd,
        },
      ],
      notes: 'Upcoming appointment booked online',
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      tenantId,
      branchId: dhanmondiBranchId,
      customerId: custTanvirId,
      status: 'completed',
      source: 'walk_in',
      depositAmount: { amount: 0, currency: 'BDT' },
      lines: [
        {
          serviceId: svcFacialId,
          staffId: stylist2UserId,
          resourceId: facialRoomId,
          start: yesterday,
          end: yesterdayEnd,
        },
      ],
      notes: 'Deluxe facial completed smoothly',
      deletedAt: null,
      createdAt: yesterday,
      updatedAt: yesterday,
    },
  ]);

  console.log('Seeding Sales & Invoices...');
  await db.collection('sales').insertMany([
    {
      tenantId,
      branchId: dhanmondiBranchId,
      invoiceNumber: 'INV-2026-0001',
      customerId: custNusratId,
      status: 'completed',
      lines: [
        {
          kind: 'service',
          serviceId: svcHaircutId,
          staffId: stylist1UserId,
          name: 'Signature Haircut & Blowdry',
          quantity: 1,
          unitPriceMinor: 120000,
          subtotalMinor: 120000,
          discountMinor: 0,
          taxMinor: 6000, // 5%
          totalMinor: 126000,
        },
        {
          kind: 'product',
          productId: prodOilId,
          name: 'Moroccan Argan Hair Serum 100ml',
          quantity: 1,
          unitPriceMinor: 250000,
          subtotalMinor: 250000,
          discountMinor: 0,
          taxMinor: 12500,
          totalMinor: 262500,
        },
      ],
      subtotalMinor: 370000,
      discountMinor: 0,
      taxMinor: 18500,
      tipMinor: 10000,
      totalMinor: 398500,
      paidMinor: 398500,
      dueMinor: 0,
      payments: [
        {
          method: 'bkash',
          amountMinor: 398500,
          reference: 'TRX-BKASH-88129',
          paidAt: new Date(Date.now() - 86400000),
        },
      ],
      createdAt: new Date(Date.now() - 86400000),
      updatedAt: new Date(Date.now() - 86400000),
    },
    {
      tenantId,
      branchId: dhanmondiBranchId,
      invoiceNumber: 'INV-2026-0002',
      customerId: custTanvirId,
      status: 'completed',
      lines: [
        {
          kind: 'service',
          serviceId: svcFacialId,
          staffId: stylist2UserId,
          name: 'Organic Deluxe Glow Facial',
          quantity: 1,
          unitPriceMinor: 350000,
          subtotalMinor: 350000,
          discountMinor: 0,
          taxMinor: 17500,
          totalMinor: 367500,
        },
      ],
      subtotalMinor: 350000,
      discountMinor: 0,
      taxMinor: 17500,
      tipMinor: 20000,
      totalMinor: 387500,
      paidMinor: 387500,
      dueMinor: 0,
      payments: [
        {
          method: 'card',
          amountMinor: 387500,
          reference: 'POS-VISA-9912',
          paidAt: new Date(Date.now() - 40000000),
        },
      ],
      createdAt: new Date(Date.now() - 40000000),
      updatedAt: new Date(Date.now() - 40000000),
    },
  ]);

  console.log('Seeding Gift Cards & Coupons...');
  await db.collection('gift_cards').insertMany([
    {
      tenantId,
      code: 'BLOOM-GIFT-5000',
      initialBalanceMinor: 500000, // 5,000 BDT
      currentBalanceMinor: 500000,
      status: 'active',
      recipientPhone: '+8801711000001',
      recipientName: 'Nusrat Jahan',
      expiresAt: new Date('2027-12-31'),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      tenantId,
      code: 'SUMMER-SPECIAL-2000',
      initialBalanceMinor: 200000,
      currentBalanceMinor: 150000,
      status: 'active',
      recipientPhone: '+8801811000002',
      recipientName: 'Tanvir Hasan',
      expiresAt: new Date('2027-06-30'),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  await db.collection('coupons').insertMany([
    {
      tenantId,
      code: 'EID20',
      type: 'percentage',
      value: 2000, // 20%
      minSpendMinor: 200000, // Min 2,000 BDT
      maxDiscountMinor: 100000, // Max 1,000 BDT discount
      usageLimit: 500,
      usageCount: 42,
      active: true,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2027-01-01'),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      tenantId,
      code: 'FLAT500',
      type: 'fixed',
      value: 50000, // 500 BDT
      minSpendMinor: 150000,
      usageLimit: 1000,
      usageCount: 110,
      active: true,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2027-01-01'),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  console.log('Seeding Subscription Plans & Memberships...');
  const planVipId = new Types.ObjectId();
  await db.collection('subscription_plans').insertOne({
    _id: planVipId,
    tenantId,
    name: 'VIP Beauty Club',
    description: 'Unlimited priority bookings, 2 free blowouts/month, 15% product discounts',
    cadence: 'monthly',
    priceMinor: 250000, // 2,500 BDT / month
    benefits: [
      { type: 'service_discount', percentage: 15 },
      { type: 'product_discount', percentage: 15 },
    ],
    active: true,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.collection('customer_subscriptions').insertOne({
    tenantId,
    customerId: custNusratId,
    planId: planVipId,
    status: 'active',
    currentPeriodStart: new Date(Date.now() - 10 * 86400000),
    currentPeriodEnd: new Date(Date.now() + 20 * 86400000),
    autoRenew: true,
    paymentMethod: 'bkash',
    createdAt: new Date(Date.now() - 10 * 86400000),
    updatedAt: new Date(),
  });

  console.log('Seeding Attendance & Staff Earnings...');
  await db.collection('attendance_records').insertMany([
    {
      tenantId,
      branchId: dhanmondiBranchId,
      staffId: stylist1UserId,
      date: new Date().toISOString().slice(0, 10),
      clockIn: new Date(Date.now() - 7 * 3600000),
      clockOut: null,
      status: 'clocked_in',
      breaks: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      tenantId,
      branchId: dhanmondiBranchId,
      staffId: stylist2UserId,
      date: new Date().toISOString().slice(0, 10),
      clockIn: new Date(Date.now() - 6 * 3600000),
      clockOut: null,
      status: 'clocked_in',
      breaks: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  console.log('Seeding Daily Rollups for Enterprise Reports...');
  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  await db.collection('daily_rollups').insertMany([
    {
      tenantId,
      branchId: dhanmondiBranchId,
      date: todayStr,
      metrics: {
        grossSalesMinor: 387500,
        netSalesMinor: 350000,
        taxMinor: 17500,
        discountMinor: 0,
        tipMinor: 20000,
        salesCount: 1,
        averageOrderValueMinor: 387500,
        appointmentsBooked: 2,
        appointmentsCompleted: 1,
        appointmentsCancelled: 0,
        appointmentsNoShow: 0,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      tenantId,
      branchId: dhanmondiBranchId,
      date: yesterdayStr,
      metrics: {
        grossSalesMinor: 398500,
        netSalesMinor: 370000,
        taxMinor: 18500,
        discountMinor: 0,
        tipMinor: 10000,
        salesCount: 1,
        averageOrderValueMinor: 398500,
        appointmentsBooked: 1,
        appointmentsCompleted: 1,
        appointmentsCancelled: 0,
        appointmentsNoShow: 0,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  console.log('SUCCESS: Full browser test dataset successfully seeded!');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
